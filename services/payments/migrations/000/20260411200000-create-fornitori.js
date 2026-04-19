'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('fornitori', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      societa_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      denominazione: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      codice_fiscale: {
        type: Sequelize.STRING(16),
        allowNull: true,
      },
      partita_iva: {
        type: Sequelize.STRING(11),
        allowNull: true,
      },
      codice_sdi: {
        type: Sequelize.STRING(7),
        allowNull: true,
      },
      pec: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      telefono: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      indirizzo: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      comune: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      cap: {
        type: Sequelize.STRING(5),
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('fornitori');
  },
};
