'use strict';

// Registro statico dei 9 tipi di automazione email. Non è editabile da UI:
// solo i valori per-società (attiva, giorni_anticipo, extra_config, testo/
// oggetto) sono salvati in AutomazioneConfig.
//
// Il destinatario di OGNI automazione è sempre un Socio (mai la casella email
// generica della società) — asse "destinatario":
//  - 'socio_field'   la scadenza stessa è un campo del socio (Socio.<socioField>):
//                     riceve solo il socio su cui il campo è valorizzato.
//  - 'tutti_soci'     la scadenza è calcolata a livello di società (stessa per
//                     tutti), ma l'email va a ciascun socio della società (uno
//                     invio/log per socio, per trasparenza verso gli associati).
//  - 'per_abbonamento' un invio per ciascun abbonamento in scadenza (un socio
//                     può averne più di uno attivo contemporaneamente).
//
// deadlineStrategy (come si calcola la data di scadenza):
//  - 'socio_field'            Socio.<socioField> (nessuna ricorrenza automatica:
//                             quando l'operatore aggiorna il campo si apre un
//                             nuovo ciclo)
//  - 'anno_associativo_offset' scadenza = fine anno associativo + offsetGiorni
//  - 'fixed_calendar'         scadenza annuale fissa (mese/giorno)
//  - 'biannual_calendar'      due scadenze annuali fisse, configurabili (extra_config)
//  - 'payments_abbonamento'   da servizio payments (cross-service), per abbonamento

const REGISTRY = {
  organo_amministrazione: {
    categoria: 'ets_point',
    label: 'Scadenza organo di amministrazione',
    deadlineStrategy: 'socio_field',
    destinatario: 'socio_field',
    socioField: 'scadenza_consiglio_direttivo',
    giorniAnticipoDefault: 30,
    applicabile: () => true,
    oggettoDefault: () => `Scadenza organo di amministrazione`,
    testoDefault: () => `Gentile socio,<br/>il tuo mandato nell'organo di amministrazione è in scadenza. Si prega di provvedere agli adempimenti necessari (rinnovo cariche sociali).`,
  },
  doc_presidente: {
    categoria: 'ets_point',
    label: 'Scadenza documento del presidente',
    deadlineStrategy: 'socio_field',
    destinatario: 'socio_field',
    socioField: 'scadenza_doc_presidente',
    giorniAnticipoDefault: 30,
    applicabile: () => true,
    oggettoDefault: () => `Scadenza documento di identità (presidente)`,
    testoDefault: () => `Gentile presidente,<br/>il tuo documento di identità è in scadenza. Si prega di provvedere al rinnovo.`,
  },
  bilancio: {
    categoria: 'ets_point',
    label: 'Deposito bilancio (120gg da fine anno associativo)',
    deadlineStrategy: 'anno_associativo_offset',
    destinatario: 'tutti_soci',
    offsetGiorni: 120,
    giorniAnticipoDefault: 60,
    applicabile: () => true,
    oggettoDefault: (societa) => `Scadenza deposito bilancio - ${societa.denominazione}`,
    testoDefault: (societa) => `Gentile socio,<br/>si ricorda che il bilancio di ${societa.denominazione} deve essere depositato entro 120 giorni dalla chiusura dell'anno associativo.`,
  },
  runts: {
    categoria: 'ets_point',
    label: 'Deposito bilancio RUNTS (180gg da chiusura anno associativo)',
    deadlineStrategy: 'anno_associativo_offset',
    destinatario: 'tutti_soci',
    offsetGiorni: 180,
    giorniAnticipoDefault: 60,
    applicabile: (societa) => societa.tipo_associazione === 'APS',
    oggettoDefault: (societa) => `Scadenza deposito bilancio RUNTS - ${societa.denominazione}`,
    testoDefault: (societa) => `Gentile socio,<br/>si ricorda che il bilancio di ${societa.denominazione} deve essere depositato sul RUNTS entro 180 giorni dalla chiusura dell'anno associativo.`,
  },
  contributi_pubblici: {
    categoria: 'ets_point',
    label: 'Pubblicazione contributi pubblici (entro 30 giugno)',
    deadlineStrategy: 'fixed_calendar',
    destinatario: 'tutti_soci',
    mese: 6,
    giorno: 30,
    giorniAnticipoDefault: 30,
    applicabile: () => true,
    oggettoDefault: (societa) => `Scadenza pubblicazione contributi pubblici - ${societa.denominazione}`,
    testoDefault: (societa) => `Gentile socio,<br/>si ricorda l'obbligo di pubblicazione dei contributi pubblici ricevuti da ${societa.denominazione} entro il 30 giugno.`,
  },
  cu: {
    categoria: 'ets_point',
    label: 'Certificazione Unica (CU)',
    deadlineStrategy: 'fixed_calendar',
    destinatario: 'tutti_soci',
    mese: 1,
    giorno: 30,
    giorniAnticipoDefault: 15,
    applicabile: () => true,
    oggettoDefault: (societa) => `Scadenza Certificazione Unica (CU) - ${societa.denominazione}`,
    testoDefault: (societa) => `Gentile socio,<br/>si ricorda la scadenza per l'invio della Certificazione Unica (CU) di ${societa.denominazione}.`,
  },
  attivita_didattiche: {
    categoria: 'ets_point',
    label: "Promemoria attività didattiche (2 volte l'anno)",
    deadlineStrategy: 'biannual_calendar',
    destinatario: 'tutti_soci',
    // Default: 1 gennaio e 1 luglio, sovrascrivibili per società (extra_config).
    defaultExtra: { mese1: 1, giorno1: 1, mese2: 7, giorno2: 1 },
    giorniAnticipoDefault: 15,
    applicabile: (societa) => ['ASD', 'SSD'].includes(societa.tipo_associazione),
    oggettoDefault: (societa) => `Promemoria attività didattiche - ${societa.denominazione}`,
    testoDefault: (societa) => `Gentile socio,<br/>promemoria periodico per la gestione delle attività didattiche di ${societa.denominazione}.`,
  },
  certificato_medico: {
    categoria: 'associazioni',
    label: 'Scadenza certificato medico',
    deadlineStrategy: 'socio_field',
    destinatario: 'socio_field',
    socioField: 'scadenza_certificato',
    giorniAnticipoDefault: 15,
    applicabile: () => true,
    oggettoDefault: () => `Scadenza certificato medico`,
    testoDefault: () => `Gentile socio,<br/>il tuo certificato medico è in scadenza. Ti invitiamo a provvedere al rinnovo.`,
  },
  abbonamento: {
    categoria: 'associazioni',
    label: 'Scadenza abbonamento',
    deadlineStrategy: 'payments_abbonamento',
    destinatario: 'per_abbonamento',
    giorniAnticipoDefault: 15,
    applicabile: () => true,
    oggettoDefault: () => `Scadenza abbonamento`,
    testoDefault: () => `Gentile socio,<br/>il tuo abbonamento è in scadenza. Ti invitiamo a provvedere al rinnovo.`,
  },
};

