const { sendEmail } = require('./mailService');
const { sanitizeDescrizioneHtml } = require('../controllers/piattaformaController');

// Email automatiche della piattaforma, con testi configurabili da Backoffice → Email
// (tabella email_template). Segnaposto {{CAMPO}} sostituiti all'invio; i valori sono
// sempre escapati. Mittente e risposta: REGISTRAZIONE_MITTENTE / REGISTRAZIONE_REPLY_TO.

const PRODOTTO = 'GNP - Gestionale Non Profit';

const FIRMA = `<p>Per qualsiasi dubbio rispondi a questa email.</p>
<p>Buon lavoro,<br>Il team di GNP</p>
<p>--<br>GNP - Gestionale Non Profit<br>Tecno Consulenza, Via G. Marconi 9/H, Treviso<br>info@tecnoconsulenza.it - https://gestionalenonprofit.it</p>`;

// Segnaposto disponibili: [token, etichetta pulsante, descrizione]
const CAMPI_COMUNI = [
    ['{{PRESIDENTE}}', 'Presidente', 'Nome e cognome del presidente'],
    ['{{NOME}}', 'Nome destinatario', "Nome dell'amministratore che riceve l'email"],
    ['{{ASSOCIAZIONE}}', 'Associazione', "Nome dell'associazione registrata"],
    ['{{NOME_UTENTE}}', 'Nome utente', "Email di accesso dell'amministratore"],
    ['{{INDIRIZZO_ACCESSO}}', 'Indirizzo di accesso', 'Link al gestionale'],
    ['{{PIANO}}', 'Piano', 'Piano della licenza (Free, Pro, Advanced)'],
    ['{{ANNO_ASSOCIATIVO}}', 'Anno associativo', "Anno associativo indicato nella registrazione"],
];

// Segnaposto delle email dei ticket di assistenza
const CAMPI_TICKET = [
    ['{{NUMERO_TICKET}}', 'Numero ticket', 'Numero del ticket (es. #42)'],
    ['{{OGGETTO_TICKET}}', 'Oggetto', 'Oggetto del ticket'],
    ['{{ASSOCIAZIONE}}', 'Associazione', 'Società che ha aperto il ticket'],
    ['{{AUTORE}}', 'Autore', "Email dell'utente che ha aperto il ticket"],
    ['{{STATO_TICKET}}', 'Stato', 'Stato del ticket dopo il messaggio'],
    ['{{MESSAGGIO}}', 'Messaggio', "Testo dell'ultimo messaggio"],
    ['{{LINK_TICKET}}', 'Link al ticket', 'Pulsante per aprire il ticket nel gestionale'],
];

