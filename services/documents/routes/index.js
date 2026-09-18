const express = require('express');
const router = express.Router();
const moduloRoutes = require('./moduloRoutes');
const authenticateToken = require('../middleware/auth');
const moduloController = require('../controllers/moduloController');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'template-service' });
});

// --- Rotta PUBBLICA (senza autenticazione) — pagina /ricevuta-telematica/:societaId ---
// Deve stare PRIMA di router.use(authenticateToken).
router.get('/public/moduli/effettivo', moduloController.getEffettivo);

router.use(authenticateToken);
router.use('/moduli', moduloRoutes);

module.exports = router;
