'use strict';

// Idempotente per lo stesso motivo spiegato in
// 20260722000000-add-modalita-array-to-conti.js: il sync di avvio del
// servizio può aver già allineato queste colonne al modello prima che questa
// migration venga eseguita.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('conti');

    if (!table.saldo_iniziale) {
      await queryInterface.addColumn('conti', 'saldo_iniziale', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      });
    }
    if (!table.saldo_iniziale_data) {
      await queryInterface.addColumn('conti', 'saldo_iniziale_data', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('conti');
    if (table.saldo_iniziale) await queryInterface.removeColumn('conti', 'saldo_iniziale');
    if (table.saldo_iniziale_data) await queryInterface.removeColumn('conti', 'saldo_iniziale_data');
  },
};
