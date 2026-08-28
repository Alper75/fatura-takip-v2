const fs = require('fs');
const path = require('path');

// 1. FaturaAktarim.tsx
const faturaAktarimPath = path.resolve(__dirname, '../src/sections/FaturaAktarim.tsx');
let faturaAktarim = fs.readFileSync(faturaAktarimPath, 'utf8');

// Replace parseDate and sortInvoicesChronologically in FaturaAktarim.tsx
const newSortFunc = `  const parseDateToTimestamp = (dStr: any): number => {
    if (!dStr) return 0;
    if (typeof dStr === 'number') return dStr;
    const s = String(dStr).trim();
    if (s.includes('.') || s.includes('/')) {
      const sep = s.includes('.') ? '.' : '/';
      const parts = s.split(sep);
      if (parts.length >= 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2].substring(0, 4), 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day).getTime();
        }
      }
    }
    const ts = new Date(s).getTime();
    return isNaN(ts) ? 0 : ts;
  };

  // FATURALARI TARİHE GÖRE (ESKİDEN YENİYE / KRONOLOJİK 1 GÜNDEN 31 GÜNE) SIRALAMA
  const sortInvoicesChronologically = (list: any[]) => {
    return [...list].sort((a, b) => {
      const timeA = parseDateToTimestamp(a.faturaTarihi || a.tarih);
      const timeB = parseDateToTimestamp(b.faturaTarihi || b.tarih);
      if (timeA !== timeB) return timeA - timeB;
      return String(a.faturaNo || a.no || '').localeCompare(String(b.faturaNo || b.no || ''), undefined, { numeric: true });
    });
  };`;

faturaAktarim = faturaAktarim.replace(/\/\/ FATURALARI TARİHE GÖRE[\s\S]*?return String\(a\.faturaNo[\s\S]*?\};\s*\}\;/, newSortFunc);

// Also make formatTarih robust
const newFormatTarih = `  const formatTarih = (tarih: string) => {
    if (!tarih) return '';
    const str = String(tarih).trim();
    if (str.includes('/')) return str;
    if (str.includes('.') && str.split('.').length === 3) return str.replace(/\\./g, '/');
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) return \`\${parts[2]}/\${parts[1]}/\${parts[0]}\`;
      return \`\${parts[0]}/\${parts[1]}/\${parts[2]}\`;
    }
    return str;
  };`;

faturaAktarim = faturaAktarim.replace(/const formatTarih = \(tarih: string\) => \{[\s\S]*?return `\$\{d\}\/\$\{m\}\/\$\{y\}`;[\s\S]*?\};/, newFormatTarih);

fs.writeFileSync(faturaAktarimPath, faturaAktarim, 'utf8');
console.log('FaturaAktarim.tsx updated with robust chronological parser!');

// 2. popup.js
const popupPath = path.resolve(__dirname, '../../luca_extension/popup.js');
let popupJs = fs.readFileSync(popupPath, 'utf8');

// Ensure sorting inside popup.js before executeScript
const popupSortSnippet = `            const storage = await chrome.storage.local.get(['transferData']);
            let mList = storage.transferData?.mahsupRows || [];
            if (mList.length === 0) return showError("Aktarılacak mahsup satırı yok.");

            // Kronolojik sıralama garantisi (Eskiden Yeniye / 1. günden 31. güne)
            const parseTs = (d) => {
                if (!d) return 0;
                const str = String(d).trim();
                if (str.includes('/') || str.includes('.')) {
                    const sep = str.includes('/') ? '/' : '.';
                    const p = str.split(sep);
                    if (p.length >= 3) return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0])).getTime() || 0;
                }
                return new Date(str).getTime() || 0;
            };
            mList = [...mList].sort((a, b) => {
                const tA = parseTs(a.tarih || a.evrakTarihi || a['Evrak Tarihi']);
                const tB = parseTs(b.tarih || b.evrakTarihi || b['Evrak Tarihi']);
                if (tA !== tB) return tA - tB;
                return String(a.evrakNo || a.no || '').localeCompare(String(b.evrakNo || b.no || ''), undefined, { numeric: true });
            });`;

popupJs = popupJs.replace(/const storage = await chrome\.storage\.local\.get\(\['transferData'\]\);\s*const mList = storage\.transferData\?\.mahsupRows \|\| \[\];\s*if \(mList\.length === 0\) return showError\("Aktarılacak mahsup satırı yok\."\);/, popupSortSnippet);

fs.writeFileSync(popupPath, popupJs, 'utf8');
console.log('popup.js updated with chronological sorting guarantee!');
