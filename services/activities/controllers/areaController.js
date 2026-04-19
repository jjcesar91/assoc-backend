const { Area } = require('../models');
const { Op } = require('sequelize');

exports.getByStruttura = async (req, res) => {
    try {
        const { strutturaId } = req.params;
        const { descrizione } = req.query;

        const where = { strutturaId };
        if (descrizione) where.descrizione = { [Op.iLike]: `%${descrizione}%` };

        const aree = await Area.findAll({ where, order: [['descrizione', 'ASC']] });
        res.json(aree);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const area = await Area.create({ ...req.body, strutturaId: req.params.strutturaId });
        res.status(201).json(area);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const [updated] = await Area.update(req.body, { where: { id: req.params.id } });
        if (!updated) return res.status(404).json({ error: 'Area non trovata' });
        const area = await Area.findByPk(req.params.id);
        res.json(area);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.destroy = async (req, res) => {
    try {
        const deleted = await Area.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ error: 'Area non trovata' });
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
