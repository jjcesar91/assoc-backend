const { Op } = require('sequelize');
const { Conto, sequelize } = require('../models');

exports.getAll = async (req, res) => {
    try {
        const conti = await Conto.findAll();
        res.json(conti);
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
        res.json(conti);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const payload = req.body;
        const record = await Conto.create(payload);
        res.status(201).json(record);
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
        await record.update(payload);
        res.json(record);
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

        res.json(record);
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