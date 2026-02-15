const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticateToken = require('../middleware/auth');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'auth-service' });
});

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.get('/me', authenticateToken, authController.me);
router.put('/me', authenticateToken, authController.updateProfile);
router.put('/password', authenticateToken, authController.updatePassword);

module.exports = router;
