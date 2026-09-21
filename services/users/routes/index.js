const express = require('express');
const router = express.Router();
const socioRoutes = require('./socioRoutes');
const societaRoutes = require('./societaRoutes');
const automazioneRoutes = require('./automazioneRoutes');
const authenticateToken = require('../middleware/auth');
const requireInternal = require('../middleware/requireInternal');
const InternalController = require('../controllers/internalController');
const societaController = require('../controllers/societaController');
const socioController = require('../controllers/socioController');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'users-service' });
});

// --- Rotte interne (service-to-service, protette da secret) — PRIMA dell'auth utente ---
router.post('/internal/ricevuta-uploaded', requireInternal, InternalController.ricevutaUploaded);

// --- Rotte PUBBLICHE (senza autenticazione) — pagina /ricevuta-telematica/:societaId ---
// Devono stare PRIMA di router.use(authenticateToken).
router.get('/public/societa/:id', societaController.getSocietaPubblica);
router.get('/public/soci', socioController.lookupPublicSocio);
router.post('/public/soci', socioController.getOrCreatePublicSocio);

router.use(authenticateToken);
router.use('/soci', socioRoutes);
router.use('/societa', societaRoutes);
router.use('/automazioni', automazioneRoutes);

module.exports = router;
