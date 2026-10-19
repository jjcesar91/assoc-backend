// Cloudflare Turnstile: verifica lato server del token prodotto dal widget.
// Configurazione per ambiente in services/users/.env (non versionato):
//   TURNSTILE_SITE_KEY        pubblica, inviata al form
//   TURNSTILE_SECRET_KEY      segreta, solo qui
//   TURNSTILE_HOSTNAMES       domini ammessi, separati da virgola (es. app.nonprofitgest.it)
//   TURNSTILE_ALLOW_TEST_KEYS true solo dove si usano le chiavi di test Cloudflare (dev)
// Senza chiavi Turnstile è disattivato (le altre protezioni restano attive).
// Come raccomandato da Cloudflare, oltre a success si verificano action e hostname.
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const siteKey = () => process.env.TURNSTILE_SITE_KEY || null;
const attivo = () => !!(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);

const hostnamesAmmessi = () => (process.env.TURNSTILE_HOSTNAMES || '')
    .split(',').map(h => h.trim().toLowerCase()).filter(Boolean);

// true se il token è valido per l'azione attesa; con Turnstile disattivato ritorna sempre true
async function verificaTurnstile(token, remoteip, actionAttesa) {
    if (!attivo()) return true;
    if (typeof token !== 'string' || !token || token.length > 2048) return false;
    try {
        const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
        if (remoteip) body.append('remoteip', remoteip);
        const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        if (data.success !== true) {
            console.warn('[turnstile] verifica fallita:', (data['error-codes'] || []).join(','));
            return false;
        }
        // Risposta prodotta da chiavi di test: valida solo dove esplicitamente consentito
        if (data.metadata?.result_with_testing_key) {
            if (process.env.TURNSTILE_ALLOW_TEST_KEYS === 'true') return true;
            console.warn('[turnstile] rifiutato: chiavi di test non consentite in questo ambiente');
            return false;
        }
        if (actionAttesa && data.action !== actionAttesa) {
            console.warn(`[turnstile] action inattesa: ${data.action}`);
            return false;
        }
        const ammessi = hostnamesAmmessi();
        if (ammessi.length && !ammessi.includes(String(data.hostname || '').toLowerCase())) {
            console.warn(`[turnstile] hostname non ammesso: ${data.hostname}`);
            return false;
        }
        return true;
    } catch (err) {
        // Cloudflare non raggiungibile: si rifiuta (fail-closed), l'utente può riprovare
        console.error('[turnstile] errore di verifica:', err.message);
        return false;
    }
}

module.exports = { siteKey, attivo, verificaTurnstile };
