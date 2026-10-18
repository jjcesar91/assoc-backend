const models = require('../models');
const { ensureLicenza } = require('../utils/licenze');

const { Licenza, Societa } = models;

const PIANI = ['free', 'pro', 'advanced'];
const STATI = ['attiva', 'sospesa', 'scaduta'];
const ANNI = ['solare', 'sportivo', 'personalizzato'];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const GG_MM = /^\d{2}-\d{2}$/;

// Campi testuali della snapshot con la lunghezza massima
const TEXT_FIELDS = {
    associazione: 255, tipologia: 255, email: 255, indirizzo: 255, cap: 10, comune: 255,
    provincia: 30, affiliazioni: 2000, presidente: 255, telefono: 50,
    referente_nome: 255, referente_telefono: 50, note: 5000,
};

module.exports = {
    // GET /licenze — riepilogo per l'elenco Iscrizioni
    async list(req, res) {
        try {
            const licenze = await Licenza.findAll({
                attributes: ['societa_id', 'piano', 'stato', 'data_inizio', 'data_scadenza'],
            });
            return res.json(licenze);
        } catch (error) {
            console.error('Errore elenco licenze:', error);
            return res.status(500).json({ error: 'Errore lettura licenze' });
        }
    },

    // GET /licenze/:societaId — licenza completa (creata Free se mancante)
    async get(req, res) {
        try {
            const societa = await Societa.findByPk(req.params.societaId);
            if (!societa) return res.status(404).json({ error: 'Società non trovata' });
            const licenza = await ensureLicenza(models, societa);
            return res.json(licenza);
        } catch (error) {
            console.error('Errore lettura licenza:', error);
            return res.status(500).json({ error: 'Errore lettura licenza' });
        }
    },

    // PUT /licenze/:societaId — aggiorna piano, stato, date e dati di registrazione
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
            }
            if (body.anno_associativo_inizio !== undefined) {
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
            // L'inizio personalizzato ha senso solo con anno personalizzato
            const tipoFinale = updates.anno_associativo_tipo !== undefined ? updates.anno_associativo_tipo : undefined;
            if (tipoFinale !== undefined && tipoFinale !== 'personalizzato') updates.anno_associativo_inizio = null;

            const societa = await Societa.findByPk(req.params.societaId);
            if (!societa) return res.status(404).json({ error: 'Società non trovata' });
            const licenza = await ensureLicenza(models, societa);
            const inizio = updates.data_inizio !== undefined ? updates.data_inizio : licenza.data_inizio;
            const scadenza = updates.data_scadenza !== undefined ? updates.data_scadenza : licenza.data_scadenza;
            if (inizio && scadenza && scadenza < inizio) {
                return res.status(400).json({ error: 'La data di scadenza è precedente alla data di inizio' });
            }
            await licenza.update(updates);
            return res.json(licenza);
        } catch (error) {
            console.error('Errore salvataggio licenza:', error);
            return res.status(400).json({ error: error.message || 'Errore salvataggio licenza' });
        }
    },
};
