'use strict';

// Un conto può ora avere più modalità di pagamento associate (prima era un
// singolo valore in "modalita_pagamento"). Aggiungiamo una nuova colonna
// array invece di alterare in-place il tipo della colonna esistente: una
// ALTER COLUMN TYPE varchar -> varchar[] non è un cast implicito in Postgres,
// e il sync di avvio del servizio (sequelize.sync({alter:true}) in index.js /
// scripts/sync-db.js, eseguito PRIMA di questa migration a ogni boot) tenta
// già da solo di allineare le colonne mancanti al modello: se questa
// migration non fosse idempotente, girerebbe in errore "column already
// exists" ogni volta che il sync la precede.
//
// La vecchia colonna "modalita_pagamento" NON viene toccata/rimossa: resta
// come dato storico (letto dal controller come fallback quando "modalita" è
// vuoto) proprio perché rimuoverla in questa stessa migration esporrebbe la
// stessa corsa sync-vs-migrate al rischio di perdere il valore legacy prima
// che venga copiato nel nuovo campo.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('conti');

    if (!table.modalita) {
      await queryInterface.addColumn('conti', 'modalita', {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
      });
    }

    if (table.modalita_pagamento) {
      await queryInterface.sequelize.query(`
        UPDATE "conti" SET "modalita" = ARRAY["modalita_pagamento"]
        WHERE "modalita_pagamento" IS NOT NULL AND "modalita" IS NULL;
      `);
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('conti');
    if (table.modalita) {
      await queryInterface.removeColumn('conti', 'modalita');
    }
  },
};
