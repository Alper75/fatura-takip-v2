const fs = require('fs');
const filePath = 'src/sections/KesilecekFaturalar.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Replace 1
content = content.replace(
  /if \(detailsResult\.aliciVknTckn\) finalVkn = detailsResult\.aliciVknTckn;\s*\}\s*\}\s*\} catch \(detailsErr\) \{\s*console\.error\('Detaylar getirilemedi:', detailsErr\);\s*\}/,
  `if (detailsResult.aliciVknTckn) finalVkn = detailsResult.aliciVknTckn;
            if (detailsResult.tevkifatTutari) gibInv.tevkifatTutari = detailsResult.tevkifatTutari;
            if (detailsResult.stopajTutari) gibInv.stopajTutari = detailsResult.stopajTutari;
          }
        }
      } catch (detailsErr) {
        console.error('Detaylar getirilemedi:', detailsErr);
      }`
);

// Replace 2
content = content.replace(
  /const parts = \(gibInv\.belgeTarihi \|\| ''\)\.split\('\/'\);/,
  `const parts = (gibInv.belgeTarihi || '').split(/-|\\//);`
);

// Replace 3
content = content.replace(
  /kdvOrani: '20',\s*tevkifatOrani: '0',\s*tevkifatKodu: '',\s*stopajOrani: '0',\s*stopajKodu: '',/g,
  `kdvOrani: '20',
        tevkifatOrani: gibInv.tevkifatTutari ? '2/10' : '0',
        tevkifatTutari: gibInv.tevkifatTutari || 0,
        tevkifatKodu: '',
        stopajOrani: gibInv.stopajTutari ? '20' : '0',
        stopajTutari: gibInv.stopajTutari || 0,
        stopajKodu: '',`
);

// Replace 4 (Bulk import)
content = content.replace(
  /if \(detailsResult\.aliciVknTckn\) finalVkn = detailsResult\.aliciVknTckn;\s*\}\s*\}\s*\} catch \(detailsErr\) \{\s*console\.error\('Toplu detay getirilemedi:', detailsErr\);\s*\}/,
  `if (detailsResult.aliciVknTckn) finalVkn = detailsResult.aliciVknTckn;
            if (detailsResult.tevkifatTutari) gibInv.tevkifatTutari = detailsResult.tevkifatTutari;
            if (detailsResult.stopajTutari) gibInv.stopajTutari = detailsResult.stopajTutari;
          }
        }
      } catch (detailsErr) {
        console.error('Toplu detay getirilemedi:', detailsErr);
      }`
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Update successful');
