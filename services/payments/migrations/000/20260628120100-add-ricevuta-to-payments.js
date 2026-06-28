'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('payments', 'ricevuta_file_path', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('payments', 'ricevuta_file_nome', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('payments', 'ricevuta_uploaded_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('payments', 'ricevuta_file_path');
    await queryInterface.removeColumn('payments', 'ricevuta_file_nome');
    await queryInterface.removeColumn('payments', 'ricevuta_uploaded_at');
  },
};
