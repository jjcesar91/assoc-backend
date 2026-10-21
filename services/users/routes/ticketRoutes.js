const express = require('express');
const ticketController = require('../controllers/ticketController');
const requireSuperuser = require('../middleware/requireSuperuser');

const router = express.Router();

// Montato su /tickets dopo authenticateToken.
// Backoffice → Ticket (solo superuser): prima delle rotte /:id del cliente
router.get('/backoffice', requireSuperuser, ticketController.backofficeList);
router.get('/backoffice/:id(\\d+)', requireSuperuser, ticketController.backofficeGet);
router.post('/backoffice/:id(\\d+)/messaggi', requireSuperuser, ticketController.backofficeRispondi);
router.patch('/backoffice/:id(\\d+)', requireSuperuser, ticketController.backofficeAggiorna);

// Assistenza (utenti del gestionale, società consentite dal token)
router.get('/', ticketController.list);
router.post('/', ticketController.create);
router.get('/:id(\\d+)', ticketController.get);
router.post('/:id(\\d+)/messaggi', ticketController.rispondi);
router.post('/:id(\\d+)/chiudi', ticketController.chiudi);

module.exports = router;
