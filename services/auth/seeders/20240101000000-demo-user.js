'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if user already exists to avoid unique constraint errors if the volume is preserved
    const users = await queryInterface.sequelize.query(
      `SELECT id FROM "Users" WHERE email = 'demo@example.com';`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (users.length === 0) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      return queryInterface.bulkInsert('Users', [{
        username: 'Demo User',
        email: 'demo@example.com',
        password: hashedPassword,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      }]);
    }
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('Users', { email: 'demo@example.com' }, {});
  }
};
