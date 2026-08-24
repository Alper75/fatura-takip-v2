const fs = require('fs');
let content = fs.readFileSync('src/sections/KesilecekFaturalar.tsx', 'utf8');
content = content.replace(/const parts = \(gibInv\.belgeTarihi \|\| ''\)\.split\('\/'\);/g, 'const parts = (gibInv.belgeTarihi || \'\').split(/-|\\//);');
fs.writeFileSync('src/sections/KesilecekFaturalar.tsx', content);
console.log('Fixed bulk import date');
