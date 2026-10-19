// Limitatore in memoria a finestra fissa (sufficiente per un singolo processo).
// key: identificativo del client; limit: richieste massime per finestra.
function createRateLimiter({ windowMs, limit }) {
    const hits = new Map(); // key → { count, resetAt }
    return function consume(key) {
        const now = Date.now();
        if (hits.size > 10000) {
            for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
        }
        const entry = hits.get(key);
        if (!entry || entry.resetAt <= now) {
            hits.set(key, { count: 1, resetAt: now + windowMs });
            return true;
        }
        entry.count += 1;
        return entry.count <= limit;
    };
}

// IP del visitatore dietro la catena di proxy: load balancer → Vite → nginx.
// Il load balancer scrive in X-Forwarded-For l'IP del client, Vite (xfwd) vi
// aggiunge quello del load balancer, nginx lo inoltra invariato. Gli ultimi
// TRUSTED_PROXY_HOPS indirizzi sono quindi della nostra infrastruttura e quello
// subito prima è il client reale; i valori più a sinistra possono essere stati
// inventati dal client e vengono ignorati.
function clientKey(req) {
    const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS || '1', 10);
    const xff = String(req.headers['x-forwarded-for'] || '')
        .split(',').map(s => s.trim()).filter(Boolean);
    if (xff.length > hops) return xff[xff.length - 1 - hops];
    if (xff.length) return xff[0];
    return req.headers['x-real-ip'] || req.ip || 'unknown';
}

module.exports = { createRateLimiter, clientKey };
