// Regole dei ticket di assistenza, condivise da controller e job.
//
// Stati:
//   aperto             – in attesa di risposta del supporto (nuovo o riaperto dal cliente)
//   in_lavorazione     – preso in carico dal supporto
//   in_attesa_cliente  – il supporto ha risposto e aspetta il cliente
//   risolto            – soluzione proposta; si chiude da solo dopo GIORNI_CHIUSURA_AUTOMATICA
//   chiuso             – definitivo per il cliente (può riaprirlo solo il supporto)
//
// Passaggi automatici:
//   messaggio del cliente → aperto (se era in_attesa_cliente o risolto)
//   risposta del supporto → lo stato scelto con la risposta (default in_attesa_cliente)

const STATI = ['aperto', 'in_lavorazione', 'in_attesa_cliente', 'risolto', 'chiuso'];
const CATEGORIE = ['tecnico', 'amministrativo', 'funzionalita', 'altro'];
const PRIORITA = ['bassa', 'normale', 'alta', 'urgente'];

const ETICHETTE_STATO = {
    aperto: 'Aperto',
    in_lavorazione: 'In lavorazione',
    in_attesa_cliente: 'In attesa di risposta',
    risolto: 'Risolto',
    chiuso: 'Chiuso',
};

const MAX_OGGETTO = 150;
const MAX_TESTO = 5000;
const GIORNI_CHIUSURA_AUTOMATICA = 7;

const ORDINAMENTI = { creazione: 'createdAt', ultimo_messaggio: 'ultimo_messaggio_at' };

// Ordinamento e paginazione dalla query (?ordina=creazione|ultimo_messaggio&dir=asc|desc&pagina=1)
function parseLista(query) {
    const campo = ORDINAMENTI[query.ordina] || ORDINAMENTI.ultimo_messaggio;
    const dir = String(query.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const perPagina = Math.min(Math.max(parseInt(query.per_pagina, 10) || 25, 1), 100);
    const pagina = Math.max(parseInt(query.pagina, 10) || 1, 1);
    const stato = STATI.includes(query.stato) ? query.stato : null;
    return { order: [[campo, dir], ['id', dir]], limit: perPagina, offset: (pagina - 1) * perPagina, stato, pagina, perPagina };
}

// Testo di un messaggio: stringa non vuota, entro il limite (spazi iniziali/finali tolti)
function testoValido(v) {
    if (typeof v !== 'string') return null;
    const t = v.replace(/\r\n/g, '\n').trim();
    return t && t.length <= MAX_TESTO ? t : null;
}

// true se l'altra parte ha scritto dopo l'ultima lettura di questa parte
function nonLetto(ticket, perParte) {
    const daAltri = perParte === 'cliente' ? 'supporto' : 'cliente';
    if (ticket.ultimo_messaggio_da !== daAltri) return false;
    const letto = perParte === 'cliente' ? ticket.letto_cliente_at : ticket.letto_supporto_at;
    return !letto || new Date(letto) < new Date(ticket.ultimo_messaggio_at);
}

function serializza(ticket, perParte) {
    const t = ticket.toJSON ? ticket.toJSON() : ticket;
    const out = {
        id: t.id,
        societa_id: t.societa_id,
        oggetto: t.oggetto,
        categoria: t.categoria,
        priorita: t.priorita,
        stato: t.stato,
        autore_email: t.autore_email,
        createdAt: t.createdAt,
        ultimo_messaggio_at: t.ultimo_messaggio_at,
        ultimo_messaggio_da: t.ultimo_messaggio_da,
        risolto_at: t.risolto_at,
        chiuso_at: t.chiuso_at,
        non_letto: nonLetto(t, perParte),
    };
    if (perParte === 'supporto') {
        out.licenza_id = t.licenza_id;
        out.societa = t.societa ? { id: t.societa.id, denominazione: t.societa.denominazione } : null;
    }
    if (Array.isArray(t.messaggi)) {
        out.messaggi = t.messaggi
            .filter(m => perParte === 'supporto' || !m.nota_interna)
            .map(m => ({
                id: m.id,
                autore_tipo: m.autore_tipo,
                // Il cliente vede "Supporto", non l'indirizzo dell'operatore
                autore_email: perParte === 'cliente' && m.autore_tipo === 'supporto' ? null : m.autore_email,
                testo: m.testo,
                nota_interna: !!m.nota_interna,
                stato_impostato: m.stato_impostato,
                createdAt: m.createdAt,
            }));
    }
    return out;
}

// Campi da aggiornare quando lo stato cambia (date di risoluzione/chiusura)
function campiStato(stato, adesso = new Date()) {
    return {
        stato,
        risolto_at: stato === 'risolto' ? adesso : null,
        chiuso_at: stato === 'chiuso' ? adesso : null,
    };
}

module.exports = {
    STATI, CATEGORIE, PRIORITA, ETICHETTE_STATO, MAX_OGGETTO, MAX_TESTO, GIORNI_CHIUSURA_AUTOMATICA,
    parseLista, testoValido, nonLetto, serializza, campiStato,
};
