'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('societa', [{
      denominazione: 'DEMO ASSOCIATION ASD',
      codice_fiscale: 'DUMMY123456',
      partita_iva: 'DUMMY123456',
      email: 'info@demo-assoc.test',
      cognome_rappr_legale: 'Rossi',
      nome_rappr_legale: 'Mario',
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('societa', { denominazione: 'DEMO ASSOCIATION ASD' }, {});
  }
};
