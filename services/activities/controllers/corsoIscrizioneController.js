const { CorsoIscrizione, Corso } = require('../models');

// GET /api/corsi/iscrizioni?societaId=X  – tutte le iscrizioni dei corsi di una società
exports.getAllBySocieta = async (req, res) => {
    try {
        const { societaId } = req.query;
        if (!societaId) return res.status(400).json({ error: 'societaId richiesto' });
        const iscrizioni = await CorsoIscrizione.findAll({
            include: [{ model: Corso, as: 'corso', where: { societaId }, attributes: [] }],
            attributes: ['corsoId', 'socioId'],
            raw: true,
        });
        res.json(iscrizioni);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET /api/corsi/:id/iscritti
exports.getIscritti = async (req, res) => {
    try {
        const iscrizioni = await CorsoIscrizione.findAll({
            where: { corsoId: req.params.id },
            order: [['dataIscrizione', 'ASC']],
        });
        res.json(iscrizioni);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/corsi/:id/iscritti  { socioId }
exports.addIscritto = async (req, res) => {
    try {
        const { socioId, note } = req.body;
        if (!socioId) return res.status(400).json({ error: 'socioId richiesto' });

        const [iscrizione, created] = await CorsoIscrizione.findOrCreate({
            where: { corsoId: req.params.id, socioId },
            defaults: { dataIscrizione: new Date().toISOString().split('T')[0], note: note || null },
        });

        if (!created) {
            return res.status(409).json({ error: 'Socio già iscritto a questo corso' });
        }
        res.status(201).json(iscrizione);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// DELETE /api/corsi/:id/iscritti/:socioId
exports.removeIscritto = async (req, res) => {
    try {
        const deleted = await CorsoIscrizione.destroy({
            where: { corsoId: req.params.id, socioId: req.params.socioId },
        });
        if (!deleted) return res.status(404).json({ error: 'Iscrizione non trovata' });
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
