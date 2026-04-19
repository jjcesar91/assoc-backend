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
            where.product_id = req.query.product_id;
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
        let numero_ricevuta = null;

        if (emetti_ricevuta === 'SI' && commonFields.societa_id) {
            const targetAnno = anno_ricevuta ? parseInt(anno_ricevuta, 10) : null;
            let tipo = 'solare';
            let dataInizio = '01-01';
            try {
                const usersUrl = process.env.USERS_SERVICE_URL || 'http://users_ms:3000';
                const socRes = await fetch(`${usersUrl}/api/societa/${commonFields.societa_id}`);
                if (socRes.ok) {
                    const societa = await socRes.json();
                    tipo = societa.tipo_anno_associativo || 'solare';
                    dataInizio = societa.data_inizio_anno_associativo || '01-01';
                }
            } catch (e) {
                console.error('Impossibile recuperare dati societa, uso tipo solare:', e.message);
            }

            const annoStartStr = getAnnoStart(tipo, dataInizio, targetAnno);
            const annoEndStr = getAnnoEnd(tipo, dataInizio, targetAnno);

            const lastPayment = await Payment.findOne({
                where: {
                    societa_id: commonFields.societa_id,
                    progressivo_stagione: { [Op.not]: null },
                    data_ricevuta: { [Op.gte]: annoStartStr, [Op.lt]: annoEndStr }
                },
                order: [['progressivo_stagione', 'DESC']]
            });

            const nextProgressivo = lastPayment ? (lastPayment.progressivo_stagione + 1) : 1;
            progressivo_stagione = nextProgressivo;
            numero_ricevuta = formatNumeroRicevuta(nextProgressivo, tipo, dataInizio, commonFields.data_ricevuta);
        }

        if (Array.isArray(items) && items.length > 0) {
            // Multi-item: un record Payment per voce del carrello, tutti condividono numero_ricevuta
            const created = await Promise.all(
                items.map(item => Payment.create({
                    ...commonFields,
                    ...item,
                    progressivo_stagione,
                    numero_ricevuta,
                }))
            );
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

// Restituisce il prossimo numero ricevuta formattato (per anteprima nel frontend)
exports.getNextNumero = async (req, res) => {
    try {
        const { societa_id, anno } = req.query;
        if (!societa_id) return res.status(400).json({ error: 'societa_id is required' });

        const targetAnno = anno ? parseInt(anno, 10) : null;

        let tipo = 'solare';
        let dataInizio = '01-01';
        try {
            const usersUrl = process.env.USERS_SERVICE_URL || 'http://users_ms:3000';
            const socRes = await fetch(`${usersUrl}/api/societa/${societa_id}`);
            if (socRes.ok) {
                const societa = await socRes.json();
                tipo = societa.tipo_anno_associativo || 'solare';
                dataInizio = societa.data_inizio_anno_associativo || '01-01';
            }
        } catch (e) {
            console.error('Impossibile recuperare dati societa:', e.message);
        }

        const annoStartStr = getAnnoStart(tipo, dataInizio, targetAnno);
        const annoEndStr = getAnnoEnd(tipo, dataInizio, targetAnno);
        const lastPayment = await Payment.findOne({
            where: {
                societa_id,
                progressivo_stagione: { [Op.not]: null },
                data_ricevuta: { [Op.gte]: annoStartStr, [Op.lt]: annoEndStr }
            },
            order: [['progressivo_stagione', 'DESC']]
        });

        const nextNumero = lastPayment ? (lastPayment.progressivo_stagione + 1) : 1;
        const formatted = formatNumeroRicevuta(nextNumero, tipo, dataInizio, annoStartStr);
        const lastPaymentDate = lastPayment ? lastPayment.data_ricevuta : null;
        res.json({ nextNumero, formatted, lastPaymentDate });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get next numero' });
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
