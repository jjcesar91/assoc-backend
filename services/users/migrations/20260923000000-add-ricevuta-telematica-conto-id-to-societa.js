'use strict';

// Colonna di configurazione per la funzionalità "Ricevuta Telematica": memorizza
// quale Conto (servizio payments, nessuna FK reale perché vive in un altro DB)
// viene usato come conto di incasso quando un operatore conferma in blocco le
// proforme generate dalla pagina pubblica, trasformandole in ricevute pagate
// (pagina backoffice "Ricevute Telematiche > Invio Ricevute").
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('societa');
    if (!table.ricevuta_telematica_conto_id) {
      await queryInterface.addColumn('societa', 'ricevuta_telematica_conto_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('societa', 'ricevuta_telematica_conto_id');
  }
};
