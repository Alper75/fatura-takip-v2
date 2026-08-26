const fs = require('fs');
const path = require('path');

const lucaContentPath = path.resolve(__dirname, '../../luca_extension/luca_content.js');
let content = fs.readFileSync(lucaContentPath, 'utf8');

// Add sorting inside runHizliFisFill in luca_content.js
const sortSnippet = `  // --- 3. HIZLI FİŞ DOLDURMA MOTORU ---
  async function runHizliFisFill(rawList, onProgress) {
    // Tarihe göre eskiden yeniye (küçükten büyüğe) sıralama
    const parseDateToTime = (d) => {
      if (!d) return 0;
      if (typeof d === 'string' && d.includes('/')) {
        const parts = d.split('/');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      return new Date(d).getTime() || 0;
    };

    const invList = [...rawList].sort((a, b) => {
      const tA = parseDateToTime(a.evrakTarih || a.kayitTarihi || a.tarih || a.faturaTarihi);
      const tB = parseDateToTime(b.evrakTarih || b.kayitTarihi || b.tarih || b.faturaTarihi);
      if (tA !== tB) return tA - tB;
      return String(a.evrakNo || a.no || '').localeCompare(String(b.evrakNo || b.no || ''), undefined, { numeric: true });
    });`;

if (content.includes('// --- 3. HIZLI FİŞ DOLDURMA MOTORU ---')) {
  content = content.replace(
    /\/\/ --- 3\. HIZLI FİŞ DOLDURMA MOTORU ---\s+async function runHizliFisFill\(invList, onProgress\) \{/,
    sortSnippet
  );
  fs.writeFileSync(lucaContentPath, content, 'utf8');
  console.log('luca_content.js updated with chronological sorting!');
}

// Also update popup.js
const popupPath = path.resolve(__dirname, '../../luca_extension/popup.js');
let popup = fs.readFileSync(popupPath, 'utf8');

const popupSortSnippet = `                func: async (rawList) => {
                    const parseDateToTime = (d) => {
                      if (!d) return 0;
                      if (typeof d === 'string' && d.includes('/')) {
                        const parts = d.split('/');
                        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
                      }
                      return new Date(d).getTime() || 0;
                    };

                    const invList = [...rawList].sort((a, b) => {
                      const tA = parseDateToTime(a.evrakTarih || a.kayitTarihi || a.tarih || a.faturaTarihi);
                      const tB = parseDateToTime(b.evrakTarih || b.kayitTarihi || b.tarih || b.faturaTarihi);
                      if (tA !== tB) return tA - tB;
                      return String(a.evrakNo || a.no || '').localeCompare(String(b.evrakNo || b.no || ''), undefined, { numeric: true });
                    });`;

if (popup.includes('func: async (invList) => {')) {
  popup = popup.replace('func: async (invList) => {', popupSortSnippet);
  fs.writeFileSync(popupPath, popup, 'utf8');
  console.log('popup.js updated with chronological sorting!');
}
