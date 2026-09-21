'use strict';

// Colonna di configurazione per la funzionalità "Ricevuta Telematica": memorizza
// quale Prodotto (servizio products, nessuna FK reale perché vive in un altro DB)
// viene usato per generare automaticamente una proforma quando il socio conferma
// i propri dati dalla pagina pubblica. Se null, nessuna proforma viene generata
// (a differenza del Modulo, per il Prodotto non c'è un default automatico: la
// creazione di una proforma è un'azione con effetti gestionali, va configurata
// esplicitamente).
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('societa');
    if (!table.ricevuta_telematica_prodotto_id) {
      await queryInterface.addColumn('societa', 'ricevuta_telematica_prodotto_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('societa', 'ricevuta_telematica_prodotto_id');
  }
};
