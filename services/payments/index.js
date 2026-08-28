const express = require('express');
const cors = require('cors');
const db = require('./models');
const routes = require('./routes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
db.sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database connected and synced successfully.');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
