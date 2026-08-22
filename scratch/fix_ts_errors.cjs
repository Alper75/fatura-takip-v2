const fs = require('fs');

// 1. Fix App.tsx
let appStr = fs.readFileSync('src/App.tsx', 'utf8');
if (!appStr.includes("<AkilliOgrenme />")) {
  // Use regex to match regardless of \r or \n
  appStr = appStr.replace(/case 'sirket-dosyalari':[\r\n\s]+return <SirketDosyalari \/>;/, "case 'sirket-dosyalari':\n            return <SirketDosyalari />;\n          case 'akilli-ogrenme':\n            return <AkilliOgrenme />;");
  fs.writeFileSync('src/App.tsx', appStr);
}

// 2. Fix AkilliOgrenme.tsx
let aoStr = fs.readFileSync('src/sections/AkilliOgrenme.tsx', 'utf8');
aoStr = aoStr.replace("import React, { useState, useEffect }", "import { useState, useEffect }");
fs.writeFileSync('src/sections/AkilliOgrenme.tsx', aoStr);

// 3. Fix BankaEkstreListesi.tsx (Remove yapayZekaKurallari hook completely to avoid TS errors, as we decided we won't auto-apply AI rules here for now)
let bankStr = fs.readFileSync('src/sections/BankaEkstreListesi.tsx', 'utf8');
const hookStart = "const [yapayZekaKurallari, setYapayZekaKurallari]";
if (bankStr.includes(hookStart)) {
  // Remove the entire block we injected
  const hookRegex = /const \[yapayZekaKurallari.*?catch\(console\.error\);\s*}, \[\]\);/s;
  bankStr = bankStr.replace(hookRegex, "");
}
// Add useEffect if it's missing but needed elsewhere, or just leave it out if we removed the hook that used it.
// Wait, is useEffect used anywhere else in BankaEkstreListesi? No, BankaEkstreListesi didn't have it originally.
// If it complains, we'll see, but removing the yapayZekaKurallari hook also removes the useEffect we injected.
fs.writeFileSync('src/sections/BankaEkstreListesi.tsx', bankStr);
console.log("All fixes applied");
