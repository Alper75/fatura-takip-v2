const fs=require('fs'); 
let idx=fs.readFileSync('api/index.js','utf8'); 
const ep=fs.readFileSync('scratch/uyumsoft_esmm_pdf.js','utf8'); 
idx=idx.replace('// Logo\'dan Gelen Faturayı Sisteme Kaydet', ep + '\n\n// Logo\'dan Gelen Faturayı Sisteme Kaydet'); 
fs.writeFileSync('api/index.js',idx,'utf8'); 
console.log('Injected');
