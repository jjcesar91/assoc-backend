'use strict';

const { getDefinizione } = require('./automazioniRegistry');

// --- Helpers su date (usiamo sempre stringhe 'YYYY-MM-DD' e Date a UTC
// mezzanotte per evitare problemi di fuso orario nei calcoli "a giorni"). ---

function toDateOnly(d) {
  return d.toISOString().split('T')[0];
}

function fromParts(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Replica la logica di assoc-frontend/src/data/AnnoContext.jsx (getAnnoDateRange),
// ma restituisce solo la data di fine anno associativo per l'anno di riferimento `anno`.
function fineAnnoAssociativo(anno, societa) {
  const tipo = societa?.tipo_anno_associativo || 'solare';
  if (tipo === 'associativo') {
    return fromParts(anno + 1, 8, 31);
  }
  if (tipo === 'personalizzato' && societa?.data_inizio_anno_associativo) {
    const parts = societa.data_inizio_anno_associativo.split('-');
    if (parts.length === 2) {
      const cDay = parseInt(parts[0], 10);
      const cMonth = parseInt(parts[1], 10);
      const end = fromParts(anno + 1, cMonth, cDay);
      return addDays(end, -1);
    }
  }
  return fromParts(anno, 12, 31); // solare (o fallback)
}

// Tra una lista di candidate (Date), sceglie quella "rilevante" rispetto a oggi:
// la più vicina tra quelle future/odierne; se sono tutte passate, la più recente.
function scegliOccorrenza(candidates, today) {
  if (!candidates.length) return null;
  const future = candidates.filter(d => d.getTime() >= today.getTime()).sort((a, b) => a - b);
  if (future.length) return future[0];
  return candidates.reduce((max, d) => (d > max ? d : max), candidates[0]);
}

/**
 * Calcola l'occorrenza corrente (scadenza + data target di invio) per le
 * automazioni con un'unica scadenza a livello di società (destinatario
 * 'tutti_soci'). Ritorna null se il tipo non è applicabile o non gestito da
 * questa funzione (le strategie per-socio si calcolano altrove, dal job).
 */
function computeOccorrenzaSocieta(tipo, config, societa, today = todayUTC()) {
  const def = getDefinizione(tipo);
  if (def.destinatario !== 'tutti_soci') return null;

  const anno = today.getUTCFullYear();
  let candidates = [];

  if (def.deadlineStrategy === 'anno_associativo_offset') {
    for (const y of [anno - 2, anno - 1, anno, anno + 1]) {
      candidates.push(addDays(fineAnnoAssociativo(y, societa), def.offsetGiorni));
    }
  } else if (def.deadlineStrategy === 'fixed_calendar') {
    for (const y of [anno - 1, anno, anno + 1]) {
      candidates.push(fromParts(y, def.mese, def.giorno));
    }
  } else if (def.deadlineStrategy === 'biannual_calendar') {
    const extra = { ...def.defaultExtra, ...(config?.extra_config || {}) };
    for (const y of [anno - 1, anno, anno + 1]) {
      candidates.push(fromParts(y, extra.mese1, extra.giorno1));
      candidates.push(fromParts(y, extra.mese2, extra.giorno2));
    }
  } else {
    return null;
  }

  const scadenza = scegliOccorrenza(candidates, today);
  if (!scadenza) return null;

  const giorniAnticipo = config?.giorni_anticipo ?? def.giorniAnticipoDefault;
  const dataInvioTarget = addDays(scadenza, -giorniAnticipo);

  return {
    scadenza: toDateOnly(scadenza),
    dataInvioTarget: toDateOnly(dataInvioTarget),
  };
}

/**
 * Calcola l'occorrenza (scadenza + data target di invio) per un'automazione
 * il cui unico dato è un valore data preso da un campo del socio (es.
 * certificato medico, organo di amministrazione, doc. presidente). Ritorna
 * null se il valore non è impostato: in tal caso non va inviata nessuna
 * comunicazione.
 */
function computeOccorrenzaSocioField(config, valoreCampo) {
  if (!valoreCampo) return null;
  const scadenza = new Date(valoreCampo);
  const giorniAnticipo = config?.giorni_anticipo ?? 15;
  const dataInvioTarget = addDays(scadenza, -giorniAnticipo);
  return {
    scadenza: toDateOnly(scadenza),
    dataInvioTarget: toDateOnly(dataInvioTarget),
  };
}

/**
 * true se, alla data `today`, l'automazione deve considerarsi "nella finestra
 * di invio" (>= target di invio e <= scadenza). Usato dal job giornaliero;
 * l'idempotenza vera e propria è garantita dal controllo sul log
 * (AutomazioneInvio) fatto dal chiamante.
 */
function isNellaFinestraInvio(occorrenza, today = todayUTC()) {
  if (!occorrenza) return false;
  const target = new Date(occorrenza.dataInvioTarget);
  const scadenza = new Date(occorrenza.scadenza);
  return today.getTime() >= target.getTime() && today.getTime() <= scadenza.getTime();
}

module.exports = {
  todayUTC,
  addDays,
  toDateOnly,
  fineAnnoAssociativo,
  computeOccorrenzaSocieta,
  computeOccorrenzaSocioField,
  isNellaFinestraInvio,
};
