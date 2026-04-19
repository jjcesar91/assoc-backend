'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('societa', 'tipo_associazione', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'ASD'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('societa', 'tipo_associazione');
  }
};
