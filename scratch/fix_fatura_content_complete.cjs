const fs = require('fs');
const path = require('path');

const contentPath = path.resolve(__dirname, '../../luca_extension/fatura_content.js');

const safeContentCode = `// fatura_content.js
window.addEventListener('FATURA_APP_LUCA_DATA', (e) => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && e.detail) {
      chrome.runtime.sendMessage({
        type: 'SET_TRANSFER_DATA',
        data: e.detail
      }, () => {
        if (chrome.runtime.lastError) {}
      });
    }
  } catch (err) {}
});

window.addEventListener('FATURA_APP_LUCA_SEND_ISLETME', (e) => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && e.detail) {
      chrome.runtime.sendMessage({
        type: 'SET_TRANSFER_DATA',
        data: { isIsletme: true, invoices: e.detail }
      }, () => {
        if (chrome.runtime.lastError) {}
      });
    }
  } catch (err) {}
});

window.addEventListener('FATURA_APP_LUCA_SEND_MAHSUP', (e) => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && e.detail) {
      chrome.runtime.sendMessage({
        type: 'SET_TRANSFER_DATA',
        data: { isIsletme: false, mahsupRows: e.detail }
      }, () => {
        if (chrome.runtime.lastError) {}
      });
    }
  } catch (err) {}
});
`;

fs.writeFileSync(contentPath, safeContentCode, 'utf8');
console.log('fatura_content.js finalized with all event handlers and safety guards!');
