'use strict';

// Origine dell'ordine: 'backoffice' (creato da un operatore) | 'cliente' (creato
// dal socio dall'area soci). I record esistenti sono tutti di origine backoffice.
//
// Idempotente: su alcuni DB la colonna può già essere stata creata da
// `sequelize.sync({ alter: true })` (vedi scripts/baseline-migrations.js), oppure
// da un tentativo precedente in cui l'addColumn era già andato a buon fine ma la
// migration non era stata registrata. In quei casi saltiamo l'addColumn ed
// evitiamo l'errore "column already exists" che bloccava l'avvio del servizio.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('payments');
    if (!table.origine) {
      await queryInterface.addColumn('payments', 'origine', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'backoffice',
      });
    }
    await queryInterface.sequelize.query(
      `UPDATE payments SET origine = 'backoffice' WHERE origine IS NULL`
    );
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('payments');
    if (!table.origine) return;
    await queryInterface.removeColumn('payments', 'origine');
  },
};
