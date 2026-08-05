'use strict';

// Bootstrap una-tantum dello schema da modelli (stesso pattern usato dal
// servizio users, vedi services/users/sync-db.js). Su un DB nuovo crea le
// tabelle che storicamente venivano generate da `sequelize.sync({ alter: true })`
// in index.js (es. `payments`, mai create da una migration dedicata). Su un DB
// già esistente è un no-op idempotente (alter: true allinea eventuali colonne
// mancanti). Va eseguito prima di scripts/baseline-migrations.js.
const db = require('../models');

async function sync() {
  try {
    console.log(`Syncing database ${process.env.DB_NAME} on ${process.env.DB_HOST}:${process.env.DB_PORT}...`);
    await db.sequelize.sync({ force: false, alter: true });
    console.log('Database synced successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error syncing database:', error);
    process.exit(1);
  }
}

sync();
