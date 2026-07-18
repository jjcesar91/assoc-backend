require('dotenv').config();

// Tracciamento dei seeder: senza questo, sequelize-cli usa `seederStorage: 'none'`
// e `db:seed:all` (eseguito ad ogni avvio del servizio) rigira TUTTI i seeder ogni
// volta, reimpostando ad es. la password dell'utente demo. Con 'sequelize' i seeder
// vengono registrati nella tabella SequelizeData ed eseguiti una sola volta.
const seederTracking = {
  seederStorage: 'sequelize',
  seederStorageTableName: 'SequelizeData'
};

module.exports = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'template_db',
    host: process.env.DB_HOST || 'template_db',
    dialect: 'postgres',
    port: process.env.DB_PORT || 5432,
    ...seederTracking
  },
  test: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'template_test',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    ...seederTracking
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'postgres',
    ...seederTracking
  }
};
