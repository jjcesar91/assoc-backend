const { Fornitore } = require('../models');

exports.getBySocieta = async (req, res) => {
    try {
        const { societa_id } = req.query;
        const where = {};
        if (societa_id) where.societa_id = societa_id;
        const records = await Fornitore.findAll({
            where,
            order: [['denominazione', 'ASC']],
        });
        res.json(records);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const record = await Fornitore.create(req.body);
        res.status(201).json(record);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const record = await Fornitore.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Fornitore not found' });
        await record.update(req.body);
        res.json(record);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const record = await Fornitore.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Fornitore not found' });
        await record.destroy();
        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};
