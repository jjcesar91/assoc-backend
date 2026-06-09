const { Payment } = require('../models');
const { Op } = require('sequelize');

// Restituisce la data di inizio dell'anno associativo corrente (come stringa YYYY-MM-DD)
// Se targetAnno è specificato, restituisce l'inizio di quell'anno specifico
function getAnnoStart(tipo, dataInizio, targetAnno) {
    let dd = 1, mm = 1;
    if (tipo === 'associativo') {
        dd = 1; mm = 9;
    } else if (tipo === 'personalizzato' && dataInizio) {
        const parts = dataInizio.split('-');
        dd = parseInt(parts[0], 10);
        mm = parseInt(parts[1], 10);
    }
    // 'solare': dd=1 mm=1 (default)

    if (targetAnno != null) {
        return new Date(targetAnno, mm - 1, dd).toISOString().split('T')[0];
    }

    const today = new Date();
    const year = today.getFullYear();
    const startThisYear = new Date(year, mm - 1, dd);
    const startDate = today >= startThisYear ? startThisYear : new Date(year - 1, mm - 1, dd);
    return startDate.toISOString().split('T')[0];
}

// Restituisce la data di fine (esclusiva) dell'anno associativo (inizio del periodo successivo)
function getAnnoEnd(tipo, dataInizio, targetAnno) {
    const startStr = getAnnoStart(tipo, dataInizio, targetAnno);
    const start = new Date(startStr);
    let dd = 1, mm = 1;
    if (tipo === 'associativo') {
        dd = 1; mm = 9;
    } else if (tipo === 'personalizzato' && dataInizio) {
        const parts = dataInizio.split('-');
        dd = parseInt(parts[0], 10);
        mm = parseInt(parts[1], 10);
    }
    return new Date(start.getFullYear() + 1, mm - 1, dd).toISOString().split('T')[0];
}

// Formatta il numero ricevuta secondo la convenzione:
// - Anno solare:         N/ANNO        (es. 10/2026)
// - Anno non solare:     N/ANNO1-AA2   (es. 10/2025-26)
// dataRicevuta: stringa YYYY-MM-DD (opzionale, default oggi)
function formatNumeroRicevuta(numero, tipo, dataInizio, dataRicevuta) {
    const dataRef = dataRicevuta ? new Date(dataRicevuta) : new Date();
    const year = dataRef.getFullYear();

    if (tipo === 'solare') {
        return `${numero}/${year}`;
    }

    let dd = 1, mm = 9; // default associativo (1 settembre)
    if (tipo === 'personalizzato' && dataInizio) {
        const parts = dataInizio.split('-');
        dd = parseInt(parts[0], 10);
        mm = parseInt(parts[1], 10);
    }

    const startThisYear = new Date(year, mm - 1, dd);
    let annoInizio, annoFine;
    if (dataRef >= startThisYear) {
        annoInizio = year;
        annoFine = String(year + 1).slice(-2);
    } else {
        annoInizio = year - 1;
        annoFine = String(year).slice(-2);
    }
    return `${numero}/${annoInizio}-${annoFine}`;
}

// Helper: recupera tipo e dataInizio della societa, passando il token auth del chiamante
async function fetchSocietaTipo(societaId, authHeader) {
    let tipo = null;
    let dataInizio = '01-01';
    try {
        const usersUrl = process.env.USERS_SERVICE_URL || 'http://users_ms:3000';
        const headers = authHeader ? { 'Authorization': authHeader } : {};
        const socRes = await fetch(`${usersUrl}/api/societa/${societaId}`, { headers });
        if (socRes.ok) {
            const societa = await socRes.json();
            tipo = societa.tipo_anno_associativo || 'solare';
            dataInizio = societa.data_inizio_anno_associativo || '01-01';
        } else {
            console.error(`fetchSocietaTipo: risposta non ok (${socRes.status}) per societa ${societaId}`);
        }
    } catch (e) {
        console.error('fetchSocietaTipo: errore fetch:', e.message);
    }
    return { tipo, dataInizio };
}

