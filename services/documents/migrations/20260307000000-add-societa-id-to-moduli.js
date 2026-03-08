'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('moduli', 'societa_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // Allow null initially or if global modules are needed
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('moduli', 'societa_id');
  }
};
