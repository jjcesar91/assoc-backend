const express = require('express');
const cors = require('cors');
const db = require('./models');
const routes = require('./routes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger Placeholder
app.get('/swagger', (req, res) => {
    res.json({ message: "Swagger documentation will be available here" });
});

// Routes
app.use('/api', routes);

// Database connection and server start (with forced sync for new columns).
// Retry the connection so we survive the startup race when the DB container
// is not yet accepting connections (otherwise the process would stay alive
// without ever calling app.listen(), causing a permanent 502 at the gateway).
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function start({ retries = 15, delayMs = 3000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await db.sequelize.authenticate();
      // Rimuove i vecchi indici UNIQUE globali su email (Users_email_key, _key1…)
      // lasciati da precedenti sync: l'unicità email ora è composita (email, societaId),
      // così la stessa email può esistere in società diverse. Idempotente.
      await db.sequelize.query(`
        DO $$
        DECLARE obj RECORD;
        BEGIN
          -- I vecchi vincoli globali su email sono UNIQUE constraint: vanno rilasciati
          -- come constraint (questo elimina anche l'indice sottostante).
          FOR obj IN
            SELECT conname FROM pg_constraint
            WHERE conrelid = '"Users"'::regclass AND conname ~ '^Users_email_key'
          LOOP
            EXECUTE format('ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS %I', obj.conname);
          END LOOP;
          -- Eventuali indici residui (non legati a constraint).
          FOR obj IN
            SELECT indexname AS conname FROM pg_indexes
            WHERE tablename = 'Users' AND indexname ~ '^Users_email_key'
          LOOP
            EXECUTE format('DROP INDEX IF EXISTS %I', obj.conname);
          END LOOP;
        END $$;
      `);
      await db.sequelize.sync({ alter: true });
      console.log('Database connected and synced successfully.');

      // Run seeders after database sync
      const { exec } = require('child_process');
      exec('npx sequelize-cli db:seed:all', (err, stdout) => {
        if (err) { // Log error but continue
          console.error('Error running seeders:', err);
        } else {
          console.log('Seeders executed successfully:', stdout);
        }
      });

      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
      return;
    } catch (err) {
      console.error(`Database not ready (attempt ${attempt}/${retries}): ${err.message}`);
      if (attempt === retries) {
        console.error('Unable to connect to the database. Exiting so the container can restart.');
        process.exit(1);
      }
      await sleep(delayMs);
    }
  }
}

start();
