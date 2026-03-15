const http = require('http');

http.get('http://localhost/products/api?societaId=2', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const products = JSON.parse(data);
        if(products.length === 0) {
            console.log("No products found for societaId 2");
            return;
        }
        products.forEach(p => {
            const updateData = JSON.stringify({ societaId: 1 });
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
               console.log(`Updated product ${p.id} to societaId 1 - status ${res2.statusCode}`);
            });
            req.write(updateData);
            req.end();
        });
    });
});
