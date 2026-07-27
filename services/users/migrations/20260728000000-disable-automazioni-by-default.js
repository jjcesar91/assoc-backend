'use strict';

const { TIPI, getDefinizione } = require('../utils/automazioniRegistry');

// Il codice considera "attiva" un'automazione senza configurazione salvata
// (comportamento voluto per le nuove società: di default sono accese se
// applicabili). Questa migration è un intervento una tantum sui dati già
// presenti in produzione: spegne esplicitamente tutte le automazioni per
// tutte le società esistenti, così nessun invio parte automaticamente finché
// non viene riattivato consapevolmente dalla pagina Automazioni.
// Idempotente: rieseguibile senza effetti collaterali (UPDATE + INSERT-se-mancante).
module.exports = {
  async up(queryInterface) {
    for (const tipo of TIPI) {
      const giorniDefault = getDefinizione(tipo).giorniAnticipoDefault;

      // Righe di configurazione già esistenti per questo tipo: spegni.
      await queryInterface.sequelize.query(
        `UPDATE automazioni_config SET attiva = false, "updatedAt" = NOW() WHERE tipo = :tipo`,
        { replacements: { tipo } }
      );

      // Società che non hanno ancora una riga per questo tipo: creala già spenta,
      // altrimenti resterebbero "attiva" di default al primo controllo.
      await queryInterface.sequelize.query(
        `INSERT INTO automazioni_config (societa_id, tipo, attiva, giorni_anticipo, "createdAt", "updatedAt")
         SELECT s.id, :tipo, false, :giorniDefault, NOW(), NOW()
         FROM societa s
         WHERE NOT EXISTS (
           SELECT 1 FROM automazioni_config ac WHERE ac.societa_id = s.id AND ac.tipo = :tipo
         )`,
        { replacements: { tipo, giorniDefault } }
      );
    }
  },

  async down() {
    // Nessun rollback automatico: riattivare le automazioni è una scelta
    // esplicita da fare società per società dalla pagina di configurazione,
    // non qualcosa da ripristinare in blocco.
  },
};
