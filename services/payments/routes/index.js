const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');
const ContoController = require('../controllers/ContoController');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'template-service' });
});

router.get('/conti', ContoController.getBySocieta);
router.post('/conti', ContoController.create);
router.put('/conti/:id', ContoController.update);
router.delete('/conti/:id', ContoController.delete);

router.get('/next-numero', PaymentController.getNextNumero);
router.get('/', PaymentController.getAll);
router.post('/', PaymentController.create);
router.put('/:id', PaymentController.update);
router.delete('/:id', PaymentController.delete);
router.patch('/:id/annulla', PaymentController.annulla);

module.exports = router;
