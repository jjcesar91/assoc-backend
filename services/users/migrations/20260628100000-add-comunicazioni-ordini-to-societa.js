'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Idempotente: aggiunge le colonne solo se non già presenti (gestisce volumi
    // in cui una precedente esecuzione ha aggiunto le colonne senza registrarsi
    // in SequelizeMeta).
    const table = await queryInterface.describeTable('societa');
    const addIfMissing = async (name, definition) => {
      if (!table[name]) {
        await queryInterface.addColumn('societa', name, definition);
      }
    };
    await addIfMissing('com_proforma_stato', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'NON_ATTIVA'
    });
    await addIfMissing('com_proforma_oggetto', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await addIfMissing('com_proforma_testo', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await addIfMissing('com_pagamento_stato', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'NON_ATTIVA'
    });
    await addIfMissing('com_pagamento_oggetto', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await addIfMissing('com_pagamento_testo', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('societa', 'com_proforma_stato');
    await queryInterface.removeColumn('societa', 'com_proforma_oggetto');
    await queryInterface.removeColumn('societa', 'com_proforma_testo');
    await queryInterface.removeColumn('societa', 'com_pagamento_stato');
    await queryInterface.removeColumn('societa', 'com_pagamento_oggetto');
    await queryInterface.removeColumn('societa', 'com_pagamento_testo');
  }
};
