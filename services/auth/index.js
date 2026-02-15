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

// Database connection and server start (with forced sync for new columns)
db.sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database connected and synced successfully.');

    // Run seeders after database sync
    const { exec } = require('child_process');
    exec('npx sequelize-cli db:seed:all', (err, stdout, stderr) => {
      if (err) { // Log error but continue
        console.error('Error running seeders:', err);
      } else {
        console.log('Seeders executed successfully:', stdout);
      }
    });

    // Force run specific migration/seed as a check
    // ...

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
