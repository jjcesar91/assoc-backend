'use strict';

// Licenze esistenti al momento dell'introduzione dei limiti di piano: tutte
// Advanced (clienti già attivi, nessuna limitazione). Eseguita una sola volta
// per database (SequelizeMeta). Le licenze create da qui in poi nascono Free e
// in attesa di attivazione (vedi utils/licenze.js e registrazioneController).
// Sui database dove la tabella licenze è ancora vuota (prima introduzione delle
// licenze) non aggiorna nulla: le licenze delle società esistenti vengono create
// direttamente Advanced dal backfill all'avvio.
module.exports = {
  async up(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('licenze')) return;
    await queryInterface.sequelize.query(`UPDATE licenze SET piano = 'advanced', "updatedAt" = NOW()`);
  },

  async down() {
    // Non reversibile: il piano precedente di ogni licenza non è conservato.
  }
};
