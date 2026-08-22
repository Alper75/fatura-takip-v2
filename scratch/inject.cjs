const fs=require('fs'); 
let idx=fs.readFileSync('api/index.js','utf8'); 
const ep=fs.readFileSync('scratch/uyumsoft_endpoints.js','utf8'); 
idx=idx.replace('// PDF İndirme Endpoint', ep + '\n\n// PDF İndirme Endpoint'); 
fs.writeFileSync('api/index.js',idx,'utf8'); 
console.log('Injected');
