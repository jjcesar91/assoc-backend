'use strict';

// Registro statico dei 9 tipi di automazione email. Non è editabile da UI:
// solo i valori per-società (attiva, giorni_anticipo, data_riferimento,
// extra_config, testo/oggetto) sono salvati in AutomazioneConfig.
//
// strategy:
//  - 'manual_date'            usa AutomazioneConfig.data_riferimento (inserita a mano)
//  - 'anno_associativo_offset' scadenza = fine anno associativo + offsetGiorni
//  - 'fixed_calendar'         scadenza annuale fissa (mese/giorno)
//  - 'biannual_calendar'      due scadenze annuali fisse, configurabili (extra_config)
//  - 'socio_field'            per singolo socio, campo Socio.<field> (stesso DB)
//  - 'payments_abbonamento'   per singolo socio, da servizio payments (cross-service)

const REGISTRY = {
  organo_amministrazione: {
    categoria: 'ets_point',
    ambito: 'societa',
    label: 'Scadenza organo di amministrazione',
    strategy: 'manual_date',
    giorniAnticipoDefault: 30,
    applicabile: () => true,
    oggettoDefault: (societa) => `Scadenza organo di amministrazione - ${societa.denominazione}`,
    testoDefault: (societa) => `Gentile ${societa.denominazione},<br/>si segnala che l'organo di amministrazione è in scadenza. Si prega di provvedere agli adempimenti necessari (rinnovo cariche sociali).`,
  },
  doc_presidente: {
    categoria: 'ets_point',
    ambito: 'societa',
    label: 'Scadenza documento del presidente',
    strategy: 'manual_date',
    giorniAnticipoDefault: 30,
    applicabile: () => true,
    oggettoDefault: (societa) => `Scadenza documento del presidente - ${societa.denominazione}`,
    testoDefault: (societa) => `Gentile ${societa.denominazione},<br/>il documento di identità del presidente è in scadenza. Si prega di provvedere al rinnovo.`,
  },
  bilancio: {
    categoria: 'ets_point',
    ambito: 'societa',
    label: 'Deposito bilancio (120gg da fine anno associativo)',
    strategy: 'anno_associativo_offset',
    offsetGiorni: 120,
    giorniAnticipoDefault: 60,
    applicabile: () => true,
    oggettoDefault: (societa) => `Scadenza deposito bilancio - ${societa.denominazione}`,
    testoDefault: (societa) => `Gentile ${societa.denominazione},<br/>si ricorda che il bilancio deve essere depositato entro 120 giorni dalla chiusura dell'anno associativo.`,
  },
  runts: {
    categoria: 'ets_point',
    ambito: 'societa',
    label: 'Deposito bilancio RUNTS (180gg da chiusura anno associativo)',
    strategy: 'anno_associativo_offset',
    offsetGiorni: 180,
    giorniAnticipoDefault: 60,
    applicabile: (societa) => societa.tipo_associazione === 'APS',
    oggettoDefault: (societa) => `Scadenza deposito bilancio RUNTS - ${societa.denominazione}`,
    testoDefault: (societa) => `Gentile ${societa.denominazione},<br/>si ricorda che il bilancio deve essere depositato sul RUNTS entro 180 giorni dalla chiusura dell'anno associativo.`,
  },
  contributi_pubblici: {
    categoria: 'ets_point',
    ambito: 'societa',
    label: 'Pubblicazione contributi pubblici (entro 30 giugno)',
    strategy: 'fixed_calendar',
    mese: 6,
    giorno: 30,
    giorniAnticipoDefault: 30,
    applicabile: () => true,
    oggettoDefault: (societa) => `Scadenza pubblicazione contributi pubblici - ${societa.denominazione}`,
    testoDefault: (societa) => `Gentile ${societa.denominazione},<br/>si ricorda l'obbligo di pubblicazione dei contributi pubblici ricevuti entro il 30 giugno.`,
  },
  cu: {
    categoria: 'ets_point',
    ambito: 'societa',
    label: 'Certificazione Unica (CU)',
    strategy: 'fixed_calendar',
    mese: 1,
    giorno: 30,
    giorniAnticipoDefault: 15,
    applicabile: () => true,
    oggettoDefault: (societa) => `Scadenza Certificazione Unica (CU) - ${societa.denominazione}`,
    testoDefault: (societa) => `Gentile ${societa.denominazione},<br/>si ricorda la scadenza per l'invio della Certificazione Unica (CU).`,
  },
  attivita_didattiche: {
    categoria: 'ets_point',
    ambito: 'societa',
    label: "Promemoria attività didattiche (2 volte l'anno)",
    strategy: 'biannual_calendar',
    // Default: 1 gennaio e 1 luglio, sovrascrivibili per società (extra_config).
    defaultExtra: { mese1: 1, giorno1: 1, mese2: 7, giorno2: 1 },
    giorniAnticipoDefault: 15,
    applicabile: (societa) => ['ASD', 'SSD'].includes(societa.tipo_associazione),
    oggettoDefault: (societa) => `Promemoria attività didattiche - ${societa.denominazione}`,
    testoDefault: (societa) => `Gentile ${societa.denominazione},<br/>promemoria periodico per la gestione delle attività didattiche.`,
  },
  certificato_medico: {
    categoria: 'associazioni',
    ambito: 'socio',
    label: 'Scadenza certificato medico',
    strategy: 'socio_field',
    socioField: 'scadenza_certificato',
    giorniAnticipoDefault: 15,
    applicabile: () => true,
    oggettoDefault: () => `Scadenza certificato medico`,
    testoDefault: () => `Gentile socio,<br/>il tuo certificato medico è in scadenza. Ti invitiamo a provvedere al rinnovo.`,
  },
  abbonamento: {
    categoria: 'associazioni',
    ambito: 'socio',
    label: 'Scadenza abbonamento',
    strategy: 'payments_abbonamento',
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

// Unisce la riga salvata (se esiste) con i default del registro: usato sia
// dall'API di configurazione sia dal job, per non duplicare la logica.
function resolveConfig(tipo, saved, societa) {
  const def = getDefinizione(tipo);
  const applicabile = !!def.applicabile(societa);
  return {
    applicabile,
    attiva: saved ? saved.attiva : applicabile,
    giorni_anticipo: saved?.giorni_anticipo ?? def.giorniAnticipoDefault,
    data_riferimento: saved?.data_riferimento ?? null,
    extra_config: saved?.extra_config ?? def.defaultExtra ?? null,
    oggetto_email: saved?.oggetto_email || null,
    testo_email: saved?.testo_email || null,
  };
}

module.exports = { REGISTRY, TIPI, getDefinizione, resolveConfig };
