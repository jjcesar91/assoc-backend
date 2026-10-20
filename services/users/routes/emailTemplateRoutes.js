const express = require('express');
const emailTemplateController = require('../controllers/emailTemplateController');
const requireSuperuser = require('../middleware/requireSuperuser');

const router = express.Router();

// Montato su /email-template dopo authenticateToken: Backoffice → Email (solo superuser)
router.use(requireSuperuser);
router.get('/', emailTemplateController.list);
router.put('/:chiave', emailTemplateController.update);
router.post('/:chiave/anteprima', emailTemplateController.anteprima);

module.exports = router;
