'use strict';

const sociData = [
  { nome: 'FRA', cognome: 'FRA', data_nascita: '2000-04-03', sesso: 'F', livello: 'ND', telefono: '01122232323', scadenza_certificato: '2025-04-10' },
  { nome: 'STE', cognome: 'LAG', data_nascita: '1999-01-15', sesso: 'M', livello: 'Socio', telefono: '3493253802', scadenza_certificato: '2025-04-25' },
  { nome: 'AAA', cognome: 'AAA', data_nascita: '1989-05-15', sesso: 'M', livello: 'ND', telefono: '321789456', scadenza_certificato: '2024-06-26' },
  { nome: 'MARIO', cognome: 'BIANCHI', data_nascita: '2020-01-02', sesso: 'M', livello: 'ND', telefono: '', scadenza_certificato: '2025-01-03' },
  { nome: '3 PROVA', cognome: '1 PROVA', data_nascita: '2000-02-01', sesso: 'M', livello: 'ND', telefono: '', scadenza_certificato: '2025-01-03' },
  { nome: 'PAOLO', cognome: 'CATE', data_nascita: '2025-01-03', sesso: 'M', livello: 'ND', telefono: '', scadenza_certificato: '2025-01-03' },
  { nome: 'ROBERTO', cognome: 'ROB', data_nascita: '2020-01-30', sesso: 'M', livello: 'ND', telefono: '', scadenza_certificato: '2025-01-03' },
  { nome: 'PAOLO', cognome: 'CATE', data_nascita: '2019-12-30', sesso: 'M', livello: 'ND', telefono: '', scadenza_certificato: '2025-01-03' },
  { nome: 'AAA', cognome: 'AAA', data_nascita: '2001-07-01', sesso: 'F', livello: 'ND', telefono: '123', scadenza_certificato: '2025-08-15' },
  { nome: 'AAA', cognome: 'AAA', data_nascita: '2024-05-15', sesso: 'M', livello: 'ND', telefono: '64547', scadenza_certificato: '2024-05-06' },
  { nome: 'BBB', cognome: 'AAA', data_nascita: '2015-10-10', sesso: 'F', livello: 'ND', telefono: '0000000000', scadenza_certificato: '2022-04-01' },
  { nome: 'BBB', cognome: 'AAA', data_nascita: '2022-05-04', sesso: 'M', livello: 'ND', telefono: '33333', scadenza_certificato: '2024-09-05' },
  { nome: 'EEE', cognome: 'AAA', data_nascita: '1974-04-10', sesso: 'F', livello: 'ND', telefono: '123', scadenza_certificato: '2024-01-11' },
  { nome: 'BBBBBB', cognome: 'AAAAAA', data_nascita: '2010-01-08', sesso: 'M', livello: 'ND', telefono: '347.1111111', scadenza_certificato: '2023-01-01' },
  { nome: 'BBBBBBBBB', cognome: 'AAAAAAAA', data_nascita: '1990-04-27', sesso: 'F', livello: 'ND', telefono: '52561135111', scadenza_certificato: '2023-05-07' },
  { nome: 'BA', cognome: 'AB', data_nascita: '2002-10-05', sesso: 'M', livello: 'Socio', telefono: '', scadenza_certificato: '2023-10-05' },
  { nome: 'XY', cognome: 'ABC', data_nascita: '2000-03-03', sesso: 'M', livello: 'ND', telefono: '0432975051', scadenza_certificato: '2023-04-30' },
  { nome: 'ABINI', cognome: 'ABINI', data_nascita: '1991-01-01', sesso: 'F', livello: 'ND', telefono: '', scadenza_certificato: '2023-09-06' },
  { nome: 'EVA', cognome: 'ADAMO', data_nascita: '2025-10-23', sesso: 'F', livello: 'ND', telefono: '000000000', scadenza_certificato: '2025-10-10' },
  { nome: 'GIULIA 10', cognome: 'ADRIANI', data_nascita: '1994-10-27', sesso: 'F', livello: 'ND', telefono: '3311094638', scadenza_certificato: '2023-07-21' },
  { nome: 'ADRI', cognome: 'ADRIANO', data_nascita: '1976-03-31', sesso: 'M', livello: 'ND', telefono: '+393398380744', scadenza_certificato: '2022-05-26' },
  { nome: 'BARTOLI', cognome: 'ALBA', data_nascita: '2017-07-12', sesso: 'F', livello: 'ND', telefono: '', scadenza_certificato: '2023-09-14' },
  { nome: 'GIULIA', cognome: 'ANDREASSICH', data_nascita: '2019-07-27', sesso: 'F', livello: 'ND', telefono: '3463236685', scadenza_certificato: '2024-09-06' },
  { nome: 'LESNI', cognome: 'ANTO', data_nascita: '1969-09-03', sesso: 'M', livello: 'ND', telefono: '3333225112', scadenza_certificato: '2022-07-06' },
  { nome: 'LOCASCIO', cognome: 'ANTONIO', data_nascita: '2015-06-30', sesso: 'M', livello: 'ND', telefono: '333333333', scadenza_certificato: '2023-09-08' },
  { nome: 'PAOLO', cognome: 'ANUVOLOSO', data_nascita: '2012-12-12', sesso: 'M', livello: 'ND', telefono: '+355697575113', scadenza_certificato: '2022-09-30' },
  { nome: 'ENRICO', cognome: 'ANZIA', data_nascita: '1998-03-16', sesso: 'M', livello: 'ND', telefono: '0123456789', scadenza_certificato: '2021-12-23' },
  { nome: 'CAROL MARIA', cognome: 'ARCIERI', data_nascita: '2013-11-06', sesso: 'F', livello: 'ND', telefono: '', scadenza_certificato: '2023-11-06' },
  { nome: 'ASDRUBALE', cognome: 'ASQUASCIATI', data_nascita: '2007-01-18', sesso: 'M', livello: 'ND', telefono: '333 3332211', scadenza_certificato: '2023-08-18' },
  { nome: 'GINEVRA', cognome: 'ASSANDRI', data_nascita: '1998-06-16', sesso: 'F', livello: 'ND', telefono: '34509986642', scadenza_certificato: '2023-09-02' },
  { nome: 'MANICA', cognome: 'ASSO', data_nascita: '2014-03-27', sesso: 'M', livello: 'ND', telefono: '', scadenza_certificato: '2024-02-16' },
  { nome: 'TONINO', cognome: 'AVITO', data_nascita: '2009-10-10', sesso: 'M', livello: 'ND', telefono: '+355697575111', scadenza_certificato: '2022-08-13' },
  { nome: 'AWSEFRE', cognome: 'A\\SDES', data_nascita: '2022-08-31', sesso: 'F', livello: 'ND', telefono: '3887439717', scadenza_certificato: '2022-09-22' },
  { nome: 'DAVID', cognome: 'B.', data_nascita: '1969-03-17', sesso: 'M', livello: 'ND', telefono: '331112233', scadenza_certificato: '2021-10-14' },
  { nome: 'CATERINA', cognome: 'BAGI', data_nascita: '2011-01-04', sesso: 'F', livello: 'ND', telefono: '3417739229', scadenza_certificato: '2021-09-03' },
  { nome: 'DEBORAH', cognome: 'BARBAGALLO', data_nascita: '1993-11-20', sesso: 'F', livello: 'ND', telefono: '3803887080', scadenza_certificato: '2022-08-26' },
  { nome: 'ENRICO MARIA', cognome: 'BARBANERA', data_nascita: '1967-02-22', sesso: 'M', livello: 'ND', telefono: '3332654587', scadenza_certificato: '2022-10-31' },
  { nome: 'ROSSELLA', cognome: 'BAROZZI', data_nascita: '1992-12-07', sesso: 'F', livello: 'ND', telefono: '3387083650', scadenza_certificato: '2024-11-11' },
  { nome: 'BBB', cognome: 'BBB', data_nascita: '2001-03-23', sesso: 'M', livello: 'ND', telefono: '12345678', scadenza_certificato: '2022-08-16' },
  { nome: 'AAAAAA', cognome: 'BBBBBB', data_nascita: '1993-04-03', sesso: 'F', livello: 'ND', telefono: '', scadenza_certificato: '2025-04-02' },
  { nome: 'EA', cognome: 'BC', data_nascita: '2016-02-01', sesso: 'M', livello: 'ND', telefono: '012345678', scadenza_certificato: '2021-04-07' },
  { nome: 'DIAVOLO', cognome: 'BELZEBù', data_nascita: '1966-06-06', sesso: 'M', livello: 'ND', telefono: '010/666666', scadenza_certificato: '2024-02-27' },
  { nome: 'FEDERICA', cognome: 'BENSI', data_nascita: '1971-10-08', sesso: 'F', livello: 'ND', telefono: '3396205888', scadenza_certificato: '2024-08-27' },
  { nome: 'SILVIO', cognome: 'BERLUSCONI', data_nascita: '2021-11-14', sesso: 'M', livello: 'ND', telefono: '333345678', scadenza_certificato: '2023-10-27' },
  { nome: 'LINDA', cognome: 'BERTOZZI', data_nascita: '1980-11-16', sesso: 'F', livello: 'ND', telefono: '', scadenza_certificato: '2025-02-02' },
  { nome: 'ANDREA', cognome: 'BIANCHI', data_nascita: '2011-01-01', sesso: 'M', livello: 'ND', telefono: '055123456', scadenza_certificato: '2021-06-30' },
  { nome: 'ERMENEGILDO', cognome: 'BIANCHI', data_nascita: '2000-01-01', sesso: 'M', livello: 'Socio', telefono: '3331234567', scadenza_certificato: '2025-05-16' },
  { nome: 'LUCA', cognome: 'BIANCHI', data_nascita: '1968-02-07', sesso: 'M', livello: 'ND', telefono: '32555588552', scadenza_certificato: '2022-08-10' },
  { nome: 'LUCIANO', cognome: 'BIANCHI', data_nascita: '2010-02-10', sesso: 'M', livello: 'ND', telefono: '', scadenza_certificato: '2022-03-13' },
  { nome: 'LANCI', cognome: 'BIASCI', data_nascita: '1939-12-11', sesso: 'M', livello: 'ND', telefono: '2342343432423', scadenza_certificato: '2022-09-25' },
];

