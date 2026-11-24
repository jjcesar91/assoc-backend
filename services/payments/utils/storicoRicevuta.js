// Storico delle modifiche alle ricevute.
//
// Ogni evento su un pagamento (modifica di campi, annullamento, registrazione di una
// proforma, proroga, eliminazione, quietanza caricata, import voci) viene registrato:
//  - in payment_modifiche (tab "Storico" del Dettaglio ricevuta), con autore e origine;
//  - nello storico del socio (servizio users, tipo 'modifica_ricevuta'), se il pagamento
//    è collegato a un socio.
// Se lo storico socio non si scrive, registraEvento lancia un errore con
// code = 'STORICO_SOCIO' e il chiamante annulla la transazione: niente modifiche senza traccia.

const { PaymentModifica } = require('../models');

const usersUrl = () => process.env.USERS_SERVICE_URL || 'http://users_ms:3000';
const internalSecret = () => process.env.INTERNAL_API_SECRET || 'internal_secret_change_me';

const ORIGINI = ['dettaglio_ricevuta', 'prima_nota', 'scadenziario', 'ricevute', 'scheda_socio', 'area_soci', 'import', 'ricevute_telematiche'];

// Campi tracciati, nell'ordine in cui vengono elencati. Esclusi i campi tecnici
// (modificato_da, timestamp, file quietanza: hanno un evento dedicato) e quelli derivati.
const CAMPI = {
    tipo_documento: { etichetta: 'Tipo documento' },
    stato_pagamento: { etichetta: 'Stato' },
    numero_ricevuta: { etichetta: 'N. ricevuta' },
    data_ricevuta: { etichetta: 'Data ricevuta', tipo: 'data' },
    data_pagamento: { etichetta: 'Data pagamento', tipo: 'data' },
    importo: { etichetta: 'Importo', tipo: 'importo' },
    payment_items: { etichetta: 'Voci', tipo: 'voci' },
    quote: { etichetta: 'Descrizione' },
    modalita_pagamento: { etichetta: 'Modalità di pagamento' },
    conto_destinazione: { etichetta: 'Conto' },
    intestatario: { etichetta: 'Intestatario' },
    codice_fiscale: { etichetta: 'Codice fiscale' },
    codice_fiscale_genitore: { etichetta: 'C.F. genitore' },
    partita_iva: { etichetta: 'Partita IVA' },
    socio_id: { etichetta: 'Socio', tipo: 'id' },
    fornitore_id: { etichetta: 'Fornitore', tipo: 'id' },
    gruppo_id: { etichetta: 'Gruppo contabile', tipo: 'id' },
    data_inizio_abbonamento: { etichetta: 'Inizio abbonamento', tipo: 'data' },
    data_scadenza_abbonamento: { etichetta: 'Scadenza abbonamento', tipo: 'data' },
    etichette: { etichetta: 'Etichette' },
    note: { etichetta: 'Note' },
};

const vuoto = (v) => v == null || (typeof v === 'string' && v.trim() === '');

function vociDi(v) {
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return []; } }
    return Array.isArray(v) ? v : [];
}

const euro = (n) => `€ ${(Number(n) || 0).toFixed(2).replace('.', ',')}`;
const dataIt = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-'); return d && m && y ? `${d}/${m}/${y}` : String(s); };

// Valore confrontabile (stessa forma per valori equivalenti)
function chiave(campo, v) {
    const t = CAMPI[campo]?.tipo;
    if (t === 'voci') {
        const voci = vociDi(v);
        return voci.length ? JSON.stringify(voci) : null;
    }
    if (vuoto(v)) return null;
    if (t === 'data') return String(v instanceof Date ? v.toISOString() : v).slice(0, 10);
    if (t === 'importo') return (Number(v) || 0).toFixed(2);
    return String(v).trim();
}

// Valore leggibile per lo storico
function leggibile(campo, v) {
    const t = CAMPI[campo]?.tipo;
    if (t === 'voci') {
        const voci = vociDi(v);
        if (!voci.length) return null;
        const testo = voci.map(i => `${i.quote || i.descrizione || 'voce'} ${euro(i.importo)}`).join('; ');
        return testo.length > 300 ? `${testo.slice(0, 297)}…` : testo;
    }
    if (vuoto(v)) return null;
    if (t === 'data') return dataIt(v instanceof Date ? v.toISOString() : v);
    if (t === 'importo') return euro(v);
    if (t === 'id') return `#${v}`;
    const s = String(v).trim();
    return s.length > 300 ? `${s.slice(0, 297)}…` : s;
}