const DEFINIZIONI = {
    registrazione_ricevuta: {
        nome: 'Registrazione ricevuta',
        quando: "Inviata all'indirizzo di registrazione subito dopo l'invio del form pubblico.",
        campi: CAMPI_COMUNI,
        oggetto: 'Abbiamo ricevuto la registrazione di {{ASSOCIAZIONE}}',
        corpo: `<p>Gentile {{PRESIDENTE}},</p>
<p>grazie per aver registrato “{{ASSOCIAZIONE}}” su GNP - Gestionale Non Profit. Abbiamo ricevuto la tua richiesta e verificheremo i dati inseriti entro 24 ore.</p>
<p>Quando l’account sarà attivo riceverai un’altra email di conferma con il link per impostare la password e accedere con il nome utente {{NOME_UTENTE}}.</p>
${FIRMA}`,
    },
    attivazione: {
        nome: 'Attivazione licenza',
        quando: 'Inviata agli amministratori quando la licenza passa da "In attesa" ad "Attiva". La copia in CCN non contiene il link (personale e monouso).',
        campi: [
            ...CAMPI_COMUNI,
            ['{{LINK_PASSWORD}}', 'Link imposta password', 'Pulsante con il link personale per impostare la password'],
            ['{{SCADENZA_LINK}}', 'Scadenza link', 'Data e ora di scadenza del link'],
        ],
        oggetto: 'La licenza di {{ASSOCIAZIONE}} è attiva: imposta la tua password',
        corpo: `<p>Ciao {{NOME}},</p>
<p>la licenza di “{{ASSOCIAZIONE}}” su GNP - Gestionale Non Profit è stata attivata con il piano <b>{{PIANO}}</b>.</p>
<p>Per il primo accesso imposta la tua password:</p>
<p>{{LINK_PASSWORD}}</p>
<p>Il link è personale, si può usare una sola volta ed è valido fino al {{SCADENZA_LINK}}.</p>
<p>Indirizzo di accesso: {{INDIRIZZO_ACCESSO}}<br>Nome utente: {{NOME_UTENTE}}</p>
${FIRMA}`,
    },
    benvenuto: {
        nome: 'Benvenuto e primi passi',
        quando: "Inviata all'amministratore dopo che ha impostato la password per la prima volta dal link di attivazione.",
        campi: CAMPI_COMUNI,
        oggetto: 'Benvenuto su GNP: i primi passi per {{ASSOCIAZIONE}}',
        corpo: `<p>Ciao {{NOME}},</p>
<p>la tua password è stata impostata: da ora puoi accedere a {{INDIRIZZO_ACCESSO}} con il nome utente {{NOME_UTENTE}}.</p>
<p>Prima di emettere la prima ricevuta conviene sistemare alcune impostazioni. Te le indico nell’ordine in cui farle.</p>
<ol>
<li><b>Configurazione → Anagrafica Società.</b> Controlla i dati dell’associazione e scegli il Tipo Associazione, ASD o APS: da questa scelta dipendono alcune diciture nelle ricevute e negli altri documenti. Qui carichi anche il logo. Le affiliazioni si indicano in Anagrafica Società → Affiliazioni, e puoi selezionarne più di una. Completa tutti i dati mancanti.</li>
<li><b>Configurazione → Società.</b> Qui carichi il logo ed imposti se il tesseramento e la quota associativa annuale coincidono o meno.</li>
<li><b>Configurazione → Anno contabile.</b> Puoi scegliere tra anno solare (1 gennaio - 31 dicembre), sportivo (1 settembre - 31 agosto) o personalizzato. Nella registrazione ci hai indicato: {{ANNO_ASSOCIATIVO}}. Questo passaggio va fatto subito, perché dopo la prima ricevuta l’impostazione si blocca: la numerazione delle ricevute dipende da qui.</li>
<li><b>Configurazione → Conti.</b> Controlla o aggiungi i conti su cui incassate (cassa contanti, conto corrente). Con “Imposta come predefinito” scegli quello che il gestionale propone a ogni nuovo pagamento.</li>
<li><b>Configurazione → Comunicazioni.</b> Qui decidi se le Proforma e le ricevute dei pagamenti confermati partono via email ai soci. Per ciascuna delle due puoi scegliere “Non attiva”, “Chiedi” (il gestionale ti chiede conferma prima di ogni invio) o “Automatica”. Nelle prime settimane ti suggerisco “Chiedi”: così nessun socio riceve email mentre stai ancora facendo prove. L’oggetto e il testo dei messaggi si possono modificare.</li>
<li><b>Soci.</b> Se la vostra quota associativa comprende anche il tesseramento, attiva prima l’opzione “Quota associativa e Tesseramento Unico” in Configurazione → Società. Poi inserisci i soci uno alla volta oppure importali da un file Excel. Lo stato di ciascuno (REGOLARE, IN SCADENZA, SCADUTO) ti mostra chi deve rinnovare. Se avete già soci o ricevute in un altro programma, puoi scaricare il template da Soci → Altre azioni e dopo aver usato quel formato puoi importare tutti i soci.</li>
</ol>
<p>Quando le basi sono a posto puoi passare al resto.</p>
<ul>
<li><b>Corsi:</b> si creano da Attività → Calendario → + Corso. Ogni corso va collegato a un Abbonamento, che stabilisce prezzo e tipo di iscrizione, quindi conviene creare prima l’abbonamento. Dai giorni e dagli orari che imposti, il gestionale genera il calendario delle lezioni e il foglio presenze mensile da stampare.</li>
<li><b>Promemoria:</b> in Configurazione → Automazioni attivi gli avvisi per tesseramenti e certificati medici in scadenza.</li>
<li><b>Area soci:</b> dalla scheda di un socio, con Accesso Frontend, gli dai la possibilità di vedere i corsi a cui è iscritto e la scadenza del suo certificato medico.</li>
</ul>
${FIRMA}`,
    },
    ticket_risposta: {
        nome: 'Ticket: risposta del supporto',
        quando: "Inviata all'utente che ha aperto il ticket quando il supporto risponde (mai per le note interne).",
        campi: CAMPI_TICKET,
        oggetto: '[Ticket {{NUMERO_TICKET}}] Nuova risposta: {{OGGETTO_TICKET}}',
        corpo: `<p>Ciao,</p>
<p>il supporto ha risposto al ticket {{NUMERO_TICKET}} “{{OGGETTO_TICKET}}”:</p>
<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #0d6efd;background:#f5f8ff">{{MESSAGGIO}}</blockquote>
<p>Stato del ticket: <b>{{STATO_TICKET}}</b>.</p>
<p>Per rispondere apri il ticket nel gestionale (menu Assistenza):</p>
<p>{{LINK_TICKET}}</p>
<p>Il team di GNP</p>`,
    },
    ticket_supporto: {
        nome: 'Ticket: nuovo messaggio da un cliente',
        quando: 'Inviata al supporto quando un cliente apre un ticket o risponde in un ticket.',
        destinatariCcn: true,
        ccnLabel: 'Destinatari (supporto)',
        ccnHint: "Un indirizzo per riga, massimo 20. Ricevono l'avviso di ogni nuovo ticket e di ogni risposta dei clienti; senza destinatari l'avviso non viene inviato.",
        campi: CAMPI_TICKET,
        oggetto: '[Ticket {{NUMERO_TICKET}}] {{ASSOCIAZIONE}}: {{OGGETTO_TICKET}}',
        corpo: `<p>Nuovo messaggio da {{AUTORE}} ({{ASSOCIAZIONE}}) nel ticket {{NUMERO_TICKET}} “{{OGGETTO_TICKET}}”:</p>
<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #0d6efd;background:#f5f8ff">{{MESSAGGIO}}</blockquote>
<p>Stato: <b>{{STATO_TICKET}}</b></p>
<p>{{LINK_TICKET}}</p>`,
    },
};

