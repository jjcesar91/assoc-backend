'use strict';

// Idempotente: su alcuni DB la tabella/indice possono già essere stati creati da
// `sequelize.sync({ alter: true })` (vedi scripts/baseline-migrations.js) o da un
// tentativo precedente non registrato. In quei casi saltiamo la creazione ed
// evitiamo l'errore "already exists" che bloccava l'avvio del servizio.
module.exports = {
  async up(queryInterface, Sequelize) {
    const [[{ exists: tableExists }]] = await queryInterface.sequelize.query(
      "SELECT to_regclass('public.payment_voci_config') IS NOT NULL AS exists"
    );

    if (!tableExists) {
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
    }

    const indexName = 'payment_voci_config_societa_quote_type_unique';
    const [[{ exists: indexExists }]] = await queryInterface.sequelize.query(
      "SELECT to_regclass(:idx) IS NOT NULL AS exists",
      { replacements: { idx: `public.${indexName}` } }
    );
    if (!indexExists) {
      await queryInterface.addIndex('payment_voci_config', ['societa_id', 'quote_type'], {
        unique: true,
        name: indexName,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('payment_voci_config');
  },
};
