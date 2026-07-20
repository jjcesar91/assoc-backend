const crypto = require('crypto');
const { Payment, Conto, RicevutaToken } = require('../models');

// Ordini creati dal socio nella propria area riservata ("frontend socio").
//
// Regole invarianti, applicate qui e non delegate al client:
//   - l'ordine è sempre una PROFORMA: diventa ordine solo quando un operatore di
//     backoffice lo registra, anche se la ricevuta è già stata caricata;
//   - origine = 'cliente', così il backoffice distingue questi ordini dai propri;
//   - socio_id e societa_id vengono dal token, mai dal body;
//   - i prezzi sono ricalcolati dal catalogo, mai accettati dal client;
//   - acquistabili solo i prodotti visibili e vendibili online della società.

const VALIDITA_TOKEN_MS = 72 * 60 * 60 * 1000; // 72 ore, come i link inviati via email

function productsUrl() {
    return process.env.PRODUCTS_SERVICE_URL || 'http://products_ms:3000';
}

function usersUrl() {
    return process.env.USERS_SERVICE_URL || 'http://users_ms:3000';
}

// Identità del socio ricavata esclusivamente dal token.
function getSocioContext(req) {
    if (req.user?.role !== 'socio') return null;
    const socioId = req.user.socio_ref_id;
    const societaId = req.user.societaId;
    if (!socioId || !societaId) return null;
    return { socioId, societaId };
}

function formatEuro(value) {
    return Number(value || 0).toFixed(2).replace('.', ',');
}

// Catalogo acquistabile online: la selezione avviene qui perché è anche il
// filtro di sicurezza usato in fase di creazione dell'ordine.
async function fetchCatalogoOnline(societaId, authHeader) {
    const headers = authHeader ? { Authorization: authHeader } : {};
    const res = await fetch(`${productsUrl()}/api?societaId=${societaId}`, { headers });
    if (!res.ok) throw new Error(`products-service ha risposto ${res.status}`);
    const list = await res.json();
    return (Array.isArray(list) ? list : []).filter(p => p.sellableOnline && p.visible);
}

async function fetchSocio(socioId, authHeader) {
    try {
        const headers = authHeader ? { Authorization: authHeader } : {};
        const res = await fetch(`${usersUrl()}/api/soci/${socioId}`, { headers });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error('fetchSocio:', e.message);
        return null;
    }
}

function nominativoSocio(socio) {
    if (!socio) return '';
    if (socio.tipo_socio === 'associazione') return socio.ragione_sociale || '';
    return [socio.nome, socio.cognome].filter(Boolean).join(' ');
}