const CHIAVI = Object.keys(DEFINIZIONI);

// Solo le email nate con la vecchia lista unica di Backoffice → Configurazione la ereditano
const EREDITANO_CCN_LEGACY = ['registrazione_ricevuta', 'attivazione', 'benvenuto'];

// Valori d'esempio per l'anteprima nel Backoffice
const VALORI_ESEMPIO = {
    PRESIDENTE: 'Mario Rossi', NOME: 'Mario Rossi', ASSOCIAZIONE: 'ASD AQUILE TREVISO',
    NOME_UTENTE: 'info@aquiletreviso.it', INDIRIZZO_ACCESSO: 'https://app.gestionalenonprofit.it/',
    PIANO: 'Free', ANNO_ASSOCIATIVO: 'anno sportivo (1 settembre - 31 agosto)',
    LINK_PASSWORD: 'https://app.gestionalenonprofit.it/reset-password#t=esempio', SCADENZA_LINK: '23 ottobre 2026 alle ore 18:30',
    NUMERO_TICKET: '#42', OGGETTO_TICKET: 'Errore nella stampa della ricevuta', AUTORE: 'info@aquiletreviso.it',
    STATO_TICKET: 'In attesa di risposta', MESSAGGIO: 'Buongiorno,\nabbiamo verificato: ora la stampa funziona correttamente.',
    LINK_TICKET: 'https://app.gestionalenonprofit.it/assistenza?ticket=42',
};

const escapeHtml = (v) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Nomi salvati in maiuscolo → iniziali maiuscole (MARIO ROSSI → Mario Rossi)
const nomeProprio = (v) => String(v || '').toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, sep, c) => sep + c.toUpperCase()).trim();

const LINK_OMESSO = '[link personale per impostare la password: inviato solo al destinatario, non incluso nella copia]';

function bottone(url, testo) {
    return `<a href="${escapeHtml(url)}" style="display:inline-block;background:#0d6efd;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold">${escapeHtml(testo)}</a>`
        + `<br><span style="font-size:13px;color:#49454f">Se il pulsante non funziona copia questo indirizzo nel browser: <span style="word-break:break-all">${escapeHtml(url)}</span></span>`;
}

