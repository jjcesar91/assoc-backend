const crypto = require('crypto');
const { Societa } = require('../models');
const { cookieName, tokensMatch, COOKIE_MAX_AGE_MS } = require('../utils/rtCertificato');

// Gestisce il "certificato" (in realtà un secret installato come cookie sul
// browser del cliente) che protegge la pagina pubblica Ricevuta Telematica:
// vedi utils/rtCertificato.js per la verifica lato lettura/scrittura dati.
class CertificatoController {

    // Restituisce il token del certificato della società, generandolo alla prima
    // richiesta. Solo superuser: il super-admin lo scarica per installarlo dal
    // browser del cliente (pagina Configurazione).
    async getCertificato(req, res) {
        try {
            if (req.user?.role !== 'superuser') {
                return res.status(403).json({ message: 'Forbidden' });
            }
            const { id } = req.params;
            const societa = await Societa.findByPk(id);
            if (!societa) {
                return res.status(404).json({ message: 'Societa not found' });
            }

            if (!societa.ricevuta_telematica_certificato_secret) {
                societa.ricevuta_telematica_certificato_secret = crypto.randomBytes(32).toString('hex');
                await societa.save();
            }

            return res.status(200).json({ societaId: societa.id, token: societa.ricevuta_telematica_certificato_secret });
        } catch (error) {
            console.error('Error fetching certificato:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Rigenera il certificato: invalida quello già installato su qualsiasi browser
    // (va poi riscaricato e reinstallato). Solo superuser.
    async rigeneraCertificato(req, res) {
        try {
            if (req.user?.role !== 'superuser') {
                return res.status(403).json({ message: 'Forbidden' });
            }
            const { id } = req.params;
            const societa = await Societa.findByPk(id);
            if (!societa) {
                return res.status(404).json({ message: 'Societa not found' });
            }

            societa.ricevuta_telematica_certificato_secret = crypto.randomBytes(32).toString('hex');
            await societa.save();

            return res.status(200).json({ societaId: societa.id, token: societa.ricevuta_telematica_certificato_secret });
        } catch (error) {
            console.error('Error regenerating certificato:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Endpoint PUBBLICO raggiunto apreno il file "certificato-*.html" scaricato dalla
    // pagina Configurazione: se il token corrisponde a quello della società, installa
    // il cookie sul browser corrente e apre subito il form pubblico della società.
    async installaCertificato(req, res) {
        try {
            const { societaId, token } = req.query;
            const id = parseInt(societaId, 10);
            if (!Number.isInteger(id) || !token) {
                return res.status(400).send('Richiesta non valida.');
            }

            const societa = await Societa.findByPk(id, {
                attributes: ['id', 'ricevuta_telematica_certificato_secret'],
            });
            if (!societa || !tokensMatch(token, societa.ricevuta_telematica_certificato_secret)) {
                return res.status(403).send('Certificato non valido.');
            }

            res.cookie(cookieName(id), societa.ricevuta_telematica_certificato_secret, {
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                maxAge: COOKIE_MAX_AGE_MS,
                path: '/',
            });
            return res.redirect(`/ricevuta-telematica/${id}`);
        } catch (error) {
            console.error('Error installing certificato:', error);
            return res.status(500).send('Errore interno.');
        }
    }
}

module.exports = new CertificatoController();
