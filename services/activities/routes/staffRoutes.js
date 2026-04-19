const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

router.get('/', staffController.getAll);
router.post('/', staffController.create);
router.put('/:id', staffController.update);
router.delete('/:id', staffController.destroy);
router.patch('/:id/toggle-impiegato', staffController.toggleImpiegato);

module.exports = router;
