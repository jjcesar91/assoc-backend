'use strict';

// ---------------------------------------------------------------------------
// Fix una-tantum: ripristina il campo socios.scadenza_certificato a partire
// da un CSV esportato (formato "ELENCO SOCI", separatore ';', colonne
// COGNOME;NOME;...;CODICE_FISCALE;...;DATA SCADENZA CERTIFICATO;...).
// Il match tra riga CSV e socio a DB avviene per CODICE_FISCALE, ristretto
// alla società indicata.
//
// USO (da eseguire dentro un container con accesso alla rete app_network,
// tipicamente users_ms_prod, che ha già `pg` installato):
//
//   # 1. SEMPRE PRIMA in modalità report (default, nessuna scrittura):
//   node scripts/fix-scadenza-certificato.js /percorso/file.csv "DG FITNESS"
//
//   # 2. Solo dopo aver controllato con attenzione il report, per scrivere
//   #    davvero sul DB:
//   node scripts/fix-scadenza-certificato.js /percorso/file.csv "DG FITNESS" --execute
//
// Il file CSV NON deve essere committato nel repo (contiene dati personali
// dei soci): va copiato a mano sull'host di produzione, in un punto visibile
// al container (es. dentro services/users, che è bind-mounted su /app), o
// con `docker cp file.csv users_ms_prod:/app/scripts/data/file.csv`.
//
// Comportamento:
//   - righe senza CODICE_FISCALE: saltate (segnalate nel report);
//   - righe con CODICE_FISCALE non trovato tra i soci della società: saltate
//     (segnalate, per controllo manuale — es. socio non ancora importato);
//   - righe con colonna data vuota: saltate SENZA toccare il valore già
//     presente a DB (non si azzera nulla per assenza di dato nel CSV);
//   - righe con data non valida (formato atteso dd/mm/yyyy): segnalate come
//     errore e saltate;
//   - righe dove il valore a DB è già uguale a quello del CSV: contate ma non
//     riscritte;
//   - tutte le altre: aggiornate (solo la colonna scadenza_certificato).
// ---------------------------------------------------------------------------

const fs = require('fs');
const { Client, types } = require('pg');

// Il parser di default di node-pg converte le colonne DATE (oid 1082) in
// oggetti Date JS, soggetti a shift di fuso orario in fase di stampa/confronto.
// Le vogliamo come stringa 'YYYY-MM-DD' così come sono a DB.
types.setTypeParser(1082, val => val);

const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_HOST = process.env.USERS_DB_HOST || 'users_db';
const DB_NAME = 'users_db';

function usageAndExit() {
  console.error('Uso: node fix-scadenza-certificato.js <file.csv> "<nome esatto societa>" [--execute]');
  process.exit(1);
}

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const positional = args.filter(a => a !== '--execute');
const [csvPath, societaNome] = positional;
if (!csvPath || !societaNome) usageAndExit();
if (!fs.existsSync(csvPath)) {
  console.error(`File non trovato: ${csvPath}`);
  process.exit(1);
}

// Parser CSV minimale: gestisce virgolette e separatore ';' (nessuna
// dipendenza esterna, coerente con l'assenza di campi con ';' nel formato
// "ELENCO SOCI").
function parseCsv(text) {
  const rows = [];
  let cur = ''; let inQ = false; let fields = [];
  const clean = text.replace(/^﻿/, '');
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQ) {
      if (ch === '"' && clean[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else { cur += ch; }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ';') {
      fields.push(cur); cur = '';
    } else if (ch === '\n' || (ch === '\r' && clean[i + 1] === '\n')) {
      if (ch === '\r') i++;
      fields.push(cur); cur = '';
      if (fields.some(f => f.trim() !== '')) rows.push(fields);
      fields = [];
    } else {
      cur += ch;
    }
  }
  if (cur !== '' || fields.length) {
    fields.push(cur);
    if (fields.some(f => f.trim() !== '')) rows.push(fields);
  }
  return rows;
}

