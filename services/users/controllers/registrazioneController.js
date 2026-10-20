const models = require('../models');
const { createSocietaDefaults } = require('../utils/societaDefaults');
const { createRateLimiter, clientKey } = require('../utils/rateLimit');
const csrf = require('../utils/csrf');
const turnstile = require('../utils/turnstile');
const { inviaEmailRegistrazione } = require('../utils/emailRegistrazione');

const { Societa, Licenza, sequelize } = models;

const authUrl = () => process.env.AUTH_SERVICE_URL || 'http://auth_ms:3000';
const internalHeaders = () => ({
    'Content-Type': 'application/json',
    'x-internal-secret': process.env.INTERNAL_API_SECRET || 'internal_secret_change_me',
});

// Anti-abuso: limiti di invio per IP, per email e complessivo (finestra di un'ora).
// I tentativi falliti contano: chi prova a forzare il form esaurisce il limite.
const perClient = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 10 });
const perEmail = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 5 });
const globale = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 100 });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GG_MM = /^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])$/;
const TIPOLOGIE = ['ASD', 'APS'];
const ANNI = { solare: { societa: 'solare', inizio: '01-01' }, sportivo: { societa: 'associativo', inizio: '01-09' }, personalizzato: { societa: 'personalizzato' } };

const LIMITS = {
    associazione: 255, codice_fiscale: 32, email: 255, telefono: 50, indirizzo: 255, cap: 10,
    comune: 255, provincia: 30, affiliazioni: 2000, presidente_nome: 120, presidente_cognome: 120,
    referente_nome: 255, referente_telefono: 50,
};

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function validate(body) {
    const d = {};
    // Tutti i campi testuali in maiuscolo, tranne l'email
    for (const [k, max] of Object.entries(LIMITS)) {
        d[k] = k === 'email' ? str(body[k]) : str(body[k]).toUpperCase();
        if (d[k].length > max) return { error: `Massimo ${max} caratteri`, field: k };
    }
    d.tipologia = str(body.tipologia).toUpperCase();
    d.anno_associativo_tipo = str(body.anno_associativo_tipo);
    d.anno_associativo_inizio = str(body.anno_associativo_inizio);
    d.codice_fiscale = d.codice_fiscale.toUpperCase();
    d.email = d.email.toLowerCase();

    const required = {
        associazione: 'Associazione', codice_fiscale: 'Codice fiscale', email: 'Email',
        indirizzo: 'Indirizzo', cap: 'CAP', comune: 'Comune', provincia: 'Provincia',
        presidente_nome: 'Nome del presidente', presidente_cognome: 'Cognome del presidente',
        telefono: 'Telefono associazione',
    };
    for (const [k, label] of Object.entries(required)) {
        if (!d[k]) return { error: `${label}: campo obbligatorio`, field: k };
    }
    if (!TIPOLOGIE.includes(d.tipologia)) return { error: 'Tipologia non valida', field: 'tipologia' };
    if (!EMAIL.test(d.email)) return { error: 'Email non valida', field: 'email' };
    if (!ANNI[d.anno_associativo_tipo]) return { error: 'Anno associativo non valido', field: 'anno_associativo_tipo' };
    if (d.anno_associativo_tipo === 'personalizzato' && !GG_MM.test(d.anno_associativo_inizio)) {
        return { error: 'Inizio anno associativo non valido', field: 'anno_associativo_inizio' };
    }
    if (body.privacy !== true) return { error: 'È necessario accettare l\'informativa privacy', field: 'privacy' };
    return { data: d };
}

