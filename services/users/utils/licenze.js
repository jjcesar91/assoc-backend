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

// Crea la licenza (piano Free, attiva) per la società se non esiste ancora.
async function ensureLicenza(models, societa, options = {}) {
    const { Licenza, SocietaAffiliazioni } = models;
    const existing = await Licenza.findOne({ where: { societa_id: societa.id }, transaction: options.transaction });
    if (existing) return existing;
    const affiliazioni = SocietaAffiliazioni
        ? await SocietaAffiliazioni.findAll({ where: { societa_id: societa.id }, transaction: options.transaction })
        : [];
    return Licenza.create({
        societa_id: societa.id,
        piano: 'free',
        stato: 'attiva',
        data_inizio: toDateOnly(societa.createdAt) || toDateOnly(new Date()),
        ...snapshotFromSocieta(societa, affiliazioni),
    }, { transaction: options.transaction });
}

// All'avvio: ogni società senza licenza riceve una licenza Free.
async function backfillLicenze(models) {
    const { Societa, Licenza } = models;
    const withLicenza = (await Licenza.findAll({ attributes: ['societa_id'] })).map(l => l.societa_id);
    const missing = await Societa.findAll({
        where: withLicenza.length ? { id: { [Op.notIn]: withLicenza } } : undefined,
    });
    for (const societa of missing) {
        await ensureLicenza(models, societa);
    }
    if (missing.length) console.log(`[licenze] create ${missing.length} licenze Free per società esistenti`);
}

module.exports = { snapshotFromSocieta, ensureLicenza, backfillLicenze };
