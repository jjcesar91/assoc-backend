const { Presenza } = require('../models');

// GET /api/corsi/:id/presenze/:data
exports.getPresenza = async (req, res) => {
    try {
        const presenza = await Presenza.findOne({
            where: { corsoId: req.params.id, data: req.params.data },
        });
        if (!presenza) return res.status(404).json(null);
        res.json(presenza);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// PUT /api/corsi/:id/presenze/:data  { presentiIds, savedByName }
exports.savePresenza = async (req, res) => {
    try {
        const { presentiIds, savedByName } = req.body;
        const corsoId = parseInt(req.params.id, 10);
        const data = req.params.data;

        let presenza = await Presenza.findOne({ where: { corsoId, data } });
        if (presenza) {
            await presenza.update({ presentiIds: presentiIds || [], savedAt: new Date(), savedByName: savedByName || null });
        } else {
            presenza = await Presenza.create({
                corsoId,
                data,
                presentiIds: presentiIds || [],
                savedAt: new Date(),
                savedByName: savedByName || null,
            });
        }
        res.json(presenza);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
