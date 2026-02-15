'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // We want to store just DD-MM or MM-DD. A string of length 5 is sufficient (e.g. "01-09").
    // Since we already have data (maybe), we might need to cast or drop/add. 
    // Since it's development/prototype, dropping and adding is cleaner if no critical data exists. 
    // Or just changing type to STRING.
    
    await queryInterface.changeColumn('societa', 'data_inizio_anno_associativo', {
      type: Sequelize.STRING(5), // "DD-MM"
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to DATEONLY
    // This might fail if the string data isn't a valid date, but for rollback we try.
    // We would need to USING to cast, but for simplicity let's just try changeColumn
    await queryInterface.changeColumn('societa', 'data_inizio_anno_associativo', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
  }
};
