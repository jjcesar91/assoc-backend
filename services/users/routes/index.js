const express = require('express');
const router = express.Router();
const socioRoutes = require('./socioRoutes');
const societaRoutes = require('./societaRoutes');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'users-service' });
});

router.use('/soci', socioRoutes);
router.use('/societa', societaRoutes);

module.exports = router;
