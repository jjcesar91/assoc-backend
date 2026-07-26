const express = require('express');
const router = express.Router();
const AutomazioneController = require('../controllers/automazioneController');

router.get('/config', AutomazioneController.getConfig);
router.put('/config', AutomazioneController.updateConfig);
router.get('/log', AutomazioneController.getLog);
router.post('/run', AutomazioneController.runNow);

module.exports = router;
