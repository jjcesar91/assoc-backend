const express = require('express');
const licenzeController = require('../controllers/licenzeController');
const requireSuperuser = require('../middleware/requireSuperuser');

const router = express.Router();

// Montato su /licenze dopo authenticateToken: solo superuser (Backoffice)
router.use(requireSuperuser);
router.get('/', licenzeController.list);
router.get('/:societaId', licenzeController.get);
router.put('/:societaId', licenzeController.update);

module.exports = router;
