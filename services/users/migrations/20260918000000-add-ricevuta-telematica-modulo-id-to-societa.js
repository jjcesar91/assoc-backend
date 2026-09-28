'use strict';

// Colonna di configurazione per la funzionalità "Ricevuta Telematica": memorizza
// quale Modulo (servizio documents, nessuna FK reale perché vive in un altro DB)
// è quello attivo per la compilazione pubblica del modulo da parte del socio.
// Se null, il frontend/backend ricadono sul primo modulo della società.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('societa');
    if (!table.ricevuta_telematica_modulo_id) {
      await queryInterface.addColumn('societa', 'ricevuta_telematica_modulo_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('societa', 'ricevuta_telematica_modulo_id');
  }
};
