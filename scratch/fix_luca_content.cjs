const fs = require('fs');
const path = require('path');

const lucaContentPath = path.resolve(__dirname, '../../luca_extension/luca_content.js');

const newContent = `// Luca Aktarım Eklentisi - Luca Sayfa Köprüsü (v2.0.1)

(function() {
  const CURRENT_URL = window.location.href;
  console.log("[Luca Bridge] Devrede...", CURRENT_URL);

  function isRuntimeValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  }

  function handleKodSecmePopup() {
    try {
      if (!isRuntimeValid()) return;
      chrome.storage.local.get(['targetKodNo'], (res) => {
        const target = res?.targetKodNo;
        if (!target) return;
        
        const rows = document.querySelectorAll("tr[id^='tr']");
        for (let row of rows) {
          const codeCell = row.cells?.[0]?.innerText?.trim();
          if (codeCell === target) {
            console.log("[Luca Bridge] İstisna kodu otomatik seçiliyor:", target);
            if (typeof window.gonder === 'function') {
              window.gonder(row.id);
            } else if (typeof window.sec === 'function') {
              window.sec(row);
              row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            }
            // Seçildikten sonra hedefi temizle
            chrome.storage.local.remove(['targetKodNo']);
            break;
          }
        }
      });
    } catch (e) {
      console.warn("[Luca Bridge] handleKodSecmePopup hatası:", e);
    }
  }

  // Luca tevkifat kodu secme popup'inda miyiz?
  if (CURRENT_URL.indexOf('ismgetKDVBeyannameIstisnalarTable') >= 0) {
    try {
      handleKodSecmePopup();
    } catch (err) {
      console.warn("[Luca Bridge] İstisna popup yakalanamadı:", err);
    }
  }

  function setNativeValue(el, value) {
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (setter && el.tagName === 'INPUT') setter.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true }));
  }

  // Örnek: Kazıma fonksiyonu popup'tan çağrılabilir
  window.addEventListener('LUCA_SCRAPE_ACCOUNTS_REQUEST', () => {
      const table = document.getElementById("TBL") || 
                    document.getElementById("HTBL") || 
                    Array.from(document.querySelectorAll("table")).find(t => t.innerText.includes("Hesap Kodu"));
      
      if (!table) return window.dispatchEvent(new CustomEvent('LUCA_SCRAPE_ACCOUNTS_RESPONSE', { detail: { status: 'error', message: 'Tablo bulunamadı' }}));

      const accounts = [];
      const rows = Array.from(table.rows);
      for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (row.querySelector("th") || row.innerText.includes("Hesap Kodu")) continue;
          if (row.cells.length >= 2) {
              let code = row.cells[0].innerText.trim();
              let name = row.cells[1].innerText.trim();
              if (code && name && /^[0-9.]{3,}/.test(code)) {
                  accounts.push({ kod: code, ad: name });
              }
          }
      }
      window.dispatchEvent(new CustomEvent('LUCA_SCRAPE_ACCOUNTS_RESPONSE', { detail: { status: 'success', data: accounts }}));
  });

})();
`;

fs.writeFileSync(lucaContentPath, newContent, 'utf8');
console.log('luca_content.js fixed and updated successfully!');
