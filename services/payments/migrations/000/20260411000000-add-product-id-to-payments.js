'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('payments', 'product_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      // Note: product_id è un riferimento soft a Products (microservizio separato, DB diverso)
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('payments', 'product_id');
  }
};
