const express = require('express');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');
const ContoController = require('../controllers/ContoController');
const GruppoController = require('../controllers/GruppoController');
const FornitoreController = require('../controllers/FornitoreController');
const RicevutaController = require('../controllers/RicevutaController');
const authenticateToken = require('../middleware/auth');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'template-service' });
});

// --- Upload ricevute (storage su disco, volume condiviso /app/uploads) ---
const ricevuteDir = '/app/uploads/ricevute';
try { fs.mkdirSync(ricevuteDir, { recursive: true }); } catch (_) {}

const ALLOWED_RICEVUTA_MIME = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'application/rtf',
    'text/rtf',
]);

const ricevutaStorage = multer.diskStorage({
    destination: ricevuteDir,
    filename: (req, file, cb) => {
        const path = require('path');
        const unique = `${req.params.token}-${Date.now()}`;
        cb(null, `ricevuta-${unique}${path.extname(file.originalname)}`);
    },
});

const uploadRicevuta = multer({
    storage: ricevutaStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = file.mimetype.startsWith('image/') || ALLOWED_RICEVUTA_MIME.has(file.mimetype);
        if (ok) return cb(null, true);
        cb(new Error('Formato file non supportato'));
    },
}).single('ricevuta');

// Wrapper per gestire gli errori di multer (size/formato) con risposta JSON pulita.
function handleRicevutaUpload(req, res, next) {
    uploadRicevuta(req, res, (err) => {
        if (err) {
            const msg = err.code === 'LIMIT_FILE_SIZE'
                ? 'Il file supera la dimensione massima di 10MB'
                : (err.message || 'Errore caricamento file');
            return res.status(400).json({ error: msg });
        }
        next();
    });
}

// --- ROTTE PUBBLICHE (senza autenticazione) ---
// Devono stare PRIMA di router.use(authenticateToken).
router.get('/public/ricevuta/:token', RicevutaController.getStatus);
router.get('/public/ricevuta/:token/file', RicevutaController.getFile);
router.post('/public/ricevuta/:token', handleRicevutaUpload, RicevutaController.upload);
router.put('/public/ricevuta/:token', handleRicevutaUpload, RicevutaController.reupload);

router.use(authenticateToken);

// Generazione token (autenticata) — chiamata all'invio della comunicazione proforma
router.post('/ricevuta-tokens', RicevutaController.createToken);

router.get('/conti', ContoController.getBySocieta);
router.post('/conti', ContoController.create);
router.put('/conti/:id', ContoController.update);
router.delete('/conti/:id', ContoController.delete);

router.get('/gruppi', GruppoController.getBySocieta);
router.post('/gruppi/init-aps', GruppoController.initAps);
router.post('/gruppi/init-asd', GruppoController.initAsd);
router.post('/gruppi', GruppoController.create);
router.put('/gruppi/:id', GruppoController.update);
router.delete('/gruppi/:id', GruppoController.delete);

router.get('/fornitori', FornitoreController.getBySocieta);
router.post('/fornitori', FornitoreController.create);
router.put('/fornitori/:id', FornitoreController.update);
router.delete('/fornitori/:id', FornitoreController.delete);

router.get('/next-numero', PaymentController.getNextNumero);
router.get('/', PaymentController.getAll);
router.post('/bulk', PaymentController.bulk);
router.post('/import-voci', PaymentController.importVoci);
router.post('/import-odoo-ordini', PaymentController.importOdooOrdini);
router.post('/', PaymentController.create);
router.put('/:id', PaymentController.update);
router.delete('/:id/proforma', PaymentController.deleteProforma);
router.delete('/:id', PaymentController.delete);
router.patch('/:id/annulla', PaymentController.annulla);
router.patch('/:id/converti-proforma', PaymentController.convertiProforma);

module.exports = router;
