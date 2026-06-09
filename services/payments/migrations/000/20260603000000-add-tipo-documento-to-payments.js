'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('payments', 'tipo_documento', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'pagamento',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('payments', 'tipo_documento');
  },
};
