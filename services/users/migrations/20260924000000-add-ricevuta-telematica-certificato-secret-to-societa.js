'use strict';

// Secret del "certificato" client-side per la pagina pubblica Ricevuta Telematica:
// installato come cookie sul browser del cliente (vedi controllers/certificatoController.js),
// impedisce l'apertura/l'invio del form da un browser su cui non è stato installato,
// mitigando l'inserimento di dati falsi da parte di terzi che conoscono solo il link.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('societa');
    if (!table.ricevuta_telematica_certificato_secret) {
      await queryInterface.addColumn('societa', 'ricevuta_telematica_certificato_secret', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('societa', 'ricevuta_telematica_certificato_secret');
  }
};
