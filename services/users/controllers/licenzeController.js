const { Op } = require('sequelize');
const models = require('../models');
const { toDateOnly } = require('../utils/licenze');
const { getLicenzaContext, contaSociLicenza } = require('../utils/licenzaContext');
const { inviaEmailAttivazione } = require('../utils/emailAttivazione');

const { Licenza, Societa } = models;

const PIANI = ['free', 'pro', 'advanced'];
const STATI = ['attiva', 'in_attesa', 'sospesa', 'scaduta'];
const ANNI = ['solare', 'sportivo', 'personalizzato'];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const GG_MM = /^\d{2}-\d{2}$/;

// Campi testuali della snapshot con la lunghezza massima
const TEXT_FIELDS = {
    associazione: 255, tipologia: 255, email: 255, indirizzo: 255, cap: 10, comune: 255,
    provincia: 30, affiliazioni: 2000, presidente: 255, telefono: 50,
    referente_nome: 255, referente_telefono: 50, note: 5000,
};

const SOCIETA_ATTRS = ['id', 'denominazione', 'tipo_associazione', 'codice_fiscale', 'email', 'comune', 'createdAt'];

module.exports = {
    // GET /licenze — elenco per Backoffice → Licenze (con le società di ognuna)
    async list(req, res) {
        try {
            const [licenze, societa] = await Promise.all([
                Licenza.findAll({ order: [['createdAt', 'DESC']] }),
                Societa.findAll({ where: { licenza_id: { [Op.ne]: null } }, attributes: ['id', 'licenza_id', 'denominazione'] }),
            ]);
            const byLicenza = {};
            societa.forEach(s => { (byLicenza[s.licenza_id] = byLicenza[s.licenza_id] || []).push({ id: s.id, denominazione: s.denominazione }); });
            return res.json(licenze.map(l => ({
                id: l.id,
                nome: l.associazione,
                piano: l.piano,
                stato: l.stato,
                data_inizio: l.data_inizio,
                data_scadenza: l.data_scadenza,
                createdAt: l.createdAt,
                societa_registrazione_id: l.societa_id,
                societa: byLicenza[l.id] || [],
            })));
        } catch (error) {
            console.error('Errore elenco licenze:', error);
            return res.status(500).json({ error: 'Errore lettura licenze' });
        }
    },

    // GET /licenze/:id — licenza completa con le sue società
    async get(req, res) {
        try {
            const licenza = await Licenza.findByPk(req.params.id);
            if (!licenza) return res.status(404).json({ error: 'Licenza non trovata' });
            const societa = await Societa.findAll({
                where: { licenza_id: licenza.id },
                attributes: SOCIETA_ATTRS,
                order: [['createdAt', 'ASC']],
            });
            return res.json({ ...licenza.toJSON(), societa });
        } catch (error) {
            console.error('Errore lettura licenza:', error);
            return res.status(500).json({ error: 'Errore lettura licenza' });
        }
    },

    // PUT /licenze/:id — piano, stato, date, note e dati di registrazione
    async update(req, res) {
        try {
            const body = req.body || {};
            const updates = {};

            if (body.piano !== undefined) {
                if (!PIANI.includes(body.piano)) return res.status(400).json({ error: 'Piano non valido' });
                updates.piano = body.piano;
            }
            if (body.stato !== undefined) {
                if (!STATI.includes(body.stato)) return res.status(400).json({ error: 'Stato non valido' });
                updates.stato = body.stato;
            }
            for (const f of ['data_inizio', 'data_scadenza']) {
                if (body[f] === undefined) continue;
                const v = body[f] || null;
                if (v !== null && !DATE_ONLY.test(v)) return res.status(400).json({ error: `${f}: data non valida` });
                updates[f] = v;
            }
            if (body.anno_associativo_tipo !== undefined) {
                const v = body.anno_associativo_tipo || null;
                if (v !== null && !ANNI.includes(v)) return res.status(400).json({ error: 'Anno associativo non valido' });
                updates.anno_associativo_tipo = v;
                if (v !== 'personalizzato') updates.anno_associativo_inizio = null;
            }
            if (body.anno_associativo_inizio !== undefined && updates.anno_associativo_inizio === undefined) {
                const v = body.anno_associativo_inizio || null;
                if (v !== null && !GG_MM.test(v)) return res.status(400).json({ error: 'Inizio anno associativo non valido (gg-mm)' });
                updates.anno_associativo_inizio = v;
            }
            for (const [f, max] of Object.entries(TEXT_FIELDS)) {
                if (body[f] === undefined) continue;
                const v = typeof body[f] === 'string' ? body[f].trim() : '';
                if (v.length > max) return res.status(400).json({ error: `${f}: massimo ${max} caratteri` });
                updates[f] = v || null;
            }

            const licenza = await Licenza.findByPk(req.params.id);
            if (!licenza) return res.status(404).json({ error: 'Licenza non trovata' });

            // Attivazione di una licenza registrata dal sito: data inizio = oggi se non indicata
            if (updates.stato === 'attiva' && licenza.stato !== 'attiva' && !(updates.data_inizio ?? licenza.data_inizio)) {
                updates.data_inizio = toDateOnly(new Date());
            }
            const inizio = updates.data_inizio !== undefined ? updates.data_inizio : licenza.data_inizio;
            const scadenza = updates.data_scadenza !== undefined ? updates.data_scadenza : licenza.data_scadenza;
            if (inizio && scadenza && scadenza < inizio) {
                return res.status(400).json({ error: 'La data di scadenza è precedente alla data di inizio' });
            }
            // Prima attivazione (registrazione in attesa → attiva): email agli
            // amministratori con piano e link per impostare la password
            const primaAttivazione = licenza.stato === 'in_attesa' && updates.stato === 'attiva';
            await licenza.update(updates);
            if (!primaAttivazione) return res.json(licenza);
            let email_attivazione;
            try {
                email_attivazione = await inviaEmailAttivazione({ licenza, origin: req.headers.origin });
                console.log(`[licenze] licenza ${licenza.id} attivata: email a ${email_attivazione.inviate.join(', ') || 'nessuno'}`);
            } catch (err) {
                console.error(`[licenze] licenza ${licenza.id} attivata, email di attivazione non inviate:`, err.message);
                email_attivazione = { inviate: [], errori: [{ email: null, errore: err.message }] };
            }
            return res.json({ ...licenza.toJSON(), email_attivazione });
        } catch (error) {
            console.error('Errore salvataggio licenza:', error);
            return res.status(400).json({ error: error.message || 'Errore salvataggio licenza' });
        }
    },

    // GET /licenza-corrente?societaId= — piano, limiti e utilizzo per la società
    // attiva (o una delle società consentite) dell'utente. bypass = superuser.
    async corrente(req, res) {
        try {
            const role = req.user?.role;
            const tokenSocieta = Number.isInteger(req.user?.societaId) ? req.user.societaId : null;
            const consentite = Array.isArray(req.user?.societaIds) ? req.user.societaIds : [];
            const societaId = req.query.societaId ? parseInt(req.query.societaId, 10) : tokenSocieta;
            if (!societaId) return res.json(null);
            if (role !== 'superuser' && societaId !== tokenSocieta && !consentite.includes(societaId)) {
                return res.status(403).json({ error: 'Società non consentita' });
            }
            const ctx = await getLicenzaContext(models, societaId);
            if (!ctx) return res.json(null);
            const soci = await contaSociLicenza(models, ctx.societaIds);
            return res.json({
                licenza_id: ctx.licenza_id,
                piano: ctx.piano,
                piano_nome: ctx.piano_nome,
                stato: ctx.stato,
                limiti: ctx.limiti,
                utilizzo: { soci },
                bypass: role === 'superuser',
            });
        } catch (error) {
            console.error('Errore licenza corrente:', error);
            return res.status(500).json({ error: 'Errore lettura licenza' });
        }
    },

    // --- Interni (service-to-service, x-internal-secret) -----------------------

    // GET /internal/licenza-limiti?societaId= → { licenza_id, piano, piano_nome, stato, limiti, societaIds }
    async internalLimiti(req, res) {
        try {
            const societaId = parseInt(req.query.societaId, 10);
            if (!Number.isInteger(societaId)) return res.json(null);
            return res.json(await getLicenzaContext(models, societaId));
        } catch (error) {
            console.error('Errore limiti licenza (interno):', error);
            return res.status(500).json({ error: 'Errore lettura licenza' });
        }
    },

    // GET /internal/licenze-stato?societaIds=1,2 → { "1": { licenza_id, stato } }
    // Usato da auth per consentire l'accesso al gestionale solo con licenza attiva.
    async internalStato(req, res) {
        try {
            const ids = String(req.query.societaIds || '')
                .split(',').map(v => parseInt(v, 10)).filter(Number.isInteger).slice(0, 500);
            if (!ids.length) return res.json({});
            const societa = await Societa.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'licenza_id'] });
            const licenzaIds = [...new Set(societa.map(s => s.licenza_id).filter(Boolean))];
            const licenze = await Licenza.findAll({ where: { id: { [Op.in]: licenzaIds } }, attributes: ['id', 'stato'] });
            const stati = Object.fromEntries(licenze.map(l => [l.id, l.stato]));
            const out = {};
            societa.forEach(s => { if (s.licenza_id) out[s.id] = { licenza_id: s.licenza_id, stato: stati[s.licenza_id] || null }; });
            return res.json(out);
        } catch (error) {
            console.error('Errore stato licenze (interno):', error);
            return res.status(500).json({ error: 'Errore lettura licenze' });
        }
    },

    // GET /internal/societa-licenze → [{ societa_id, licenza_id }]
    async internalSocietaLicenze(req, res) {
        try {
            const societa = await Societa.findAll({ where: { licenza_id: { [Op.ne]: null } }, attributes: ['id', 'licenza_id'] });
            return res.json(societa.map(s => ({ societa_id: s.id, licenza_id: s.licenza_id })));
        } catch (error) {
            console.error('Errore mappa società-licenze (interno):', error);
            return res.status(500).json({ error: 'Errore lettura licenze' });
        }
    },
};
