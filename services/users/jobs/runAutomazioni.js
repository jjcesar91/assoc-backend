'use strict';

const { Op } = require('sequelize');
const { Societa, Socio, AutomazioneConfig, AutomazioneInvio } = require('../models');
const { TIPI, getDefinizione, resolveConfig } = require('../utils/automazioniRegistry');
const { computeOccorrenzaSocieta, computeOccorrenzaSocioField, isNellaFinestraInvio, todayUTC, toDateOnly, addDays } = require('../utils/deadlineCalculator');
const pianificazione = require('../utils/automazioniPianificazione');
const { sendEmail } = require('../utils/mailService');

const PAYMENTS_SERVICE_URL = process.env.PAYMENTS_SERVICE_URL || 'http://payments_ms:3000';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'internal_secret_change_me';

function formatDataIt(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// Registra/aggiorna la riga di log per uno specifico promemoria di un'occorrenza
// (chiave di idempotenza: occorrenza + promemoria_n). Un solo run "vincente" per
// promemoria: se esiste già un log INVIATO il chiamante non prova nemmeno a inviare.
async function registraInvio({ societaId, tipo, socioId, riferimentoExtra, scadenzaRiferimento, promemoriaN, destinatario, esito, dettaglioErrore }) {
  const where = { societa_id: societaId, tipo, socio_id: socioId ?? null, riferimento_extra: riferimentoExtra ?? null, scadenza_riferimento: scadenzaRiferimento, promemoria_n: promemoriaN || 1 };
  const [row] = await AutomazioneInvio.findOrCreate({ where, defaults: { ...where, destinatario, esito, dettaglio_errore: dettaglioErrore, data_invio: new Date() } });
  await row.update({ destinatario, esito, dettaglio_errore: dettaglioErrore || null, data_invio: new Date() });
}

// Numero del promemoria da inviare oggi per l'occorrenza, 0 se non è dovuto:
// - nessun invio riuscito → 1 (primo promemoria, siamo già nella finestra di invio);
// - con ripeti_ogni_giorni = N → il successivo quando sono passati almeno N giorni
//   dall'ultimo invio riuscito (fino al giorno della scadenza compreso);
// - senza ripetizione → 0 (una sola email per occorrenza, come prima).
async function promemoriaDovuto({ societaId, tipo, socioId, riferimentoExtra, scadenzaRiferimento }, config, today) {
  const ultimo = await AutomazioneInvio.findOne({
    where: { societa_id: societaId, tipo, socio_id: socioId ?? null, riferimento_extra: riferimentoExtra ?? null, scadenza_riferimento: scadenzaRiferimento, esito: 'INVIATO' },
    order: [['promemoria_n', 'DESC']],
  });
  if (!ultimo) return 1;
  const ogni = config.ripeti_ogni_giorni;
  if (!ogni || ogni <= 0) return 0;
  const giornoUltimo = new Date(`${toDateOnly(new Date(ultimo.data_invio))}T00:00:00Z`);
  return today.getTime() >= addDays(giornoUltimo, ogni).getTime() ? (ultimo.promemoria_n || 1) + 1 : 0;
}

// Campi dinamici dei testi personalizzabili (Scadenziario → Comunicazioni):
// {{NOME}}, {{COGNOME}}, {{SOCIETA}}, {{DATA_SCADENZA}}. Valori escapati nel corpo HTML.
const escapeHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function sostituisciCampi(testo, valori, { html }) {
  return String(testo || '').replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in valori ? (html ? escapeHtml(valori[k]) : String(valori[k] ?? '')) : m));
}

async function inviaEmailAutomazione({ def, config, societa, socio, to, scadenza, contatore }) {
  try {
    if (!to) throw new Error('Destinatario mancante');
    const valori = {
      NOME: socio?.nome || '',
      COGNOME: socio?.cognome || '',
      SOCIETA: societa.denominazione || '',
      DATA_SCADENZA: formatDataIt(scadenza),
    };
    const oggetto = config.oggetto_email || def.oggettoDefault(societa);
    const corpo = config.testo_email || def.testoDefault(societa);
    const subject = sostituisciCampi(oggetto, valori, { html: false });
    const html = sostituisciCampi(corpo, valori, { html: true });
    // La data di scadenza in fondo solo se il testo non la riporta già con {{DATA_SCADENZA}}
    const finale = corpo.includes('{{DATA_SCADENZA}}')
      ? html
      : `${html}<br/><br/><strong>Data scadenza: ${formatDataIt(scadenza)}</strong>`;
    await sendEmail({ to, subject, html: finale, societa });
    contatore.inviati += 1;
    return { esito: 'INVIATO', errore: null };
  } catch (err) {
    contatore.errori += 1;
    return { esito: 'ERRORE', errore: err.message };
  }
}

