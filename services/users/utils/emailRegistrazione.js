const { sendEmail } = require('./mailService');

// Email inviata all'indirizzo di registrazione dopo l'invio del form pubblico.
// Configurabile per ambiente in services/users/.env:
//   REGISTRAZIONE_APP_URL      indirizzo di accesso (default: sito da cui arriva la registrazione)
//   REGISTRAZIONE_MITTENTE     nome del mittente (default: GNP - Gestionale Non Profit)
//   REGISTRAZIONE_REPLY_TO     indirizzo di risposta (default: info@tecnoconsulenza.it)
//   REGISTRAZIONE_FIRMA        firma in fondo al messaggio
// Copia nascosta: amministratori indicati in Backoffice → Configurazione
// (piattaforma_config.registrazione_ccn); REGISTRAZIONE_BCC nel .env come riserva.

const PRODOTTO = 'GNP - Gestionale Non Profit';
const DEFAULT_APP_URL = 'https://app.gestionalenonprofit.it/';

// Nomi salvati in maiuscolo → iniziali maiuscole nel saluto (MARIO ROSSI → Mario Rossi)
const nomeProprio = (v) => String(v || '').toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, sep, c) => sep + c.toUpperCase()).trim();

const escapeHtml = (v) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function annoAssociativoText(tipo, inizio) {
    if (tipo === 'solare') return 'anno solare (1 gennaio - 31 dicembre)';
    if (tipo === 'sportivo') return 'anno sportivo (1 settembre - 31 agosto)';
    if (tipo === 'personalizzato') {
        const [gg, mm] = String(inizio || '').split('-');
        return gg && mm ? `anno personalizzato, dal ${gg}/${mm}` : 'anno personalizzato';
    }
    return 'non indicato';
}

// Indirizzo di accesso: configurato, altrimenti l'origine https della richiesta
function appUrl(origin) {
    if (process.env.REGISTRAZIONE_APP_URL) return process.env.REGISTRAZIONE_APP_URL;
    if (typeof origin === 'string' && /^https:\/\/[a-z0-9.-]+$/i.test(origin)) return `${origin}/`;
    return DEFAULT_APP_URL;
}

// Passi di configurazione: [titolo, testo]
const PASSI_CONFIGURAZIONE = (anno) => [
    ['Configurazione → Anagrafica Società.', 'Controlla i dati dell’associazione e scegli il Tipo Associazione, ASD o APS: da questa scelta dipendono alcune diciture nelle ricevute e negli altri documenti. Qui carichi anche il logo. Le affiliazioni si indicano in Anagrafica Società → Affiliazioni, e puoi selezionarne più di una. Completa tutti i dati mancanti.'],
    ['Configurazione → Società.', 'Qui carichi il logo ed imposti se il tesseramento e la quota associativa annuale coincidono o meno.'],
    ['Configurazione → Anno contabile.', `Puoi scegliere tra anno solare (1 gennaio - 31 dicembre), sportivo (1 settembre - 31 agosto) o personalizzato. Nella registrazione ci hai indicato: ${anno}. Questo passaggio va fatto subito, perché dopo la prima ricevuta l’impostazione si blocca: la numerazione delle ricevute dipende da qui.`],
    ['Configurazione → Conti.', 'Controlla o aggiungi i conti su cui incassate (cassa contanti, conto corrente). Con “Imposta come predefinito” scegli quello che il gestionale propone a ogni nuovo pagamento.'],
    ['Configurazione → Comunicazioni.', 'Qui decidi se le Proforma e le ricevute dei pagamenti confermati partono via email ai soci. Per ciascuna delle due puoi scegliere “Non attiva”, “Chiedi” (il gestionale ti chiede conferma prima di ogni invio) o “Automatica”. Nelle prime settimane ti suggerisco “Chiedi”: così nessun socio riceve email mentre stai ancora facendo prove. L’oggetto e il testo dei messaggi si possono modificare.'],
    ['Soci.', 'Se la vostra quota associativa comprende anche il tesseramento, attiva prima l’opzione “Quota associativa e Tesseramento Unico” in Configurazione → Società. Poi inserisci i soci uno alla volta oppure importali da un file Excel. Lo stato di ciascuno (REGOLARE, IN SCADENZA, SCADUTO) ti mostra chi deve rinnovare. Se avete già soci o ricevute in un altro programma, puoi scaricare il template da Soci → Altre azioni e dopo aver usato quel formato puoi importare tutti i soci.'],
];

const PASSI_SUCCESSIVI = [
    ['Corsi:', 'si creano da Attività → Calendario → + Corso. Ogni corso va collegato a un Abbonamento, che stabilisce prezzo e tipo di iscrizione, quindi conviene creare prima l’abbonamento. Dai giorni e dagli orari che imposti, il gestionale genera il calendario delle lezioni e il foglio presenze mensile da stampare.'],
    ['Promemoria:', 'in Configurazione → Automazioni attivi gli avvisi per tesseramenti e certificati medici in scadenza.'],
    ['Area soci:', 'dalla scheda di un socio, con Accesso Frontend, gli dai la possibilità di vedere i corsi a cui è iscritto e la scadenza del suo certificato medico.'],
];

