const express = require('express');
const router = express.Router();
const moduloController = require('../controllers/moduloController');

router.post('/', moduloController.create);
router.get('/', moduloController.getAll);
router.get('/:id', moduloController.getById);
router.put('/:id', moduloController.update);
router.delete('/:id', moduloController.delete);

module.exports = router;
