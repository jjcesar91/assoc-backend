'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('societa', 'tipo_associazione', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('societa', 'associazione_riferimento', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('societa', 'tipo_associazione');
    await queryInterface.removeColumn('societa', 'associazione_riferimento');
  }
};
