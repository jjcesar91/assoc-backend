'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ricevuta_tokens', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      token: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      payment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      societa_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      used_at: {
        type: Sequelize.DATE,
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
    await queryInterface.addIndex('ricevuta_tokens', ['token']);
    await queryInterface.addIndex('ricevuta_tokens', ['payment_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('ricevuta_tokens');
  },
};