// Sostituzione dei segnaposto: html (valori escapati, link cliccabili) o testo
function sostituisci(template, valori, { html, copia }) {
    return String(template || '').replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => {
        if (!(k in valori)) return m;
        const v = valori[k];
        if (k === 'LINK_PASSWORD') {
            if (copia) return html ? `<i>${escapeHtml(LINK_OMESSO)}</i>` : LINK_OMESSO;
            return html ? bottone(v, 'Imposta la password') : v;
        }
        if (k === 'LINK_TICKET' && html) return bottone(v, 'Apri il ticket');
        if (k === 'MESSAGGIO' && html) return escapeHtml(v).replace(/\n/g, '<br>');
        if (k === 'INDIRIZZO_ACCESSO' && html) return `<a href="${escapeHtml(v)}" style="color:#0d6efd">${escapeHtml(v)}</a>`;
        return html ? escapeHtml(v) : String(v ?? '');
    });
}

// Testo semplice dal corpo HTML (alternativa per i client senza HTML)
function htmlToText(html) {
    let n = 0;
    return String(html || '')
        .replace(/<ol[^>]*>/gi, () => { n = 0; return '\n'; })
        .replace(/<li[^>]*>/gi, (m, off, all) => {
            const prima = all.slice(0, off);
            const inOl = prima.lastIndexOf('<ol') > prima.lastIndexOf('<ul');
            return inOl ? `${++n}. ` : '- ';
        })
        .replace(/<\/li>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|ul|ol)>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
        .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function wrapHtml(corpo, notaCopia) {
    return `<!doctype html>
<html lang="it"><body style="margin:0;padding:24px;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#1c1b1f;font-size:15px;line-height:1.55">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px 32px">
${notaCopia ? `<p style="margin:0 0 18px;padding:10px 14px;background:#fff4e5;border-radius:6px;font-size:13px;color:#7a4100">${escapeHtml(notaCopia)}</p>` : ''}
${corpo}
</div></body></html>`;
}

// Testo effettivo (personalizzato o predefinito) di una email
async function getTemplate(models, chiave) {
    const def = DEFINIZIONI[chiave];
    if (!def) throw new Error(`Email sconosciuta: ${chiave}`);
    const row = await models.EmailTemplate.findByPk(chiave);
    let ccn = Array.isArray(row?.ccn) ? row.ccn : null;
    if (ccn === null && !EREDITANO_CCN_LEGACY.includes(chiave)) ccn = [];
    if (ccn === null) {
        // Prima configurazione: eredita la lista CCN che stava in Backoffice → Configurazione
        const legacy = await models.PiattaformaConfig.findByPk(1);
        ccn = Array.isArray(legacy?.registrazione_ccn) ? legacy.registrazione_ccn : [];
    }
    return {
        chiave,
        nome: def.nome,
        quando: def.quando,
        campi: def.campi.map(([token, label, title]) => ({ token, label, title })),
        oggetto: row?.oggetto || def.oggetto,
        corpo_html: row?.corpo_html || def.corpo,
        ccn,
        ccn_label: def.ccnLabel || null,
        ccn_hint: def.ccnHint || null,
        personalizzato: !!(row?.oggetto || row?.corpo_html),
        default_oggetto: def.oggetto,
        default_corpo_html: def.corpo,
    };
}

function rendi({ oggetto, corpo_html }, valori, { copia = false, destinatario = null } = {}) {
    const corpo = sostituisci(corpo_html, valori, { html: true, copia });
    const subject = `${copia ? '[Copia] ' : ''}${sostituisci(oggetto, valori, { html: false, copia })}`;
    const notaCopia = copia && destinatario ? `Copia per conoscenza dell'email inviata a ${destinatario}.` : null;
    // Prima il template in testo, poi i valori: i testi scritti dagli utenti restano intatti
    const corpoTesto = sostituisci(htmlToText(corpo_html), valori, { html: false, copia });
    return {
        subject,
        html: wrapHtml(corpo, notaCopia),
        text: `${notaCopia ? `${notaCopia}\n\n------\n\n` : ''}${corpoTesto}`,
    };
}

const DEFAULT_APP_URL = 'https://app.gestionalenonprofit.it/';

// Indirizzo di accesso: configurato, altrimenti il sito https da cui arriva la richiesta
function appUrl(origin) {
    if (process.env.REGISTRAZIONE_APP_URL) return process.env.REGISTRAZIONE_APP_URL.replace(/\/?$/, '/');
    if (typeof origin === 'string' && /^https:\/\/[a-z0-9.-]+$/i.test(origin)) return `${origin}/`;
    return DEFAULT_APP_URL;
}

const NOMI_PIANI = { free: 'Free', pro: 'Pro', advanced: 'Advanced' };

function annoAssociativoText(tipo, inizio) {
    if (tipo === 'solare') return 'anno solare (1 gennaio - 31 dicembre)';
    if (tipo === 'sportivo') return 'anno sportivo (1 settembre - 31 agosto)';
    if (tipo === 'personalizzato') {
        const [gg, mm] = String(inizio || '').split('-');
        return gg && mm ? `anno personalizzato, dal ${gg}/${mm}` : 'anno personalizzato';
    }
    return 'non indicato';
}

// Valori dei segnaposto a partire dalla licenza (snapshot dei dati di registrazione)
function valoriLicenza(licenza, { nome, email, origin, link, scadenza } = {}) {
    const l = licenza?.toJSON ? licenza.toJSON() : (licenza || {});
    const scad = scadenza ? new Date(scadenza) : null;
    return {
        PRESIDENTE: nomeProprio(l.presidente),
        NOME: nomeProprio(nome || l.presidente),
        ASSOCIAZIONE: l.associazione || '',
        NOME_UTENTE: email || l.email || '',
        INDIRIZZO_ACCESSO: appUrl(origin),
        PIANO: NOMI_PIANI[l.piano] || l.piano || '',
        ANNO_ASSOCIATIVO: annoAssociativoText(l.anno_associativo_tipo, l.anno_associativo_inizio),
        LINK_PASSWORD: link || '',
        SCADENZA_LINK: scad && !Number.isNaN(scad.getTime())
            ? scad.toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'long', timeStyle: 'short' })
            : '',
    };
}

