const { Product } = require('../models');
const { normalizzaListino, campiDaListino } = require('../utils/listino');

const activitiesUrl = () => process.env.ACTIVITIES_SERVICE_URL || 'http://activities_ms:3000';

// Abbonamento: listino obbligatorio e valido; i campi legacy seguono il listino.
// Ritorna il messaggio d'errore o null.
function preparaAbbonamento(data) {
    if (data.type !== 'subscription') return null;
    const { listino, error } = normalizzaListino(data.listino);
    if (error) return error;
    Object.assign(data, { listino }, campiDaListino(listino));
    return null;
}

// Convert empty strings to null to avoid type errors on INTEGER/BOOLEAN fields
function sanitize(data) {
    const cleaned = { ...data };
    Object.keys(cleaned).forEach(key => {
        if (cleaned[key] === '') cleaned[key] = null;
    });
    return cleaned;
}

exports.createProduct = async (req, res) => {
    try {
        const data = sanitize(req.body);
        const errore = preparaAbbonamento(data);
        if (errore) return res.status(400).json({ error: errore });
        const product = await Product.create(data);
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllProducts = async (req, res) => {
    try {
        const { societaId, type } = req.query;
        const whereClause = {};
        if (societaId) whereClause.societaId = societaId;
        if (type) whereClause.type = type;
        const products = await Product.findAll({ where: whereClause });
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Versione PUBBLICA (nessuna autenticazione) di getProductById — usata dal
// servizio payments (creazione proforma) e dalla pagina pubblica
// /ricevuta-telematica/:societaId. Espone solo i campi necessari per calcolare
// il prezzo e descrivere la voce, mai dati gestionali (gruppoId, ecc.).
exports.getPublicProduct = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id, {
            attributes: ['id', 'societaId', 'type', 'description', 'basePrice', 'periodicity'],
        });
        if (product) {
            res.status(200).json(product);
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (product) {
            res.status(200).json(product);
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const data = sanitize(req.body);
        if (data.type === undefined) {
            const esistente = await Product.findByPk(req.params.id, { attributes: ['type'] });
            if (esistente) data.type = esistente.type;
        }
        if (data.type === 'subscription' && data.listino !== undefined) {
            const errore = preparaAbbonamento(data);
            if (errore) return res.status(400).json({ error: errore });
        }
        const [updated] = await Product.update(data, {
            where: { id: req.params.id }
        });
        if (updated) {
            const updatedProduct = await Product.findByPk(req.params.id);
            res.status(200).json(updatedProduct);
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const deleted = await Product.destroy({
            where: { id: req.params.id }
        });
        if (deleted) {
            // Abbonamento eliminato: via i collegamenti con i corsi (best effort)
            fetch(`${activitiesUrl()}/api/corsi/abbonamenti/${req.params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization || '' },
                body: JSON.stringify({ corsoIds: [] }),
            }).catch(err => console.error('Pulizia collegamenti corsi fallita:', err.message));
            res.status(204).send();
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
