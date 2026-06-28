'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('societa', 'com_proforma_stato', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'NON_ATTIVA'
    });
    await queryInterface.addColumn('societa', 'com_proforma_oggetto', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('societa', 'com_proforma_testo', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('societa', 'com_pagamento_stato', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'NON_ATTIVA'
    });
    await queryInterface.addColumn('societa', 'com_pagamento_oggetto', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('societa', 'com_pagamento_testo', {
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