const TIPI = Object.keys(REGISTRY);

function getDefinizione(tipo) {
  const def = REGISTRY[tipo];
  if (!def) throw new Error(`Tipo automazione sconosciuto: ${tipo}`);
  return def;
}

// Ambito ai fini della UI di configurazione: 'societa' per i tipi con
// un'unica scadenza calcolata a livello di società (destinatario 'tutti_soci',
// mostra "prossimo invio"), 'socio' per gli altri (gestiti per singolo socio,
// nessuna data unica da mostrare).
function getAmbito(tipo) {
  return getDefinizione(tipo).destinatario === 'tutti_soci' ? 'societa' : 'socio';
}

// Unisce la riga salvata (se esiste) con i default del registro: usato sia
// dall'API di configurazione sia dal job, per non duplicare la logica.
function resolveConfig(tipo, saved, societa) {
  const def = getDefinizione(tipo);
  // Le automazioni di categoria 'ets_point' sono applicabili solo alle società
  // che hanno attivato "Gestore ETS Point" in Anagrafica (opzione riservata ai
  // superuser, disattivata di default): altrimenti la sezione non è visibile
  // in UI e nessuna email di questo tipo deve poter partire dal job schedulato.
  const applicabile = !!def.applicabile(societa)
    && (def.categoria !== 'ets_point' || !!societa.gestore_ets_point);
  return {
    applicabile,
    attiva: saved ? saved.attiva : applicabile,
    giorni_anticipo: saved?.giorni_anticipo ?? def.giorniAnticipoDefault,
    extra_config: saved?.extra_config ?? def.defaultExtra ?? null,
    oggetto_email: saved?.oggetto_email || null,
    testo_email: saved?.testo_email || null,
  };
}

module.exports = { REGISTRY, TIPI, getDefinizione, getAmbito, resolveConfig };
