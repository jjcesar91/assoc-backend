// Cloudflare Turnstile: verifica lato server del token prodotto dal widget.
// Chiavi per ambiente in services/users/.env (non versionato):
//   TURNSTILE_SITE_KEY   (pubblica, inviata al form)
//   TURNSTILE_SECRET_KEY (segreta, solo qui)
// Senza chiavi Turnstile è disattivato (le altre protezioni restano attive).
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const siteKey = () => process.env.TURNSTILE_SITE_KEY || null;
const attivo = () => !!(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);

// true se il token è valido; con Turnstile disattivato ritorna sempre true
async function verificaTurnstile(token, remoteip) {
    if (!attivo()) return true;
    if (typeof token !== 'string' || !token || token.length > 2048) return false;
    try {
        const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
        if (remoteip) body.append('remoteip', remoteip);
        const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        if (!data.success) console.warn('[turnstile] verifica fallita:', (data['error-codes'] || []).join(','));
        return data.success === true;
    } catch (err) {
        // Cloudflare non raggiungibile: si rifiuta (fail-closed), l'utente può riprovare
        console.error('[turnstile] errore di verifica:', err.message);
        return false;
    }
}

module.exports = { siteKey, attivo, verificaTurnstile };
