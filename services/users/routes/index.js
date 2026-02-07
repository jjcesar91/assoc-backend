const express = require('express');
const router = express.Router();
const socioRoutes = require('./socioRoutes');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'users-service' });
});

router.use('/soci', socioRoutes);

module.exports = router;
