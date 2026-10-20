const models = require('../models');
const { inviaEmail, valoriLicenza, appUrl } = require('./emailTemplates');

// Email "Attivazione licenza": agli amministratori quando la licenza passa da
// "in attesa" ad "attiva", con piano e link personale per impostare la password.
// Testo configurabile in Backoffice → Email (attivazione); la copia in CCN non
// contiene il link (chi lo ricevesse potrebbe impostare la password al posto del cliente).

const authUrl = () => process.env.AUTH_SERVICE_URL || 'http://auth_ms:3000';
const internalHeaders = () => ({
    'Content-Type': 'application/json',
    'x-internal-secret': process.env.INTERNAL_API_SECRET || 'internal_secret_change_me',
});

// Genera i link (servizio auth) e invia un'email a ogni amministratore della licenza.
// → { inviate: [email], errori: [{ email, errore }], copia }
async function inviaEmailAttivazione({ licenza, origin }) {
    const res = await fetch(`${authUrl()}/api/internal/licenze/${licenza.id}/link-attivazione`, {
        method: 'POST',
        headers: internalHeaders(),
    });
    if (!res.ok) throw new Error(`auth-service ha risposto ${res.status}`);
    const amministratori = await res.json();
    const url = appUrl(origin);
    const esito = { inviate: [], errori: [], copia: null };
    for (const a of amministratori) {
        const link = `${url}reset-password#t=${encodeURIComponent(a.token)}`;
        try {
            const r = await inviaEmail(models, 'attivazione', {
                to: a.email,
                valori: valoriLicenza(licenza, {
                    nome: [a.nome, a.cognome].filter(Boolean).join(' '),
                    email: a.email, origin, link, scadenza: a.expiresAt,
                }),
            });
            esito.inviate.push(a.email);
            if (r.copia) esito.copia = r.copia;
        } catch (err) {
            console.error(`[licenze] email di attivazione a ${a.email} fallita:`, err.message);
            esito.errori.push({ email: a.email, errore: err.message });
        }
    }
    return esito;
}

module.exports = { inviaEmailAttivazione };
