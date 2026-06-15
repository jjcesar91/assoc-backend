'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE societa ADD COLUMN IF NOT EXISTS receipt_footer_text TEXT DEFAULT NULL`
    );
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('societa', 'receipt_footer_text');
  },
};
