'use strict';

// Cadenza configurabile del controllo scadenze (Configurazione → Automazioni).
// Idempotente: le colonne possono già esistere per via di `sequelize.sync({ alter: true })`.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('societa');
    if (!table.automazioni_pianificazione) {
      await queryInterface.addColumn('societa', 'automazioni_pianificazione', { type: Sequelize.JSON, allowNull: true });
    }
    if (!table.automazioni_ultimo_controllo) {
      await queryInterface.addColumn('societa', 'automazioni_ultimo_controllo', { type: Sequelize.DATE, allowNull: true });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('societa', 'automazioni_ultimo_controllo');
    await queryInterface.removeColumn('societa', 'automazioni_pianificazione');
  }
};
