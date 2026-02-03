const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'template-service' });
});

module.exports = router;
