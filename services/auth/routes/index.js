const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticateToken = require('../middleware/auth');
const { requireAdmin, requireSuperuser } = require('../middleware/auth');
const requireInternal = require('../middleware/requireInternal');

router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'auth-service' });
});

// Interno (service-to-service): destinatari notifiche
router.get('/internal/admin-emails', requireInternal, authController.internalAdminEmails);
// Registrazione dal sito (chiamata dal servizio users)
router.post('/internal/registrazione-admin/verifica', requireInternal, authController.internalVerificaRegistrazione);
router.post('/internal/registrazione-admin', requireInternal, authController.internalRegistrazioneAdmin);

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
// Impostazione password tramite link monouso (pubblico: il token è nel body)
router.post('/password-reset/verify', authController.verifyPasswordReset);
router.post('/password-reset', authController.completePasswordReset);
router.get('/me', authenticateToken, authController.me);
router.put('/me', authenticateToken, authController.updateProfile);
router.post('/switch-societa', authenticateToken, authController.switchSocieta);
router.put('/password', authenticateToken, authController.updatePassword);
router.get('/wp-root-token', authenticateToken, authController.getWpRootAccessToken);

// Admin – gestione utenti (solo role=admin)
router.get('/admin/users', authenticateToken, requireAdmin, authController.adminListUsers);
router.post('/admin/users', authenticateToken, requireAdmin, authController.adminCreateUser);
router.put('/admin/users/:id', authenticateToken, requireAdmin, authController.adminUpdateUser);
router.patch('/admin/users/:id/toggle-attivo', authenticateToken, requireAdmin, authController.adminToggleAttivo);
router.get('/admin/users/:id/comunicazioni', authenticateToken, requireAdmin, authController.adminGetComunicazioni);
router.put('/admin/users/:id/comunicazioni', authenticateToken, requireAdmin, authController.adminSetComunicazioni);
router.delete('/admin/users/:id', authenticateToken, requireAdmin, authController.adminDeleteUser);
router.post('/admin/users/:id/impersonate', authenticateToken, requireAdmin, authController.adminImpersonate);
router.get('/admin/users/:id/features', authenticateToken, requireAdmin, authController.adminGetUserFeatures);

// Backoffice (solo superuser): onboarding amministratore e link reset password
router.post('/admin/onboarding-admin', authenticateToken, requireSuperuser, authController.adminOnboardAdmin);
router.post('/admin/users/:id/password-reset-link', authenticateToken, requireSuperuser, authController.adminCreatePasswordResetLink);
router.get('/admin/licenze/amministratori-conteggio', authenticateToken, requireSuperuser, authController.adminContaAmministratoriLicenze);
router.get('/admin/licenze/:licenzaId/amministratori', authenticateToken, requireSuperuser, authController.adminListAmministratoriLicenza);
router.post('/admin/licenze/:licenzaId/amministratori', authenticateToken, requireSuperuser, authController.adminAddAmministratoreLicenza);
router.delete('/admin/licenze/:licenzaId/amministratori', authenticateToken, requireSuperuser, authController.adminRemoveAmministratoreLicenza);
router.post('/admin/licenze/:licenzaId/provisioning', authenticateToken, requireSuperuser, authController.adminProvisioningSocietaLicenza);
router.put('/admin/users/:id/features', authenticateToken, requireAdmin, authController.adminSetUserFeatures);

// Accesso frontend soci (solo admin)
router.get('/socio-access/status', authenticateToken, requireAdmin, authController.getSocioAccessStatus);
router.post('/socio-access', authenticateToken, requireAdmin, authController.createSocioAccess);
router.delete('/socio-access/:socio_ref_id', authenticateToken, requireAdmin, authController.deleteSocioAccess);
router.post('/socio-access/:socio_ref_id/reset-password', authenticateToken, requireAdmin, authController.resetSocioPassword);

module.exports = router;