// Helper: trova l'ultimo progressivo per un dato anno.
// Prima cerca per progressivo_stagione (campo esplicito),
// poi fallback sul numero_ricevuta (pagamenti importati senza progressivo).
async function findLastProgressivoInAnno(societaId, tipo, annoStartStr, annoEndStr) {
    // Metodo primario: progressivo_stagione esplicito + data_ricevuta nel range
    const effectiveAnno = parseInt(annoStartStr.split('-')[0], 10);
    const annoSuffix = tipo === 'solare'
        ? `/${effectiveAnno}`
        : `/${effectiveAnno}-${String(effectiveAnno + 1).slice(-2)}`;

    const byProgressivo = await Payment.findOne({
        where: {
            societa_id: societaId,
            progressivo_stagione: { [Op.not]: null },
            numero_ricevuta: { [Op.like]: `%${annoSuffix}` },
        },
        order: [['progressivo_stagione', 'DESC']],
    });
    if (byProgressivo) return byProgressivo.progressivo_stagione;

    // Fallback: pagamenti importati con numero_ricevuta ma senza progressivo_stagione
    const byNumero = await Payment.findOne({
        where: {
            societa_id: societaId,
            numero_ricevuta: { [Op.like]: `%${annoSuffix}` },
        },
        order: [
            [Payment.sequelize.literal("CAST(SPLIT_PART(numero_ricevuta, '/', 1) AS INTEGER)"), 'DESC'],
        ],
    });
    if (byNumero && byNumero.numero_ricevuta) {
        const num = parseInt(byNumero.numero_ricevuta.split('/')[0], 10);
        if (!isNaN(num)) return num;
    }

    return 0; // Nessun pagamento trovato
}

