'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE socios ADD COLUMN IF NOT EXISTS indirizzo_2 VARCHAR(255) DEFAULT NULL`
    );
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('socios', 'indirizzo_2');
  },
};
