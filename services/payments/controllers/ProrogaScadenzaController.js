const { Payment, sequelize } = require('../models');
const { registraEvento } = require('../utils/storicoRicevuta');

// Proroga della scadenza di un abbonamento (Scadenziario → Dettaglio scadenza).
//
// Regole:
//  - solo admin e superuser (gli admin solo sulle proprie società);
//  - solo ricevute attive: niente proforma né documenti annullati;
//  - solo voci di tipo abbonamento con una data di scadenza;
//  - la nuova data deve essere successiva a quella attuale (solo proroghe);
//  - motivazione obbligatoria;
//  - ogni proroga è registrata nello storico del socio (servizio users). Se lo
//    storico non si scrive la modifica viene annullata: niente proroghe senza traccia.
//
// La data modificata è quella già letta da Scadenziario, automazioni, scheda
// socio e area soci, che quindi si allineano senza altre modifiche.

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MOTIVO_MAX = 500;

const usersUrl = () => process.env.USERS_SERVICE_URL || 'http://users_ms:3000';
const productsUrl = () => process.env.PRODUCTS_SERVICE_URL || 'http://products_ms:3000';
const internalSecret = () => process.env.INTERNAL_API_SECRET || 'internal_secret_change_me';

const dataValida = (s) => DATA_RE.test(s) && !isNaN(new Date(`${s}T00:00:00Z`).getTime())
    && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

const formatIt = (s) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

const isAbbonamento = (t) => String(t || '').trim().toLowerCase() === 'subscription';

function vociDi(p) {
    let items = p.payment_items;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = null; } }
    return Array.isArray(items) ? items : [];
}

// Descrizione del prodotto per il testo dello storico (best-effort).
async function descrizioneProdotto(productId) {
    if (!productId) return null;
    try {
        const res = await fetch(`${productsUrl()}/api/public/${productId}`);
        if (!res.ok) return null;
        return (await res.json())?.description || null;
    } catch {
        return null;
    }
}

// Individua la scadenza da prorogare: voce abbonamento `voceIdx` dei payment_items
// oppure, per i pagamenti senza voci (vecchio formato), il campo del record.
// Stessa logica di scadenzeDelPagamento nello Scadenziario (frontend).
function trovaScadenza(p, voceIdx) {
    const voci = vociDi(p);
    if (voci.length > 0) {
        const v = voci[voceIdx];
        if (!v || !isAbbonamento(v.quote_types)) return null;
        const nAbbonamenti = voci.filter(x => isAbbonamento(x.quote_types)).length;
        const data = v.data_scadenza_abbonamento || (nAbbonamenti === 1 ? p.data_scadenza_abbonamento : null);
        return data ? { voci, idx: voceIdx, nAbbonamenti, productId: v.product_id ?? null, attuale: String(data).slice(0, 10) } : null;
    }
    const tipi = String(p.quote_types || '').split(',').map(t => t.trim().toLowerCase());
    if (!tipi.includes('subscription') || !p.data_scadenza_abbonamento) return null;
    return { voci: null, idx: 0, nAbbonamenti: 1, productId: p.product_id ?? null, attuale: String(p.data_scadenza_abbonamento).slice(0, 10) };
}

