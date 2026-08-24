const fs = require('fs');
let content = fs.readFileSync('src/sections/KesilecekFaturalar.tsx', 'utf8');

const regex1 = /kdvOrani:\s*'20',\s*tevkifatOrani:\s*gibInv\.tevkifatTutari\s*\?\s*'2\/10'\s*:\s*'0',\s*tevkifatTutari:\s*gibInv\.tevkifatTutari\s*\|\|\s*0,\s*tevkifatKodu:\s*'',\s*stopajOrani:\s*gibInv\.stopajTutari\s*\?\s*'20'\s*:\s*'0',/g;

const replacement = `kdvOrani: (gibInv.kdvTutari && gibInv.matrah) ? Math.round((gibInv.kdvTutari / gibInv.matrah) * 100).toString() : '20',
        tevkifatOrani: (gibInv.tevkifatTutari && gibInv.kdvTutari) ? \`\${Math.round((gibInv.tevkifatTutari / gibInv.kdvTutari) * 10)}/10\` : '0',
        tevkifatTutari: gibInv.tevkifatTutari || 0,
        tevkifatKodu: '',
        stopajOrani: (gibInv.stopajTutari && gibInv.matrah) ? Math.round((gibInv.stopajTutari / gibInv.matrah) * 100).toString() : '0',`;

content = content.replace(regex1, replacement);

fs.writeFileSync('src/sections/KesilecekFaturalar.tsx', content);
console.log('Fixed dynamic oran in KesilecekFaturalar.tsx');
