const http = require('http');

const products = [
    { type: 'generic', description: 'Generic Product', basePrice: 10.00 },
    { type: 'periodic_quota', description: 'Monthly Quota', basePrice: 20.00, periodicity: 'monthly' },
    { type: 'subscription', description: 'Yearly Subscription', basePrice: 100.00, duration: '1_year', unlimitedEntries: true },
    { type: 'inscription', description: 'Winter Inscription', basePrice: 50.00, season: 'Winter 2024' },
    { type: 'schedule', description: 'Summer Camp Schedule', basePrice: 200.00, season: 'Summer 2024', numInstallments: 3 }
];

async function run() {
    for (const prod of products) {
        await new Promise((resolve, reject) => {
            const data = JSON.stringify(prod);
            const req = http.request({
                hostname: 'localhost',
                port: 3005,
                path: '/api/',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            }, res => {
                let body = '';
                res.on('data', chunk => body+=chunk);
                res.on('end', () => {
                    console.log(`Created ${prod.type}:`, body);
                    resolve();
                });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }
}
run();
