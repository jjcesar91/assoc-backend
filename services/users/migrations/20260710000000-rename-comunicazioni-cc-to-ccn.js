'use strict';

// Rinomina le colonne di configurazione da CC a CCn (copia conoscenza nascosta).
// Idempotente e robusta rispetto allo stato precedente del DB:
//  - se esiste già la colonna nuova (_ccn) → non fa nulla
//  - se esiste la vecchia (_cc) → la rinomina in _ccn preservando i dati
//  - se non esiste nessuna delle due → crea direttamente _ccn
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('societa');
    const renameOrAdd = async (oldName, newName) => {
      if (table[newName]) return;
      if (table[oldName]) {
        await queryInterface.renameColumn('societa', oldName, newName);
      } else {
        await queryInterface.addColumn('societa', newName, {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        });
      }
    };
    await renameOrAdd('com_proforma_cc', 'com_proforma_ccn');
    await renameOrAdd('com_pagamento_cc', 'com_pagamento_ccn');
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('societa');
    if (table['com_proforma_ccn']) {
      await queryInterface.renameColumn('societa', 'com_proforma_ccn', 'com_proforma_cc');
    }
    if (table['com_pagamento_ccn']) {
      await queryInterface.renameColumn('societa', 'com_pagamento_ccn', 'com_pagamento_cc');
    }
  }
};
