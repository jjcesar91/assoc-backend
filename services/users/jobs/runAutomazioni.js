'use strict';

const { Op } = require('sequelize');
const { Societa, Socio, AutomazioneConfig, AutomazioneInvio } = require('../models');
const { TIPI, getDefinizione, resolveConfig } = require('../utils/automazioniRegistry');
const { computeOccorrenzaSocieta, computeOccorrenzaSocioField, isNellaFinestraInvio, todayUTC } = require('../utils/deadlineCalculator');
const { sendEmail } = require('../utils/mailService');

const PAYMENTS_SERVICE_URL = process.env.PAYMENTS_SERVICE_URL || 'http://payments_ms:3000';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'internal_secret_change_me';

function formatDataIt(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// Registra/aggiorna la riga di log per una specifica occorrenza (chiave di
// idempotenza). Un solo run "vincente" per occorrenza: se esiste già un
// log con esito INVIATO il chiamante non deve nemmeno provare a inviare.
async function registraInvio({ societaId, tipo, socioId, riferimentoExtra, scadenzaRiferimento, destinatario, esito, dettaglioErrore }) {
  const where = { societa_id: societaId, tipo, socio_id: socioId ?? null, riferimento_extra: riferimentoExtra ?? null, scadenza_riferimento: scadenzaRiferimento };
  const [row] = await AutomazioneInvio.findOrCreate({ where, defaults: { ...where, destinatario, esito, dettaglio_errore: dettaglioErrore, data_invio: new Date() } });
  await row.update({ destinatario, esito, dettaglio_errore: dettaglioErrore || null, data_invio: new Date() });
}

async function giaInviata({ societaId, tipo, socioId, riferimentoExtra, scadenzaRiferimento }) {
  const row = await AutomazioneInvio.findOne({
    where: { societa_id: societaId, tipo, socio_id: socioId ?? null, riferimento_extra: riferimentoExtra ?? null, scadenza_riferimento: scadenzaRiferimento, esito: 'INVIATO' },
  });
  return !!row;
}

async function inviaEmailAutomazione({ def, config, societa, to, scadenza, contatore }) {
  try {
    if (!to) throw new Error('Destinatario mancante');
    const subject = config.oggetto_email || def.oggettoDefault(societa);
    const corpo = config.testo_email || def.testoDefault(societa);
    const html = `${corpo}<br/><br/><strong>Data scadenza: ${formatDataIt(scadenza)}</strong>`;
    await sendEmail({ to, subject, html, societa });
    contatore.inviati += 1;
    return { esito: 'INVIATO', errore: null };
  } catch (err) {
    contatore.errori += 1;
    return { esito: 'ERRORE', errore: err.message };
  }
}

// Tipi con destinatario 'socio_field' (organo_amministrazione, doc_presidente,
// certificato_medico): la scadenza è il valore di un campo del socio; se non
// impostato, nessuna comunicazione viene inviata. Riceve solo il socio su cui
// il campo è valorizzato.
async function processSocioField(tipo, def, config, societa, today, contatore) {
  const soci = await Socio.findAll({ where: { societa_id: societa.id, [def.socioField]: { [Op.not]: null } } });
  for (const socio of soci) {
    const valore = socio[def.socioField];
    const occorrenza = computeOccorrenzaSocioField(config, valore);
    if (!isNellaFinestraInvio(occorrenza, today)) continue;
    const scadenza = occorrenza.scadenza;
    if (await giaInviata({ societaId: societa.id, tipo, socioId: socio.id, scadenzaRiferimento: scadenza })) {
      contatore.saltati += 1;
      continue;
    }
    const { esito, errore } = await inviaEmailAutomazione({ def, config, societa, to: socio.email, scadenza, contatore });
    await registraInvio({ societaId: societa.id, tipo, socioId: socio.id, scadenzaRiferimento: scadenza, destinatario: socio.email, esito, dettaglioErrore: errore });
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
    if (await giaInviata({ societaId: societa.id, tipo, socioId: socio.id, scadenzaRiferimento: scadenza })) {
      contatore.saltati += 1;
      continue;
    }
    const { esito, errore } = await inviaEmailAutomazione({ def, config, societa, to: socio.email, scadenza, contatore });
    await registraInvio({ societaId: societa.id, tipo, socioId: socio.id, scadenzaRiferimento: scadenza, destinatario: socio.email, esito, dettaglioErrore: errore });
  }
}

// Tipo 'abbonamento' (destinatario 'per_abbonamento'): un socio può avere più
// abbonamenti attivi con scadenze diverse (o anche uguali) — ognuno genera un
// invio/log indipendente, distinto tramite riferimento_extra (abbonamento_id).
async function processAbbonamento(tipo, def, config, societa, today, contatore) {
  let abbonamenti = [];
  try {
    const resp = await fetch(`${PAYMENTS_SERVICE_URL}/api/internal/abbonamenti-scadenza?societaId=${societa.id}`, {
      headers: { 'x-internal-secret': INTERNAL_API_SECRET },
    });
    if (resp.ok) abbonamenti = await resp.json();
  } catch (err) {
    console.error('Errore recupero abbonamenti da payments_ms:', err.message);
    return;
  }

  for (const item of abbonamenti) {
    if (!item.socio_id || !item.data_scadenza_abbonamento) continue;
    const occorrenza = computeOccorrenzaSocioField(config, item.data_scadenza_abbonamento);
    if (!isNellaFinestraInvio(occorrenza, today)) continue;
    const scadenza = occorrenza.scadenza;
    const riferimentoExtra = item.abbonamento_id ?? null;
    if (await giaInviata({ societaId: societa.id, tipo, socioId: item.socio_id, riferimentoExtra, scadenzaRiferimento: scadenza })) {
      contatore.saltati += 1;
      continue;
    }
    const socio = await Socio.findByPk(item.socio_id);
    const to = socio?.email;
    const { esito, errore } = await inviaEmailAutomazione({ def, config, societa, to, scadenza, contatore });
    await registraInvio({ societaId: societa.id, tipo, socioId: item.socio_id, riferimentoExtra, scadenzaRiferimento: scadenza, destinatario: to, esito, dettaglioErrore: errore });
  }
}

/**
 * Controlla tutte le automazioni configurate e invia le email dovute.
 * Chiamata una volta al giorno dal cron (vedi index.js) e a richiesta
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

module.exports = { runAutomazioniCheck };