// Abbonamenti della società, uno per socio e abbonamento con la scadenza più recente
// (solo pagamenti effettivi: niente annullati né proforma). null se payments_ms non risponde.
async function fetchAbbonamenti(societaId) {
  try {
    const resp = await fetch(`${PAYMENTS_SERVICE_URL}/api/internal/abbonamenti-scadenza?societaId=${societaId}`, {
      headers: { 'x-internal-secret': INTERNAL_API_SECRET },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.error('Errore recupero abbonamenti da payments_ms:', err.message);
    return null;
  }
}

// Soci con almeno un abbonamento non ancora scaduto (scadenza >= oggi).
function sociConAbbonamentoAttivo(abbonamenti, today) {
  const oggi = toDateOnly(today);
  return new Set(abbonamenti
    .filter(a => a.socio_id != null && a.data_scadenza_abbonamento && String(a.data_scadenza_abbonamento).slice(0, 10) >= oggi)
    .map(a => Number(a.socio_id)));
}

// Tipi con destinatario 'socio_field' (organo_amministrazione, doc_presidente,
// certificato_medico): la scadenza è il valore di un campo del socio; se non
// impostato, nessuna comunicazione viene inviata. Riceve solo il socio su cui
// il campo è valorizzato.
async function processSocioField(tipo, def, config, societa, today, contatore) {
  const soci = await Socio.findAll({ where: { societa_id: societa.id, [def.socioField]: { [Op.not]: null } } });
  // Certificato medico: solo ai soci con un abbonamento attivo. Caricati una volta
  // sola e solo se c'è almeno un socio nella finestra di invio.
  let attivi;
  for (const socio of soci) {
    const valore = socio[def.socioField];
    const occorrenza = computeOccorrenzaSocioField(config, valore);
    if (!isNellaFinestraInvio(occorrenza, today)) continue;
    const scadenza = occorrenza.scadenza;
    const promemoriaN = await promemoriaDovuto({ societaId: societa.id, tipo, socioId: socio.id, scadenzaRiferimento: scadenza }, config, today);
    if (!promemoriaN) {
      contatore.saltati += 1;
      continue;
    }
    if (def.richiedeAbbonamentoAttivo) {
      if (attivi === undefined) {
        const abbonamenti = await fetchAbbonamenti(societa.id);
        // payments_ms non raggiungibile: meglio non inviare (si riprova al prossimo controllo)
        if (!abbonamenti) return;
        attivi = sociConAbbonamentoAttivo(abbonamenti, today);
      }
      if (!attivi.has(Number(socio.id))) {
        // Registrato (esito NON_INVIATO) per mostrarlo nel Log invii; non conta come inviato,
        // quindi se il socio rinnova l'abbonamento prima della scadenza l'email parte.
        contatore.saltati += 1;
        await registraInvio({ societaId: societa.id, tipo, socioId: socio.id, scadenzaRiferimento: scadenza, promemoriaN, destinatario: socio.email, esito: 'NON_INVIATO', dettaglioErrore: 'Nessun abbonamento attivo' });
        continue;
      }
    }
    const { esito, errore } = await inviaEmailAutomazione({ def, config, societa, socio, to: socio.email, scadenza, contatore });
    await registraInvio({ societaId: societa.id, tipo, socioId: socio.id, scadenzaRiferimento: scadenza, promemoriaN, destinatario: socio.email, esito, dettaglioErrore: errore });
  }
}

// Tipi con destinatario 'tutti_soci' (bilancio, runts, contributi_pubblici,
// cu, attivita_didattiche): la scadenza è unica per la società, ma l'email va
// a ciascun socio (trasparenza verso gli associati) — un invio/log per socio.
async function processTuttiSoci(tipo, def, config, societa, today, contatore) {
  const occorrenza = computeOccorrenzaSocieta(tipo, config, societa, today);
  if (!isNellaFinestraInvio(occorrenza, today)) return;
  const scadenza = occorrenza.scadenza;

  const soci = await Socio.findAll({ where: { societa_id: societa.id, email: { [Op.not]: null } } });
  for (const socio of soci) {
    if (!socio.email) continue;
    const promemoriaN = await promemoriaDovuto({ societaId: societa.id, tipo, socioId: socio.id, scadenzaRiferimento: scadenza }, config, today);
    if (!promemoriaN) {
      contatore.saltati += 1;
      continue;
    }
    const { esito, errore } = await inviaEmailAutomazione({ def, config, societa, socio, to: socio.email, scadenza, contatore });
    await registraInvio({ societaId: societa.id, tipo, socioId: socio.id, scadenzaRiferimento: scadenza, promemoriaN, destinatario: socio.email, esito, dettaglioErrore: errore });
  }
}

// Tipo 'abbonamento' (destinatario 'per_abbonamento'): un socio può avere più
// abbonamenti attivi con scadenze diverse (o anche uguali) — ognuno genera un
// invio/log indipendente, distinto tramite riferimento_extra (abbonamento_id).
async function processAbbonamento(tipo, def, config, societa, today, contatore) {
  const abbonamenti = await fetchAbbonamenti(societa.id);
  if (!abbonamenti) return;

  for (const item of abbonamenti) {
    if (!item.socio_id || !item.data_scadenza_abbonamento) continue;
    const occorrenza = computeOccorrenzaSocioField(config, item.data_scadenza_abbonamento);
    if (!isNellaFinestraInvio(occorrenza, today)) continue;
    const scadenza = occorrenza.scadenza;
    const riferimentoExtra = item.abbonamento_id ?? null;
    const promemoriaN = await promemoriaDovuto({ societaId: societa.id, tipo, socioId: item.socio_id, riferimentoExtra, scadenzaRiferimento: scadenza }, config, today);
    if (!promemoriaN) {
      contatore.saltati += 1;
      continue;
    }
    const socio = await Socio.findByPk(item.socio_id);
    const to = socio?.email;
    const { esito, errore } = await inviaEmailAutomazione({ def, config, societa, socio, to, scadenza, contatore });
    await registraInvio({ societaId: societa.id, tipo, socioId: item.socio_id, riferimentoExtra, scadenzaRiferimento: scadenza, promemoriaN, destinatario: to, esito, dettaglioErrore: errore });
  }
}

/**
 * Controlla tutte le automazioni configurate e invia le email dovute.
 * Chiamata per ogni società secondo la sua cadenza (runAutomazioniPianificate) e a richiesta
 * dall'endpoint POST /automazioni/run per test manuali.
 */
async function runAutomazioniCheck({ societaId } = {}) {
  const today = todayUTC();
  const whereSocieta = societaId ? { id: societaId } : undefined;
  const societaList = await Societa.findAll({ where: whereSocieta });
  const societaIds = societaList.map(s => s.id);

  const configRows = await AutomazioneConfig.findAll({ where: { societa_id: { [Op.in]: societaIds } } });
  const configByKey = new Map(configRows.map(r => [`${r.societa_id}:${r.tipo}`, r]));

  const contatore = { inviati: 0, errori: 0, saltati: 0 };

  for (const societa of societaList) {
    for (const tipo of TIPI) {
      const def = getDefinizione(tipo);
      const saved = configByKey.get(`${societa.id}:${tipo}`);
      const config = resolveConfig(tipo, saved, societa);
      if (!config.applicabile || !config.attiva) continue;

      try {
        if (def.destinatario === 'tutti_soci') {
          await processTuttiSoci(tipo, def, config, societa, today, contatore);
        } else if (def.destinatario === 'socio_field') {
          await processSocioField(tipo, def, config, societa, today, contatore);
        } else if (def.destinatario === 'per_abbonamento') {
          await processAbbonamento(tipo, def, config, societa, today, contatore);
        }
      } catch (err) {
        console.error(`Errore controllo automazione ${tipo} per società ${societa.id}:`, err);
      }
    }
  }

  console.log(`[automazioni] check completato — inviati: ${contatore.inviati}, errori: ${contatore.errori}, saltati: ${contatore.saltati}`);
  return contatore;
}

/**
 * Tick orario (vedi index.js): controlla solo le società per cui è arrivato lo slot
 * della propria cadenza (Configurazione → Automazioni) e ne registra l'esecuzione.
 */
let inCorso = false;
async function runAutomazioniPianificate(now = new Date()) {
  if (inCorso) return; // un controllo lungo non si sovrappone al tick successivo
  inCorso = true;
  try {
    const societaList = await Societa.findAll({ attributes: ['id', 'automazioni_pianificazione', 'automazioni_ultimo_controllo'] });
    for (const s of societaList) {
      if (!pianificazione.daControllare(s, now)) continue;
      try {
        await runAutomazioniCheck({ societaId: s.id });
      } catch (err) {
        console.error(`[automazioni] controllo pianificato fallito per società ${s.id}:`, err);
      }
      // Registrato anche in caso di errore: si riprova al prossimo slot, non a ogni ora
      await Societa.update({ automazioni_ultimo_controllo: new Date() }, { where: { id: s.id } });
    }
  } finally {
    inCorso = false;
  }
}

module.exports = { runAutomazioniCheck, runAutomazioniPianificate };