function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function generateFakeCF(nome, cognome, data_nascita, sesso) {
    // Basic approximation just to be unique(-ish) and 16 chars
    // 3 chars surname + 3 chars name + 2 year + 1 month char + 2 day + 4 random check
    const cn = (cognome.replace(/[^A-Z]/g, '') + 'XXX').substring(0, 3);
    const nm = (nome.replace(/[^A-Z]/g, '') + 'XXX').substring(0, 3);
    const year = data_nascita.substring(2, 4);
    const month = 'ABCDEHLMPRST'.charAt(parseInt(data_nascita.substring(5, 7)) - 1);
    const day = sesso === 'F' ? parseInt(data_nascita.substring(8, 10)) + 40 : data_nascita.substring(8, 10);
    
    let base = `${cn}${nm}${year}${month}${day}`;
    // fill rest with random to ensure uniqueness and length 16
    while (base.length < 15) {
        base += generateRandomString(1);
    }
    return base + generateRandomString(1);
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create Users
    const usersData = sociData.map((socio, index) => {
      // Create a unique email
      const cleanNome = socio.nome.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanCognome = socio.cognome.toLowerCase().replace(/[^a-z0-9]/g, '');
      const email = `${cleanNome}.${cleanCognome}.${index + 1}@example.com`;
      
      return {
        email: email,
        role: 'SOCIO',
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        auth_ref_id: null // Assuming handled elsewhere or not strictly required for this seeder to work
      };
    });

    // Use bulkInsert for users
    // Note: returning: true option checks might differ by dialect
    // Postgres supports returning: true.
    const insertedUsers = await queryInterface.bulkInsert('users', usersData, { returning: ['id', 'email'] });
    
    // If dialect doesn't support returning, we might need to fetch them
    let userIdMap = {};
    if (insertedUsers && insertedUsers.length > 0 && insertedUsers[0].id) {
       insertedUsers.forEach(u => userIdMap[u.email] = u.id);
    } else {
       // Fallback fetch
       const allUsers = await queryInterface.sequelize.query(
         `SELECT id, email FROM users WHERE email LIKE '%@example.com'`,
         { type: queryInterface.sequelize.QueryTypes.SELECT }
       );
       allUsers.forEach(u => userIdMap[u.email] = u.id);
    }

    // 2. Create Socios
    const sociosPayload = sociData.map((socio, index) => {
      const cleanNome = socio.nome.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanCognome = socio.cognome.toLowerCase().replace(/[^a-z0-9]/g, '');
      const email = `${cleanNome}.${cleanCognome}.${index + 1}@example.com`;
      const userId = userIdMap[email];

      if (!userId) {
          console.error(`User for ${email} not found!`);
          return null; // Should not happen
      }

      // Generate CF
      let cf = generateFakeCF(socio.nome, socio.cognome, socio.data_nascita, socio.sesso);
      
      // Ensure CF unique in this batch (simple check, append index if needed)
      // Though logic should handle it naturally 
      
      return {
        user_id: userId,
        cognome: socio.cognome,
        nome: socio.nome,
        sesso: socio.sesso,
        data_nascita: socio.data_nascita,
        luogo_nascita: 'Roma', // Default place
        codice_fiscale: cf,
        email: email,
        telefono: socio.telefono || 'ND',
        indirizzo: 'Via Roma 1',
        comune: 'Roma',
        cap: '00100',
        scadenza_certificato: socio.scadenza_certificato,
        livello: socio.livello,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }).filter(s => s !== null);

    await queryInterface.bulkInsert('socios', sociosPayload, {});
  },

  down: async (queryInterface, Sequelize) => {
    // Delete socios created by this seeder (by checking email pattern)
    // We can join with users to be safer, but cleaning up by email domain is easier if safe
    
    // Find users to delete
    const usersToDelete = await queryInterface.sequelize.query(
        `SELECT id FROM users WHERE email LIKE '%@example.com'`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    if (usersToDelete.length > 0) {
        const ids = usersToDelete.map(u => u.id);
        await queryInterface.bulkDelete('socios', { user_id: ids }, {});
        await queryInterface.bulkDelete('users', { id: ids }, {});
    }
  }
};
