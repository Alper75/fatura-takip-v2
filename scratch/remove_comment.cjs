const fs = require('fs');
let code = fs.readFileSync('src/sections/BankaEkstreListesi.tsx', 'utf8');
code = code.replace(/(\n|\r\n)?\s*\*\//g, ''); // Removes ALL `*/` which is safe since there are no other block comments in that area (or hopefully anywhere else that we don't want removed, wait, safer regex: )
code = fs.readFileSync('src/sections/BankaEkstreListesi.tsx', 'utf8');
code = code.replace('  */\r\n  const handleTransferleriBul', '  const handleTransferleriBul');
code = code.replace('  */\n  const handleTransferleriBul', '  const handleTransferleriBul');
fs.writeFileSync('src/sections/BankaEkstreListesi.tsx', code);
console.log("Comment removed");
