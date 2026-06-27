/**
 * seed_superuser.js
 * 
 * Script per generare il superuser iniziale di default.
 * L'uso del modello Sequelize attiva automaticamente gli hook (es. hashing della password).
 * 
 * Esecuzione: 
 * cd /Users/juliocesarplascenciabierd/web-associazioni/assoc-backend/services/auth
 * node seed_superuser.js
 */

const { User } = require('./models');

async function seedSuperuser() {
    try {
        console.log('Verifica esistenza superuser...');
        const existing = await User.findOne({ where: { role: 'superuser' } });
        
        if (existing) {
            console.log(`Un superuser esiste già nel sistema: ${existing.email}`);
            process.exit(0);
        }

        console.log('Creazione superuser in corso...');
        const admin = await User.create({
            username: 'admin',
            email: 'admin@admin.com',
            password: 'AdminPassword123!', // Assicurati che rispetti la tua policy (maiuscole, numeri, speciali)
            nome: 'Super',
            cognome: 'User',
            role: 'superuser',
            attivo: true,
            societaId: null, // I superuser sono slegati da una specifica associazione
        });

        console.log('✅ Superuser creato con successo! (admin@admin.com / AdminPassword123!)');
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore durante la creazione del superuser:', error.message || error);
        process.exit(1);
    }
}

seedSuperuser();