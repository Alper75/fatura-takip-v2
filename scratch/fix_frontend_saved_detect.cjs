const fs = require('fs');
const path = require('path');

// 1. Update GelenEFaturalar.tsx
const gelenElogoPath = path.resolve(__dirname, '../src/sections/GelenEFaturalar.tsx');
let gelenElogo = fs.readFileSync(gelenElogoPath, 'utf8');

// Ensure fetchAlisFaturalari is called on mount
gelenElogo = gelenElogo.replace(/useEffect\(\(\) => \{\s*fetchFaturalar\(\);\s*\}, \[\]\);/, `useEffect(() => {
    fetchFaturalar();
    fetchAlisFaturalari();
    fetchCariHareketler();
  }, []);`);

// Make checkIsSaved support both database field formats & case-insensitive matching
const safeCheckIsSaved = `  const checkIsSaved = (f: any) => {
    if (!f) return false;
    if (f.isAlreadySaved) return true;
    const fNo = String(f.invoiceNumber || f.faturaNo || f.documentId || '').trim().toLowerCase();
    const fUuid = String(f.uuid || f.documentUuid || '').trim().toLowerCase();
    
    if (fUuid && savedInvoices.map(s => s.toLowerCase()).includes(fUuid)) return true;
    
    return (alisFaturalari || []).some((a: any) => {
      const aNo = String(a.faturaNo || a.fatura_no || '').trim().toLowerCase();
      const aUuid = String(a.gibUuid || a.gib_uuid || a.uuid || '').trim().toLowerCase();
      if (fNo && aNo && aNo === fNo) return true;
      if (fUuid && aUuid && aUuid === fUuid) return true;
      return false;
    });
  };`;

gelenElogo = gelenElogo.replace(/const checkIsSaved = \(f: any\) => \{[\s\S]*?\};\n\n  const savedCount/, safeCheckIsSaved + `\n\n  const savedCount`);
fs.writeFileSync(gelenElogoPath, gelenElogo, 'utf8');
console.log('GelenEFaturalar.tsx updated with auto-fetch and robust saved detection!');

// 2. Update GelenUyumsoftFaturalar.tsx
const gelenUyumsoftPath = path.resolve(__dirname, '../src/sections/GelenUyumsoftFaturalar.tsx');
let gelenUyumsoft = fs.readFileSync(gelenUyumsoftPath, 'utf8');
gelenUyumsoft = gelenUyumsoft.replace(/useEffect\(\(\) => \{\s*fetchFaturalar\(\);\s*\}, \[\]\);/, `useEffect(() => {
    fetchFaturalar();
    fetchAlisFaturalari();
    fetchCariHareketler();
  }, []);`);
gelenUyumsoft = gelenUyumsoft.replace(/const checkIsSaved = \(f: any\) => \{[\s\S]*?\};\n\n  const savedCount/, safeCheckIsSaved + `\n\n  const savedCount`);
fs.writeFileSync(gelenUyumsoftPath, gelenUyumsoft, 'utf8');
console.log('GelenUyumsoftFaturalar.tsx updated with auto-fetch and robust saved detection!');

// 3. Update GidenElogoFaturalar.tsx
const gidenElogoPath = path.resolve(__dirname, '../src/sections/GidenElogoFaturalar.tsx');
let gidenElogo = fs.readFileSync(gidenElogoPath, 'utf8');
gidenElogo = gidenElogo.replace(/useEffect\(\(\) => \{\s*fetchFaturalar\(\);\s*\}, \[\]\);/, `useEffect(() => {
    fetchFaturalar();
    fetchSatisFaturalari();
    fetchCariHareketler();
  }, []);`);

const safeCheckIsSavedSatis = `  const checkIsSaved = (f: any) => {
    if (!f) return false;
    if (f.isAlreadySaved) return true;
    const fNo = String(f.invoiceNumber || f.faturaNo || f.documentId || '').trim().toLowerCase();
    const fUuid = String(f.uuid || f.documentUuid || '').trim().toLowerCase();
    
    if (fUuid && savedInvoices.map(s => s.toLowerCase()).includes(fUuid)) return true;
    
    return (satisFaturalari || []).some((s: any) => {
      const sNo = String(s.faturaNo || s.fatura_no || '').trim().toLowerCase();
      const sUuid = String(s.gibUuid || s.gib_uuid || s.uuid || '').trim().toLowerCase();
      if (fNo && sNo && sNo === fNo) return true;
      if (fUuid && sUuid && sUuid === fUuid) return true;
      return false;
    });
  };`;

gidenElogo = gidenElogo.replace(/const checkIsSaved = \(f: any\) => \{[\s\S]*?\};\n\n  const savedCount/, safeCheckIsSavedSatis + `\n\n  const savedCount`);
fs.writeFileSync(gidenElogoPath, gidenElogo, 'utf8');
console.log('GidenElogoFaturalar.tsx updated with auto-fetch and robust saved detection!');
