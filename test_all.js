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
          }
        });
      }).end();
    });
  });
});
req.write(JSON.stringify({ tc: 'admin', password: 'admin' })); // We saw the db.js insert admin123. Ah! wait, let me check the password.
req.end();
