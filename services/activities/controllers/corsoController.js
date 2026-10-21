const { Corso, CorsoOrario, CorsoAbbonamento, Attivita, Struttura, Area, Staff, CorsoIscrizione, sequelize } = require('../models');

const INCLUDES = [
    { model: Attivita, as: 'attivita', attributes: ['id', 'descrizione', 'colore'] },
    { model: Struttura, as: 'struttura', attributes: ['id', 'descrizione'] },
    { model: Area, as: 'area', attributes: ['id', 'descrizione'] },
    { model: Staff, as: 'staff', attributes: ['id', 'nome', 'cognome'] },
    { model: CorsoOrario, as: 'orari', attributes: ['id', 'giorno', 'oraInizio', 'durataMinuti'] },
    { model: CorsoAbbonamento, as: 'abbonamentiLink', attributes: ['abbonamentoId'] },
];

const ORARI_ORDER = [
    [{ model: CorsoOrario, as: 'orari' }, 'giorno', 'ASC'],
    [{ model: CorsoOrario, as: 'orari' }, 'oraInizio', 'ASC'],
    [{ model: CorsoAbbonamento, as: 'abbonamentiLink' }, 'id', 'ASC'],
];

const toIds = (raw) => [...new Set((Array.isArray(raw) ? raw : [])
    .map(v => parseInt(v, 10))
    .filter(v => Number.isInteger(v) && v > 0))];

// Abbonamenti del corso dal body: `abbonamentoIds` (array) o il legacy `abbonamentoId`.
// undefined = non indicati (in modifica i collegamenti restano invariati).
const parseAbbonamenti = (body) => {
    if (Array.isArray(body.abbonamentoIds)) return toIds(body.abbonamentoIds);
    if (body.abbonamentoId !== undefined) return toIds([body.abbonamentoId]);
    return undefined;
};

// Sostituisce gli abbonamenti collegati al corso e allinea il mirror abbonamentoId
const salvaAbbonamenti = async (corsoId, societaId, abbonamentoIds, t) => {
    await CorsoAbbonamento.destroy({ where: { corsoId }, transaction: t });
    if (abbonamentoIds.length) {
        await CorsoAbbonamento.bulkCreate(
            abbonamentoIds.map(abbonamentoId => ({ corsoId, abbonamentoId, societaId })),
            { transaction: t }
        );
    }
    await Corso.update({ abbonamentoId: abbonamentoIds[0] ?? null }, { where: { id: corsoId }, transaction: t });
};

// Normalizza il campo `orari` del body in un array di {giorno, oraInizio, durataMinuti}.
// Se il body non contiene orari, ricade sui campi piatti legacy (giorno/oraInizio/durataMinuti).
const parseOrari = (body) => {
    const raw = Array.isArray(body.orari) && body.orari.length > 0
        ? body.orari
        : [{ giorno: body.giorno, oraInizio: body.oraInizio, durataMinuti: body.durataMinuti }];

    return raw
        .filter(o => o && o.oraInizio && o.giorno !== undefined && o.giorno !== null && o.giorno !== '')
        .map(o => ({
            giorno: parseInt(o.giorno, 10),
            oraInizio: String(o.oraInizio).slice(0, 5),
            durataMinuti: parseInt(o.durataMinuti, 10) || 50,
        }))
        .sort((a, b) => a.giorno - b.giorno || a.oraInizio.localeCompare(b.oraInizio));
};

// I campi piatti sul Corso restano allineati al primo orario (retrocompatibilità)
const buildCorsoPayload = (body, orari) => {
    const { orari: _ignored, id: _id, abbonamentoIds: _abb, abbonamentoId: _legacy, ...rest } = body;
    return { ...rest, giorno: orari[0].giorno, oraInizio: orari[0].oraInizio, durataMinuti: orari[0].durataMinuti };
};

