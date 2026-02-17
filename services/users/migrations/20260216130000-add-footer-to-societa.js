'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('societa', 'email_text', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    // Adding footer data for templates
    await queryInterface.addColumn('societa', 'footer_text', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('societa', 'email_text');
    await queryInterface.removeColumn('societa', 'footer_text');
  }
};
