/**
 * populate_attivita.js
 *
 * Popola la vista Attività/Calendario con dati di esempio:
 *  - 3 attività extra (NUOTO, YOGA, CALCETTO)
 *  - 1 struttura extra (Piscina Comunale)
 *  - 2 aree extra (Vasca Olimpionica, Sala Fitness)
 *  - 8 corsi extra (totale 10 con i 2 già esistenti)
 *  - Aggiorna scadenza_certificato dei soci 1-20
 *  - Crea pagamenti per i soci con date variegate (verde/giallo/rosso)
 *  - Iscrive i soci ai corsi con mix di stati
 *
 * Run from: /home/dave/management-software/backend/services/activities/
 *   node ../../populate_attivita.js
 * oppure direttamente se pg è disponibile globalmente.
 */

'use strict';

const { Client } = require('pg');

// ── Configurazione database ─────────────────────────────────────────────────
const DB = {
  activities: { host: 'localhost', port: 5438, user: 'postgres', password: 'postgres', database: 'activities_db' },
  users:      { host: 'localhost', port: 5434, user: 'postgres', password: 'postgres', database: 'users_db' },
  payments:   { host: 'localhost', port: 5437, user: 'postgres', password: 'postgres', database: 'payments_db' },
};

// ── Costanti ────────────────────────────────────────────────────────────────
const SOCIETA_ID = 1;

// Oggi: 2026-04-19 — date usate per i diversi scenari
// Default giorniAvviso = 30  →  zona warning: 2026-04-19 .. 2026-05-19
// Abb 8 giorniAvviso = 2    →  zona warning: 2026-04-19 .. 2026-04-21

const CERT_GREEN  = '2026-10-01'; // OK per tutti
const CERT_YELLOW = '2026-04-20'; // 1 giorno dalla scadenza → warning per qualsiasi giorniAvviso ≥ 1
const CERT_RED    = '2025-12-15'; // Scaduto

const PAY_GREEN   = '2026-10-01'; // OK per tutti
const PAY_YELLOW  = '2026-04-20'; // 1 giorno → warning per qualsiasi giorniAvviso ≥ 1
const PAY_RED     = '2025-11-30'; // Scaduto

// ── Gruppi soci (IDs 1-20 in users_db, tutti societa_id=1) ─────────────────
const SOCI_GREEN        = [1, 2, 3, 4];       // cert OK  + abb OK  → verde
const SOCI_YELLOW_CERT  = [5, 6, 7];           // cert ⚠   + abb OK  → giallo
const SOCI_YELLOW_ABB   = [8, 9, 10];          // cert OK  + abb ⚠   → giallo
const SOCI_RED_CERT     = [11, 12, 13];        // cert ✗   + abb OK  → rosso
const SOCI_RED_ABB      = [14, 15, 16];        // cert OK  + abb ✗   → rosso
const SOCI_RED_BOTH     = [17, 18, 19, 20];    // cert ✗   + abb ✗   → rosso

// Abbonamenti già esistenti su products_db
const ABBONAMENTI = [3, 5, 8]; // product_id da usare per i pagamenti

// ────────────────────────────────────────────────────────────────────────────

async function withClient(cfg, fn) {
  const c = new Client(cfg);
  await c.connect();
  try { return await fn(c); }
  finally { await c.end(); }
}

