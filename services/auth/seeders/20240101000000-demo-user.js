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
        username: 'demo',
        email: 'demo@example.com',
        password: hashedPassword,
        role: 'admin',
        nome: 'DONATO',
        cognome: 'SALFI',
        telefono: '336382041',
        createdAt: new Date(),
        updatedAt: new Date()
      }]);
    } else {
       console.log('Seeder: Updating existing Demo User to admin and setting profile info...');
       // If user exists, we might want to update it to ensure it has the new fields
       return queryInterface.sequelize.query(
        `UPDATE "Users" SET 
          role = 'admin', 
          username = 'demo',
          nome = 'DONATO', 
          cognome = 'SALFI', 
          telefono = '336382041' 
        WHERE email = 'demo@example.com';`
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('Users', { email: 'demo@example.com' }, {});
  }
};
