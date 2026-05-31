const express = require('express');
const router = express.Router();
const moduloRoutes = require('./moduloRoutes');
const authenticateToken = require('../middleware/auth');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'template-service' });
});

router.use(authenticateToken);
router.use('/moduli', moduloRoutes);

module.exports = router;
