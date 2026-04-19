const express = require('express');
const router = express.Router();
const strutturaController = require('../controllers/strutturaController');
const areaController = require('../controllers/areaController');

router.get('/', strutturaController.getAll);
router.post('/', strutturaController.create);
router.put('/:id', strutturaController.update);
router.delete('/:id', strutturaController.destroy);

// Aree nested
router.get('/:strutturaId/aree', areaController.getByStruttura);
router.post('/:strutturaId/aree', areaController.create);

module.exports = router;
