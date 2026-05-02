'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('soci', 'frontend_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('soci', 'frontend_password_plain', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('soci', 'frontend_user_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('soci', 'frontend_enabled');
    await queryInterface.removeColumn('soci', 'frontend_password_plain');
    await queryInterface.removeColumn('soci', 'frontend_user_id');
  },
};
