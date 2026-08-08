'use strict';

// ---------------------------------------------------------------------------
// Cancellazione fisica e definitiva di una o più società e di TUTTI i dati
// collegati, su TUTTI i microservizi (users, auth, payments, activities,
// products, documents). Operazione manuale una-tantum: nell'app non esiste
// nessuna funzione di cancellazione società (né endpoint né UI).
//
// USO (da eseguire dentro un container con accesso alla rete app_network,
// tipicamente users_ms_prod, che ha già `pg` installato):
//
//   # 1. SEMPRE PRIMA in modalità report (default, nessuna scrittura):
//   node scripts/delete-societa.js "ACADEMY DEMO" "TERESA ASD" ...
//
//   # 2. Solo dopo aver controllato il report con attenzione, per eseguire
//   #    davvero la cancellazione bisogna passare ENTRAMBI i flag:
//   node scripts/delete-societa.js "ACADEMY DEMO" "TERESA ASD" ... \
//        --execute --confirm="ACADEMY DEMO,TERESA ASD,..."
//   (--confirm deve elencare ESATTAMENTE gli stessi nomi, nello stesso
//   ordine, passati come argomenti posizionali: è un secondo controllo
//   contro l'esecuzione accidentale, es. rilancio da history della shell).
//
// Lo script:
//   - risolve i nomi in id sulla tabella societa (users_db) e si ferma se
//     un nome non trova ESATTAMENTE una corrispondenza;
//   - in modalità report conta le righe che verrebbero cancellate in ogni
//     tabella di ogni database, senza scrivere nulla;
//   - in modalità --execute cancella esplicitamente in ordine figli-prima-
//     dei-genitori, in una transazione per ciascun database (non si affida
//     alle FK/CASCADE del database, che in produzione potrebbero non
//     corrispondere esattamente a quanto risulta dai file di migration);
//   - NON cancella i file caricati (logo società, quietanze/ricevute
//     caricate, allegati storico): alla fine stampa l'elenco dei path da
//     rimuovere manualmente (vivono su volumi di container diversi:
//     users_ms per logo/storico, payments_ms per le quietanze).
// ---------------------------------------------------------------------------

const { Client } = require('pg');

const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_PORT = process.env.DB_PORT || 5432;

// Host di default = nome servizio nella rete docker compose (app_network),
// sovrascrivibili singolarmente via env se necessario.
const DATABASES = {
  users: { host: process.env.USERS_DB_HOST || 'users_db', database: 'users_db' },
  auth: { host: process.env.AUTH_DB_HOST || 'auth_db', database: 'auth_db' },
  payments: { host: process.env.PAYMENTS_DB_HOST || 'payments_db', database: 'payments_db' },
  activities: { host: process.env.ACTIVITIES_DB_HOST || 'activities_db', database: 'activities_db' },
  products: { host: process.env.PRODUCTS_DB_HOST || 'products_db', database: 'products_db' },
  documents: { host: process.env.DOCUMENTS_DB_HOST || 'documents_db', database: 'documents_db' },
};

