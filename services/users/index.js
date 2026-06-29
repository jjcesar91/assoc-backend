const express = require('express');
const cors = require('cors');
const db = require('./models');
const routes = require('./routes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Limite ampio per i body: le comunicazioni includono la ricevuta PDF in base64
// (allegato), che supera facilmente il default di 100kb di express.json.
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static('/app/uploads'));

// Swagger Placeholder
app.get('/swagger', (req, res) => {
    res.json({ message: "Swagger documentation will be available here" });
});

// Routes
app.use('/api', routes);

// Database connection and server start
db.sequelize.authenticate()
  .then(async () => {
    // Rimuove il vecchio indice unico globale su codice_fiscale (se esiste)
    // in modo che sync({ alter: true }) possa creare quello composito (cf + societa_id)
    try {
      await db.sequelize.query(
        `DROP INDEX IF EXISTS socios_codice_fiscale_key;`
      );
      await db.sequelize.query(
        `DROP INDEX IF EXISTS "socios_codice_fiscale_key";`
      );
    } catch (e) {
      // ignora se l'indice non esiste
    }
    return db.sequelize.sync({ alter: true });
  })
  .then(() => {
    console.log('Database connected and synced successfully.');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
