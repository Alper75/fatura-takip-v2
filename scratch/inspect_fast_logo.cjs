const fs = require('fs');
const path = require('path');

const indexPath = path.resolve(__dirname, '../api/index.js');
let indexJs = fs.readFileSync(indexPath, 'utf8');

// Let's inspect the fetchInvoiceDetails and Promise.all in /api/elogo/gelen-faturalar and /api/elogo/giden-faturalar
console.log('Inspecting /api/elogo/gelen-faturalar in index.js...');
