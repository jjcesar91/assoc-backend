const crypto = require('crypto');

// Listino di un prodotto di tipo abbonamento: una o più formule, ciascuna con
// descrizione facoltativa, durata, ingressi (numero o illimitati) e prezzo. Le formule hanno un id stabile,
// registrato sulla voce del pagamento quando vengono vendute.
const DURATE_MESI = { '1_mese': 1, '2_mesi': 2, '3_mesi': 3, '4_mesi': 4, '6_mesi': 6, '12_mesi': 12 };
const MAX_FORMULE = 50;
const MAX_DESCRIZIONE = 120;

const toPrezzo = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

// Valida e normalizza il listino; ritorna { listino } oppure { error }
function normalizzaListino(raw) {
    if (!Array.isArray(raw) || raw.length === 0) return { error: 'Il listino deve contenere almeno una formula.' };
    if (raw.length > MAX_FORMULE) return { error: `Massimo ${MAX_FORMULE} formule nel listino.` };
    const listino = [];
    const chiavi = new Set();
    for (const [i, f] of raw.entries()) {
        const n = i + 1;
        if (!DURATE_MESI[f?.durata]) return { error: `Formula ${n}: durata non valida.` };
        const illimitato = f.illimitato === true || f.illimitato === 'true';
        let ingressi = null;
        if (!illimitato) {
            ingressi = parseInt(f.ingressi, 10);
            if (!Number.isInteger(ingressi) || ingressi <= 0) return { error: `Formula ${n}: indica il numero di ingressi o scegli "illimitati".` };
            if (ingressi > 1000) return { error: `Formula ${n}: numero di ingressi troppo alto.` };
        }
        const prezzo = toPrezzo(f.prezzo);
        if (!Number.isFinite(prezzo) || prezzo < 0) return { error: `Formula ${n}: prezzo non valido.` };
        const descrizione = typeof f.descrizione === 'string' ? f.descrizione.trim().replace(/\s+/g, ' ') : '';
        if (descrizione.length > MAX_DESCRIZIONE) return { error: `Formula ${n}: descrizione troppo lunga (massimo ${MAX_DESCRIZIONE} caratteri).` };
        // Doppia solo se coincidono durata, ingressi e descrizione (es. "Adulti" e "Under 18" possono convivere)
        const chiave = `${f.durata}|${illimitato ? 'open' : ingressi}|${descrizione.toLowerCase()}`;
        if (chiavi.has(chiave)) return { error: `Formula ${n}: esiste già una formula con la stessa durata, gli stessi ingressi e la stessa descrizione.` };
        chiavi.add(chiave);
        listino.push({
            id: typeof f.id === 'string' && /^[a-zA-Z0-9-]{8,40}$/.test(f.id) ? f.id : crypto.randomUUID(),
            durata: f.durata,
            illimitato,
            ingressi,
            prezzo,
            ...(descrizione ? { descrizione } : {}),
        });
    }
    // Ordine: per durata, poi per ingressi (illimitati in fondo)
    listino.sort((a, b) => DURATE_MESI[a.durata] - DURATE_MESI[b.durata]
        || (a.illimitato - b.illimitato) || ((a.ingressi || 0) - (b.ingressi || 0)));
    return { listino };
}

// Campi legacy del prodotto allineati al listino (elenchi, preavviso, ecc.):
// prezzo base = prezzo minimo, durata/ingressi = prima formula
function campiDaListino(listino) {
    const prima = listino[0];
    return {
        basePrice: Math.min(...listino.map(f => f.prezzo)),
        duration: prima.durata,
        unlimitedEntries: prima.illimitato,
        numEntries: prima.ingressi,
    };
}

// Listino iniziale per i prodotti creati prima dei listini (una sola formula)
function listinoDaLegacy(p) {
    return [{
        id: crypto.randomUUID(),
        durata: DURATE_MESI[p.duration] ? p.duration : '1_mese',
        illimitato: !!p.unlimitedEntries || !(parseInt(p.numEntries, 10) > 0),
        ingressi: !p.unlimitedEntries && parseInt(p.numEntries, 10) > 0 ? parseInt(p.numEntries, 10) : null,
        prezzo: toPrezzo(p.basePrice) || 0,
    }];
}

async function backfillListini(Product) {
    const prodotti = await Product.findAll({ where: { type: 'subscription', listino: null } });
    for (const p of prodotti) {
        await p.update({ listino: listinoDaLegacy(p) });
    }
    if (prodotti.length) console.log(`[listino] creati ${prodotti.length} listini dagli abbonamenti esistenti`);
}

module.exports = { DURATE_MESI, normalizzaListino, campiDaListino, listinoDaLegacy, backfillListini };
