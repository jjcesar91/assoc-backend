'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payment_voci_config', {
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
      quote_type: {
        type: Sequelize.STRING,
        allowNull: false,
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

    await queryInterface.addIndex('payment_voci_config', ['societa_id', 'quote_type'], {
      unique: true,
      name: 'payment_voci_config_societa_quote_type_unique',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('payment_voci_config');
  },
};
