'use strict';

// Idempotente: su alcuni DB la colonna può già essere stata creata da
// `sequelize.sync({ alter: true })` (vedi scripts/baseline-migrations.js).
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('conti');
    if (table.predefinito) return;
    await queryInterface.addColumn('conti', 'predefinito', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('conti');
    if (!table.predefinito) return;
    await queryInterface.removeColumn('conti', 'predefinito');
  },
};
