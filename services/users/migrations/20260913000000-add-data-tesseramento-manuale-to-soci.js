'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE socios ADD COLUMN IF NOT EXISTS data_tesseramento_manuale DATE DEFAULT NULL`
    );
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('socios', 'data_tesseramento_manuale');
  },
};