function makeClient(key) {
  const cfg = DATABASES[key];
  return new Client({
    host: cfg.host,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: cfg.database,
  });
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const execute = rawArgs.includes('--execute');
  const confirmArg = rawArgs.find((a) => a.startsWith('--confirm='));
  const names = rawArgs.filter((a) => a !== '--execute' && !a.startsWith('--confirm='));

  if (names.length === 0) {
    console.error('Uso: node delete-societa.js "Nome Società 1" "Nome Società 2" ... [--execute --confirm="Nome Società 1,Nome Società 2,..."]');
    process.exit(1);
  }

  if (execute) {
    const confirmNames = confirmArg ? confirmArg.slice('--confirm='.length).split(',').map((s) => s.trim()) : [];
    const same = confirmNames.length === names.length && names.every((n, i) => n === confirmNames[i]);
    if (!same) {
      console.error('\n--execute richiede anche --confirm="<stessi nomi, stesso ordine, separati da virgola>" — non corrisponde, interrompo senza scrivere nulla.\n');
      process.exit(1);
    }
  }

  console.log(execute ? '\n*** MODALITA\' ESECUZIONE: le righe elencate verranno cancellate DAVVERO ***\n' : '\nModalità report (nessuna scrittura). Aggiungi --execute --confirm=... per cancellare davvero.\n');

  // ── Fase 0: risolvi i nomi società sul DB users ───────────────────────
  const users = makeClient('users');
  await users.connect();

  const { rows: societaRows } = await users.query(
    'SELECT id, denominazione FROM societa WHERE denominazione = ANY($1::text[])',
    [names]
  );

  const foundByName = new Map(societaRows.map((r) => [r.denominazione, r.id]));
  const missing = names.filter((n) => !foundByName.has(n));
  if (missing.length > 0) {
    console.error('Nomi non trovati (o con corrispondenza non esatta) nella tabella societa, interrompo:');
    missing.forEach((n) => console.error(`  - "${n}"`));
    await users.end();
    process.exit(1);
  }

  const societaIds = societaRows.map((r) => r.id);
  console.log('Società risolte:');
  societaRows.forEach((r) => console.log(`  - id=${r.id}  "${r.denominazione}"`));
  console.log('');

  // ── Fase 1: raccogli gli id/percorsi che servono per i database "figli" ─
  const { rows: socioRows } = await users.query(
    'SELECT id, user_id, cognome, nome FROM socios WHERE societa_id = ANY($1::int[])',
    [societaIds]
  );
  const socioIds = socioRows.map((r) => r.id);
  const orphanUserIds = socioRows.map((r) => r.user_id).filter((v) => v != null);

  const { rows: storicoAllegati } = socioIds.length
    ? await users.query(
        `SELECT allegato_path FROM socio_storico WHERE socio_id = ANY($1::int[]) AND allegato_path IS NOT NULL`,
        [socioIds]
      )
    : { rows: [] };

  const { rows: logoRows } = await users.query(
    'SELECT logo_path FROM societa WHERE id = ANY($1::int[]) AND logo_path IS NOT NULL',
    [societaIds]
  );

  console.log(`Soci trovati: ${socioIds.length}`);
  console.log('');

  // ── Fase 2: report (SELECT COUNT ovunque, nessuna scrittura) ──────────
  async function reportCount(client, label, sql, params) {
    const { rows } = await client.query(sql, params);
    const n = parseInt(rows[0].n, 10);
    console.log(`  ${label}: ${n}`);
    return n;
  }

  console.log('=== users_db ===');
  await reportCount(users, 'socio_storico', 'SELECT COUNT(*) n FROM socio_storico WHERE socio_id = ANY($1::int[])', [socioIds]);
  await reportCount(users, 'socio_contatti', 'SELECT COUNT(*) n FROM socio_contatti WHERE socio_id = ANY($1::int[])', [socioIds]);
  await reportCount(users, 'iscrizioni', 'SELECT COUNT(*) n FROM iscrizioni WHERE socio_id = ANY($1::int[])', [socioIds]);
  await reportCount(users, 'comunicazioni', 'SELECT COUNT(*) n FROM comunicazioni WHERE socio_id = ANY($1::int[])', [socioIds]);
  await reportCount(users, 'automazioni_invii', 'SELECT COUNT(*) n FROM automazioni_invii WHERE societa_id = ANY($1::int[])', [societaIds]);
  await reportCount(users, 'socios', 'SELECT COUNT(*) n FROM socios WHERE societa_id = ANY($1::int[])', [societaIds]);
  await reportCount(users, 'users (secondario, orfani)', 'SELECT COUNT(*) n FROM users WHERE id = ANY($1::int[])', [orphanUserIds]);
  await reportCount(users, 'automazioni_config', 'SELECT COUNT(*) n FROM automazioni_config WHERE societa_id = ANY($1::int[])', [societaIds]);
  await reportCount(users, '"SocietaAffiliazioni"', 'SELECT COUNT(*) n FROM "SocietaAffiliazioni" WHERE societa_id = ANY($1::int[])', [societaIds]);
  console.log('  societa: ' + societaIds.length);
  console.log('');

  const auth = makeClient('auth');
  await auth.connect();
  console.log('=== auth_db ===');
  await reportCount(auth, '"Users" (credenziali login)', 'SELECT COUNT(*) n FROM "Users" WHERE "societaId" = ANY($1::int[])', [societaIds]);
  console.log('');

  const payments = makeClient('payments');
  await payments.connect();
  console.log('=== payments_db ===');
  await reportCount(payments, 'ricevuta_tokens', 'SELECT COUNT(*) n FROM ricevuta_tokens WHERE societa_id = ANY($1::int[])', [societaIds]);
  await reportCount(payments, 'payments', 'SELECT COUNT(*) n FROM payments WHERE societa_id = ANY($1::int[])', [societaIds]);
  await reportCount(payments, 'payment_voci_config', 'SELECT COUNT(*) n FROM payment_voci_config WHERE societa_id = ANY($1::int[])', [societaIds]);
  await reportCount(payments, 'gruppi', 'SELECT COUNT(*) n FROM gruppi WHERE societa_id = ANY($1::int[])', [societaIds]);
  await reportCount(payments, 'conti', 'SELECT COUNT(*) n FROM conti WHERE societa_id = ANY($1::int[])', [societaIds]);
  await reportCount(payments, 'fornitori', 'SELECT COUNT(*) n FROM fornitori WHERE societa_id = ANY($1::int[])', [societaIds]);
  const { rows: ricevutaFiles } = await payments.query(
    'SELECT ricevuta_file_path FROM payments WHERE societa_id = ANY($1::int[]) AND ricevuta_file_path IS NOT NULL',
    [societaIds]
  );
  console.log('');

  const activities = makeClient('activities');
  await activities.connect();
  console.log('=== activities_db ===');
  const { rows: corsoRows } = await activities.query('SELECT id FROM "Corsi" WHERE "societaId" = ANY($1::int[])', [societaIds]);
  const corsoIds = corsoRows.map((r) => r.id);
  await reportCount(activities, '"CorsoPresenze"', 'SELECT COUNT(*) n FROM "CorsoPresenze" WHERE "corsoId" = ANY($1::int[])', [corsoIds]);
  await reportCount(activities, '"CorsoIscrizioni"', 'SELECT COUNT(*) n FROM "CorsoIscrizioni" WHERE "corsoId" = ANY($1::int[])', [corsoIds]);
  await reportCount(activities, '"CorsoOrari"', 'SELECT COUNT(*) n FROM "CorsoOrari" WHERE "corsoId" = ANY($1::int[])', [corsoIds]);
  console.log('  "Corsi": ' + corsoIds.length);
  await reportCount(activities, '"Aree"', 'SELECT COUNT(*) n FROM "Aree" a JOIN "Strutture" s ON s.id = a."strutturaId" WHERE s."societaId" = ANY($1::int[])', [societaIds]);
  await reportCount(activities, '"Strutture"', 'SELECT COUNT(*) n FROM "Strutture" WHERE "societaId" = ANY($1::int[])', [societaIds]);
  await reportCount(activities, '"Staff"', 'SELECT COUNT(*) n FROM "Staff" WHERE "societaId" = ANY($1::int[])', [societaIds]);
  await reportCount(activities, '"Attivita"', 'SELECT COUNT(*) n FROM "Attivita" WHERE "societaId" = ANY($1::int[])', [societaIds]);
  console.log('');

  const products = makeClient('products');
  await products.connect();
  console.log('=== products_db ===');
  await reportCount(products, '"Products"', 'SELECT COUNT(*) n FROM "Products" WHERE "societaId" = ANY($1::int[])', [societaIds]);
  console.log('');

  const documents = makeClient('documents');
  await documents.connect();
  console.log('=== documents_db ===');
  await reportCount(documents, 'moduli', 'SELECT COUNT(*) n FROM moduli WHERE societa_id = ANY($1::int[])', [societaIds]);
  console.log('');

  console.log('=== File da rimuovere manualmente (nessuno script li tocca) ===');
  console.log(`  logo società (container users_ms, uploads/): ${logoRows.map((r) => r.logo_path).join(', ') || '(nessuno)'}`);
  console.log(`  allegati storico (container users_ms, uploads/storico/): ${storicoAllegati.map((r) => r.allegato_path).join(', ') || '(nessuno)'}`);
  console.log(`  quietanze caricate (container payments_ms, uploads/ricevute/): ${ricevutaFiles.map((r) => r.ricevuta_file_path).join(', ') || '(nessuno)'}`);
  console.log('');

  if (!execute) {
    console.log('Report completato, nessuna scrittura eseguita. Rilancia con --execute --confirm="..." per cancellare davvero.\n');
    await Promise.all([users.end(), auth.end(), payments.end(), activities.end(), products.end(), documents.end()]);
    return;
  }

  // ── Fase 3: cancellazione vera, in transazione per ciascun database ────
  console.log('Procedo con la cancellazione...\n');

  async function runDeletes(client, label, statements) {
    await client.query('BEGIN');
    try {
      for (const { sql, params, desc } of statements) {
        const res = await client.query(sql, params);
        console.log(`  [${label}] ${desc}: ${res.rowCount} righe`);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  [${label}] ERRORE, rollback eseguito:`, err.message);
      throw err;
    }
  }

  await runDeletes(payments, 'payments_db', [
    { sql: 'DELETE FROM ricevuta_tokens WHERE societa_id = ANY($1::int[])', params: [societaIds], desc: 'ricevuta_tokens' },
    { sql: 'DELETE FROM payments WHERE societa_id = ANY($1::int[])', params: [societaIds], desc: 'payments' },
    { sql: 'DELETE FROM payment_voci_config WHERE societa_id = ANY($1::int[])', params: [societaIds], desc: 'payment_voci_config' },
    { sql: 'DELETE FROM gruppi WHERE societa_id = ANY($1::int[])', params: [societaIds], desc: 'gruppi' },
    { sql: 'DELETE FROM conti WHERE societa_id = ANY($1::int[])', params: [societaIds], desc: 'conti' },
    { sql: 'DELETE FROM fornitori WHERE societa_id = ANY($1::int[])', params: [societaIds], desc: 'fornitori' },
  ]);

  await runDeletes(activities, 'activities_db', [
    { sql: 'DELETE FROM "CorsoPresenze" WHERE "corsoId" = ANY($1::int[])', params: [corsoIds], desc: '"CorsoPresenze"' },
    { sql: 'DELETE FROM "CorsoIscrizioni" WHERE "corsoId" = ANY($1::int[])', params: [corsoIds], desc: '"CorsoIscrizioni"' },
    { sql: 'DELETE FROM "CorsoOrari" WHERE "corsoId" = ANY($1::int[])', params: [corsoIds], desc: '"CorsoOrari"' },
    { sql: 'DELETE FROM "Corsi" WHERE "societaId" = ANY($1::int[])', params: [societaIds], desc: '"Corsi"' },
    { sql: 'DELETE FROM "Aree" WHERE "strutturaId" IN (SELECT id FROM "Strutture" WHERE "societaId" = ANY($1::int[]))', params: [societaIds], desc: '"Aree"' },
    { sql: 'DELETE FROM "Strutture" WHERE "societaId" = ANY($1::int[])', params: [societaIds], desc: '"Strutture"' },
    { sql: 'DELETE FROM "Staff" WHERE "societaId" = ANY($1::int[])', params: [societaIds], desc: '"Staff"' },
    { sql: 'DELETE FROM "Attivita" WHERE "societaId" = ANY($1::int[])', params: [societaIds], desc: '"Attivita"' },
  ]);

  await runDeletes(products, 'products_db', [
    { sql: 'DELETE FROM "Products" WHERE "societaId" = ANY($1::int[])', params: [societaIds], desc: '"Products"' },
  ]);

  await runDeletes(documents, 'documents_db', [
    { sql: 'DELETE FROM moduli WHERE societa_id = ANY($1::int[])', params: [societaIds], desc: 'moduli' },
  ]);

  await runDeletes(auth, 'auth_db', [
    { sql: 'DELETE FROM "Users" WHERE "societaId" = ANY($1::int[])', params: [societaIds], desc: '"Users"' },
  ]);

  await runDeletes(users, 'users_db', [
    { sql: 'DELETE FROM socio_storico WHERE socio_id = ANY($1::int[])', params: [socioIds], desc: 'socio_storico' },
    { sql: 'DELETE FROM socio_contatti WHERE socio_id = ANY($1::int[])', params: [socioIds], desc: 'socio_contatti' },
    { sql: 'DELETE FROM iscrizioni WHERE socio_id = ANY($1::int[])', params: [socioIds], desc: 'iscrizioni' },
    { sql: 'DELETE FROM comunicazioni WHERE socio_id = ANY($1::int[])', params: [socioIds], desc: 'comunicazioni' },
    { sql: 'DELETE FROM automazioni_invii WHERE societa_id = ANY($1::int[])', params: [societaIds], desc: 'automazioni_invii' },
    { sql: 'DELETE FROM socios WHERE societa_id = ANY($1::int[])', params: [societaIds], desc: 'socios' },
    { sql: 'DELETE FROM users WHERE id = ANY($1::int[])', params: [orphanUserIds], desc: 'users (secondario)' },
    { sql: 'DELETE FROM automazioni_config WHERE societa_id = ANY($1::int[])', params: [societaIds], desc: 'automazioni_config' },
    { sql: 'DELETE FROM "SocietaAffiliazioni" WHERE societa_id = ANY($1::int[])', params: [societaIds], desc: '"SocietaAffiliazioni"' },
    { sql: 'DELETE FROM societa WHERE id = ANY($1::int[])', params: [societaIds], desc: 'societa' },
  ]);

  console.log('\nCancellazione completata su tutti i database.');
  console.log('Ricorda di rimuovere manualmente i file elencati sopra (logo, allegati storico, quietanze).\n');

  await Promise.all([users.end(), auth.end(), payments.end(), activities.end(), products.end(), documents.end()]);
}

main().catch((err) => {
  console.error('\nErrore:', err);
  process.exit(1);
});