exports.getAll = async (req, res) => {
    try {
        const { societa_id, codice_fiscale } = req.query;
        if (!societa_id) {
            return res.status(400).json({ error: 'societa_id is required' });
        }
        const where = { societa_id };
        if (req.query.socio_id) {
            where.socio_id = req.query.socio_id;
        } else if (codice_fiscale) {
            where.codice_fiscale = { [Op.iLike]: codice_fiscale };
        }
        if (req.query.numero_ricevuta) {
            where.numero_ricevuta = req.query.numero_ricevuta;
        }
        if (req.query.product_id) {
            const pid = parseInt(req.query.product_id, 10);
            if (!isNaN(pid)) {
                if (!where[Op.and]) where[Op.and] = [];
                where[Op.and].push(
                    Payment.sequelize.literal(
                        `("product_id" = ${pid} OR ("payment_items" IS NOT NULL AND "payment_items" @> '[{"product_id": ${pid}}]'))`
                    )
                );
            }
        }
        const payments = await Payment.findAll({ where });
        res.json(payments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
};

exports.create = async (req, res) => {
    try {
        const { items, emetti_ricevuta, anno_ricevuta, ...commonFields } = req.body;

        let progressivo_stagione = null;
        let numero_ricevuta = commonFields.numero_ricevuta || null;

        if (emetti_ricevuta === 'SI' && commonFields.societa_id) {
            const targetAnno = anno_ricevuta ? parseInt(anno_ricevuta, 10) : null;
            const { tipo, dataInizio } = await fetchSocietaTipo(commonFields.societa_id, req.headers['authorization']);
            const tipoEffettivo = tipo || 'solare';

            const annoStartStr = getAnnoStart(tipoEffettivo, dataInizio, targetAnno);
            const annoEndStr = getAnnoEnd(tipoEffettivo, dataInizio, targetAnno);

            const lastProgressivo = await findLastProgressivoInAnno(
                commonFields.societa_id, tipoEffettivo, annoStartStr, annoEndStr
            );

            const nextProgressivo = lastProgressivo + 1;
            progressivo_stagione = nextProgressivo;
            numero_ricevuta = formatNumeroRicevuta(nextProgressivo, tipoEffettivo, dataInizio, commonFields.data_ricevuta);
        }

        if (Array.isArray(items) && items.length > 0) {
            // Singolo record per l'intera transazione con payment_items come dettaglio
            const subItem = items.find(i => i.quote_types === 'subscription');
            const tessItem = items.find(i => i.quote_types === 'tesseramento');
            const primaryItem = subItem || tessItem || items[0];

            const allTypes = [...new Set(items.map(i => i.quote_types).filter(Boolean))].join(',');
            const totalImporto = items.reduce((sum, i) => sum + parseFloat(i.importo || 0), 0);
            const quoteStr = items.map(i => i.quote).join(' + ');

            // Salva payment_items senza il campo quote (risolto dinamicamente dal product_id)
            const paymentItemsClean = items.map(({ quote: _q, ...rest }) => rest);

            const created = await Payment.create({
                ...commonFields,
                importo: totalImporto,
                quote: quoteStr,
                quote_types: allTypes,
                product_id: primaryItem.product_id || null,
                payment_items: paymentItemsClean,
                data_inizio_abbonamento: subItem?.data_inizio_abbonamento || null,
                data_scadenza_abbonamento: subItem?.data_scadenza_abbonamento || null,
                periodicity_tesseramento: tessItem?.periodicity_tesseramento || null,
                progressivo_stagione,
                numero_ricevuta,
            });
            return res.status(201).json(created);
        }

        // Fallback legacy: singolo payment dall'intero body
        const newPayment = await Payment.create({
            ...commonFields,
            progressivo_stagione,
            numero_ricevuta,
        });
        res.status(201).json(newPayment);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create payment' });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Payment.update(req.body, { where: { id } });
        if (updated) {
            const updatedPayment = await Payment.findByPk(id);
            return res.json(updatedPayment);
        }
        throw new Error('Payment not found');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update payment' });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Payment.destroy({ where: { id } });
        if (deleted) {
            return res.status(204).send();
        }
        throw new Error('Payment not found');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete payment' });
    }
};

exports.deleteProforma = async (req, res) => {
    try {
        const { id } = req.params;
        const payment = await Payment.findOne({ where: { id } });
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        if (payment.tipo_documento !== 'proforma') {
            return res.status(403).json({ error: 'Only proforma payments can be deleted with this endpoint' });
        }
        await payment.destroy();
        return res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete proforma' });
    }
};

// Restituisce il prossimo numero ricevuta formattato (per anteprima nel frontend)
exports.getNextNumero = async (req, res) => {
    try {
        const { societa_id, anno } = req.query;
        if (!societa_id) return res.status(400).json({ error: 'societa_id is required' });

        const targetAnno = anno ? parseInt(anno, 10) : null;

        const { tipo, dataInizio } = await fetchSocietaTipo(societa_id, req.headers['authorization']);
        const tipoEffettivo = tipo || 'solare';

        const annoStartStr = getAnnoStart(tipoEffettivo, dataInizio, targetAnno);
        const annoEndStr = getAnnoEnd(tipoEffettivo, dataInizio, targetAnno);

        const lastProgressivo = await findLastProgressivoInAnno(
            societa_id, tipoEffettivo, annoStartStr, annoEndStr
        );

        const nextNumero = lastProgressivo + 1;
        const formatted = formatNumeroRicevuta(nextNumero, tipoEffettivo, dataInizio, annoStartStr);
        res.json({ nextNumero, formatted, lastPaymentDate: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get next numero' });
    }
};

exports.bulk = async (req, res) => {
    try {
        const { payments: rows } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'payments array is required' });
        }
        const created = await Payment.bulkCreate(rows, { returning: true });
        res.status(201).json({ count: created.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to bulk create payments' });
    }
};

exports.convertiProforma = async (req, res) => {
    try {
        const { id } = req.params;
        const { anno_ricevuta, data_ricevuta } = req.body;

        const payment = await Payment.findByPk(id);
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        if (payment.tipo_documento !== 'proforma') {
            return res.status(400).json({ error: 'Il pagamento non è di tipo proforma' });
        }

        const targetAnno = anno_ricevuta ? parseInt(anno_ricevuta, 10) : null;
        const { tipo, dataInizio } = await fetchSocietaTipo(payment.societa_id, req.headers['authorization']);
        const tipoEffettivo = tipo || 'solare';

        const annoStartStr = getAnnoStart(tipoEffettivo, dataInizio, targetAnno);
        const annoEndStr = getAnnoEnd(tipoEffettivo, dataInizio, targetAnno);

        const lastProgressivo = await findLastProgressivoInAnno(
            payment.societa_id, tipoEffettivo, annoStartStr, annoEndStr
        );

        const nextProgressivo = lastProgressivo + 1;
        const dataRicevutaEff = data_ricevuta || payment.data_pagamento;
        const numero_ricevuta = formatNumeroRicevuta(nextProgressivo, tipoEffettivo, dataInizio, dataRicevutaEff);

        await payment.update({
            tipo_documento: 'pagamento',
            emetti_ricevuta: 'SI',
            progressivo_stagione: nextProgressivo,
            numero_ricevuta,
            data_ricevuta: dataRicevutaEff,
        });

        const updated = await Payment.findByPk(id);
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to convert proforma' });
    }
};

exports.annulla = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Payment.update(
            { stato_pagamento: '3. ANNULLATO CON RICEVUTA' },
            { where: { id } }
        );
        if (updated) {
            const updatedPayment = await Payment.findByPk(id);
            return res.json(updatedPayment);
        }
        throw new Error('Payment not found');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to annul payment' });
    }
};

// ── Import voci ricevuta ────────────────────────────────────────────────────
// Aggiorna i payment_items di pagamenti esistenti in base al numero ricevuta.
// Body: { societa_id, items: [{ numero_ricevuta, rows: [{quota, importo, product_id, quote_types, valido}] }] }
exports.importVoci = async (req, res) => {
    try {
        const { societa_id, items } = req.body;
        if (!societa_id || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'societa_id e items sono obbligatori' });
        }

        const results = { updated: [], notFound: [], errors: [] };

        for (const item of items) {
            const { numero_ricevuta, rows } = item;
            if (!numero_ricevuta || !Array.isArray(rows) || rows.length === 0) continue;

            try {
                const payment = await Payment.findOne({
                    where: { societa_id, numero_ricevuta },
                });

                if (!payment) {
                    results.notFound.push(numero_ricevuta);
                    continue;
                }

                // Filtra solo le righe valide (VALIDO=1)
                const validRows = rows.filter(r => {
                    const v = r.valido;
                    return v !== false && v !== 0 && v !== '0' && v !== 0;
                });
                if (validRows.length === 0) {
                    results.notFound.push(numero_ricevuta);
                    continue;
                }

                const paymentItems = validRows.map(r => ({
                    importo: parseFloat(r.importo) || 0,
                    product_id: r.product_id || null,
                    quote_types: r.quote_types || null,
                }));

                const totalImporto = paymentItems.reduce((sum, pi) => sum + pi.importo, 0);
                const quoteStr = validRows.map(r => r.quota).join(', ');
                const allTypes = [...new Set(paymentItems.map(pi => pi.quote_types).filter(Boolean))].join(',');

                await payment.update({
                    payment_items: paymentItems,
                    quote: quoteStr,
                    importo: totalImporto,
                    ...(allTypes ? { quote_types: allTypes } : {}),
                });

                results.updated.push(numero_ricevuta);
            } catch (e) {
                results.errors.push({ numero_ricevuta, error: e.message });
            }
        }

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore durante l\'import delle voci' });
    }
};
