const express = require('express');
const cors = require('cors');
const db = require('./models');
const routes = require('./routes');
const backfillCorsoOrari = require('./scripts/backfillCorsoOrari');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/swagger', (req, res) => {
    res.json({ message: "Swagger documentation will be available here" });
});

app.use('/api', routes);

db.sequelize.sync({ alter: true })
  .then(async () => {
    console.log('Database connected and synced successfully.');
    try {
      const migrated = await backfillCorsoOrari(db);
      if (migrated > 0) console.log(`Backfill CorsoOrari: migrati ${migrated} corsi preesistenti.`);
    } catch (err) {
      // Non bloccare l'avvio del servizio se il backfill fallisce
      console.error('Backfill CorsoOrari fallito:', err.message);
    }
    app.listen(PORT, () => {
      console.log(`Activities service running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
