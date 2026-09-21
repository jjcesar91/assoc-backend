const express = require('express');
const router = express.Router();
const productRoutes = require('./productRoutes');
const authenticateToken = require('../middleware/auth');
const productController = require('../controllers/productController');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'products-service' });
});

// --- Rotta PUBBLICA (senza autenticazione) — pagina /ricevuta-telematica/:societaId
// e creazione proforma dal servizio payments. Deve stare PRIMA di authenticateToken.
router.get('/public/:id', productController.getPublicProduct);

router.use(authenticateToken);
router.use('/', productRoutes);

module.exports = router;
