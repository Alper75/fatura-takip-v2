const http = require('http');

const req = http.request({
  method: 'POST',
  host: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const { token } = JSON.parse(body);
    if (!token) {
      console.log('Login failed');
      return;
    }
    
    const endpoints = [
      '/api/cariler',
      '/api/cari-hareketler',
      '/api/satis-faturalari',
      '/api/alis-faturalari',
      '/api/cek-senetler',
      '/api/banka-hesaplari',
      '/api/kesilecek-faturalar',
      '/api/masraf-kurallari'
    ];

    endpoints.forEach(ep => {
      http.request({
        host: 'localhost',
        port: 5000,
        path: ep,
        headers: { 'Authorization': `Bearer ${token}` }
      }, (r) => {
        let out = '';
        r.on('data', d => out+=d);
        r.on('end', () => {
          if (r.statusCode !== 200) {
            console.log(`[FAILED] ${ep} - ${r.statusCode}`);
            console.log(out);
          } else {
             console.log(`[OK]     ${ep}`);
             if (ep === '/api/satis-faturalari') {
               // TEST POST
               const payload = JSON.stringify({id: 'test' + Date.now(), olusturmaTarihi: '2025-01-01'});
               const preq = http.request({
                 host: 'localhost', port: 5000, path: '/api/satis-faturalari', method: 'POST',
                 headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}
               }, (pr) => {
                 let pout = ''; pr.on('data', d=>pout+=d); pr.on('end', () => console.log('POST RESULT:', pr.statusCode, pout));
               });
               preq.write(payload);
               preq.end();
             }
          }
        });
      }).end();
    });
  });
});
req.write(JSON.stringify({ tc: 'admin', password: 'admin123' }));
req.end();
