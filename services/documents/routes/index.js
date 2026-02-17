const express = require('express');
const router = express.Router();
const moduloRoutes = require('./moduloRoutes');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'template-service' });
});

router.use('/moduli', moduloRoutes);

module.exports = router;
