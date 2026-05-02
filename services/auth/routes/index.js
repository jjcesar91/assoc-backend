const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticateToken = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'auth-service' });
});

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.get('/me', authenticateToken, authController.me);
router.put('/me', authenticateToken, authController.updateProfile);
router.put('/password', authenticateToken, authController.updatePassword);

// Admin – gestione utenti (solo role=admin)
router.get('/admin/users', authenticateToken, requireAdmin, authController.adminListUsers);
router.post('/admin/users', authenticateToken, requireAdmin, authController.adminCreateUser);
router.put('/admin/users/:id', authenticateToken, requireAdmin, authController.adminUpdateUser);
router.patch('/admin/users/:id/toggle-attivo', authenticateToken, requireAdmin, authController.adminToggleAttivo);
router.delete('/admin/users/:id', authenticateToken, requireAdmin, authController.adminDeleteUser);
router.post('/admin/users/:id/impersonate', authenticateToken, requireAdmin, authController.adminImpersonate);
router.get('/admin/users/:id/features', authenticateToken, requireAdmin, authController.adminGetUserFeatures);
router.put('/admin/users/:id/features', authenticateToken, requireAdmin, authController.adminSetUserFeatures);

// Accesso frontend soci (solo admin)
router.post('/socio-access', authenticateToken, requireAdmin, authController.createSocioAccess);
router.delete('/socio-access/:socio_ref_id', authenticateToken, requireAdmin, authController.deleteSocioAccess);
router.post('/socio-access/:socio_ref_id/reset-password', authenticateToken, requireAdmin, authController.resetSocioPassword);

module.exports = router;
