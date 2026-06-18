const express = require('express');
const router = express.Router();
const socioController = require('../controllers/socioController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = '/app/uploads/storico';
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (_) {}

const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, unique + path.extname(file.originalname));
    },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Routes for /api/soci
router.post('/check-email', socioController.checkEmail);
router.post('/', socioController.createSocio);
router.get('/', socioController.getAllSoci);
router.get('/:id', socioController.getSocioById);
router.put('/:id', socioController.updateSocio);
router.delete('/:id', socioController.deleteSocio);
router.post('/:id/comunicazioni', socioController.createComunicazione);
router.get('/:id/comunicazioni', socioController.getComunicazioni);
router.post('/:id/iscrizione', socioController.createIscrizione);
router.get('/:id/iscrizione', socioController.getIscrizioni);
router.delete('/:id/iscrizione', socioController.deleteIscrizione);

router.get('/:id/contatti', socioController.getContatti);
router.post('/:id/contatti', socioController.createContatto);
router.put('/:id/contatti/:contattoId', socioController.updateContatto);
router.delete('/:id/contatti/:contattoId', socioController.deleteContatto);

router.get('/:id/storico', socioController.getStorico);
router.post('/:id/storico/nota', upload.single('allegato'), socioController.createNota);
router.post('/:id/storico', socioController.createStoricoEntry);
router.get('/:id/storico/:storiciId/allegato', socioController.downloadAllegato);

module.exports = router;
