const { Struttura, Area } = require('../models');
const { Op } = require('sequelize');

exports.getAll = async (req, res) => {
    try {
        const { societaId, descrizione } = req.query;
        if (!societaId) return res.status(400).json({ error: 'societaId richiesto' });

        const where = { societaId };
        if (descrizione) where.descrizione = { [Op.iLike]: `%${descrizione}%` };

        const strutture = await Struttura.findAll({
            where,
            include: [{ model: Area, as: 'aree', attributes: ['id'] }],
            order: [['descrizione', 'ASC']]
        });

        const result = strutture.map(s => ({
            ...s.toJSON(),
            numAree: s.aree ? s.aree.length : 0
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const struttura = await Struttura.create(req.body);
        res.status(201).json(struttura);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const [updated] = await Struttura.update(req.body, { where: { id: req.params.id } });
        if (!updated) return res.status(404).json({ error: 'Struttura non trovata' });
        const struttura = await Struttura.findByPk(req.params.id);
        res.json(struttura);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.destroy = async (req, res) => {
    try {
        const deleted = await Struttura.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ error: 'Struttura non trovata' });
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
