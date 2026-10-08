const { Payment } = require('../models');
const { findDocumentoSocioInAnno, hasQuotaAssociativa } = require('./PaymentController');

// Creazione della proforma associata alla pagina pubblica
// /ricevuta-telematica/:societaId (nessuna autenticazione).
//
// Invarianti (stesso principio di SocioOrdineController.createOrdine):
//   - è sempre una PROFORMA: diventa ricevuta solo quando un operatore di
//     backoffice la registra (PATCH /:id/converti-proforma), qui in blocco
//     dalla pagina "Ricevute Telematiche > Invio Ricevute";
//   - origine = 'cliente' (stesso valore delle altre proforme self-service,
//     per non alterare badge/viste esistenti — es. "DA CLIENTE" in Ricevute.jsx);
//   - marcata con l'etichetta ETICHETTA_RICEVUTA_TELEMATICA, unico modo per
//     distinguerla dalle altre proforme 'cliente' (es. area soci) nella lista
//     "Invio Ricevute", che filtra su questa etichetta;
//   - il prezzo non è mai accettato dal client: viene sempre ricalcolato qui
//     interrogando il servizio prodotti per il prodotto configurato in
//     Ricevute Telematiche (Societa.ricevuta_telematica_prodotto_id).

const ETICHETTA_RICEVUTA_TELEMATICA = 'Ricevuta Telematica';

function productsUrl() {
    return process.env.PRODUCTS_SERVICE_URL || 'http://products_ms:3000';
}

// Aggiunge un'etichetta alla stringa comma-separated se non già presente
// (stesso helper di RicevutaController.js, duplicato perché non esportato lì).
function addEtichetta(etichetteStr, nuova) {
    const list = (etichetteStr || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    if (!list.some(e => e.toLowerCase() === nuova.toLowerCase())) {
        list.push(nuova);
    }
    return list.join(',');
}

function usersUrl() {
    return process.env.USERS_SERVICE_URL || 'http://users_ms:3000';
}

// Tipo di anno contabile della società dall'endpoint pubblico del servizio users
// (qui non c'è un token: si inoltra il cookie del certificato Ricevuta Telematica,
// lo stesso richiesto alla pagina pubblica). In caso di errore: anno solare.
async function fetchSocietaTipoPubblico(societaId, cookieHeader) {
    try {
        const headers = cookieHeader ? { Cookie: cookieHeader } : {};
        const res = await fetch(`${usersUrl()}/api/public/societa/${societaId}`, { headers });
        if (res.ok) {
            const s = await res.json();
            return { tipo: s.tipo_anno_associativo || 'solare', dataInizio: s.data_inizio_anno_associativo || '01-01' };
        }
        console.error(`fetchSocietaTipoPubblico: risposta non ok (${res.status}) per societa ${societaId}`);
    } catch (err) {
        console.error('fetchSocietaTipoPubblico:', err.message);
    }
    return { tipo: 'solare', dataInizio: '01-01' };
}

// true se il documento contiene il prodotto (riga principale o payment_items)
function contieneProdotto(p, prodottoId) {
    if (String(p.product_id) === String(prodottoId)) return true;
    const items = Array.isArray(p.payment_items) ? p.payment_items : [];
    return items.some(i => String(i.product_id) === String(prodottoId));
}

async function fetchProdottoPubblico(id) {
    try {
        const res = await fetch(`${productsUrl()}/api/public/${id}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        console.error('fetchProdottoPubblico:', err.message);
        return null;
    }
}

module.exports = {
    // POST /api/public/proforma-telematica
    // body: { societa_id, prodotto_id, socio: { id, nome, cognome, codice_fiscale } }
    create: async (req, res) => {
        try {
            const { societa_id, prodotto_id, socio } = req.body || {};
            if (!societa_id || !prodotto_id || !socio?.id) {
                return res.status(400).json({ error: 'Dati mancanti per la creazione della proforma' });
            }

            const prodotto = await fetchProdottoPubblico(prodotto_id);
            if (!prodotto || String(prodotto.societaId) !== String(societa_id)) {
                return res.status(400).json({ error: 'Prodotto non valido per questa società' });
            }

            const oggi = new Date().toISOString().split('T')[0];

            // Niente proforma se nell'anno contabile corrente esiste già, per lo
            // stesso socio, una proforma o una ricevuta (non annullata) dello stesso
            // prodotto — o di una qualsiasi quota associativa se il prodotto lo è.
            const esistente = await findDocumentoSocioInAnno({
                societa_id,
                socio_id: socio.id,
                codice_fiscale: socio.codice_fiscale || null,
                data_pagamento: oggi,
                societaTipo: await fetchSocietaTipoPubblico(societa_id, req.headers['cookie']),
                includeProforma: true,
                match: p => contieneProdotto(p, prodotto.id)
                    || (prodotto.type === 'quota_associativa' && hasQuotaAssociativa(p.quote_types)),
            });
            if (esistente) {
                const isProforma = esistente.tipo_documento === 'proforma';
                const rif = !isProforma && esistente.numero_ricevuta ? ` n. ${esistente.numero_ricevuta}` : '';
                return res.status(409).json({
                    error: `Per questo socio esiste già ${isProforma ? 'una proforma' : `una ricevuta${rif}`} per l'anno in corso: la proforma non è stata generata.`,
                    code: 'PROFORMA_TELEMATICA_DUPLICATA',
                    payment_id: esistente.id,
                    tipo_documento: esistente.tipo_documento || 'pagamento',
                });
            }

            const prezzoUnitario = parseFloat(prodotto.basePrice || 0);
            const nominativo = [socio.nome, socio.cognome].filter(Boolean).join(' ');
            const periodicity = prodotto.type === 'tesseramento' ? (prodotto.periodicity || null) : null;

            const created = await Payment.create({
                societa_id,
                socio_id: socio.id,
                intestatario: nominativo,
                codice_fiscale: socio.codice_fiscale || null,
                data_pagamento: oggi,
                importo: prezzoUnitario,
                quote: prodotto.description,
                quote_types: prodotto.type || '',
                payment_items: [{
                    product_id: prodotto.id,
                    importo: prezzoUnitario,
                    quote_types: prodotto.type || '',
                    qty: 1,
                    prezzo_unitario: prezzoUnitario,
                    periodicity_tesseramento: periodicity,
                    data_inizio_abbonamento: null,
                    data_scadenza_abbonamento: null,
                }],
                product_id: prodotto.id,
                periodicity_tesseramento: periodicity,
                // Sempre proforma: la registrazione resta un atto del backoffice.
                tipo_documento: 'proforma',
                origine: 'cliente',
                etichette: addEtichetta(null, ETICHETTA_RICEVUTA_TELEMATICA),
                utente_nome: nominativo || 'RICEVUTA TELEMATICA',
            });

            return res.status(201).json({ id: created.id, importo: created.importo });
        } catch (err) {
            console.error('Errore creazione proforma telematica:', err);
            return res.status(500).json({ error: 'Errore durante la creazione della proforma' });
        }
    },
};
