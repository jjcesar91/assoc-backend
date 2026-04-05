const { Conto } = require('../models');

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
        await record.update(req.body);
        res.json(record);
    } catch (error) {
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