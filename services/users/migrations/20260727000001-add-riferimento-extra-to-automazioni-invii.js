'use strict';

// Un socio può avere più abbonamenti attivi con la stessa data di scadenza:
// la sola coppia (societa_id, tipo, socio_id, scadenza_riferimento) non basta
// più a distinguere due promemoria distinti. Aggiungiamo un riferimento extra
// (es. product_id/payment id) e lo includiamo nell'indice di idempotenza.
// Idempotente: colonna e indice possono già esistere per via di
// `sequelize.sync({ alter: true })`, eseguito ad ogni avvio prima che questa
// migration venga applicata (vedi pattern in add-origine-to-payments).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('automazioni_invii');
    if (!table.riferimento_extra) {
      await queryInterface.addColumn('automazioni_invii', 'riferimento_extra', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS automazioni_invii_occorrenza_unique
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS automazioni_invii_occorrenza_unique
      ON automazioni_invii (societa_id, tipo, COALESCE(socio_id, -1), COALESCE(riferimento_extra, -1), scadenza_riferimento)
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS automazioni_invii_occorrenza_unique
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS automazioni_invii_occorrenza_unique
      ON automazioni_invii (societa_id, tipo, COALESCE(socio_id, -1), scadenza_riferimento)
    `);
    await queryInterface.removeColumn('automazioni_invii', 'riferimento_extra');
  },
};