// Campi cambiati tra due snapshot del pagamento: [{ campo, etichetta, da, a }]
function diffRicevuta(prima, dopo) {
    const out = [];
    for (const [campo, cfg] of Object.entries(CAMPI)) {
        if (chiave(campo, prima?.[campo]) === chiave(campo, dopo?.[campo])) continue;
        out.push({ campo, etichetta: cfg.etichetta, da: leggibile(campo, prima?.[campo]), a: leggibile(campo, dopo?.[campo]) });
    }
    return out;
}

// "ricevuta n. 12/2026", "proforma #34", "movimento #56"
function riferimento(p) {
    if (p.tipo_documento === 'proforma') return `proforma #${p.id}`;
    if (p.numero_ricevuta) return `ricevuta n. ${p.numero_ricevuta}`;
    return `${p.socio_id ? 'ricevuta' : 'movimento'} #${p.id}`;
}

const elencoModifiche = (modifiche) => modifiche
    .map(m => `${m.etichetta}: ${m.da ?? '(vuoto)'} → ${m.a ?? '(vuoto)'}`)
    .join('; ');

const autore = (user) => user?.email || user?.username || null;

// Registra un evento sul pagamento `p` (snapshot plain). Da chiamare nella stessa
// transazione della modifica. storicoSocio=false quando il chiamante scrive già
// lo storico socio per conto suo (es. proroga, quietanza).
async function registraEvento({ p, tipo, descrizione, modifiche = null, user = null, utenteLabel = null, origine = null, transaction, storicoSocio = true, sociExtra = [] }) {
    const riga = await PaymentModifica.create({
        payment_id: p.id,
        societa_id: p.societa_id,
        socio_id: p.socio_id || null,
        tipo,
        descrizione,
        modifiche: modifiche && modifiche.length ? modifiche : null,
        utente_id: user?.id ?? null,
        utente_email: autore(user) || utenteLabel,
        utente_ruolo: user?.role ?? null,
        origine: ORIGINI.includes(origine) ? origine : (origine ? 'altro' : null),
    }, { transaction });

    if (!storicoSocio) return riga;

    // Se cambia il socio collegato l'evento va nello storico di entrambi
    const soci = [...new Set([p.socio_id, ...sociExtra].filter(Boolean).map(Number))];
    // Per le modifiche di campi l'elenco è il contenuto; per gli altri eventi basta la descrizione
    const azione = tipo === 'modifica' && modifiche && modifiche.length ? `${descrizione}: ${elencoModifiche(modifiche)}` : descrizione;
    for (const socioId of soci) {
        const res = await fetch(`${usersUrl()}/api/internal/soci/${socioId}/storico`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-secret': internalSecret() },
            body: JSON.stringify({
                societa_id: p.societa_id,
                tipo: 'modifica_ricevuta',
                azione: azione.length > 1000 ? `${azione.slice(0, 997)}…` : azione,
                dettagli: {
                    payment_id: p.id,
                    numero_ricevuta: p.numero_ricevuta || null,
                    evento: tipo,
                    modifiche: riga.modifiche,
                    origine: riga.origine,
                },
                owner_id: user?.id || null,
                owner_label: autore(user) || utenteLabel || 'Operatore',
            }),
        }).catch(err => ({ ok: false, status: err.message }));
        if (!res.ok) {
            const e = new Error(`Storico socio non scritto (${res.status})`);
            e.code = 'STORICO_SOCIO';
            throw e;
        }
    }
    return riga;
}

// Modifica di campi: registra solo se qualcosa cambia davvero. Ritorna la riga o null.
async function registraModifica({ prima, dopo, user, origine, transaction }) {
    const modifiche = diffRicevuta(prima, dopo);
    if (!modifiche.length) return null;
    // Stato attuale come riferimento; se il socio collegato cambia, traccia anche il precedente
    return registraEvento({
        p: dopo, tipo: 'modifica', descrizione: `Modificata ${riferimento(dopo)}`,
        modifiche, user, origine, transaction, sociExtra: [prima.socio_id],
    });
}

// Risposta standard quando lo storico socio non si scrive (modifica annullata)
function rispostaStoricoNonScritto(res, err) {
    console.error('Modifica ricevuta annullata:', err.message);
    return res.status(502).json({ error: 'Impossibile registrare la modifica nello storico del socio: nessuna modifica effettuata. Riprova.' });
}

module.exports = { CAMPI, diffRicevuta, riferimento, euro, dataIt, registraEvento, registraModifica, rispostaStoricoNonScritto };
