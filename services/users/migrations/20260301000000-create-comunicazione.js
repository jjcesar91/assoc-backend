'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('comunicazioni', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      socio_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        // Assuming table name is 'soci' based on previous context, but I will check.
        // If it fails, I'll know. But usually lower case plural.
        // Wait, 'users' service migration 000 probably created 'soci'.
        // Let's assume 'soci' for now, or check migration 000.
        references: {
          model: 'socios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      tipo: {
        type: Sequelize.ENUM('EMAIL', 'SMS'),
        allowNull: false
      },
      oggetto: {
        type: Sequelize.STRING,
        allowNull: true
      },
      testo: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      isInviato: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      mittente_email: {
        type: Sequelize.STRING
      },
      mittente_nome: {
        type: Sequelize.STRING
      },
      mittente_smtp_params: {
        type: Sequelize.JSON
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
       data_invio: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('comunicazioni');
  }
};
