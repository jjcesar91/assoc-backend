'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Idempotente: index.js fa `sequelize.sync({ alter: true })` a ogni avvio,
    // e su ambienti dove il container è già stato riavviato con il nuovo
    // modello la colonna può essere già stata aggiunta da sync prima che
    // questa migration venga eseguita da `db:migrate`.
    const table = await queryInterface.describeTable('Products');
    if (!table.gruppoId) {
      await queryInterface.addColumn('Products', 'gruppoId', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Products');
    if (table.gruppoId) {
      await queryInterface.removeColumn('Products', 'gruppoId');
    }
  }
};
