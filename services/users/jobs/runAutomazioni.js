'use strict';

const { Op } = require('sequelize');
const { Societa, Socio, AutomazioneConfig, AutomazioneInvio } = require('../models');
const { TIPI, getDefinizione, resolveConfig } = require('../utils/automazioniRegistry');
const { computeOccorrenzaSocieta, isNellaFinestraInvio, todayUTC, addDays, toDateOnly } = require('../utils/deadlineCalculator');
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
async function registraInvio({ societaId, tipo, socioId, scadenzaRiferimento, destinatario, esito, dettaglioErrore }) {
  const where = { societa_id: societaId, tipo, socio_id: socioId ?? null, scadenza_riferimento: scadenzaRiferimento };
  const [row] = await AutomazioneInvio.findOrCreate({ where, defaults: { ...where, destinatario, esito, dettaglio_errore: dettaglioErrore, data_invio: new Date() } });
  await row.update({ destinatario, esito, dettaglio_errore: dettaglioErrore || null, data_invio: new Date() });
}

async function giaInviata({ societaId, tipo, socioId, scadenzaRiferimento }) {
  const row = await AutomazioneInvio.findOne({
    where: { societa_id: societaId, tipo, socio_id: socioId ?? null, scadenza_riferimento: scadenzaRiferimento, esito: 'INVIATO' },
  });
  return !!row;
}

async function inviaEmailAutomazione({ tipo, def, config, societa, to, scadenza, contatore }) {
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

async function processTipoSocieta(tipo, def, config, societa, today, contatore) {
  const occorrenza = computeOccorrenzaSocieta(tipo, config, societa, today);
  if (!isNellaFinestraInvio(occorrenza, today)) return;

  const scadenza = occorrenza.scadenza;
  if (await giaInviata({ societaId: societa.id, tipo, socioId: null, scadenzaRiferimento: scadenza })) {
    contatore.saltati += 1;
    return;
  }

  const to = societa.email || societa.pec;
  const { esito, errore } = await inviaEmailAutomazione({ tipo, def, config, societa, to, scadenza, contatore });
  await registraInvio({ societaId: societa.id, tipo, socioId: null, scadenzaRiferimento: scadenza, destinatario: to, esito, dettaglioErrore: errore });
}

async function processCertificatoMedico(tipo, def, config, societa, today, contatore) {
  const soci = await Socio.findAll({ where: { societa_id: societa.id, scadenza_certificato: { [Op.not]: null } } });
  for (const socio of soci) {
    const scadenza = socio.scadenza_certificato; // DATEONLY -> 'YYYY-MM-DD'
    const target = toDateOnly(addDays(new Date(scadenza), -config.giorni_anticipo));
    const occorrenza = { scadenza, dataInvioTarget: target };
    if (!isNellaFinestraInvio(occorrenza, today)) continue;
    if (await giaInviata({ societaId: societa.id, tipo, socioId: socio.id, scadenzaRiferimento: scadenza })) {
      contatore.saltati += 1;
      continue;
    }
    const { esito, errore } = await inviaEmailAutomazione({ tipo, def, config, societa, to: socio.email, scadenza, contatore });
    await registraInvio({ societaId: societa.id, tipo, socioId: socio.id, scadenzaRiferimento: scadenza, destinatario: socio.email, esito, dettaglioErrore: errore });
  }
}

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
    const scadenza = item.data_scadenza_abbonamento;
    const target = toDateOnly(addDays(new Date(scadenza), -config.giorni_anticipo));
    const occorrenza = { scadenza, dataInvioTarget: target };
    if (!isNellaFinestraInvio(occorrenza, today)) continue;
    if (await giaInviata({ societaId: societa.id, tipo, socioId: item.socio_id, scadenzaRiferimento: scadenza })) {
      contatore.saltati += 1;
      continue;
    }
    const socio = await Socio.findByPk(item.socio_id);
    const to = socio?.email;
    const { esito, errore } = await inviaEmailAutomazione({ tipo, def, config, societa, to, scadenza, contatore });
    await registraInvio({ societaId: societa.id, tipo, socioId: item.socio_id, scadenzaRiferimento: scadenza, destinatario: to, esito, dettaglioErrore: errore });
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
        if (def.ambito === 'societa') {
          await processTipoSocieta(tipo, def, config, societa, today, contatore);
        } else if (def.strategy === 'socio_field') {
          await processCertificatoMedico(tipo, def, config, societa, today, contatore);
        } else if (def.strategy === 'payments_abbonamento') {
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
