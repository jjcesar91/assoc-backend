const models = require('../models');
const { CHIAVI, VALORI_ESEMPIO, getTemplate, rendi, sanitizeCorpo } = require('../utils/emailTemplates');
const { inviaEmailBenvenuto } = require('../utils/emailRegistrazione');

const { EmailTemplate, Licenza } = models;

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const MAX_CCN = 20;

function parseEmailList(value) {
    const raw = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
    const list = [...new Set(raw.map(v => String(v).trim().toLowerCase()).filter(Boolean))];
    if (list.length > MAX_CCN) return { error: `Massimo ${MAX_CCN} indirizzi` };
    const invalid = list.filter(e => !EMAIL.test(e));
    if (invalid.length) return { error: `Indirizzi non validi: ${invalid.join(', ')}` };
    return { list };
}

const valida = (req, res) => {
    if (!CHIAVI.includes(req.params.chiave)) {
        res.status(404).json({ error: 'Email sconosciuta' });
        return false;
    }
    return true;
};

module.exports = {
    // GET /email-template — le email configurabili con testo attuale e predefinito (superuser)
    async list(req, res) {
        try {
            return res.json(await Promise.all(CHIAVI.map(k => getTemplate(models, k))));
        } catch (error) {
            console.error('Errore lettura email:', error);
            return res.status(500).json({ error: 'Errore lettura email' });
        }
    },

    // PUT /email-template/:chiave { oggetto, corpo_html, ccn } — vuoto = testo predefinito
    async update(req, res) {
        if (!valida(req, res)) return undefined;
        try {
            const body = req.body || {};
            const updates = {};
            if (body.oggetto !== undefined) {
                const v = typeof body.oggetto === 'string' ? body.oggetto.trim() : '';
                if (v.length > 255) return res.status(400).json({ error: 'Oggetto: massimo 255 caratteri', field: 'oggetto' });
                updates.oggetto = v || null;
            }
            if (body.corpo_html !== undefined) {
                updates.corpo_html = sanitizeCorpo(body.corpo_html);
            }
            if (body.ccn !== undefined) {
                const { list, error } = parseEmailList(body.ccn);
                if (error) return res.status(400).json({ error, field: 'ccn' });
                updates.ccn = list;
            }
            const [row] = await EmailTemplate.findOrCreate({ where: { chiave: req.params.chiave }, defaults: { chiave: req.params.chiave } });
            await row.update(updates);
            return res.json(await getTemplate(models, req.params.chiave));
        } catch (error) {
            console.error('Errore salvataggio email:', error);
            return res.status(500).json({ error: 'Errore salvataggio email' });
        }
    },

    // POST /email-template/:chiave/anteprima { oggetto, corpo_html } — con valori d'esempio
    async anteprima(req, res) {
        if (!valida(req, res)) return undefined;
        try {
            const tpl = await getTemplate(models, req.params.chiave);
            const oggetto = typeof req.body?.oggetto === 'string' && req.body.oggetto.trim() ? req.body.oggetto : tpl.oggetto;
            const corpo = typeof req.body?.corpo_html === 'string' ? (sanitizeCorpo(req.body.corpo_html) || tpl.default_corpo_html) : tpl.corpo_html;
            const msg = rendi({ oggetto, corpo_html: corpo }, VALORI_ESEMPIO);
            return res.json({ subject: msg.subject, html: msg.html });
        } catch (error) {
            console.error('Errore anteprima email:', error);
            return res.status(500).json({ error: 'Errore anteprima' });
        }
    },

    // POST /internal/email/benvenuto { licenzaId, email, nome, origin } (dal servizio auth)
    async internalBenvenuto(req, res) {
        try {
            const licenza = await Licenza.findByPk(parseInt(req.body?.licenzaId, 10));
            if (!licenza || !req.body?.email) return res.status(400).json({ error: 'Dati mancanti' });
            const r = await inviaEmailBenvenuto({ licenza, email: req.body.email, nome: req.body.nome, origin: req.body.origin });
            console.log(`[email] benvenuto inviata a ${req.body.email}`);
            return res.json({ ok: true, copia: r.copia });
        } catch (error) {
            console.error('Errore email di benvenuto:', error.message);
            return res.status(502).json({ error: 'Invio non riuscito' });
        }
    },
};
