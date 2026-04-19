const express = require('express');
const router = express.Router();
const attivitaController = require('../controllers/attivitaController');

router.get('/', attivitaController.getAll);
router.post('/', attivitaController.create);
router.put('/:id', attivitaController.update);
router.delete('/:id', attivitaController.destroy);

module.exports = router;
