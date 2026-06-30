const express = require('express');
const router = express.Router();
const socioRoutes = require('./socioRoutes');
const societaRoutes = require('./societaRoutes');
const authenticateToken = require('../middleware/auth');
const requireInternal = require('../middleware/requireInternal');
const InternalController = require('../controllers/internalController');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'users-service' });
});

// --- Rotte interne (service-to-service, protette da secret) — PRIMA dell'auth utente ---
router.post('/internal/ricevuta-uploaded', requireInternal, InternalController.ricevutaUploaded);

router.use(authenticateToken);
router.use('/soci', socioRoutes);
router.use('/societa', societaRoutes);

module.exports = router;
