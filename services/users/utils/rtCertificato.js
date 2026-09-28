'use strict';
const crypto = require('crypto');

// Nome del cookie installato sul browser del cliente per una data società.
const cookieName = (societaId) => `rt_cert_${societaId}`;

// Confronto a tempo costante: la lunghezza/il tempo di risposta non deve rivelare
// nulla sul secret corretto.
const tokensMatch = (a, b) => {
    if (!a || !b) return false;
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

// Il browser ha il cookie-certificato installato e corrisponde a quello configurato
// per questa società. Se la società non ha ancora un certificato generato, l'accesso
// è sempre negato (default-deny).
const certificatoValido = (societa, cookieToken) => {
    if (!societa || !societa.ricevuta_telematica_certificato_secret) return false;
    return tokensMatch(cookieToken, societa.ricevuta_telematica_certificato_secret);
};

const COOKIE_MAX_AGE_MS = 10 * 365 * 24 * 60 * 60 * 1000; // ~10 anni

module.exports = { cookieName, tokensMatch, certificatoValido, COOKIE_MAX_AGE_MS };
