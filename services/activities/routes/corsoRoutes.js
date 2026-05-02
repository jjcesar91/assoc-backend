const express = require('express');
const router = express.Router();
const corsoController = require('../controllers/corsoController');
const corsoIscrizioneController = require('../controllers/corsoIscrizioneController');
const presenzaController = require('../controllers/presenzaController');

router.get('/', corsoController.getAll);
router.post('/', corsoController.create);
router.put('/:id', corsoController.update);
router.delete('/:id', corsoController.destroy);

// Iscrizioni per socio
router.get('/socio/:socioId', corsoIscrizioneController.getBySocio);

// Iscritti al corso
router.get('/iscrizioni', corsoIscrizioneController.getAllBySocieta);
router.get('/:id/iscritti', corsoIscrizioneController.getIscritti);
router.post('/:id/iscritti', corsoIscrizioneController.addIscritto);
router.delete('/:id/iscritti/:socioId', corsoIscrizioneController.removeIscritto);

// Presenze
router.get('/:id/presenze/:data', presenzaController.getPresenza);
router.put('/:id/presenze/:data', presenzaController.savePresenza);

module.exports = router;
