'use strict';

// ---------------------------------------------------------------------------
// Baseline una-tantum dello storico migrazioni (stesso pattern usato dal
// servizio payments, vedi services/payments/scripts/baseline-migrations.js).
//
// Contesto: per gran parte della sua storia lo schema del servizio users è
// stato creato da `sequelize.sync({ alter: true })` (sync-db.js, eseguito
// dall'entrypoint prima delle migration), mai tramite sequelize-cli. Di
// conseguenza la tabella "SequelizeMeta" non esiste e nessuna migration
// risulta applicata. Se lanciassimo `db:migrate` "nudo" su questi DB già
// popolati, tenterebbe di rieseguire le migration di solo-schema
// (createTable/addColumn/bulkInsert) fallendo con "already exists".
//
// Questo script rende sicuro l'aggancio delle migration al deploy:
//   - crea la tabella "SequelizeMeta" se assente;
//   - SOLO se lo schema legacy è già presente (tabella `societa` esistente,
//     segno che il DB è stato costruito da sync), marca come già applicate
//     tutte le migration precedenti al cutoff (solo-schema/seed), così non
//     vengono rieseguite. Le migration successive al cutoff (già scritte in
//     modo idempotente) restano pendenti e verranno eseguite da `db:migrate`.
//
// Su un DB nuovo (tabella `societa` ancora inesistente al momento in cui gira
// questo script) il baseline non fa nulla: significherebbe che sync-db.js non
// è stato eseguito prima, e `db:migrate` proverà a costruire lo schema da
// zero (fallendo sulla dipendenza storica da `socios`, nota assente). In
// pratica questo script va sempre eseguito dopo sync-db.js. Idempotente.
// ---------------------------------------------------------------------------

const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');

// Tutte le migration con nome file < CUTOFF sono di solo-schema/seed, già
// applicate da sync sui DB esistenti. La prima migration scritta in modo
// idempotente (sicura da rieseguire anche su schema già sincronizzato) è
// 20260727000001 (add-riferimento-extra-to-automazioni-invii): questa e le
// successive NON vanno baselinate.
const BASELINE_CUTOFF = '20260727000001';
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

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

  await sequelize.query(
    'CREATE TABLE IF NOT EXISTS "SequelizeMeta" ("name" VARCHAR(255) NOT NULL PRIMARY KEY)'
  );

  const [rows] = await sequelize.query(
    "SELECT to_regclass('public.societa') IS NOT NULL AS exists"
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
    console.log('[baseline] Tabella societa assente: nessun baseline applicato.');
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error('[baseline] Errore:', err.message);
  process.exit(1);
});