module.exports = {
    // GET /public/registrazione/sessione — token CSRF (con cookie) e chiave pubblica
    // Turnstile per il form. Va richiesta all'apertura della pagina.
    sessione(req, res) {
        res.set('Cache-Control', 'no-store');
        return res.json({ csrfToken: csrf.emetti(res), turnstileSiteKey: turnstile.siteKey() });
    },

    // POST /public/registrazione — registrazione dal sito: licenza Free "in attesa",
    // prima società e utente amministratore (email del form, password impostata col
    // link inviato all'attivazione). L'accesso
    // al gestionale resta bloccato finché la licenza non viene attivata dal Backoffice.
    async registra(req, res) {
        // Campo trappola: invisibile agli utenti, compilato dai bot
        if (str(req.body?.website)) return res.status(201).json({ ok: true });

        const ip = clientKey(req);
        const emailKey = str(req.body?.email).toLowerCase();
        if (!perClient(ip) || !globale('all') || (emailKey && !perEmail(emailKey))) {
            console.warn(`[registrazione] limite invii superato (ip ${ip})`);
            return res.status(429).json({ error: 'Troppi tentativi in poco tempo. Riprova tra un\'ora.', code: 'LIMITE_INVII' });
        }

        const motivoCsrf = csrf.verifica(req);
        if (motivoCsrf) {
            console.warn(`[registrazione] CSRF ${motivoCsrf} (ip ${ip})`);
            const msg = motivoCsrf === 'troppo_presto'
                ? 'Invio troppo rapido: controlla i dati e riprova.'
                : 'La sessione del modulo è scaduta: riprova, i dati inseriti non sono stati persi.';
            return res.status(403).json({ error: msg, code: 'CSRF' });
        }

        const { data, error, field } = validate(req.body || {});
        if (error) return res.status(400).json({ error, field });

        // Turnstile dopo la validazione: il token è monouso, non va sprecato per un campo mancante
        if (!(await turnstile.verificaTurnstile(req.body?.turnstileToken, ip, 'registrazione'))) {
            return res.status(400).json({ error: 'Verifica anti-bot non superata: riprova.', code: 'TURNSTILE' });
        }

        // Verifica preliminare (email non ancora registrata) prima di scrivere
        try {
            const check = await fetch(`${authUrl()}/api/internal/registrazione-admin/verifica`, {
                method: 'POST',
                headers: internalHeaders(),
                body: JSON.stringify({ email: data.email }),
            });
            if (!check.ok) {
                const err = await check.json().catch(() => ({}));
                const msg = err.error || 'Dati di accesso non validi';
                return res.status(400).json({ error: msg, field: 'email' });
            }
        } catch (e) {
            console.error('Registrazione: auth non raggiungibile', e.message);
            return res.status(503).json({ error: 'Servizio temporaneamente non disponibile, riprova tra poco.' });
        }

        const anno = ANNI[data.anno_associativo_tipo];
        const presidente = `${data.presidente_nome} ${data.presidente_cognome}`.trim();
        let societa;
        try {
            await sequelize.transaction(async (transaction) => {
                societa = await Societa.create({
                    denominazione: data.associazione.toUpperCase(),
                    codice_fiscale: data.codice_fiscale,
                    tipo_associazione: data.tipologia,
                    email: data.email,
                    telefono: data.telefono,
                    indirizzo: data.indirizzo.toUpperCase(),
                    cap: data.cap,
                    comune: data.comune.toUpperCase(),
                    tipo_anno_associativo: anno.societa,
                    data_inizio_anno_associativo: anno.inizio || data.anno_associativo_inizio,
                    nome_rappr_legale: data.presidente_nome.toUpperCase(),
                    cognome_rappr_legale: data.presidente_cognome.toUpperCase(),
                }, { transaction });

                const licenza = await Licenza.create({
                    societa_id: societa.id,
                    piano: 'free',
                    stato: 'in_attesa',
                    associazione: data.associazione,
                    tipologia: data.tipologia,
                    email: data.email,
                    indirizzo: data.indirizzo,
                    cap: data.cap,
                    comune: data.comune,
                    provincia: data.provincia.toUpperCase(),
                    anno_associativo_tipo: data.anno_associativo_tipo,
                    anno_associativo_inizio: data.anno_associativo_tipo === 'personalizzato' ? data.anno_associativo_inizio : null,
                    affiliazioni: data.affiliazioni || null,
                    presidente,
                    telefono: data.telefono,
                    referente_nome: data.referente_nome || null,
                    referente_telefono: data.referente_telefono || null,
                }, { transaction });
                await societa.update({ licenza_id: licenza.id }, { transaction });

                // Utente amministratore: se fallisce, la transazione annulla società e licenza
                const r = await fetch(`${authUrl()}/api/internal/registrazione-admin`, {
                    method: 'POST',
                    headers: internalHeaders(),
                    // Senza password: la imposterà col link inviato all'attivazione della licenza
                    body: JSON.stringify({
                        email: data.email,
                        nome: data.referente_nome || data.presidente_nome,
                        cognome: data.referente_nome ? null : data.presidente_cognome,
                        telefono: data.referente_telefono || data.telefono,
                        societaId: societa.id,
                        licenzaId: licenza.id,
                    }),
                });
                if (!r.ok) {
                    const err = await r.json().catch(() => ({}));
                    const e = new Error(err.error || 'Creazione utente non riuscita');
                    e.status = r.status === 400 ? 400 : 502;
                    throw e;
                }
            });
        } catch (e) {
            console.error('Registrazione fallita:', e.message);
            return res.status(e.status || 500).json({ error: e.status === 400 ? e.message : 'Registrazione non riuscita, riprova più tardi.' });
        }

        // Dati di default della società (moduli, conto CASSA, gruppi) in background
        createSocietaDefaults(societa).catch(err => console.error('Registrazione: default società', err.message));
        console.log(`[registrazione] nuova licenza in attesa per società ${societa.id} (ip ${ip})`);

        // Email "Registrazione ricevuta" all'indirizzo di registrazione (in background)
        models.Licenza.findByPk(societa.licenza_id)
            .then(licenza => inviaEmailRegistrazione({ licenza, origin: req.headers.origin }))
            .then(() => console.log(`[registrazione] email inviata a ${data.email}`))
            .catch(err => console.error(`[registrazione] invio email a ${data.email} fallito:`, err.message));
        return res.status(201).json({ ok: true });
    },
};
