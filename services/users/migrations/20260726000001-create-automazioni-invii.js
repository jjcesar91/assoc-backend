'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS automazioni_invii (
        id SERIAL PRIMARY KEY,
        societa_id INTEGER NOT NULL REFERENCES societa(id) ON DELETE CASCADE,
        tipo VARCHAR(50) NOT NULL,
        socio_id INTEGER REFERENCES socios(id) ON DELETE CASCADE,
        scadenza_riferimento DATE NOT NULL,
        destinatario VARCHAR(255),
        esito VARCHAR(20) NOT NULL,
        dettaglio_errore TEXT,
        data_invio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    // socio_id è NULL per le automazioni a livello di società: NULL non è mai
    // uguale a NULL in un vincolo UNIQUE standard, quindi usiamo un indice
    // univoco su espressione con COALESCE per garantire comunque l'idempotenza.
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS automazioni_invii_occorrenza_unique
      ON automazioni_invii (societa_id, tipo, COALESCE(socio_id, -1), scadenza_riferimento)
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('automazioni_invii');
  },
};
