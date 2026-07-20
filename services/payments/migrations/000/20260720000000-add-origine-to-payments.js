'use strict';

// Origine dell'ordine: 'backoffice' (creato da un operatore) | 'cliente' (creato
// dal socio dall'area soci). I record esistenti sono tutti di origine backoffice.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('payments', 'origine', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'backoffice',
    });
    await queryInterface.sequelize.query(
      `UPDATE payments SET origine = 'backoffice' WHERE origine IS NULL`
    );
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('payments', 'origine');
  },
};
