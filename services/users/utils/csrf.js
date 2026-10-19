const crypto = require('crypto');

// Protezione CSRF per i form pubblici (doppio invio firmato):
//  - GET della sessione: genera un valore casuale, lo mette in un cookie HttpOnly
//    SameSite=Strict e restituisce al client un token firmato che lo contiene;
//  - POST: il token arriva nell'header X-CSRF-Token; deve avere firma valida,
//    contenere lo stesso valore del cookie ed essere stato emesso da almeno
//    MIN_AGE_MS (un bot che invia subito viene scartato) e da non più di MAX_AGE_MS.
const COOKIE = 'reg_csrf';
const MIN_AGE_MS = 3 * 1000;
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

const key = () => crypto.createHash('sha256')
    .update(`registrazione-csrf:${process.env.JWT_SECRET || 'your_jwt_secret'}`)
    .digest();

const sign = (payload) => crypto.createHmac('sha256', key()).update(payload).digest('base64url');

function emetti(res) {
    const nonce = crypto.randomBytes(16).toString('base64url');
    const payload = `${nonce}.${Date.now()}`;
    res.cookie(COOKIE, nonce, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.COOKIE_SECURE !== 'false',
        maxAge: MAX_AGE_MS,
        path: '/',
    });
    return `${payload}.${sign(payload)}`;
}

// Ritorna null se valido, altrimenti il motivo ('mancante' | 'non_valido' | 'troppo_presto' | 'scaduto')
function verifica(req) {
    const token = req.headers['x-csrf-token'];
    const cookie = req.cookies?.[COOKIE];
    if (typeof token !== 'string' || !cookie) return 'mancante';
    const parts = token.split('.');
    if (parts.length !== 3) return 'non_valido';
    const [nonce, issuedAt, firma] = parts;
    const attesa = sign(`${nonce}.${issuedAt}`);
    const a = Buffer.from(firma);
    const b = Buffer.from(attesa);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return 'non_valido';
    if (nonce !== cookie) return 'non_valido';
    const eta = Date.now() - Number(issuedAt);
    if (!Number.isFinite(eta) || eta < MIN_AGE_MS) return 'troppo_presto';
    if (eta > MAX_AGE_MS) return 'scaduto';
    return null;
}

module.exports = { emetti, verifica };
