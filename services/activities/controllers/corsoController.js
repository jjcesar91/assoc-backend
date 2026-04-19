const { Corso, Attivita, Struttura, Area, Staff, CorsoIscrizione, sequelize } = require('../models');

const INCLUDES = [
    { model: Attivita, as: 'attivita', attributes: ['id', 'descrizione', 'colore'] },
    { model: Struttura, as: 'struttura', attributes: ['id', 'descrizione'] },
    { model: Area, as: 'area', attributes: ['id', 'descrizione'] },
    { model: Staff, as: 'staff', attributes: ['id', 'nome', 'cognome'] },
];

exports.getAll = async (req, res) => {
    try {
        const { societaId } = req.query;
        if (!societaId) return res.status(400).json({ error: 'societaId richiesto' });

        const corsi = await Corso.findAll({
            where: { societaId },
            include: INCLUDES,
            order: [['oraInizio', 'ASC'], ['giorno', 'ASC']],
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

exports.create = async (req, res) => {
    try {
        const corso = await Corso.create(req.body);
        const full = await Corso.findByPk(corso.id, { include: INCLUDES });
        res.status(201).json(full);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const [updated] = await Corso.update(req.body, { where: { id: req.params.id } });
        if (!updated) return res.status(404).json({ error: 'Corso non trovato' });
        const corso = await Corso.findByPk(req.params.id, { include: INCLUDES });
        res.json(corso);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.destroy = async (req, res) => {
    try {
        const deleted = await Corso.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ error: 'Corso non trovato' });
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
