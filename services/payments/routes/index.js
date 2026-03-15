const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'template-service' });
});

router.get('/', PaymentController.getAll);
router.post('/', PaymentController.create);
router.put('/:id', PaymentController.update);
router.delete('/:id', PaymentController.delete);

module.exports = router;
