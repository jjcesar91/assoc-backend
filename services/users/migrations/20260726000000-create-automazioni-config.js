'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS automazioni_config (
        id SERIAL PRIMARY KEY,
        societa_id INTEGER NOT NULL REFERENCES societa(id) ON DELETE CASCADE,
        tipo VARCHAR(50) NOT NULL,
        attiva BOOLEAN NOT NULL DEFAULT TRUE,
        giorni_anticipo INTEGER NOT NULL DEFAULT 15,
        data_riferimento DATE,
        extra_config JSON,
        oggetto_email VARCHAR(255),
        testo_email TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (societa_id, tipo)
      )
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('automazioni_config');
  },
};
