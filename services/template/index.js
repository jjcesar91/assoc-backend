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

// Database connection and server start
db.sequelize.sync()
  .then(() => {
    console.log('Database connected and synced successfully.');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
