const express = require('express');
const router = express.Router();
const socioController = require('../controllers/socioController');

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

module.exports = router;
