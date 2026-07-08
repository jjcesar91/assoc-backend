'use strict';

// ---------------------------------------------------------------------------
// Baseline una-tantum dello storico migrazioni.
//
// Contesto: lo schema del servizio payments è sempre stato creato da
// `sequelize.sync({ alter: true })` all'avvio (index.js), mai tramite
// sequelize-cli. Di conseguenza la tabella "SequelizeMeta" non esiste e nessuna
// migration risulta applicata. Se lanciassimo `db:migrate` "nudo" su questi DB
// già popolati, tenterebbe di rieseguire le migration di solo-schema
// (createTable/addColumn) fallendo con "already exists".
//
// Questo script rende sicuro l'aggancio delle migration al deploy:
//   - crea la tabella "SequelizeMeta" se assente;
//   - SOLO se lo schema legacy è già presente (tabella `gruppi` esistente, segno
//     che il DB è stato costruito da sync in passato), marca come già applicate
//     tutte le migration precedenti al cutoff (solo-schema), così non vengono
//     rieseguite. Le migration di dato/nuove (>= cutoff) restano pendenti e
//     verranno eseguite da `db:migrate`.
//
// Su un DB nuovo (tabella `gruppi` ancora inesistente al momento dell'entrypoint,
// perché sync gira dopo) il baseline non fa nulla e `db:migrate` costruisce lo
// schema da zero in modo normale. In entrambi i casi lo script è idempotente.
// ---------------------------------------------------------------------------

const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');

// Tutte le migration con nome file < CUTOFF sono di solo-schema, già applicate
// da sync sui DB esistenti. La prima migration di dato è 20260706000000
// (clear-sezione-asd-gruppi): questa e le successive NON vanno baselinate.
const BASELINE_CUTOFF = '20260706000000';
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations', '000');

const env = process.env.NODE_ENV || 'development';
const config = require(path.resolve(__dirname, '..', 'config', 'config.js'))[env];

async function main() {
  const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
      host: config.host,
      port: config.port || 5432,
      dialect: config.dialect || 'postgres',
      logging: false,
    }
  );

  await sequelize.authenticate();

  // 1. Tabella di tracking (stesso schema usato da sequelize-cli).
  await sequelize.query(
    'CREATE TABLE IF NOT EXISTS "SequelizeMeta" ("name" VARCHAR(255) NOT NULL PRIMARY KEY)'
  );

  // 2. Baseline solo su DB legacy costruito da sync (tabella gruppi già presente).
  const [rows] = await sequelize.query(
    "SELECT to_regclass('public.gruppi') IS NOT NULL AS exists"
  );
  const schemaEsiste = rows[0] && rows[0].exists;

  if (schemaEsiste) {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.js') && f < BASELINE_CUTOFF)
      .sort();

    for (const name of files) {
      await sequelize.query(
        'INSERT INTO "SequelizeMeta" ("name") VALUES (:name) ON CONFLICT ("name") DO NOTHING',
        { replacements: { name } }
      );
    }
    console.log(
      `[baseline] Schema legacy rilevato: ${files.length} migration di solo-schema marcate come applicate.`
    );
  } else {
    console.log('[baseline] DB nuovo: nessun baseline necessario, le migration costruiranno lo schema.');
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error('[baseline] Errore:', err.message);
  process.exit(1);
});