// ── 1. Popola activities_db ──────────────────────────────────────────────────
async function populateActivities() {
  await withClient(DB.activities, async (c) => {
    console.log('\n▶ activities_db');

    // --- Attività aggiuntive ---
    const attRes = await c.query(`
      INSERT INTO "Attivita" ("societaId","descrizione","colore","createdAt","updatedAt")
      VALUES
        ($1,'NUOTO','BLU',NOW(),NOW()),
        ($1,'YOGA','VERDE CHIARO',NOW(),NOW()),
        ($1,'CALCETTO','ARANCIO',NOW(),NOW())
      RETURNING id, descrizione
    `, [SOCIETA_ID]);

    const attMap = {};
    for (const r of attRes.rows) attMap[r.descrizione] = r.id;
    const ATT = { TENNIS: 1, PILATES: 2, NUOTO: attMap['NUOTO'], YOGA: attMap['YOGA'], CALCETTO: attMap['CALCETTO'] };
    console.log('  Attività:', ATT);

    // --- Struttura aggiuntiva ---
    const strRes = await c.query(`
      INSERT INTO "Strutture" ("societaId","descrizione","colore","createdAt","updatedAt")
      VALUES ($1,'Piscina Comunale - Via Colombo 5','CELESTE',NOW(),NOW())
      RETURNING id
    `, [SOCIETA_ID]);
    const piscinaId = strRes.rows[0].id;
    console.log('  Struttura Piscina id:', piscinaId);

    // --- Aree aggiuntive ---
    const areeRes = await c.query(`
      INSERT INTO "Aree" ("strutturaId","descrizione","createdAt","updatedAt")
      VALUES
        ($1,'Vasca Olimpionica',NOW(),NOW()),
        (2,'Sala Fitness',NOW(),NOW())
      RETURNING id, descrizione
    `, [piscinaId]);

    const areaMap = {};
    for (const r of areeRes.rows) areaMap[r.descrizione] = r.id;
    const AREA = { A1: 1, BBB: 2, VASCA: areaMap['Vasca Olimpionica'], FITNESS: areaMap['Sala Fitness'] };
    console.log('  Aree:', AREA);

    // --- 8 corsi nuovi ---
    // Giorno: 0=LUN 1=MAR 2=MER 3=GIO 4=VEN 5=SAB 6=DOM
    // Staff: 3=Plascencia (attivo), 4=Rossi (attiva)
    // Strutture: 1=Tennis, 2=Calcio, piscinaId=Piscina
    // Abbonamenti: 3=Abbonamento (30gg), 5=Corso Bello (30gg), 8=Abbonamentone (2gg)
    const corsiRes = await c.query(`
      INSERT INTO "Corsi"
        ("societaId","attivitaId","strutturaId","areaId","staffId",
         "giorno","oraInizio","durataMinuti","maxSoci","abbonamentoId",
         "createdAt","updatedAt")
      VALUES
        ($1,$2,1,  $3,  3, 1,'09:00',60, 8,5,NOW(),NOW()),
        ($1,$2,1,  $4,  3, 3,'18:30',60, 8,5,NOW(),NOW()),
        ($1,$5,2,  $6,  4, 0,'17:00',50,10,8,NOW(),NOW()),
        ($1,$7,$8, $9,  3, 1,'07:00',45,12,3,NOW(),NOW()),
        ($1,$7,$8, $9,  3, 4,'19:00',45,12,3,NOW(),NOW()),
        ($1,$10,2, $6,  4, 2,'08:30',60,10,5,NOW(),NOW()),
        ($1,$11,2, NULL,3, 5,'10:00',90,14,3,NOW(),NOW()),
        ($1,$5,2,  $6,  4, 4,'16:00',50,10,8,NOW(),NOW())
      RETURNING id,"attivitaId","giorno","oraInizio","abbonamentoId"
    `, [
      SOCIETA_ID,        // $1
      ATT.TENNIS,        // $2
      AREA.A1,           // $3
      AREA.BBB,          // $4
      ATT.PILATES,       // $5
      AREA.FITNESS,      // $6
      ATT.NUOTO,         // $7
      piscinaId,         // $8
      AREA.VASCA,        // $9
      ATT.YOGA,          // $10
      ATT.CALCETTO,      // $11
    ]);
    console.log('  Corsi inseriti:',
      corsiRes.rows.map(r => `id=${r.id} abb=${r.abbonamentoId} g${r.giorno} ${r.oraInizio}`).join(', '));

    // --- Ottieni tutti i corsi nell'ordine corretto ---
    const allRes = await c.query(
      `SELECT id,"abbonamentoId" FROM "Corsi" WHERE "societaId"=$1 ORDER BY id`,
      [SOCIETA_ID]
    );
    const corsi = allRes.rows;
    console.log('  Tutti i corsi (id → abbId):',
      corsi.map(r => `${r.id}→${r.abbonamentoId}`).join(', '));

    // --- Piano iscrizioni: ogni corso ha un mix di stati ---
    // corsi[0..9] = id ordinati; i primi 2 sono quelli già esistenti
    const piani = [
      // corsoIdx → soci
      [0, [1,  5,  8, 11, 14, 17]],  // mix completo
      [1, [2,  6,  9, 12, 15, 18]],  // mix completo
      [2, [3,  7, 10, 13, 16, 19]],  // mix completo
      [3, [4,  5,  6,  7]],          // green + yellow
      [4, [8,  9, 10, 11]],          // yellow-abb + red-cert
      [5, [12, 13, 14, 15]],         // red-cert + red-abb
      [6, [16, 17, 18, 19]],         // red-abb + red-both
      [7, [20,  1,  2,  3]],         // red-both + green
      [8, [4,   5,  6,  7,  8]],     // green + yellow mix
      [9, [9,  10, 11, 12, 13]],     // yellow-abb + red-cert
    ];

    let iscrittiTot = 0;
    for (const [idx, soci] of piani) {
      if (idx >= corsi.length) continue;
      const corsoId = corsi[idx].id;
      for (const socioId of soci) {
        await c.query(`
          INSERT INTO "CorsoIscrizioni"
            ("corsoId","socioId","dataIscrizione","createdAt","updatedAt")
          VALUES ($1,$2,'2025-10-01',NOW(),NOW())
          ON CONFLICT ("corsoId","socioId") DO NOTHING
        `, [corsoId, socioId]);
        iscrittiTot++;
      }
    }
    console.log(`  Iscrizioni inserite: ${iscrittiTot}`);
  });
}

