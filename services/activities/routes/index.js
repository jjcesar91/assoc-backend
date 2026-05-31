const express = require('express');
const router = express.Router();
const strutturaRoutes = require('./strutturaRoutes');
const areaRoutes = require('./areaRoutes');
const staffRoutes = require('./staffRoutes');
const attivitaRoutes = require('./attivitaRoutes');
const corsoRoutes = require('./corsoRoutes');
const authenticateToken = require('../middleware/auth');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'activities-service' });
});

router.use(authenticateToken);
router.use('/strutture', strutturaRoutes);
router.use('/aree', areaRoutes);
router.use('/staff', staffRoutes);
router.use('/attivita', attivitaRoutes);
router.use('/corsi', corsoRoutes);

module.exports = router;
