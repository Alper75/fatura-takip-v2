const fs = require('fs');
const path = require('path');

const contentPath = path.resolve(__dirname, '../../luca_extension/fatura_content.js');

if (fs.existsSync(contentPath)) {
  const code = fs.readFileSync(contentPath, 'utf8');
  console.log('Original fatura_content.js:');
  console.log(code);

  const safeContentCode = `// fatura_content.js
window.addEventListener('FATURA_APP_LUCA_DATA', (e) => {
  try {
    if (chrome && chrome.runtime && chrome.runtime.id && e.detail) {
      chrome.runtime.sendMessage({
        type: 'SET_TRANSFER_DATA',
        data: e.detail
      }, () => {
        if (chrome.runtime.lastError) {
          // Context invalidated or closed
        }
      });
    }
  } catch (err) {
    // Sayfa yenilenmediğinde eski eklenti bağlamı hatasını sessize al
  }
});

window.addEventListener('FATURA_APP_LUCA_SEND_ISLETME', (e) => {
  try {
    if (chrome && chrome.runtime && chrome.runtime.id && e.detail) {
      chrome.runtime.sendMessage({
        type: 'SET_TRANSFER_DATA',
        data: { isIsletme: true, invoices: e.detail }
      }, () => {
        if (chrome.runtime.lastError) {}
      });
    }
  } catch (err) {}
});
`;

  fs.writeFileSync(contentPath, safeContentCode, 'utf8');
  console.log('fatura_content.js updated with safe context validation!');
} else {
  console.log('fatura_content.js not found at:', contentPath);
}