// ── 2. Aggiorna users_db ─────────────────────────────────────────────────────
async function populateUsers() {
  await withClient(DB.users, async (c) => {
    console.log('\n▶ users_db');

    const aggiornamenti = [
      { soci: SOCI_GREEN,       cert: CERT_GREEN  },
      { soci: SOCI_YELLOW_CERT, cert: CERT_YELLOW },
      { soci: SOCI_YELLOW_ABB,  cert: CERT_GREEN  },
      { soci: SOCI_RED_CERT,    cert: CERT_RED    },
      { soci: SOCI_RED_ABB,     cert: CERT_GREEN  },
      { soci: SOCI_RED_BOTH,    cert: CERT_RED    },
    ];

    let updated = 0;
    for (const { soci, cert } of aggiornamenti) {
      const res = await c.query(
        `UPDATE socios SET "scadenza_certificato"=$1 WHERE id = ANY($2) AND "societa_id"=$3`,
        [cert, soci, SOCIETA_ID]
      );
      updated += res.rowCount;
    }
    console.log(`  scadenza_certificato aggiornata per ${updated} soci`);
  });
}

// ── 3. Crea pagamenti in payments_db ─────────────────────────────────────────
async function populatePayments() {
  await withClient(DB.payments, async (c) => {
    console.log('\n▶ payments_db');

    // Prima elimina eventuali pagamenti demo già inseriti per i soci 1-20
    await c.query(
      `DELETE FROM payments WHERE "societa_id"=$1 AND "socio_id" = ANY($2) AND "intestatario"='DEMO'`,
      [SOCIETA_ID, [...SOCI_GREEN,...SOCI_YELLOW_CERT,...SOCI_YELLOW_ABB,...SOCI_RED_CERT,...SOCI_RED_ABB,...SOCI_RED_BOTH]]
    );

    const gruppi = [
      { soci: SOCI_GREEN,       scadenza: PAY_GREEN  },
      { soci: SOCI_YELLOW_CERT, scadenza: PAY_GREEN  },
      { soci: SOCI_YELLOW_ABB,  scadenza: PAY_YELLOW },
      { soci: SOCI_RED_CERT,    scadenza: PAY_GREEN  },
      { soci: SOCI_RED_ABB,     scadenza: PAY_RED    },
      { soci: SOCI_RED_BOTH,    scadenza: PAY_RED    },
    ];

    let inserted = 0;
    for (const { soci, scadenza } of gruppi) {
      for (const socioId of soci) {
        for (const abbId of ABBONAMENTI) {
          await c.query(`
            INSERT INTO payments
              ("societa_id","socio_id","product_id","importo",
               "data_pagamento","data_inizio_abbonamento","data_scadenza_abbonamento",
               "stato_pagamento","intestatario","quote_types","createdAt","updatedAt")
            VALUES ($1,$2,$3,80.00,'2025-10-01','2025-10-01',$4,
                    '1. VALIDO CON RICEVUTA','DEMO','subscription',NOW(),NOW())
          `, [SOCIETA_ID, socioId, abbId, scadenza]);
          inserted++;
        }
      }
    }
    console.log(`  Pagamenti inseriti: ${inserted}`);
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await populateActivities();
    await populateUsers();
    await populatePayments();
    console.log('\n✓ Popolamento completato.\n');
    console.log('Riepilogo scenari:');
    console.log('  Verde  (cert OK + abb OK) : soci', SOCI_GREEN);
    console.log('  Giallo (cert ⚠  + abb OK) : soci', SOCI_YELLOW_CERT);
    console.log('  Giallo (cert OK + abb ⚠ ) : soci', SOCI_YELLOW_ABB);
    console.log('  Rosso  (cert ✗  + abb OK) : soci', SOCI_RED_CERT);
    console.log('  Rosso  (cert OK + abb ✗ ) : soci', SOCI_RED_ABB);
    console.log('  Rosso  (cert ✗  + abb ✗ ) : soci', SOCI_RED_BOTH);
  } catch (err) {
    console.error('ERRORE:', err.message);
    process.exit(1);
  }
})();
