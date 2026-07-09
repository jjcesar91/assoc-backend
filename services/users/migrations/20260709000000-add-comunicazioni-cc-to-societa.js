'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Idempotente: aggiunge le colonne CC solo se non già presenti.
    const table = await queryInterface.describeTable('societa');
    const addIfMissing = async (name, definition) => {
      if (!table[name]) {
        await queryInterface.addColumn('societa', name, definition);
      }
    };
    await addIfMissing('com_proforma_cc', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await addIfMissing('com_pagamento_cc', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('societa', 'com_proforma_cc');
    await queryInterface.removeColumn('societa', 'com_pagamento_cc');
  }
};
