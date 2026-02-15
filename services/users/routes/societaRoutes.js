const express = require('express');
const router = express.Router();
const societaController = require('../controllers/societaController');

// Routes for /api/societa
router.get('/', societaController.getAllSocieta);
router.post('/', societaController.createSocieta);
router.get('/:id', societaController.getSocietaById);
router.put('/:id', societaController.updateSocieta);
// Additional routes like PUT/DELETE can be added later

module.exports = router;