exports.getAll = async (req, res) => {
    try {
        const { societaId } = req.query;
        if (!societaId) return res.status(400).json({ error: 'societaId richiesto' });

        const corsi = await Corso.findAll({
            where: { societaId },
            include: INCLUDES,
            order: [['oraInizio', 'ASC'], ['giorno', 'ASC'], ...ORARI_ORDER],
        });

        // Recupera il conteggio iscritti per ogni corso
        const corsiIds = corsi.map(c => c.id);
        let countMap = {};
        if (corsiIds.length > 0) {
            const counts = await CorsoIscrizione.findAll({
                where: { corsoId: corsiIds },
                attributes: ['corsoId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                group: ['corsoId'],
                raw: true,
            });
            counts.forEach(r => { countMap[r.corsoId] = parseInt(r.count, 10); });
        }

        const result = corsi.map(c => ({
            ...c.toJSON(),
            _iscrittiCount: countMap[c.id] ?? 0,
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Errore applicativo con status HTTP, usato per abortire una transazione managed
class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

const sendError = (res, error) => res
    .status(error.status || 500)
    .json({ error: error.message });

exports.create = async (req, res) => {
    try {
        const orari = parseOrari(req.body);
        if (orari.length === 0) throw new HttpError(400, 'Almeno un giorno/orario è richiesto');

        const corso = await sequelize.transaction(async (t) => {
            const created = await Corso.create(buildCorsoPayload(req.body, orari), { transaction: t });
            await CorsoOrario.bulkCreate(
                orari.map(o => ({ ...o, corsoId: created.id })),
                { transaction: t }
            );
            await salvaAbbonamenti(created.id, created.societaId, parseAbbonamenti(req.body) || [], t);
            return created;
        });

        const full = await Corso.findByPk(corso.id, { include: INCLUDES, order: ORARI_ORDER });
        res.status(201).json(full);
    } catch (error) {
        sendError(res, error);
    }
};

exports.update = async (req, res) => {
    try {
        const orari = parseOrari(req.body);
        if (orari.length === 0) throw new HttpError(400, 'Almeno un giorno/orario è richiesto');
        const corsoId = parseInt(req.params.id, 10);

        await sequelize.transaction(async (t) => {
            const [updated] = await Corso.update(
                buildCorsoPayload(req.body, orari),
                { where: { id: corsoId }, transaction: t }
            );
            if (!updated) throw new HttpError(404, 'Corso non trovato');

            const abbonamentoIds = parseAbbonamenti(req.body);
            if (abbonamentoIds !== undefined) {
                const { societaId } = await Corso.findByPk(corsoId, { attributes: ['societaId'], transaction: t });
                await salvaAbbonamenti(corsoId, societaId, abbonamentoIds, t);
            }

            // Sostituisce integralmente gli orari del corso
            await CorsoOrario.destroy({ where: { corsoId }, transaction: t });
            await CorsoOrario.bulkCreate(
                orari.map(o => ({ ...o, corsoId })),
                { transaction: t }
            );
        });

        const corso = await Corso.findByPk(corsoId, { include: INCLUDES, order: ORARI_ORDER });
        res.json(corso);
    } catch (error) {
        sendError(res, error);
    }
};

exports.destroy = async (req, res) => {
    try {
        const corsoId = parseInt(req.params.id, 10);
        await sequelize.transaction(async (t) => {
            await CorsoOrario.destroy({ where: { corsoId }, transaction: t });
            await CorsoAbbonamento.destroy({ where: { corsoId }, transaction: t });
            const deleted = await Corso.destroy({ where: { id: corsoId }, transaction: t });
            if (!deleted) throw new HttpError(404, 'Corso non trovato');
        });
        res.status(204).end();
    } catch (error) {
        sendError(res, error);
    }
};

// GET /api/corsi/abbonamenti/:abbonamentoId?societaId=X – corsi inclusi in un abbonamento
exports.getByAbbonamento = async (req, res) => {
    try {
        const { societaId } = req.query;
        if (!societaId) return res.status(400).json({ error: 'societaId richiesto' });
        const links = await CorsoAbbonamento.findAll({
            where: { abbonamentoId: req.params.abbonamentoId, societaId },
            attributes: ['corsoId'],
            order: [['id', 'ASC']],
        });
        res.json({ corsoIds: links.map(l => l.corsoId) });
    } catch (error) {
        sendError(res, error);
    }
};

// PUT /api/corsi/abbonamenti/:abbonamentoId  { societaId, corsoIds } – sostituisce i corsi
// inclusi nell'abbonamento (dalla scheda prodotto). corsoIds vuoto rimuove tutti i collegamenti.
exports.setByAbbonamento = async (req, res) => {
    try {
        const abbonamentoId = parseInt(req.params.abbonamentoId, 10);
        if (!Number.isInteger(abbonamentoId)) throw new HttpError(400, 'Abbonamento non valido');
        const corsoIds = toIds(req.body.corsoIds);
        const societaId = parseInt(req.body.societaId ?? req.query.societaId, 10);
        if (corsoIds.length && !Number.isInteger(societaId)) throw new HttpError(400, 'societaId richiesto');

        await sequelize.transaction(async (t) => {
            if (corsoIds.length) {
                const validi = await Corso.count({ where: { id: corsoIds, societaId }, transaction: t });
                if (validi !== corsoIds.length) throw new HttpError(400, 'Uno o più corsi non appartengono alla società');
            }
            const prima = await CorsoAbbonamento.findAll({ where: { abbonamentoId }, attributes: ['corsoId'], transaction: t });
            const toccati = [...new Set([...prima.map(l => l.corsoId), ...corsoIds])];

            await CorsoAbbonamento.destroy({ where: { abbonamentoId, corsoId: prima.map(l => l.corsoId).filter(id => !corsoIds.includes(id)) }, transaction: t });
            const esistenti = new Set(prima.map(l => l.corsoId));
            const nuovi = corsoIds.filter(id => !esistenti.has(id));
            if (nuovi.length) {
                await CorsoAbbonamento.bulkCreate(nuovi.map(corsoId => ({ corsoId, abbonamentoId, societaId })), { transaction: t });
            }

            // Mirror legacy: primo abbonamento collegato di ciascun corso toccato
            for (const corsoId of toccati) {
                const primo = await CorsoAbbonamento.findOne({ where: { corsoId }, order: [['id', 'ASC']], transaction: t });
                await Corso.update({ abbonamentoId: primo ? primo.abbonamentoId : null }, { where: { id: corsoId }, transaction: t });
            }
        });

        res.json({ corsoIds });
    } catch (error) {
        sendError(res, error);
    }
};
