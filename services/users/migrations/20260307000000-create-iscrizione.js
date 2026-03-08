'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('iscrizioni', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      socio_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'soci',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      anno: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      data_iscrizione: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      tipo: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('iscrizioni');
  }
};