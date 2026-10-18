// Limiti del piano della licenza di una società, letti dal servizio users
// (unica fonte di verità: users/utils/piani.js). Cache breve per non chiamare
// users a ogni richiesta. Se users non risponde i limiti NON vengono applicati:
// un guasto tecnico non deve bloccare l'operatività dei clienti.
const usersUrl = () => process.env.USERS_SERVICE_URL || 'http://users_ms:3000';
const CACHE_TTL_MS = 30 * 1000;
const cache = new Map(); // societaId → { ctx, at }

async function getLicenzaLimiti(societaId) {
    const id = parseInt(societaId, 10);
    if (!Number.isInteger(id)) return null;
    const hit = cache.get(id);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.ctx;
    try {
        const res = await fetch(`${usersUrl()}/api/internal/licenza-limiti?societaId=${id}`, {
            headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET || 'internal_secret_change_me' },
        });
        if (!res.ok) throw new Error(`users-service ha risposto ${res.status}`);
        const ctx = await res.json();
        cache.set(id, { ctx, at: Date.now() });
        return ctx;
    } catch (err) {
        console.error('Limiti licenza non disponibili:', err.message);
        return null;
    }
}

// I superuser (Backoffice, token di servizio) non sono soggetti ai limiti
const esente = (req) => req.user?.role === 'superuser';

function limiteError(res, messaggio) {
    return res.status(403).json({ error: messaggio, code: 'LIMITE_PIANO' });
}

module.exports = { getLicenzaLimiti, esente, limiteError };
