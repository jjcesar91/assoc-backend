const express = require('express');
const router = express.Router();
const corsoController = require('../controllers/corsoController');
const corsoIscrizioneController = require('../controllers/corsoIscrizioneController');

router.get('/', corsoController.getAll);
router.post('/', corsoController.create);
router.put('/:id', corsoController.update);
router.delete('/:id', corsoController.destroy);

// Iscritti al corso
router.get('/iscrizioni', corsoIscrizioneController.getAllBySocieta);
router.get('/:id/iscritti', corsoIscrizioneController.getIscritti);
router.post('/:id/iscritti', corsoIscrizioneController.addIscritto);
router.delete('/:id/iscritti/:socioId', corsoIscrizioneController.removeIscritto);

module.exports = router;
