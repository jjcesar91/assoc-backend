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
app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: process.env.SERVICE_NAME || 'documents-service' });
});

app.use('/api', routes);

// Database connection and server start
const startServer = async () => {
  let retries = 5;
  while (retries) {
    try {
      await db.sequelize.sync({ alter: true });
      console.log('Database connected and synced successfully.');
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
      break;
    } catch (err) {
      console.error('Unable to connect to the database:', err);
      retries -= 1;
      console.log(`Retries left: ${retries}`);
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

startServer();
