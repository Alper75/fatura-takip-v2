const fs = require('fs');
let code = fs.readFileSync('api/index.js', 'utf8');

const startStr = `app.get('/api/elogo/gelen-faturalar'`;
const nextStr = `app.post('/api/invoices/import-from-logo'`;

let startIdx = code.indexOf(startStr);
let endIdx = code.indexOf(nextStr, startIdx);

if (startIdx > -1 && endIdx > -1) {
  let elogoCode = code.substring(startIdx, endIdx);
  
  let uyumsoftCode = elogoCode
    .replace(/\/api\/elogo\//g, '/api/uyumsoft/')
    .replace(/elogo_username/g, 'uyumsoft_username')
    .replace(/elogo_password/g, 'uyumsoft_password')
    .replace(/elogo_is_test/g, 'uyumsoft_is_test')
    .replace(/ElogoClient/g, 'UyumsoftClient')
    .replace(/eLogo/g, 'Uyumsoft');
    
  let newCode = code.substring(0, endIdx) + uyumsoftCode + '\n\n' + code.substring(endIdx);
  fs.writeFileSync('api/index.js', newCode);
  console.log('Successfully injected Uyumsoft endpoints properly!');
} else {
  console.log('Could not find boundaries', { startIdx, endIdx });
}
