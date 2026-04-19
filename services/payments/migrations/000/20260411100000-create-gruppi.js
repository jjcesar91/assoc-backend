'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('gruppi', {
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
      descrizione: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      tipo: {
        type: Sequelize.ENUM('Entrata', 'Uscita', 'Entrata/Uscita'),
        allowNull: false,
        defaultValue: 'Entrata',
      },
      sezione: {
        type: Sequelize.CHAR(1),
        allowNull: true,
      },
      numero: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      codice: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      gruppo_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'gruppi', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
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

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('gruppi');
  },
};
