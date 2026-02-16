'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('societa', 'smtp_host', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('societa', 'smtp_port', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('societa', 'smtp_user', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('societa', 'smtp_password', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('societa', 'smtp_secure', {
      type: Sequelize.BOOLEAN, // true for 465, false for other ports usually
      allowNull: true,
      defaultValue: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('societa', 'smtp_host');
    await queryInterface.removeColumn('societa', 'smtp_port');
    await queryInterface.removeColumn('societa', 'smtp_user');
    await queryInterface.removeColumn('societa', 'smtp_password');
    await queryInterface.removeColumn('societa', 'smtp_secure');
  }
};
