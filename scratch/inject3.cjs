const fs = require('fs');
let idx = fs.readFileSync('api/index.js', 'utf8');

const gidenElogo = fs.readFileSync('scratch/elogo_giden.js', 'utf8');
const importSatis = fs.readFileSync('scratch/import_satis.js', 'utf8');

// Inject elogo/giden-faturalar before uyumsoft/giden-faturalar
idx = idx.replace("app.get('/api/uyumsoft/giden-faturalar', authMiddleware, async (req, res) => {", gidenElogo + "\n\napp.get('/api/uyumsoft/giden-faturalar', authMiddleware, async (req, res) => {");

// Inject import-satis before import-from-logo
idx = idx.replace("app.post('/api/invoices/import-from-logo', authMiddleware, async (req, res) => {", importSatis + "\n\napp.post('/api/invoices/import-from-logo', authMiddleware, async (req, res) => {");

fs.writeFileSync('api/index.js', idx, 'utf8');
console.log('Injected endpoints into api/index.js');
