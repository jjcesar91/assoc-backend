const { Staff } = require('../models');
const { Op } = require('sequelize');

exports.getAll = async (req, res) => {
    try {
        const { societaId, cognome, attualmenteImpiegato } = req.query;
        if (!societaId) return res.status(400).json({ error: 'societaId richiesto' });

        const where = { societaId };
        if (cognome) where.cognome = { [Op.iLike]: `%${cognome}%` };
        if (attualmenteImpiegato !== undefined && attualmenteImpiegato !== '') {
            where.attualmenteImpiegato = attualmenteImpiegato === 'true';
        }

        const staff = await Staff.findAll({
            where,
            order: [['cognome', 'ASC'], ['nome', 'ASC']]
        });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const staff = await Staff.create(req.body);
        res.status(201).json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const [updated] = await Staff.update(req.body, { where: { id: req.params.id } });
        if (!updated) return res.status(404).json({ error: 'Staff non trovato' });
        const staff = await Staff.findByPk(req.params.id);
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.destroy = async (req, res) => {
    try {
        const deleted = await Staff.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ error: 'Staff non trovato' });
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.toggleImpiegato = async (req, res) => {
    try {
        const staff = await Staff.findByPk(req.params.id);
        if (!staff) return res.status(404).json({ error: 'Staff non trovato' });
        await staff.update({ attualmenteImpiegato: !staff.attualmenteImpiegato });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
