const { Op } = require('sequelize');
const { Conto, ContoSaldoStorico, sequelize } = require('../models');
const { getLicenzaLimiti, esente, limiteError } = require('../utils/licenzaLimiti');

// Normalizza il payload in arrivo dal client: l'API pubblica usa il nome
// "modalita_pagamento" (array), che qui rinominiamo verso l'attributo interno
// "modalita" (vedi commento nel modello sul perché non condividono lo stesso
// nome). Sempre normalizzato ad array o null, mai stringa singola o array
// vuoto. I campi numerici/data del saldo iniziale accettano stringa vuota dal
// form e vanno convertiti in null.
function sanitize(payload) {
    const cleaned = { ...payload };
    if ('modalita_pagamento' in cleaned) {
        const m = cleaned.modalita_pagamento;
        delete cleaned.modalita_pagamento;
        if (!m) {
            cleaned.modalita = null;
        } else if (!Array.isArray(m)) {
            cleaned.modalita = [m];
        } else if (m.length === 0) {
            cleaned.modalita = null;
        } else {
            cleaned.modalita = m;
        }
    }
    if (cleaned.saldo_iniziale === '') cleaned.saldo_iniziale = null;
    if (cleaned.saldo_iniziale_data === '') cleaned.saldo_iniziale_data = null;
    return cleaned;
}

// Ricostruisce il nome pubblico "modalita_pagamento" a partire dall'attributo
// interno "modalita", con fallback sul valore legacy a singolo elemento per i
// conti creati prima dell'introduzione delle modalità multiple e non ancora
// risalvati col nuovo campo.
function toPublicJson(conto) {
    const plain = conto.toJSON();
    const { modalita, modalita_pagamento_legacy, ...rest } = plain;
    rest.modalita_pagamento = (modalita && modalita.length > 0)
        ? modalita
        : (modalita_pagamento_legacy ? [modalita_pagamento_legacy] : null);
    return rest;
}

