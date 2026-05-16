'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Aggiungi tipo_socio per distinguere persona fisica da associazione
    await queryInterface.addColumn('socios', 'tipo_socio', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'persona_fisica',
    });

    // Campi specifici per associazioni
    await queryInterface.addColumn('socios', 'ragione_sociale', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'partita_iva', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'codice_sdi', {
      type: Sequelize.STRING(10),
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'pec', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'tipo_associazione', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'cognome_rappresentante', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('socios', 'nome_rappresentante', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    // Rendi nullable i campi persona-fisica-specifici per supportare il tipo associazione
    await queryInterface.changeColumn('socios', 'cognome', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn('socios', 'nome', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn('socios', 'sesso', {
      type: Sequelize.STRING(10),
      allowNull: true,
    });
    await queryInterface.changeColumn('socios', 'data_nascita', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.changeColumn('socios', 'luogo_nascita', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn('socios', 'email', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn('socios', 'telefono', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn('socios', 'codice_fiscale', {
      type: Sequelize.STRING(16),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('socios', 'tipo_socio');
    await queryInterface.removeColumn('socios', 'ragione_sociale');
    await queryInterface.removeColumn('socios', 'partita_iva');
    await queryInterface.removeColumn('socios', 'codice_sdi');
    await queryInterface.removeColumn('socios', 'pec');
    await queryInterface.removeColumn('socios', 'tipo_associazione');
    await queryInterface.removeColumn('socios', 'cognome_rappresentante');
    await queryInterface.removeColumn('socios', 'nome_rappresentante');

    // Ripristina i vincoli originali (best-effort, potrebbe fallire se ci sono null)
    await queryInterface.changeColumn('socios', 'cognome', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn('socios', 'nome', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn('socios', 'sesso', {
      type: Sequelize.STRING(10),
      allowNull: false,
    });
    await queryInterface.changeColumn('socios', 'data_nascita', {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });
    await queryInterface.changeColumn('socios', 'luogo_nascita', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn('socios', 'email', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn('socios', 'telefono', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn('socios', 'codice_fiscale', {
      type: Sequelize.STRING(16),
      allowNull: false,
    });
  },
};
