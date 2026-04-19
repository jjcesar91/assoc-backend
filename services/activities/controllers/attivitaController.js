const { Attivita } = require('../models');
const { Op } = require('sequelize');

exports.getAll = async (req, res) => {
    try {
        const { societaId, descrizione } = req.query;
        if (!societaId) return res.status(400).json({ error: 'societaId richiesto' });

        const where = { societaId };
        if (descrizione) where.descrizione = { [Op.iLike]: `%${descrizione}%` };

        const attivita = await Attivita.findAll({
            where,
            order: [['descrizione', 'ASC']]
        });

        res.json(attivita);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const attivita = await Attivita.create(req.body);
        res.status(201).json(attivita);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const [updated] = await Attivita.update(req.body, { where: { id: req.params.id } });
        if (!updated) return res.status(404).json({ error: 'Attività non trovata' });
        const attivita = await Attivita.findByPk(req.params.id);
        res.json(attivita);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.destroy = async (req, res) => {
    try {
        const deleted = await Attivita.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ error: 'Attività non trovata' });
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
