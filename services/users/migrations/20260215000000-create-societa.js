'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create Societa table
    await queryInterface.createTable('societa', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      denominazione: {
        type: Sequelize.STRING,
        allowNull: false
      },
      codice_fiscale: {
        type: Sequelize.STRING,
        allowNull: false
      },
      partita_iva: {
        type: Sequelize.STRING,
        allowNull: true
      },
      codice_sdi: {
        type: Sequelize.STRING,
        allowNull: true
      },
      pec: {
        type: Sequelize.STRING,
        allowNull: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true
      },
      telefono: {
        type: Sequelize.STRING,
        allowNull: true
      },
      indirizzo: {
        type: Sequelize.STRING,
        allowNull: true
      },
      comune: {
        type: Sequelize.STRING,
        allowNull: true
      },
      cap: {
        type: Sequelize.STRING,
        allowNull: true
      },
      cognome_rappr_legale: {
        type: Sequelize.STRING,
        allowNull: true
      },
      nome_rappr_legale: {
        type: Sequelize.STRING,
        allowNull: true
      },
      alias_sms: {
        type: Sequelize.STRING,
        allowNull: true
      },
      alias_email: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // 2. Add societa_id to socios
    await queryInterface.addColumn('socios', 'societa_id', {
      type: Sequelize.INTEGER,
      references: {
        model: 'societa',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      allowNull: true
    });

    // 3. Seed Societa
    const societaData = {
      denominazione: 'WAI KAAN WING CHUN',
      codice_fiscale: '03061500926',
      partita_iva: '03061500926',
      codice_sdi: 'KRRH6B9',
      pec: '', 
      email: 'donato.salfi@gmail.com',
      telefono: '3792473072',
      indirizzo: 'via occhiate',
      comune: 'Venezia',
      cap: '74122',
      cognome_rappr_legale: 'Melis',
      nome_rappr_legale: 'DONATO SALFI',
      alias_sms: '336382041',
      alias_email: 'donato.salfi@gmail.com',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await queryInterface.bulkInsert('societa', [societaData]);

    // 4. Update existing Socios to depend on this new Societa.
    // Assuming the ID of the new Societa is 1 (since we just created the table)
    await queryInterface.sequelize.query(
      `UPDATE socios SET societa_id = (SELECT id FROM societa LIMIT 1)`
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('socios', 'societa_id');
    await queryInterface.dropTable('societa');
  }
};