// PATCH /api/:id/proroga-scadenza  body: { voce_idx, nuova_data: 'AAAA-MM-GG', motivo }
exports.proroga = async (req, res) => {
    const user = req.user || {};
    if (!['admin', 'superuser'].includes(user.role)) {
        return res.status(403).json({ error: 'Solo gli amministratori possono prorogare una scadenza' });
    }

    const nuovaData = String(req.body?.nuova_data || '').trim();
    const motivo = String(req.body?.motivo || '').trim();
    const voceIdx = Number.isInteger(Number(req.body?.voce_idx)) ? Number(req.body.voce_idx) : 0;
    if (!dataValida(nuovaData)) return res.status(400).json({ error: 'Nuova data di scadenza non valida' });
    if (!motivo) return res.status(400).json({ error: 'La motivazione è obbligatoria' });
    if (motivo.length > MOTIVO_MAX) return res.status(400).json({ error: `La motivazione può avere al massimo ${MOTIVO_MAX} caratteri` });

    const t = await sequelize.transaction();
    try {
        const p = await Payment.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
        if (!p) { await t.rollback(); return res.status(404).json({ error: 'Pagamento non trovato' }); }

        const consentite = (user.societaIds || []).map(String);
        if (user.role !== 'superuser' && !consentite.includes(String(p.societa_id))) {
            await t.rollback();
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (p.tipo_documento === 'proforma' || String(p.stato_pagamento || '').startsWith('3.')) {
            await t.rollback();
            return res.status(400).json({ error: 'La proroga è consentita solo su ricevute attive (non proforma né annullate)' });
        }
        if (!p.socio_id) {
            await t.rollback();
            return res.status(400).json({ error: 'Il pagamento non è collegato a un socio' });
        }

        const scad = trovaScadenza(p, voceIdx);
        if (!scad) {
            await t.rollback();
            return res.status(400).json({ error: 'Nessuna scadenza di abbonamento da prorogare per questa voce' });
        }
        if (nuovaData <= scad.attuale) {
            await t.rollback();
            return res.status(400).json({ error: `La nuova data deve essere successiva alla scadenza attuale (${formatIt(scad.attuale)})` });
        }

        const patch = { modificato_da: user.email || user.username || null };
        if (scad.voci) {
            // data_scadenza_originale: la scadenza prima della prima proroga (mostrata nello Scadenziario)
            patch.payment_items = scad.voci.map((v, i) => (i === scad.idx
                ? { ...v, data_scadenza_abbonamento: nuovaData, data_scadenza_originale: v.data_scadenza_originale || scad.attuale }
                : v));
            // Il campo del record rispecchia l'abbonamento quando è uno solo (o coincide con la voce)
            const topLevel = p.data_scadenza_abbonamento ? String(p.data_scadenza_abbonamento).slice(0, 10) : null;
            if (scad.nAbbonamenti === 1 || topLevel === scad.attuale) patch.data_scadenza_abbonamento = nuovaData;
        } else {
            patch.data_scadenza_abbonamento = nuovaData;
        }
        await p.update(patch, { transaction: t });

        const prodotto = await descrizioneProdotto(scad.productId);
        const rif = p.numero_ricevuta ? ` (ricevuta n. ${p.numero_ricevuta})` : '';
        const storicoRes = await fetch(`${usersUrl()}/api/internal/soci/${p.socio_id}/storico`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-secret': internalSecret() },
            body: JSON.stringify({
                societa_id: p.societa_id,
                tipo: 'proroga',
                azione: `Scadenza abbonamento${prodotto ? ` "${prodotto}"` : ''} prorogata dal ${formatIt(scad.attuale)} al ${formatIt(nuovaData)}${rif}. Motivo: ${motivo}`,
                dettagli: {
                    payment_id: p.id,
                    numero_ricevuta: p.numero_ricevuta || null,
                    voce_idx: scad.idx,
                    product_id: scad.productId,
                    prodotto,
                    data_precedente: scad.attuale,
                    data_nuova: nuovaData,
                    motivo,
                },
                owner_id: user.id || null,
                owner_label: user.email || 'Operatore',
            }),
        }).catch(err => ({ ok: false, status: err.message }));
        if (!storicoRes.ok) {
            await t.rollback();
            console.error('Proroga annullata: storico non scritto', storicoRes.status);
            return res.status(502).json({ error: 'Impossibile registrare la proroga nello storico del socio: nessuna modifica effettuata. Riprova.' });
        }

        // Storico della ricevuta (lo storico socio è già scritto sopra, con tipo 'proroga')
        await registraEvento({
            p: p.get({ plain: true }), tipo: 'proroga', user, origine: 'scadenziario', transaction: t, storicoSocio: false,
            descrizione: `Scadenza abbonamento${prodotto ? ` "${prodotto}"` : ''} prorogata. Motivo: ${motivo}`,
            modifiche: [{ campo: 'data_scadenza_abbonamento', etichetta: 'Scadenza abbonamento', da: formatIt(scad.attuale), a: formatIt(nuovaData) }],
        });

        await t.commit();
        return res.json(await Payment.findByPk(p.id));
    } catch (err) {
        if (!t.finished) await t.rollback();
        console.error('Errore proroga scadenza:', err);
        return res.status(500).json({ error: 'Errore durante la proroga della scadenza' });
    }
};
