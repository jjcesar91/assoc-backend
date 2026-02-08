const db = require('./models');

async function sync() {
  try {
    console.log(`Syncing database ${process.env.DB_NAME} on ${process.env.DB_HOST}:${process.env.DB_PORT}...`);
    await db.sequelize.sync({ force: false, alter: true }); 
    console.log('Database synced successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error syncing database:', error);
    process.exit(1);
  }
}

sync();
