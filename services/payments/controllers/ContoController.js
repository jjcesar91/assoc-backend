const { Op } = require('sequelize');
const { Conto, sequelize } = require('../models');

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
        const record = await Conto.create(sanitize(req.body));
        res.status(201).json(toPublicJson(record));
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
        await record.update(sanitize(payload));
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