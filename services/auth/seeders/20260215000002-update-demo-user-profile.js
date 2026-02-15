'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Check if user exists
    const users = await queryInterface.sequelize.query(
      `SELECT id FROM "Users" WHERE email = 'demo@example.com';`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (users.length > 0) {
        // Update existing user
        return queryInterface.sequelize.query(
          `UPDATE "Users" 
           SET 
             username = 'demo',
             role = 'admin', 
             nome = 'DONATO', 
             cognome = 'SALFI', 
             telefono = '336382041',
             password = '${hashedPassword}'
           WHERE email = 'demo@example.com';`
        );
    } else {
        // Create new user if not exists
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
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Revert changes if needed (optional for update seeders usually)
    return queryInterface.sequelize.query(
        `UPDATE "Users" 
         SET 
           role = 'user',
           nome = NULL, 
           cognome = NULL, 
           telefono = NULL 
         WHERE email = 'demo@example.com';`
      );
  }
};