// dd/mm/yyyy -> yyyy-mm-dd. Restituisce null se non parsabile.
function parseItDate(str) {
  const s = (str || '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10), month = parseInt(m[2], 10), year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toIsoDateOnly(dbValue) {
  if (!dbValue) return null;
  // node-pg con DATEONLY restituisce già una stringa 'YYYY-MM-DD'.
  return String(dbValue).slice(0, 10);
}

async function main() {
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  if (rows.length < 2) { console.error('CSV vuoto o non valido.'); process.exit(1); }

  const header = rows[0].map(h => h.trim().toUpperCase());
  const idxCf = header.indexOf('CODICE_FISCALE');
  const idxScad = header.indexOf('DATA SCADENZA CERTIFICATO');
  const idxCognome = header.indexOf('COGNOME');
  const idxNome = header.indexOf('NOME');
  if (idxCf === -1 || idxScad === -1) {
    console.error('Intestazioni CODICE_FISCALE / DATA SCADENZA CERTIFICATO non trovate nel CSV.');
    process.exit(1);
  }
  const dataRows = rows.slice(1);

  const client = new Client({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
  await client.connect();

  try {
    const societaRes = await client.query('SELECT id, denominazione FROM societa WHERE denominazione ILIKE $1', [societaNome]);
    if (societaRes.rows.length === 0) {
      console.error(`Nessuna società trovata con denominazione esattamente "${societaNome}".`);
      const simili = await client.query('SELECT denominazione FROM societa WHERE denominazione ILIKE $1', [`%${societaNome}%`]);
      if (simili.rows.length) {
        console.error('Nomi simili trovati:');
        simili.rows.forEach(r => console.error(`  - ${r.denominazione}`));
      }
      process.exit(1);
    }
    if (societaRes.rows.length > 1) {
      console.error(`Trovate ${societaRes.rows.length} società con denominazione "${societaNome}", interrompo per sicurezza.`);
      process.exit(1);
    }
    const societaId = societaRes.rows[0].id;
    console.log(`Società: "${societaRes.rows[0].denominazione}" (id=${societaId})`);

    const sociRes = await client.query(
      'SELECT id, cognome, nome, codice_fiscale, scadenza_certificato FROM socios WHERE societa_id = $1',
      [societaId]
    );
    const byCf = new Map();
    for (const s of sociRes.rows) {
      if (s.codice_fiscale) {
        const key = s.codice_fiscale.trim().toUpperCase();
        if (byCf.has(key)) console.log(`ATTENZIONE: CF duplicato a DB per questa società: ${key}`);
        byCf.set(key, s);
      }
    }
    console.log(`Soci trovati a DB per questa società: ${sociRes.rows.length}`);

    const toUpdate = [];
    const noCf = [];
    const notFound = [];
    const noDate = [];
    const badDate = [];
    const unchanged = [];
    const seenCf = new Set();
    const dupCsv = [];

    for (let i = 0; i < dataRows.length; i++) {
      const cells = dataRows[i];
      const cf = (cells[idxCf] || '').trim().toUpperCase();
      const cognome = (cells[idxCognome] ?? '').trim();
      const nome = (cells[idxNome] ?? '').trim();
      const label = `riga ${i + 2} - ${cognome} ${nome}`.trim();

      if (!cf) { noCf.push(label); continue; }
      if (seenCf.has(cf)) dupCsv.push(`${label} (${cf})`);
      seenCf.add(cf);

      const rawDate = cells[idxScad] || '';
      if (!rawDate.trim()) { noDate.push(`${label} (${cf})`); continue; }

      const iso = parseItDate(rawDate);
      if (!iso) { badDate.push(`${label} (${cf}): "${rawDate}"`); continue; }

      const socio = byCf.get(cf);
      if (!socio) { notFound.push(`${label} (${cf})`); continue; }

      const current = toIsoDateOnly(socio.scadenza_certificato);
      if (current === iso) { unchanged.push(`${label} (${cf})`); continue; }

      toUpdate.push({ id: socio.id, cf, label, from: current, to: iso });
    }

    console.log('\n--- REPORT ---');
    console.log(`Righe CSV totali: ${dataRows.length}`);
    console.log(`Senza codice fiscale (saltate): ${noCf.length}`);
    console.log(`CF duplicati nel CSV: ${dupCsv.length}`);
    console.log(`Senza data certificato nel CSV (saltate, DB non toccato): ${noDate.length}`);
    console.log(`Data non valida (saltate): ${badDate.length}`);
    console.log(`CF non trovato tra i soci della società (saltate): ${notFound.length}`);
    console.log(`Già allineate (nessuna modifica necessaria): ${unchanged.length}`);
    console.log(`Da aggiornare: ${toUpdate.length}`);

    if (badDate.length) { console.log('\nDate non valide:'); badDate.forEach(l => console.log(`  - ${l}`)); }
    if (notFound.length) { console.log('\nCF non trovati a DB (primi 30):'); notFound.slice(0, 30).forEach(l => console.log(`  - ${l}`)); }
    if (dupCsv.length) { console.log('\nCF duplicati nel CSV:'); dupCsv.forEach(l => console.log(`  - ${l}`)); }

    console.log('\nAnteprima modifiche (prime 30):');
    toUpdate.slice(0, 30).forEach(u => console.log(`  - ${u.label} (${u.cf}): ${u.from || 'NULL'} -> ${u.to}`));

    if (!execute) {
      console.log('\nModalità report: nessuna scrittura effettuata. Rilanciare con --execute per applicare.');
      return;
    }

    if (toUpdate.length === 0) {
      console.log('\nNessuna riga da aggiornare, esco senza aprire transazioni.');
      return;
    }

    console.log(`\nEsecuzione: aggiorno ${toUpdate.length} soci...`);
    await client.query('BEGIN');
    try {
      for (const u of toUpdate) {
        await client.query('UPDATE socios SET scadenza_certificato = $1, "updatedAt" = NOW() WHERE id = $2', [u.to, u.id]);
      }
      await client.query('COMMIT');
      console.log(`Fatto: ${toUpdate.length} soci aggiornati.`);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Errore durante l\'aggiornamento, rollback eseguito:', e);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
