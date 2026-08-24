const fs = require('fs');
let content = fs.readFileSync('src/sections/KesilecekFaturalar.tsx', 'utf8');

content = content.replace(/alinanUcret: finalAmount\.toString\(\),\s*faturaTarihi: formattedDate,\s*kdvOrani: '20',/g,
  `alinanUcret: finalAmount.toString(),
        matrah: gibInv.matrah || finalAmount,
        kdvTutari: gibInv.kdvTutari || 0,
        faturaTarihi: formattedDate,
        kdvOrani: '20',`);

fs.writeFileSync('src/sections/KesilecekFaturalar.tsx', content);
console.log('Fixed');
