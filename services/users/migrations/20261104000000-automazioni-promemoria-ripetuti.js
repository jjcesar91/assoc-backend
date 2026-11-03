'use strict';

// Promemoria ripetuti ogni N giorni fino alla scadenza:
// - automazioni_config.ripeti_ogni_giorni (null = una sola email)
// - automazioni_invii.promemoria_n, aggiunto alla chiave di idempotenza.
// Idempotente: le colonne possono già esistere per via di `sequelize.sync({ alter: true })`.
module.exports = {
  async up(queryInterface, Sequelize) {
    const config = await queryInterface.describeTable('automazioni_config');
    if (!config.ripeti_ogni_giorni) {
      await queryInterface.addColumn('automazioni_config', 'ripeti_ogni_giorni', { type: Sequelize.INTEGER, allowNull: true });
    }
    const invii = await queryInterface.describeTable('automazioni_invii');
    if (!invii.promemoria_n) {
      await queryInterface.addColumn('automazioni_invii', 'promemoria_n', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 });
    }
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS automazioni_invii_occorrenza_unique`);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS automazioni_invii_occorrenza_unique
      ON automazioni_invii (societa_id, tipo, COALESCE(socio_id, -1), COALESCE(riferimento_extra, -1), scadenza_riferimento, promemoria_n)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DELETE FROM automazioni_invii WHERE promemoria_n > 1`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS automazioni_invii_occorrenza_unique`);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS automazioni_invii_occorrenza_unique
      ON automazioni_invii (societa_id, tipo, COALESCE(socio_id, -1), COALESCE(riferimento_extra, -1), scadenza_riferimento)
    `);
    await queryInterface.removeColumn('automazioni_invii', 'promemoria_n');
    await queryInterface.removeColumn('automazioni_config', 'ripeti_ogni_giorni');
  }
};
