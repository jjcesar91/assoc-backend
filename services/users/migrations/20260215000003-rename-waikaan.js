'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `UPDATE societa SET denominazione = 'WING CHUN ACADEMY DEMO' WHERE denominazione = 'WAI KAAN WING CHUN'`
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `UPDATE societa SET denominazione = 'WAI KAAN WING CHUN' WHERE denominazione = 'WING CHUN ACADEMY DEMO'`
    );
  }
};
