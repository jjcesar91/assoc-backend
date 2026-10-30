'use strict';

// Storico delle modifiche al saldo iniziale dei conti (vedi models/ContoSaldoStorico.js).
// Sui DB già esistenti la tabella può essere stata creata da sync({ alter }): si salta.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tabelle = await queryInterface.showAllTables();
    if (tabelle.includes('conto_saldo_storico')) return;
    await queryInterface.createTable('conto_saldo_storico', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      conto_id: { type: Sequelize.INTEGER, allowNull: false },
      societa_id: { type: Sequelize.INTEGER, allowNull: false },
      saldo_precedente: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      data_precedente: { type: Sequelize.DATEONLY, allowNull: true },
      saldo_nuovo: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      data_nuova: { type: Sequelize.DATEONLY, allowNull: true },
      utente_id: { type: Sequelize.INTEGER, allowNull: true },
      utente_email: { type: Sequelize.STRING, allowNull: true },
      utente_ruolo: { type: Sequelize.STRING(20), allowNull: true },
      origine: { type: Sequelize.STRING(20), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('conto_saldo_storico', ['conto_id'], { name: 'conto_saldo_storico_conto_idx' });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('conto_saldo_storico');
  },
};