exports.getAll = async (req, res) => {
    try {
        const conti = await Conto.findAll();
        res.json(conti.map(toPublicJson));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.getBySocieta = async (req, res) => {
    try {
        const societa_id = req.query.societa_id;
        const where = {};
        if (societa_id) where.societa_id = societa_id;
        const conti = await Conto.findAll({ where });
        res.json(conti.map(toPublicJson));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const data = sanitize(req.body);
        if (!esente(req)) {
            const ctx = await getLicenzaLimiti(data.societa_id);
            const max = ctx?.limiti?.max_conti;
            if (max != null && await Conto.count({ where: { societa_id: data.societa_id } }) >= max) {
                return limiteError(res, `Il piano ${ctx.piano_nome} consente al massimo ${max} conti. Per aggiungerne altri passa a un piano superiore.`);
            }
        }
        const record = await Conto.create(data);
        res.status(201).json(toPublicJson(record));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// ─── Saldo iniziale ──────────────────────────────────────────────────────────
// Lo modificano gli amministratori della società (admin) e il superuser; ogni modifica
// effettiva finisce in conto_saldo_storico con valori prima/dopo e autore. Se il saldo
// non è mai stato impostato (importo 0 e nessuna data) può inserirlo chiunque.
const AMMINISTRATORI = ['admin', 'superuser'];

const saldoImpostato = (c) => c.saldo_iniziale_data != null || (c.saldo_iniziale != null && Number(c.saldo_iniziale) !== 0);

// L'utente può operare sui conti di questa società? (superuser ovunque, gli altri sulle proprie)
function societaConsentita(user, societaId) {
    if (user?.role === 'superuser') return true;
    const ids = [...(Array.isArray(user?.societaIds) ? user.societaIds : []), user?.societaId].filter(v => v != null).map(String);
    return ids.includes(String(societaId));
}

function puoModificareSaldo(user, conto) {
    return !saldoImpostato(conto) || AMMINISTRATORI.includes(user?.role);
}

// Applica saldo e data al conto e registra la modifica (se i valori cambiano davvero)
async function applicaSaldo(conto, { saldo_iniziale, saldo_iniziale_data }, user, origine, transaction) {
    const nuovoSaldo = saldo_iniziale === '' || saldo_iniziale == null ? 0 : Number(saldo_iniziale);
    const nuovaData = saldo_iniziale_data || null;
    const vecchioSaldo = conto.saldo_iniziale == null ? 0 : Number(conto.saldo_iniziale);
    const vecchiaData = conto.saldo_iniziale_data || null;
    if (Math.abs(nuovoSaldo - vecchioSaldo) < 0.005 && nuovaData === vecchiaData) return false;
    await conto.update({ saldo_iniziale: nuovoSaldo, saldo_iniziale_data: nuovaData }, { transaction });
    await ContoSaldoStorico.create({
        conto_id: conto.id, societa_id: conto.societa_id,
        saldo_precedente: vecchioSaldo, data_precedente: vecchiaData,
        saldo_nuovo: nuovoSaldo, data_nuova: nuovaData,
        utente_id: user?.id ?? null, utente_email: user?.email ?? null, utente_ruolo: user?.role ?? null,
        origine,
    }, { transaction });
    return true;
}

// PUT /conti/:id/saldo  { saldo_iniziale, saldo_iniziale_data }  (Prima Nota)
exports.updateSaldo = async (req, res) => {
    try {
        const conto = await Conto.findByPk(req.params.id);
        if (!conto) return res.status(404).json({ error: 'Conto non trovato' });
        if (!societaConsentita(req.user, conto.societa_id)) return res.sendStatus(403);
        if (!puoModificareSaldo(req.user, conto)) {
            return res.status(403).json({ error: 'Il saldo iniziale di un conto già impostato può essere modificato solo da un amministratore.' });
        }
        const saldo = req.body?.saldo_iniziale;
        if (saldo !== '' && saldo != null && isNaN(Number(String(saldo).replace(',', '.')))) {
            return res.status(400).json({ error: 'Saldo non valido' });
        }
        const dati = { saldo_iniziale: saldo == null || saldo === '' ? 0 : Number(String(saldo).replace(',', '.')), saldo_iniziale_data: req.body?.saldo_iniziale_data || null };
        await sequelize.transaction(t => applicaSaldo(conto, dati, req.user, req.body?.origine === 'conti' ? 'conti' : 'prima_nota', t));
        res.json(toPublicJson(conto));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// GET /conti/:id/saldo/storico → modifiche al saldo iniziale, dalla più recente
exports.storicoSaldo = async (req, res) => {
    try {
        const conto = await Conto.findByPk(req.params.id);
        if (!conto) return res.status(404).json({ error: 'Conto non trovato' });
        if (!societaConsentita(req.user, conto.societa_id)) return res.sendStatus(403);
        const righe = await ContoSaldoStorico.findAll({ where: { conto_id: conto.id }, order: [['createdAt', 'DESC']], limit: 100 });
        res.json(righe);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const id = req.params.id;
        const record = await Conto.findByPk(id);
        if (!record) return res.status(404).json({ error: 'Conto not found' });
        // Il flag predefinito si imposta solo tramite l'endpoint dedicato,
        // che garantisce l'unicità del conto predefinito per società.
        const { predefinito, ...payload } = req.body;
        const cleaned = sanitize(payload);
        // Saldo iniziale: stesse regole e stesso storico di PUT /conti/:id/saldo. Chi non può
        // modificarlo (saldo già impostato e utente non amministratore) se lo vede ignorato.
        const toccaSaldo = 'saldo_iniziale' in cleaned || 'saldo_iniziale_data' in cleaned;
        const saldo = toccaSaldo && puoModificareSaldo(req.user, record)
            ? { saldo_iniziale: 'saldo_iniziale' in cleaned ? cleaned.saldo_iniziale : record.saldo_iniziale, saldo_iniziale_data: 'saldo_iniziale_data' in cleaned ? cleaned.saldo_iniziale_data : record.saldo_iniziale_data }
            : null;
        delete cleaned.saldo_iniziale;
        delete cleaned.saldo_iniziale_data;
        await sequelize.transaction(async (t) => {
            await record.update(cleaned, { transaction: t });
            if (saldo) await applicaSaldo(record, saldo, req.user, 'conti', t);
        });
        res.json(toPublicJson(record));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Imposta il conto come predefinito per la sua società, azzerando il flag su tutti gli altri.
exports.setPredefinito = async (req, res) => {
    try {
        const id = req.params.id;
        const record = await Conto.findByPk(id);
        if (!record) return res.status(404).json({ error: 'Conto not found' });

        await sequelize.transaction(async (t) => {
            await Conto.update(
                { predefinito: false },
                { where: { societa_id: record.societa_id, id: { [Op.ne]: record.id } }, transaction: t }
            );
            await record.update({ predefinito: true }, { transaction: t });
        });

        res.json(toPublicJson(record));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const id = req.params.id;
        const record = await Conto.findByPk(id);
        if (!record) return res.status(404).json({ error: 'Conto not found' });
        await record.destroy();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};