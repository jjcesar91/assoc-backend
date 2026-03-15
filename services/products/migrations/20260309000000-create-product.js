'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Products', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      type: {
        type: Sequelize.ENUM('generic', 'periodic_quota', 'subscription', 'inscription', 'schedule'),
        allowNull: false
      },
      description: {
        type: Sequelize.STRING,
        allowNull: false
      },
      basePrice: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },
      visible: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      sellableOnline: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      visibleInFast: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      hasRevenueCenter: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      // Specific fields
      periodicity: {
        type: Sequelize.STRING
      },
      duration: {
        type: Sequelize.STRING
      },
      unlimitedEntries: {
        type: Sequelize.BOOLEAN
      },
      numEntries: {
        type: Sequelize.INTEGER
      },
      season: {
        type: Sequelize.STRING
      },
      numInstallments: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Products');
  }
};
