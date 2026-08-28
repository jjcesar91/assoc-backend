'use strict';

// Attiva la sezione "ETS Point" nelle Automazioni, riservata ai superuser.
// Idempotente: la colonna può già esistere per via di `sequelize.sync({ alter: true })`,
// eseguito ad ogni avvio prima che questa migration venga applicata (vedi pattern
// in add-riferimento-extra-to-automazioni-invii).
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('societa');
    if (!table.gestore_ets_point) {
      await queryInterface.addColumn('societa', 'gestore_ets_point', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('societa', 'gestore_ets_point');
  }
};
