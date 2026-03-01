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

module.exports = router;
