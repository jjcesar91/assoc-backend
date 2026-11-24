'use strict';

// Storico delle modifiche a modalità di pagamento / conto delle ricevute (vedi models/PaymentModifica.js).
// Sui DB già esistenti la tabella può essere stata creata da sync({ alter }): si salta.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tabelle = await queryInterface.showAllTables();
    if (tabelle.includes('payment_modifiche')) return;
    await queryInterface.createTable('payment_modifiche', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      payment_id: { type: Sequelize.INTEGER, allowNull: false },
      societa_id: { type: Sequelize.INTEGER, allowNull: false },
      modalita_precedente: { type: Sequelize.STRING, allowNull: true },
      modalita_nuova: { type: Sequelize.STRING, allowNull: true },
      conto_precedente: { type: Sequelize.STRING, allowNull: true },
      conto_nuovo: { type: Sequelize.STRING, allowNull: true },
      utente_id: { type: Sequelize.INTEGER, allowNull: true },
      utente_email: { type: Sequelize.STRING, allowNull: true },
      utente_ruolo: { type: Sequelize.STRING(20), allowNull: true },
      origine: { type: Sequelize.STRING(30), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('payment_modifiche', ['payment_id'], { name: 'payment_modifiche_payment_idx' });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('payment_modifiche');
  },
};
