// This script is designed to run once to backfill default modules for existing societies.
// Run with Node.js 18+ (requires native fetch or node-fetch to be installed).
// Usage: node scripts/create_default_modules.js

const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || 'http://localhost:3003';
const DOCUMENTS_SERVICE_URL = process.env.DOCUMENTS_SERVICE_URL || 'http://localhost:3004';

async function main() {
    try {
        console.log('Starting default modules creation for existing societies...');

        // 1. Fetch all societies
        console.log(`Fetching societies from ${USERS_SERVICE_URL}/api/societa ...`);
        const response = await fetch(`${USERS_SERVICE_URL}/api/societa`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch societies: ${response.status} ${response.statusText}`);
        }

        const societies = await response.json();
        console.log(`Found ${societies.length} existing societies.`);

        // 2. Create modules for each society
        let successCount = 0;
        let failCount = 0;

        for (const societa of societies) {
            // Optional: Check if modules already exist for this society.
            // Since we're doing a blind create of the new default types, 
            // we assume they don't exist or duplicates are allowed/handled by documents service logic.
            // The documents service bulk create doesn't deduplicate by default based on description,
            // so running this multiple times will create duplicates.
            // CAUTION: Run this script only once.

            const defaultModules = [
                {
                    descrizione: 'MODULO ISCRIZIONE',
                    testo: '',
                    htmlContent: '',
                    societa_id: societa.id
                },
                {
                    descrizione: 'INFORMATIVA PRIVACY',
                    testo: '',
                    htmlContent: '',
                    societa_id: societa.id
                }
            ];

            console.log(`Creating modules for society ID ${societa.id} (${societa.denominazione})...`);
            
            try {
                const createResponse = await fetch(`${DOCUMENTS_SERVICE_URL}/api/moduli`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(defaultModules)
                });

                if (createResponse.ok) {
                    console.log(`  ✓ Modules created successfully.`);
                    successCount++;
                } else {
                    const errorText = await createResponse.text();
                    console.error(`  ✗ Failed to create modules: ${errorText}`);
                    failCount++;
                }
            } catch (err) {
                console.error(`  ✗ Error making request: ${err.message}`);
                failCount++;
            }
        }

        console.log('\n--- Summary ---');
        console.log(`Total Societies: ${societies.length}`);
        console.log(`Success: ${successCount}`);
        console.log(`Failed: ${failCount}`);

    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Check for fetch availability (Node 18+)
if (!global.fetch) {
    console.error('This script requires Node.js 18+ (native fetch support).');
    process.exit(1);
}

main();
