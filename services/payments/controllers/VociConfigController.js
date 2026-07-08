const { PaymentVoceConfig } = require('../models');

// Tipi prodotto validi del sistema (una voce di pagamento per ognuno).
// Allineato all'enum di products (Product.type).
const QUOTE_TYPES = ['generic', 'subscription', 'quota_associativa', 'tesseramento'];

// GET /voci-config?societa_id=...
// Ritorna la configurazione salvata per la società (una riga per tipo prodotto).
exports.getBySocieta = async (req, res) => {
    try {
        const { societa_id } = req.query;
        if (!societa_id) return res.status(400).json({ error: 'societa_id obbligatorio' });
        const records = await PaymentVoceConfig.findAll({
            where: { societa_id },
            order: [['quote_type', 'ASC']],
        });
        res.json(records);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// PUT /voci-config
// Body: { societa_id, quote_type, gruppo_id }
// Upsert dell'assegnazione tipo prodotto → sottogruppo.
exports.upsert = async (req, res) => {
    try {
        const { societa_id, quote_type } = req.body;
        let { gruppo_id } = req.body;
        if (!societa_id) return res.status(400).json({ error: 'societa_id obbligatorio' });
        if (!QUOTE_TYPES.includes(quote_type)) {
            return res.status(400).json({ error: `quote_type non valido: ${quote_type}` });
        }
        if (gruppo_id === '' || gruppo_id === undefined) gruppo_id = null;

        const [record, created] = await PaymentVoceConfig.findOrCreate({
            where: { societa_id, quote_type },
            defaults: { societa_id, quote_type, gruppo_id },
        });
        if (!created) {
            await record.update({ gruppo_id });
        }
        res.status(created ? 201 : 200).json(record);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};
