const jwt = require('jsonwebtoken');

const documentsUrl = () => process.env.DOCUMENTS_SERVICE_URL || 'http://documents_ms:3000';
const paymentsUrl = () => process.env.PAYMENTS_SERVICE_URL || 'http://payments_ms:3000';

// Token di servizio a vita brevissima per le chiamate verso gli altri microservizi
// quando non c'è un utente autenticato (es. registrazione pubblica).
function serviceAuthHeader() {
    const token = jwt.sign(
        { id: 0, role: 'superuser', service: 'users-service' },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '60s' }
    );
    return `Bearer ${token}`;
}

async function post(url, body, authorization) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authorization },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${url} ha risposto ${res.status}`);
}

// Dati di default di una nuova società: moduli base, conto CASSA, gruppi
// contabili (APS o ASD). Ogni passo è indipendente: un errore viene loggato
// senza bloccare gli altri né la creazione della società.
async function createSocietaDefaults(societa, authorization = serviceAuthHeader()) {
    const steps = [
        ['moduli di default', () => post(`${documentsUrl()}/api/moduli`, [
            { descrizione: 'MODULO ISCRIZIONE', testo: '', htmlContent: '', societa_id: societa.id },
            { descrizione: 'INFORMATIVA PRIVACY', testo: '', htmlContent: '', societa_id: societa.id },
        ], authorization)],
        ['conto CASSA', () => post(`${paymentsUrl()}/api/conti`, {
            descrizione: 'CASSA', modalita_pagamento: ['Contanti'], societa_id: societa.id,
        }, authorization)],
    ];
    if (societa.tipo_associazione === 'APS') {
        steps.push(['gruppi APS', () => post(`${paymentsUrl()}/api/gruppi/init-aps`, { societa_id: societa.id }, authorization)]);
    } else if (societa.tipo_associazione === 'ASD') {
        steps.push(['gruppi ASD', () => post(`${paymentsUrl()}/api/gruppi/init-asd`, { societa_id: societa.id }, authorization)]);
    }
    for (const [label, run] of steps) {
        try {
            await run();
        } catch (err) {
            console.error(`Errore creazione ${label} per la società ${societa.id}:`, err.message);
        }
    }
}

module.exports = { createSocietaDefaults, serviceAuthHeader };
