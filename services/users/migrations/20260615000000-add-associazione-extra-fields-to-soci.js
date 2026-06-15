'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('socios', 'anno_associativo', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'codice_affiliazione', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'scadenza_affiliazione', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'costo_affiliazione', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'costo_tessera_base', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'costo_tessera_associativa', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'costo_tessera_completa', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'durata_consiglio_direttivo', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'scadenza_consiglio_direttivo', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'etichette', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'runts', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('socios', 'somministrazione', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('socios', 'sito_web', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('socios', 'anno_associativo');
    await queryInterface.removeColumn('socios', 'codice_affiliazione');
    await queryInterface.removeColumn('socios', 'scadenza_affiliazione');
    await queryInterface.removeColumn('socios', 'costo_affiliazione');
    await queryInterface.removeColumn('socios', 'costo_tessera_base');
    await queryInterface.removeColumn('socios', 'costo_tessera_associativa');
    await queryInterface.removeColumn('socios', 'costo_tessera_completa');
    await queryInterface.removeColumn('socios', 'durata_consiglio_direttivo');
    await queryInterface.removeColumn('socios', 'scadenza_consiglio_direttivo');
    await queryInterface.removeColumn('socios', 'etichette');
    await queryInterface.removeColumn('socios', 'runts');
    await queryInterface.removeColumn('socios', 'somministrazione');
    await queryInterface.removeColumn('socios', 'sito_web');
  },
};
