const { Payment } = require('../models');

// Creazione della proforma associata alla pagina pubblica
// /ricevuta-telematica/:societaId (nessuna autenticazione).
//
// Invarianti (stesso principio di SocioOrdineController.createOrdine):
//   - è sempre una PROFORMA: diventa ricevuta solo quando un operatore di
//     backoffice la registra (PATCH /:id/converti-proforma);
//   - origine = 'cliente';
//   - il prezzo non è mai accettato dal client: viene sempre ricalcolato qui
//     interrogando il servizio prodotti per il prodotto configurato in
//     Ricevute Telematiche (Societa.ricevuta_telematica_prodotto_id).

function productsUrl() {
    return process.env.PRODUCTS_SERVICE_URL || 'http://products_ms:3000';
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

            const prezzoUnitario = parseFloat(prodotto.basePrice || 0);
            const oggi = new Date().toISOString().split('T')[0];
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
                utente_nome: nominativo || 'RICEVUTA TELEMATICA',
            });

            return res.status(201).json({ id: created.id, importo: created.importo });
        } catch (err) {
            console.error('Errore creazione proforma telematica:', err);
            return res.status(500).json({ error: 'Errore durante la creazione della proforma' });
        }
    },
};
