'use strict';

// Idempotente: la colonna può già essere stata creata da
// `sequelize.sync({ alter: true })` (eseguito ad ogni avvio del servizio)
// prima che questa migration venga applicata. In tal caso saltiamo l'addColumn
// per evitare l'errore "column already exists" che bloccherebbe l'avvio.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('socios');
    if (!table.scadenza_doc_presidente) {
      await queryInterface.addColumn('socios', 'scadenza_doc_presidente', {
        type: Sequelize.DATEONLY,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('socios');
    if (!table.scadenza_doc_presidente) return;
    await queryInterface.removeColumn('socios', 'scadenza_doc_presidente');
  }
};
