const { Op } = require('sequelize');

// Snapshot dei dati di registrazione a partire dall'anagrafica attuale della società
// (usata per precompilare la licenza: dopo è indipendente dall'anagrafica).
function snapshotFromSocieta(societa, affiliazioni = []) {
    const s = societa.toJSON ? societa.toJSON() : societa;
    const tipoAnno = {
        solare: 'solare',
        associativo: 'sportivo',
        personalizzato: 'personalizzato',
    }[s.tipo_anno_associativo] || null;
    const presidente = [s.nome_rappr_legale, s.cognome_rappr_legale].filter(Boolean).join(' ').trim();
    const aff = (affiliazioni.length ? affiliazioni : (s.affiliazioni || []))
        .map(a => (a.tipo && a.nome ? `${a.tipo}: ${a.nome}` : (a.nome || a.tipo || '')).trim())
        .filter(Boolean)
        .join(', ');
    return {
        associazione: s.denominazione || null,
        tipologia: s.tipo_associazione || null,
        email: s.email || null,
        indirizzo: s.indirizzo || null,
        cap: s.cap || null,
        comune: s.comune || null,
        anno_associativo_tipo: tipoAnno,
        anno_associativo_inizio: tipoAnno === 'personalizzato' ? (s.data_inizio_anno_associativo || null) : null,
        affiliazioni: aff || null,
        presidente: presidente || null,
        telefono: s.telefono || null,
    };
}

const toDateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// Licenza di una società. Se la società non ne ha ancora una:
//  - modello precedente (licenza 1:1 con societa_id) → la collega;
//  - altrimenti apre una nuova licenza Free attiva di cui è la società di registrazione.
async function ensureLicenzaForSocieta(models, societa, options = {}) {
    const { Licenza, SocietaAffiliazioni } = models;
    const { transaction } = options;
    if (societa.licenza_id) {
        const own = await Licenza.findByPk(societa.licenza_id, { transaction });
        if (own) return own;
    }
    let licenza = await Licenza.findOne({ where: { societa_id: societa.id }, transaction });
    if (!licenza) {
        const affiliazioni = await SocietaAffiliazioni.findAll({ where: { societa_id: societa.id }, transaction });
        licenza = await Licenza.create({
            societa_id: societa.id,
            piano: 'free',
            stato: 'attiva',
            data_inizio: toDateOnly(societa.createdAt) || toDateOnly(new Date()),
            ...snapshotFromSocieta(societa, affiliazioni),
        }, { transaction });
    }
    if (societa.licenza_id !== licenza.id) {
        await societa.update({ licenza_id: licenza.id }, { transaction });
    }
    return licenza;
}

// All'avvio: ogni società senza licenza viene collegata alla propria (o ne riceve una Free).
async function backfillLicenze(models) {
    const { Societa } = models;
    const missing = await Societa.findAll({ where: { licenza_id: { [Op.is]: null } } });
    for (const societa of missing) {
        await ensureLicenzaForSocieta(models, societa);
    }
    if (missing.length) console.log(`[licenze] collegate ${missing.length} società alla propria licenza`);
}

module.exports = { snapshotFromSocieta, ensureLicenzaForSocieta, backfillLicenze, toDateOnly };