const MITTENTE = () => ({
    denominazione: process.env.REGISTRAZIONE_MITTENTE || PRODOTTO,
    email: process.env.REGISTRAZIONE_REPLY_TO || 'info@tecnoconsulenza.it',
});

// Invia l'email al destinatario e, se configurata, la copia alla lista CCN
// (per l'attivazione la copia è senza link). Errori della copia solo loggati.
async function inviaEmail(models, chiave, { to, valori }) {
    const tpl = await getTemplate(models, chiave);
    const msg = rendi(tpl, valori);
    await sendEmail({ to, subject: msg.subject, html: msg.html, text: msg.text, societa: MITTENTE() });
    let copia = null;
    if (tpl.ccn.length) {
        // Copia: stesso testo, nota del destinatario originale e, per l'attivazione, senza link
        const c = rendi(tpl, valori, { copia: true, destinatario: to });
        try {
            await sendEmail({ bcc: tpl.ccn, subject: c.subject, html: c.html, text: c.text, societa: MITTENTE() });
            copia = { inviata: true, destinatari: tpl.ccn.length };
        } catch (err) {
            console.error(`[email] copia CCN di "${chiave}" fallita:`, err.message);
            copia = { inviata: false, errore: err.message };
        }
    }
    return { copia };
}

// Email con destinatari = lista configurata (avvisi al supporto): niente se la lista è vuota
async function inviaEmailAiDestinatari(models, chiave, { valori }) {
    const tpl = await getTemplate(models, chiave);
    if (!tpl.ccn.length) return { inviata: false };
    const msg = rendi(tpl, valori);
    await sendEmail({ bcc: tpl.ccn, subject: msg.subject, html: msg.html, text: msg.text, societa: MITTENTE() });
    return { inviata: true, destinatari: tpl.ccn.length };
}

module.exports = {
    CHIAVI, DEFINIZIONI, VALORI_ESEMPIO,
    getTemplate, rendi, inviaEmail, inviaEmailAiDestinatari, nomeProprio, valoriLicenza, appUrl, sanitizeCorpo: sanitizeDescrizioneHtml,
};
