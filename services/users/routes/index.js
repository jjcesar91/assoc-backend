const express = require('express');
const router = express.Router();
const socioRoutes = require('./socioRoutes');
const societaRoutes = require('./societaRoutes');
const automazioneRoutes = require('./automazioneRoutes');
const piattaformaRoutes = require('./piattaformaRoutes');
const licenzeRoutes = require('./licenzeRoutes');
const piattaformaController = require('../controllers/piattaformaController');
const licenzeController = require('../controllers/licenzeController');
const registrazioneController = require('../controllers/registrazioneController');
const authenticateToken = require('../middleware/auth');
const requireInternal = require('../middleware/requireInternal');
const InternalController = require('../controllers/internalController');
const societaController = require('../controllers/societaController');
const socioController = require('../controllers/socioController');
const certificatoController = require('../controllers/certificatoController');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'users-service' });
});

// --- Rotte interne (service-to-service, protette da secret) — PRIMA dell'auth utente ---
router.post('/internal/ricevuta-uploaded', requireInternal, InternalController.ricevutaUploaded);
router.get('/internal/licenze-stato', requireInternal, licenzeController.internalStato);
router.get('/internal/societa-licenze', requireInternal, licenzeController.internalSocietaLicenze);
router.get('/internal/licenza-limiti', requireInternal, licenzeController.internalLimiti);

// --- Rotte PUBBLICHE (senza autenticazione) — pagina /ricevuta-telematica/:societaId ---
// Devono stare PRIMA di router.use(authenticateToken).
router.get('/public/societa/:id', societaController.getSocietaPubblica);
router.get('/public/soci', socioController.lookupPublicSocio);
router.post('/public/soci', socioController.getOrCreatePublicSocio);
// Installa sul browser corrente il cookie-certificato (aperto dal file scaricato in Configurazione).
router.get('/public/rt-certificato/installa', certificatoController.installaCertificato);
// Personalizzazione dell'ambiente (nome, colori, logo): serve già alla pagina di login.
router.get('/public/piattaforma', piattaformaController.getPublic);
// Registrazione dal sito: licenza Free in attesa + prima società + amministratore
router.get('/public/registrazione/sessione', registrazioneController.sessione);
router.post('/public/registrazione', registrazioneController.registra);

router.use(authenticateToken);
router.use('/soci', socioRoutes);
router.use('/societa', societaRoutes);
router.use('/automazioni', automazioneRoutes);
router.use('/piattaforma', piattaformaRoutes); // solo superuser
router.use('/licenze', licenzeRoutes); // solo superuser
// Piano e limiti della licenza della società corrente (tutti gli utenti autenticati)
router.get('/licenza-corrente', licenzeController.corrente);

module.exports = router;
