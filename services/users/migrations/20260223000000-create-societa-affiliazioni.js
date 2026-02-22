'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create SocietaAffiliazioni table
    await queryInterface.createTable('SocietaAffiliazioni', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      societa_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'societa',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      tipo: {
        type: Sequelize.STRING,
        allowNull: false
      },
      nome: {
        type: Sequelize.STRING,
        allowNull: false
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

    // Remove old columns from Societa
    await queryInterface.removeColumn('societa', 'tipo_associazione');
    await queryInterface.removeColumn('societa', 'associazione_riferimento');
  },

  down: async (queryInterface, Sequelize) => {
    // Drop SocietaAffiliazioni table
    await queryInterface.dropTable('SocietaAffiliazioni');

    // Add back old columns
    await queryInterface.addColumn('societa', 'tipo_associazione', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('societa', 'associazione_riferimento', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};
