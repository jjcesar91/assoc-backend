'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('societa', 'tipo_anno_associativo', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'solare'
    });
    
    await queryInterface.addColumn('societa', 'data_inizio_anno_associativo', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('societa', 'data_inizio_anno_associativo');
    await queryInterface.removeColumn('societa', 'tipo_anno_associativo');
  }
};
