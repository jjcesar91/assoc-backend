const fs = require('fs');
const path = require('path');
const { PiattaformaConfig } = require('../models');

const CONFIG_ID = 1;
const UPLOAD_DIR = '/app/uploads';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const TEXT_FIELDS = {
    nome_ambiente: 80,
    titolo: 120,
    sottotitolo: 255,
};

// Tag ammessi nella descrizione della pagina di login (quelli prodotti da
// SimpleEditor). Tutti gli attributi vengono rimossi: niente href, style, on*.
const ALLOWED_TAGS = new Set(['p', 'div', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'span']);

function sanitizeDescrizioneHtml(html) {
    if (typeof html !== 'string') return null;
    const cleaned = html
        // contenuto di script/style e commenti eliminati per intero
        .replace(/<(script|style|iframe|object|embed|template)[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        // ogni tag: tenuto (senza attributi) solo se ammesso
        .replace(/<\s*(\/?)\s*([a-zA-Z0-9]+)\b[^>]*>/g, (_, slash, tag) => {
            const name = tag.toLowerCase();
            if (!ALLOWED_TAGS.has(name)) return '';
            if (name === 'br') return slash ? '' : '<br>';
            return `<${slash}${name}>`;
        })
        // eventuali "<" residui di tag malformati
        .replace(/<(?![/a-z])/gi, '&lt;')
        .trim();
    return cleaned.length > 0 ? cleaned.slice(0, 10000) : null;
}

function toPublic(config) {
    const c = config ? config.toJSON() : {};
    return {
        nome_ambiente: c.nome_ambiente || null,
        favicon_path: c.favicon_path || null,
        colore_primario: c.colore_primario || null,
        colore_header: c.colore_header || null,
        logo_path: c.logo_path || null,
        titolo: c.titolo || null,
        sottotitolo: c.sottotitolo || null,
        descrizione_html: c.descrizione_html || null,
        updatedAt: c.updatedAt || null,
    };
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const MAX_CCN = 20;

// Elenco email da stringa (virgole, punti e virgola, a capo) o array; null se non valido
function parseEmailList(value) {
    const raw = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
    const list = [...new Set(raw.map(v => String(v).trim().toLowerCase()).filter(Boolean))];
    if (list.length > MAX_CCN) return { error: `Massimo ${MAX_CCN} indirizzi` };
    const invalid = list.filter(e => !EMAIL.test(e));
    if (invalid.length) return { error: `Indirizzi non validi: ${invalid.join(', ')}` };
    return { list };
}

// Configurazione completa, campi privati inclusi (solo superuser)
function toPrivate(config) {
    const c = config ? config.toJSON() : {};
    return { ...toPublic(config), registrazione_ccn: Array.isArray(c.registrazione_ccn) ? c.registrazione_ccn : [] };
}

async function getOrCreate() {
    const [config] = await PiattaformaConfig.findOrCreate({ where: { id: CONFIG_ID }, defaults: { id: CONFIG_ID } });
    return config;
}

function removeUploadedFile(relPath) {
    if (!relPath || !relPath.startsWith('uploads/')) return;
    const abs = path.join(UPLOAD_DIR, path.basename(relPath));
    fs.unlink(abs, () => {}); // best effort
}

module.exports = {
    sanitizeDescrizioneHtml,

    // Destinatari in CCN dell'email di registrazione (usato da utils/emailRegistrazione)
    async getRegistrazioneCcn() {
        const config = await PiattaformaConfig.findByPk(CONFIG_ID);
        return Array.isArray(config?.registrazione_ccn) ? config.registrazione_ccn : [];
    },

    // GET /piattaforma — configurazione completa, campi privati inclusi (solo superuser)
    async getPrivate(req, res) {
        try {
            const config = await PiattaformaConfig.findByPk(CONFIG_ID);
            return res.json(toPrivate(config));
        } catch (error) {
            console.error('Errore lettura configurazione piattaforma:', error);
            return res.status(500).json({ error: 'Errore lettura configurazione' });
        }
    },

    // GET /public/piattaforma — pubblico: serve alla pagina di login prima dell'accesso
    async getPublic(req, res) {
        try {
            const config = await PiattaformaConfig.findByPk(CONFIG_ID);
            res.set('Cache-Control', 'no-cache');
            return res.json(toPublic(config));
        } catch (error) {
            console.error('Errore lettura configurazione piattaforma:', error);
            return res.status(500).json({ error: 'Errore lettura configurazione' });
        }
    },

    // PUT /piattaforma — solo superuser. Campi vuoti = ripristino del default.
    async update(req, res) {
        try {
            const body = req.body || {};
            const updates = {};

            for (const [field, max] of Object.entries(TEXT_FIELDS)) {
                if (body[field] === undefined) continue;
                const v = typeof body[field] === 'string' ? body[field].trim() : '';
                if (v.length > max) return res.status(400).json({ error: `${field}: massimo ${max} caratteri` });
                updates[field] = v || null;
            }
            for (const field of ['colore_primario', 'colore_header']) {
                if (body[field] === undefined) continue;
                const v = body[field] || null;
                if (v !== null && !HEX_COLOR.test(v)) return res.status(400).json({ error: `${field}: colore non valido (formato #rrggbb)` });
                updates[field] = v ? v.toLowerCase() : null;
            }
            if (body.descrizione_html !== undefined) {
                updates.descrizione_html = sanitizeDescrizioneHtml(body.descrizione_html);
            }
            if (body.registrazione_ccn !== undefined) {
                const { list, error } = parseEmailList(body.registrazione_ccn);
                if (error) return res.status(400).json({ error, field: 'registrazione_ccn' });
                updates.registrazione_ccn = list;
            }

            const config = await getOrCreate();
            await config.update(updates);
            return res.json(toPrivate(config));
        } catch (error) {
            console.error('Errore salvataggio configurazione piattaforma:', error);
            return res.status(500).json({ error: 'Errore salvataggio configurazione' });
        }
    },

    // POST /piattaforma/:tipo (logo | favicon) — solo superuser, multipart campo "file"
    async uploadAsset(req, res) {
        try {
            if (!req.file) return res.status(400).json({ error: 'Nessun file caricato' });
            const field = req.params.tipo === 'logo' ? 'logo_path' : 'favicon_path';
            const config = await getOrCreate();
            const previous = config[field];
            await config.update({ [field]: `uploads/${req.file.filename}` });
            removeUploadedFile(previous);
            return res.json(toPublic(config));
        } catch (error) {
            console.error('Errore upload asset piattaforma:', error);
            return res.status(500).json({ error: 'Errore caricamento file' });
        }
    },

    // DELETE /piattaforma/:tipo (logo | favicon) — solo superuser: torna al default
    async deleteAsset(req, res) {
        try {
            const field = req.params.tipo === 'logo' ? 'logo_path' : 'favicon_path';
            const config = await getOrCreate();
            const previous = config[field];
            await config.update({ [field]: null });
            removeUploadedFile(previous);
            return res.json(toPublic(config));
        } catch (error) {
            console.error('Errore rimozione asset piattaforma:', error);
            return res.status(500).json({ error: 'Errore rimozione file' });
        }
    },
};
