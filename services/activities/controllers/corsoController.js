const { Corso, CorsoOrario, Attivita, Struttura, Area, Staff, CorsoIscrizione, sequelize } = require('../models');

const INCLUDES = [
    { model: Attivita, as: 'attivita', attributes: ['id', 'descrizione', 'colore'] },
    { model: Struttura, as: 'struttura', attributes: ['id', 'descrizione'] },
    { model: Area, as: 'area', attributes: ['id', 'descrizione'] },
    { model: Staff, as: 'staff', attributes: ['id', 'nome', 'cognome'] },
    { model: CorsoOrario, as: 'orari', attributes: ['id', 'giorno', 'oraInizio', 'durataMinuti'] },
];

const ORARI_ORDER = [
    [{ model: CorsoOrario, as: 'orari' }, 'giorno', 'ASC'],
    [{ model: CorsoOrario, as: 'orari' }, 'oraInizio', 'ASC'],
];

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
    const { orari: _ignored, id: _id, ...rest } = body;
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
            const deleted = await Corso.destroy({ where: { id: corsoId }, transaction: t });
            if (!deleted) throw new HttpError(404, 'Corso non trovato');
        });
        res.status(204).end();
    } catch (error) {
        sendError(res, error);
    }
};
