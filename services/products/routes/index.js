const express = require('express');
const router = express.Router();
const productRoutes = require('./productRoutes');
const authenticateToken = require('../middleware/auth');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'products-service' });
});

router.use(authenticateToken);
router.use('/', productRoutes);

module.exports = router;
