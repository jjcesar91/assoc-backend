const { sendEmail } = require('./mailService');
const { NOMI_PIANI } = require('./piani');

// Email inviata agli amministratori quando una licenza passa da "in attesa" ad
// "attiva": piano della licenza e link per impostare la password (primo accesso).
// Stessa configurazione dell'email di registrazione (REGISTRAZIONE_* nel .env).

const PRODOTTO = 'GNP - Gestionale Non Profit';
const DEFAULT_APP_URL = 'https://app.gestionalenonprofit.it/';

const authUrl = () => process.env.AUTH_SERVICE_URL || 'http://auth_ms:3000';
const internalHeaders = () => ({
    'Content-Type': 'application/json',
    'x-internal-secret': process.env.INTERNAL_API_SECRET || 'internal_secret_change_me',
});

const escapeHtml = (v) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function appUrl(origin) {
    if (process.env.REGISTRAZIONE_APP_URL) return process.env.REGISTRAZIONE_APP_URL.replace(/\/?$/, '/');
    if (typeof origin === 'string' && /^https:\/\/[a-z0-9.-]+$/i.test(origin)) return `${origin}/`;
    return DEFAULT_APP_URL;
}

const scadenzaText = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'long', timeStyle: 'short' });
};

function buildEmailAttivazione({ nome, associazione, piano, email, link, scadenza, url }) {
    const pianoNome = NOMI_PIANI[piano] || piano;
    const firma = process.env.REGISTRAZIONE_FIRMA || 'Il team di GNP';
    const saluto = nome ? `Ciao ${nome},` : 'Ciao,';
    const subject = `La licenza di ${associazione} è attiva: imposta la tua password`;

    const text = [
        saluto,
        `la licenza di “${associazione}” su ${PRODOTTO} è stata attivata con il piano ${pianoNome}.`,
        '',
        'Per il primo accesso imposta la tua password da questo link:',
        link,
        `Il link è personale, si può usare una sola volta ed è valido fino al ${scadenzaText(scadenza)}.`,
        '',
        `Indirizzo di accesso: ${url}`,
        `Nome utente: ${email}`,
        '',
        'Per qualsiasi dubbio rispondi a questa email.',
        '',
        'Buon lavoro,',
        firma,
        '',
        '--',
        PRODOTTO,
        'Tecno Consulenza, Via G. Marconi 9/H, Treviso',
        'info@tecnoconsulenza.it - https://gestionalenonprofit.it',
    ].join('\n');

    const html = `<!doctype html>
<html lang="it"><body style="margin:0;padding:24px;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#1c1b1f;font-size:15px;line-height:1.55">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px 32px">
<p style="margin:0 0 14px">${escapeHtml(saluto)}</p>
<p style="margin:0 0 14px">la licenza di “${escapeHtml(associazione)}” su ${PRODOTTO} è stata attivata con il piano <strong>${escapeHtml(pianoNome)}</strong>.</p>
<p style="margin:0 0 18px">Per il primo accesso imposta la tua password:</p>
<p style="margin:0 0 18px;text-align:center"><a href="${escapeHtml(link)}" style="display:inline-block;background:#0d6efd;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold">Imposta la password</a></p>
<p style="margin:0 0 18px;font-size:13px;color:#49454f">Il link è personale, si può usare una sola volta ed è valido fino al ${escapeHtml(scadenzaText(scadenza))}. Se il pulsante non funziona copia questo indirizzo nel browser:<br><span style="word-break:break-all">${escapeHtml(link)}</span></p>
<table role="presentation" style="margin:0 0 18px;border-collapse:collapse;background:#f7f9fa;border-radius:6px;width:100%"><tr><td style="padding:12px 16px">
<div><strong>Indirizzo di accesso:</strong> <a href="${escapeHtml(url)}" style="color:#0d6efd">${escapeHtml(url)}</a></div>
<div><strong>Nome utente:</strong> ${escapeHtml(email)}</div>
</td></tr></table>
<p style="margin:0 0 14px">Per qualsiasi dubbio rispondi a questa email.</p>
<p style="margin:0 0 14px">Buon lavoro,<br>${escapeHtml(firma)}</p>
<div style="margin-top:24px;padding-top:14px;border-top:1px solid #e2e2e6;font-size:13px;color:#49454f">
${PRODOTTO}<br>Tecno Consulenza, Via G. Marconi 9/H, Treviso<br>
<a href="mailto:info@tecnoconsulenza.it" style="color:#49454f">info@tecnoconsulenza.it</a> - <a href="https://gestionalenonprofit.it" style="color:#49454f">https://gestionalenonprofit.it</a>
</div>
</div></body></html>`;

    return { subject, html, text };
}

// Genera i link (servizio auth) e invia un'email a ogni amministratore della licenza.
// → { inviate: [email], errori: [{ email, errore }] }
async function inviaEmailAttivazione({ licenza, origin }) {
    const res = await fetch(`${authUrl()}/api/internal/licenze/${licenza.id}/link-attivazione`, {
        method: 'POST',
        headers: internalHeaders(),
    });
    if (!res.ok) throw new Error(`auth-service ha risposto ${res.status}`);
    const amministratori = await res.json();
    const url = appUrl(origin);
    const esito = { inviate: [], errori: [] };
    for (const a of amministratori) {
        const link = `${url}reset-password#t=${encodeURIComponent(a.token)}`;
        const { subject, html, text } = buildEmailAttivazione({
            nome: a.nome, associazione: licenza.associazione || 'la tua associazione',
            piano: licenza.piano, email: a.email, link, scadenza: a.expiresAt, url,
        });
        try {
            await sendEmail({
                to: a.email, subject, html, text,
                societa: {
                    denominazione: process.env.REGISTRAZIONE_MITTENTE || PRODOTTO,
                    email: process.env.REGISTRAZIONE_REPLY_TO || 'info@tecnoconsulenza.it',
                },
            });
            esito.inviate.push(a.email);
        } catch (err) {
            console.error(`[licenze] email di attivazione a ${a.email} fallita:`, err.message);
            esito.errori.push({ email: a.email, errore: err.message });
        }
    }
    return esito;
}

module.exports = { buildEmailAttivazione, inviaEmailAttivazione };
