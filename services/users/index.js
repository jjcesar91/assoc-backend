const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');
const db = require('./models');
const { backfillLicenze } = require('./utils/licenze');
const routes = require('./routes');
const { runAutomazioniCheck } = require('./jobs/runAutomazioni');
const { chiudiTicketRisolti } = require('./jobs/chiudiTicketRisolti');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Legge il cookie-certificato della pagina pubblica Ricevuta Telematica (vedi
// utils/rtCertificato.js e controllers/certificatoController.js).
app.use(cookieParser());
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
// Le risposte delle API sono dinamiche: impedisce a un eventuale CDN/reverse-proxy
// davanti al servizio di cachearle (visto su dev.etspoint.it: GET stale dopo un deploy).
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});
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
  .then(async () => {
    console.log('Database connected and synced successfully.');
    // Ogni società deve avere una licenza (piano Free di default)
    try {
      await backfillLicenze(db);
    } catch (err) {
      console.error('[licenze] backfill fallito:', err);
    }
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // Controllo automazioni email: un solo run giornaliero (non polling
    // continuo) per non sovraccaricare le risorse. Orario notturno/mattutino
    // per non interferire con l'operatività.
    cron.schedule('0 6 * * *', () => {
      runAutomazioniCheck().catch(err => console.error('Errore job automazioni:', err));
    }, { timezone: 'Europe/Rome' });

    // Ticket risolti senza risposta del cliente: chiusura automatica (vedi utils/ticket.js)
    cron.schedule('30 6 * * *', () => {
      chiudiTicketRisolti().catch(err => console.error('Errore job chiusura ticket:', err));
    }, { timezone: 'Europe/Rome' });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