function buildEmailRegistrazione({ presidente, associazione, email, annoTipo, annoInizio, origin }) {
    presidente = nomeProprio(presidente);
    const url = appUrl(origin);
    const anno = annoAssociativoText(annoTipo, annoInizio);
    const firma = process.env.REGISTRAZIONE_FIRMA || 'Il team di GNP';
    const passi = PASSI_CONFIGURAZIONE(anno);

    const subject = `Registrazione ricevuta: ${associazione} su ${PRODOTTO}`;

    const text = [
        `Gentile ${presidente},`,
        `grazie per aver confermato la registrazione. L’account di “${associazione}” su ${PRODOTTO} è in fase di verifica. Riceverai conferma entro 24 ore a seguito della verifica dei dati inseriti.`,
        '',
        `Indirizzo di accesso: ${url}`,
        `Nome utente: ${email}`,
        'Password: la imposterai con il link che ti invieremo all’attivazione dell’account',
        '',
        'Prima di emettere la prima ricevuta conviene sistemare alcune impostazioni. Te le indico nell’ordine in cui farle.',
        '',
        ...passi.map(([t, d], i) => `${i + 1}. ${t} ${d}`),
        '',
        'Quando le basi sono a posto puoi passare al resto.',
        '',
        ...PASSI_SUCCESSIVI.map(([t, d]) => `- ${t} ${d}`),
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

    const p = (html) => `<p style="margin:0 0 14px">${html}</p>`;
    const li = ([t, d]) => `<li style="margin:0 0 10px"><strong>${escapeHtml(t)}</strong> ${escapeHtml(d)}</li>`;
    const html = `<!doctype html>
<html lang="it"><body style="margin:0;padding:24px;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#1c1b1f;font-size:15px;line-height:1.55">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px 32px">
${p(`Gentile ${escapeHtml(presidente)},`)}
${p(`grazie per aver confermato la registrazione. L’account di “${escapeHtml(associazione)}” su ${PRODOTTO} è in fase di verifica. Riceverai conferma entro 24 ore a seguito della verifica dei dati inseriti.`)}
<table role="presentation" style="margin:0 0 18px;border-collapse:collapse;background:#f7f9fa;border-radius:6px;width:100%">
<tr><td style="padding:12px 16px">
<div><strong>Indirizzo di accesso:</strong> <a href="${escapeHtml(url)}" style="color:#0d6efd">${escapeHtml(url)}</a></div>
<div><strong>Nome utente:</strong> ${escapeHtml(email)}</div>
<div><strong>Password:</strong> la imposterai con il link che ti invieremo all’attivazione dell’account</div>
</td></tr></table>
${p('Prima di emettere la prima ricevuta conviene sistemare alcune impostazioni. Te le indico nell’ordine in cui farle.')}
<ol style="margin:0 0 18px;padding-left:22px">${passi.map(li).join('')}</ol>
${p('Quando le basi sono a posto puoi passare al resto.')}
<ul style="margin:0 0 18px;padding-left:22px">${PASSI_SUCCESSIVI.map(li).join('')}</ul>
${p('Per qualsiasi dubbio rispondi a questa email.')}
${p(`Buon lavoro,<br>${escapeHtml(firma)}`)}
<div style="margin-top:24px;padding-top:14px;border-top:1px solid #e2e2e6;font-size:13px;color:#49454f">
${PRODOTTO}<br>Tecno Consulenza, Via G. Marconi 9/H, Treviso<br>
<a href="mailto:info@tecnoconsulenza.it" style="color:#49454f">info@tecnoconsulenza.it</a> - <a href="https://gestionalenonprofit.it" style="color:#49454f">https://gestionalenonprofit.it</a>
</div>
</div></body></html>`;

    return { subject, html, text };
}

// Invio (best effort: un errore viene loggato, la registrazione resta valida)
async function inviaEmailRegistrazione(dati) {
    const { subject, html, text } = buildEmailRegistrazione(dati);
    // Il controller è richiesto qui per evitare dipendenze circolari all'avvio
    const { getRegistrazioneCcn } = require('../controllers/piattaformaController');
    let bcc = [];
    try {
        bcc = await getRegistrazioneCcn();
    } catch (err) {
        console.error('[registrazione] lettura destinatari CCN fallita:', err.message);
    }
    if (!bcc.length && process.env.REGISTRAZIONE_BCC) bcc = process.env.REGISTRAZIONE_BCC.split(/[\s,;]+/).filter(Boolean);
    await sendEmail({
        to: dati.email,
        subject,
        html,
        text,
        bcc: bcc.length ? bcc : undefined,
        // Mittente e risposta: non quelli di una società ma del prodotto
        societa: {
            denominazione: process.env.REGISTRAZIONE_MITTENTE || PRODOTTO,
            email: process.env.REGISTRAZIONE_REPLY_TO || 'info@tecnoconsulenza.it',
        },
    });
}

module.exports = { buildEmailRegistrazione, inviaEmailRegistrazione };
