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

// Client dietro i proxy (load balancer → Vite → nginx): primo indirizzo di
// X-Forwarded-For se presente, altrimenti X-Real-IP / IP della connessione.
function clientKey(req) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
    return req.headers['x-real-ip'] || req.ip || 'unknown';
}

module.exports = { createRateLimiter, clientKey };