const SocioOrdineController = {
    // GET /api/socio/catalogo
    // Prodotti della società del socio vendibili online.
    getCatalogo: async (req, res) => {
        const ctx = getSocioContext(req);
        if (!ctx) return res.status(403).json({ error: 'Accesso riservato ai soci' });
        try {
            const prodotti = await fetchCatalogoOnline(ctx.societaId, req.headers['authorization']);
            return res.json(prodotti);
        } catch (err) {
            console.error('Errore getCatalogo socio:', err);
            return res.status(502).json({ error: 'Catalogo non disponibile' });
        }
    },

    // GET /api/socio/conti-bonifico
    // Solo i conti bonifico della società del socio: sono gli unici metodi di
    // pagamento selezionabili in autonomia dal cliente.
    getContiBonifico: async (req, res) => {
        const ctx = getSocioContext(req);
        if (!ctx) return res.status(403).json({ error: 'Accesso riservato ai soci' });
        try {
            const conti = await Conto.findAll({ where: { societa_id: ctx.societaId } });
            const bonifici = conti
                .filter(c => (c.modalita_pagamento || '').toLowerCase() === 'bonifico')
                .map(c => ({
                    id: c.id,
                    descrizione: c.descrizione,
                    iban: c.iban,
                    istruzioni_pagamento: c.istruzioni_pagamento,
                    predefinito: c.predefinito,
                }));
            return res.json(bonifici);
        } catch (err) {
            console.error('Errore getContiBonifico socio:', err);
            return res.status(500).json({ error: 'Errore lettura conti' });
        }
    },

    // GET /api/socio/ordini
    // Solo gli ordini del socio loggato.
    getOrdini: async (req, res) => {
        const ctx = getSocioContext(req);
        if (!ctx) return res.status(403).json({ error: 'Accesso riservato ai soci' });
        try {
            const ordini = await Payment.findAll({
                where: { societa_id: ctx.societaId, socio_id: ctx.socioId, origine: 'cliente' },
                order: [['createdAt', 'DESC']],
            });
            // Il socio non deve percepire il passaggio proforma → ordine: espongo
            // solo ciò che gli serve, senza tipo_documento né numero ricevuta.
            return res.json(ordini.map(o => ({
                id: o.id,
                createdAt: o.createdAt,
                data_pagamento: o.data_pagamento,
                importo: o.importo,
                modalita_pagamento: o.modalita_pagamento,
                conto_destinazione: o.conto_destinazione,
                note: o.note,
                payment_items: o.payment_items,
                annullato: !!o.stato_pagamento?.startsWith('3.'),
                ricevuta_file_nome: o.ricevuta_file_nome,
                ricevuta_uploaded_at: o.ricevuta_uploaded_at,
            })));
        } catch (err) {
            console.error('Errore getOrdini socio:', err);
            return res.status(500).json({ error: 'Errore lettura ordini' });
        }
    },

    // POST /api/socio/ordini
    // body: { items: [{ product_id, qty }], conto_id, note }
    createOrdine: async (req, res) => {
        const ctx = getSocioContext(req);
        if (!ctx) return res.status(403).json({ error: 'Accesso riservato ai soci' });

        const { items, conto_id, note } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Il carrello è vuoto' });
        }
        if (!conto_id) {
            return res.status(400).json({ error: 'Seleziona un metodo di pagamento' });
        }

        try {
            const conto = await Conto.findByPk(conto_id);
            if (!conto
                || String(conto.societa_id) !== String(ctx.societaId)
                || (conto.modalita_pagamento || '').toLowerCase() !== 'bonifico') {
                return res.status(400).json({ error: 'Metodo di pagamento non valido' });
            }

            const catalogo = await fetchCatalogoOnline(ctx.societaId, req.headers['authorization']);
            const byId = new Map(catalogo.map(p => [String(p.id), p]));

            const paymentItems = [];
            const quoteParts = [];
            for (const raw of items) {
                const prodotto = byId.get(String(raw?.product_id));
                if (!prodotto) {
                    return res.status(400).json({ error: 'Uno dei prodotti selezionati non è più acquistabile online' });
                }
                const qty = parseInt(raw?.qty, 10);
                if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
                    return res.status(400).json({ error: `Quantità non valida per "${prodotto.description}"` });
                }
                const prezzoUnitario = parseFloat(prodotto.basePrice || 0);
                const importoRiga = Math.round(prezzoUnitario * qty * 100) / 100;

                paymentItems.push({
                    product_id: prodotto.id,
                    importo: importoRiga,
                    quote_types: prodotto.type || '',
                    qty,
                    prezzo_unitario: prezzoUnitario,
                    periodicity_tesseramento: prodotto.type === 'tesseramento' ? (prodotto.periodicity || null) : null,
                    data_inizio_abbonamento: null,
                    data_scadenza_abbonamento: null,
                });
                quoteParts.push(`${prodotto.description} (x${qty}) €${formatEuro(importoRiga)}`);
            }

            const totale = Math.round(paymentItems.reduce((s, i) => s + i.importo, 0) * 100) / 100;
            if (totale <= 0) {
                return res.status(400).json({ error: 'Il totale dell\'ordine non è valido' });
            }

            const socio = await fetchSocio(ctx.socioId, req.headers['authorization']);
            const tessItem = paymentItems.find(i => i.quote_types === 'tesseramento');
            const subItem = paymentItems.find(i => i.quote_types === 'subscription');
            const primaryItem = subItem || tessItem || paymentItems[0];
            const oggi = new Date().toISOString().split('T')[0];

            const created = await Payment.create({
                societa_id: ctx.societaId,
                socio_id: ctx.socioId,
                intestatario: nominativoSocio(socio) || req.user?.email || '',
                codice_fiscale: socio?.codice_fiscale || null,
                data_pagamento: oggi,
                importo: totale,
                quote: quoteParts.join(' + '),
                quote_types: [...new Set(paymentItems.map(i => i.quote_types).filter(Boolean))].join(','),
                payment_items: paymentItems,
                product_id: primaryItem.product_id,
                periodicity_tesseramento: tessItem?.periodicity_tesseramento || null,
                modalita_pagamento: 'Bonifico',
                conto_destinazione: conto.descrizione,
                note: (note || '').slice(0, 2000) || null,
                // Sempre proforma: la registrazione resta un atto del backoffice.
                tipo_documento: 'proforma',
                origine: 'cliente',
                utente_nome: nominativoSocio(socio) || 'SOCIO',
            });

            return res.status(201).json({
                id: created.id,
                importo: created.importo,
                conto_destinazione: created.conto_destinazione,
                istruzioni_pagamento: conto.istruzioni_pagamento || '',
                iban: conto.iban || '',
            });
        } catch (err) {
            console.error('Errore createOrdine socio:', err);
            return res.status(500).json({ error: 'Errore durante la creazione dell\'ordine' });
        }
    },

    // POST /api/socio/ordini/:id/ricevuta-token
    // Genera un token per riusare il flusso pubblico di caricamento ricevuta.
    // Il socio può farlo solo per i propri ordini ancora senza ricevuta.
    createRicevutaToken: async (req, res) => {
        const ctx = getSocioContext(req);
        if (!ctx) return res.status(403).json({ error: 'Accesso riservato ai soci' });
        try {
            const payment = await Payment.findByPk(req.params.id);
            if (!payment
                || String(payment.socio_id) !== String(ctx.socioId)
                || String(payment.societa_id) !== String(ctx.societaId)) {
                return res.status(404).json({ error: 'Ordine non trovato' });
            }
            if (payment.ricevuta_uploaded_at) {
                return res.status(409).json({ error: 'Ricevuta già caricata per questo ordine' });
            }

            const token = crypto.randomBytes(32).toString('hex');
            await RicevutaToken.create({
                token,
                payment_id: payment.id,
                societa_id: payment.societa_id,
                expires_at: new Date(Date.now() + VALIDITA_TOKEN_MS),
            });
            return res.status(201).json({ token });
        } catch (err) {
            console.error('Errore createRicevutaToken socio:', err);
            return res.status(500).json({ error: 'Errore generazione link di caricamento' });
        }
    },
};

module.exports = SocioOrdineController;
