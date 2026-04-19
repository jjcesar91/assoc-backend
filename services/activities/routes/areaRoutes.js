const express = require('express');
const router = express.Router();
const areaController = require('../controllers/areaController');

router.put('/:id', areaController.update);
router.delete('/:id', areaController.destroy);

module.exports = router;
