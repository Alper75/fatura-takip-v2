const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');

// ==================== 1. fatura_content.js ====================
const faturaContentCode = `// fatura_content.js - Fatura Takip Web Uygulaması Köprüsü
(function() {
  function saveToExtension(detail, explicitType) {
    if (!detail) return;
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['transferData'], (res) => {
        let current = res.transferData || {};

        if (explicitType === 'MAHSUP' || detail.mahsupRows || (!detail.isIsletme && Array.isArray(detail))) {
          const rows = detail.mahsupRows || (Array.isArray(detail) ? detail : []);
          current.mahsupRows = rows;
          current.isIsletme = false;
        } else if (explicitType === 'ISLETME' || detail.invoices || detail.hizliFisItems || (detail.isIsletme && Array.isArray(detail))) {
          const invs = detail.invoices || detail.hizliFisItems || (Array.isArray(detail) ? detail : []);
          current.invoices = invs;
          current.hizliFisItems = invs;
          current.isIsletme = true;
        } else if (detail.bankTransactions) {
          current.bankTransactions = detail.bankTransactions;
        }

        chrome.storage.local.set({ transferData: current }, () => {
          if (chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({ type: 'TRANSFER_DATA_UPDATED', data: current }, () => {
              if (chrome.runtime.lastError) { /* ignore */ }
            });
          }
        });
      });
    }
  }

  window.addEventListener('FATURA_APP_LUCA_SEND_MAHSUP', (e) => saveToExtension(e.detail, 'MAHSUP'));
  window.addEventListener('FATURA_APP_LUCA_SEND_ISLETME', (e) => saveToExtension(e.detail, 'ISLETME'));
  window.addEventListener('FATURA_APP_LUCA_DATA', (e) => saveToExtension(e.detail));

  window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (e.data.type === 'FATURA_APP_LUCA_SEND_MAHSUP') saveToExtension(e.data.detail || e.data.data, 'MAHSUP');
    if (e.data.type === 'FATURA_APP_LUCA_SEND_ISLETME') saveToExtension(e.data.detail || e.data.data, 'ISLETME');
    if (e.data.type === 'FATURA_APP_LUCA_DATA') saveToExtension(e.data.detail || e.data.data || e.data.payload);
  });
})();
`;
fs.writeFileSync(path.join(extDir, 'fatura_content.js'), faturaContentCode, 'utf8');

// ==================== 2. background.js ====================
const backgroundCode = `// background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_TRANSFER_DATA') {
    chrome.storage.local.set({ transferData: message.data }, () => {
      sendResponse({ status: 'ok' });
    });
    return true;
  }
  if (message.type === 'GET_TRANSFER_DATA') {
    chrome.storage.local.get(['transferData'], (result) => {
      sendResponse(result.transferData);
    });
    return true;
  }
});
`;
fs.writeFileSync(path.join(extDir, 'background.js'), backgroundCode, 'utf8');

console.log('fatura_content.js & background.js updated with permanent non-overwriting storage!');
