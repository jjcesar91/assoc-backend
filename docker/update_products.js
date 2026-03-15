const http = require('http');

http.get('http://localhost/products/api', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const products = JSON.parse(data);
        products.forEach(p => {
            const updateData = JSON.stringify({ societaId: 2 });
            const req = http.request({
                hostname: 'localhost',
                port: 80,
                path: `/products/api/${p.id}`,
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(updateData)
                }
            }, res2 => {
               console.log(`Updated ${p.id} status ${res2.statusCode}`);
            });
            req.write(updateData);
            req.end();
        });
    });
});
