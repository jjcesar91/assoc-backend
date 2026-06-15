'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS socio_contatti (
        id SERIAL PRIMARY KEY,
        socio_id INTEGER NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        posizione_lavorativa VARCHAR(255),
        telefono VARCHAR(50),
        dispositivo_mobile VARCHAR(50),
        email VARCHAR(255),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('socio_contatti');
  },
};
