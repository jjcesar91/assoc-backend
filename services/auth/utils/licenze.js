const { Op } = require('sequelize');

const usersUrl = () => process.env.USERS_SERVICE_URL || 'http://users_ms:3000';
const internalHeaders = () => ({ 'x-internal-secret': process.env.INTERNAL_API_SECRET || 'internal_secret_change_me' });

// Stato delle licenze per società, con una piccola cache: il login e il refresh
// non devono interrogare il servizio users a ogni richiesta.
const CACHE_TTL_MS = 15 * 1000;
const cache = new Map(); // societaId → { stato, at }

async function fetchStati(societaIds) {
    const now = Date.now();
    const missing = societaIds.filter(id => {
        const c = cache.get(id);
        return !c || now - c.at > CACHE_TTL_MS;
    });
    if (missing.length) {
        const res = await fetch(`${usersUrl()}/api/internal/licenze-stato?societaIds=${missing.join(',')}`, { headers: internalHeaders() });
        if (!res.ok) throw new Error(`users-service ha risposto ${res.status}`);
        const data = await res.json();
        missing.forEach(id => cache.set(id, { stato: data[id]?.stato || null, at: now }));
    }
    return Object.fromEntries(societaIds.map(id => [id, cache.get(id)?.stato || null]));
}

// Una società è accessibile dal gestionale solo se la sua licenza è attiva.
// Società senza licenza nota restano accessibili (nessun blocco per dati mancanti).
const isBloccato = (stato) => !!stato && stato !== 'attiva';

// Divide le società in consentite / bloccate. failOpen: se il servizio users non
// risponde, considera tutto consentito (usato per refresh e /me, per non chiudere
// le sessioni aperte durante un riavvio del servizio users).
async function filtraSocietaAttive(societaIds, { failOpen = false } = {}) {
    const ids = [...new Set(societaIds.filter(id => Number.isInteger(id)))];
    if (!ids.length) return { consentite: [], bloccate: {} };
    let stati;
    try {
        stati = await fetchStati(ids);
    } catch (err) {
        if (failOpen) return { consentite: ids, bloccate: {} };
        throw err;
    }
    const bloccate = {};
    const consentite = ids.filter(id => {
        if (isBloccato(stati[id])) { bloccate[id] = stati[id]; return false; }
        return true;
    });
    return { consentite, bloccate };
}

const invalidaCache = () => cache.clear();

// Migrazione: le licenze che non hanno ancora amministratori adottano gli admin
// delle proprie società (licenzaId sulle righe admin). Idempotente: una licenza
// con almeno un amministratore non viene più toccata.
async function backfillAmministratoriLicenze(User) {
    const res = await fetch(`${usersUrl()}/api/internal/societa-licenze`, { headers: internalHeaders() });
    if (!res.ok) throw new Error(`users-service ha risposto ${res.status}`);
    const mappa = await res.json(); // [{ societa_id, licenza_id }]
    const societaPerLicenza = {};
    mappa.forEach(({ societa_id, licenza_id }) => {
        (societaPerLicenza[licenza_id] = societaPerLicenza[licenza_id] || []).push(societa_id);
    });
    const conAdmin = new Set((await User.findAll({
        where: { licenzaId: { [Op.ne]: null } }, attributes: ['licenzaId'],
    })).map(u => u.licenzaId));
    let adottati = 0;
    for (const [licenzaId, societaIds] of Object.entries(societaPerLicenza)) {
        if (conAdmin.has(Number(licenzaId))) continue;
        const [n] = await User.update(
            { licenzaId: Number(licenzaId) },
            { where: { role: 'admin', societaId: { [Op.in]: societaIds }, licenzaId: null }, hooks: false, validate: false }
        );
        adottati += n;
    }
    if (adottati) console.log(`[licenze] ${adottati} utenti admin collegati come amministratori di licenza`);
}

// Avvio non bloccante con ritentativi (il servizio users potrebbe non essere ancora su).
function scheduleBackfill(User, { attempts = 20, delayMs = 15000 } = {}) {
    let n = 0;
    const run = () => {
        n += 1;
        backfillAmministratoriLicenze(User).catch(err => {
            if (n < attempts) setTimeout(run, delayMs);
            else console.error('[licenze] backfill amministratori fallito:', err.message);
        });
    };
    setTimeout(run, 5000);
}

module.exports = { filtraSocietaAttive, invalidaCache, scheduleBackfill };
