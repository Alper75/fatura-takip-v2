const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');

// ==================== 1. fatura_content.js ====================
const faturaContentOriginal = `// fatura_content.js
window.addEventListener('FATURA_APP_LUCA_DATA', (e) => {
  if (e.detail) {
    chrome.runtime.sendMessage({
      type: 'SET_TRANSFER_DATA',
      data: e.detail
    });
  }
});

window.addEventListener('FATURA_APP_LUCA_SEND_ISLETME', (e) => {
  if (e.detail) {
    chrome.runtime.sendMessage({
      type: 'SET_TRANSFER_DATA',
      data: { isIsletme: true, invoices: e.detail }
    });
  }
});

window.addEventListener('FATURA_APP_LUCA_SEND_MAHSUP', (e) => {
  if (e.detail) {
    chrome.runtime.sendMessage({
      type: 'SET_TRANSFER_DATA',
      data: { isIsletme: false, mahsupRows: e.detail }
    });
  }
});
`;

fs.writeFileSync(path.join(extDir, 'fatura_content.js'), faturaContentOriginal, 'utf8');

// ==================== 2. background.js ====================
const backgroundOriginal = `chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

fs.writeFileSync(path.join(extDir, 'background.js'), backgroundOriginal, 'utf8');

// ==================== 3. popup.html ====================
const popupHtmlOriginal = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      --secondary: #6366f1;
      --success: #10b981;
      --error: #ef4444;
      --bg: #ffffff;
      --card-bg: #f8fafc;
      --text: #1e293b;
      --text-muted: #64748b;
      --border: #e2e8f0;
    }
    
    body {
      width: 320px;
      margin: 0;
      padding: 16px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      background-color: var(--bg);
      color: var(--text);
    }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 20px;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
    }

    h1 {
      font-size: 18px;
      font-weight: 700;
      margin: 0;
      background: linear-gradient(to right, var(--text), var(--text-muted));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      transition: all 0.2s;
    }

    .section:hover {
      border-color: var(--primary);
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }

    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .info-label { color: var(--text-muted); }
    .info-value { font-weight: 600; }

    .btn {
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 8px;
    }

    .btn-sync {
      background-color: var(--success);
      color: white;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
    }

    .btn-paste {
      background-color: var(--primary);
      color: white;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
    }

    .btn-secondary {
      background-color: white;
      border: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 12px;
      padding: 8px;
    }

    .btn:hover:not(:disabled) {
      transform: translateY(-2px);
      filter: brightness(1.05);
    }

    .btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      filter: grayscale(0.5);
    }

    .footer {
      text-align: center;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px dashed var(--border);
    }

    .badge {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
    }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-green { background: #dcfce7; color: #166534; }

    #error-display {
      color: var(--error);
      font-size: 12px;
      margin-top: 8px;
      display: none;
      text-align: center;
      background: #fef2f2;
      padding: 8px;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-icon">L</div>
    <h1 title="Luca VKN Aktarım">Luca Aktarım v2.0</h1>
  </div>

  <!-- Seksiyon: Hesap Planı -->
  <div class="section">
    <div class="section-title">
      <span>Luca Hesap Planı</span>
      <span class="badge badge-green" id="sync-badge">Tamam</span>
    </div>
    <div class="info-row">
      <span class="info-label">Durum:</span>
      <span class="info-value" id="sync-status">Bağlı Değil</span>
    </div>
    <div id="sync-time" style="font-size: 10px; color: var(--text-muted); margin-bottom: 12px;">Henüz eşitlenmedi</div>
    <button id="sync-btn" class="btn btn-sync">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
      Hesap Planını Çek
    </button>
  </div>

  <!-- Seksiyon: Fatura Aktarımı -->
  <div class="section">
    <div class="section-title">
      <span>Fatura Kuyruğu</span>
      <span class="badge badge-blue" id="queue-badge">0 Fatura</span>
    </div>
    <div class="info-row">
      <span class="info-label">Bekleyen:</span>
      <span class="info-value" id="queue-count">0 Fatura</span>
    </div>
    <button id="paste-btn" class="btn btn-paste" disabled>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
      Faturaları Buraya Aktar
    </button>
    <button id="clear-btn" class="btn btn-secondary">Fatura Kuyruğunu Temizle</button>
  </div>

  <!-- Seksiyon: Banka Aktarımı -->
  <div class="section">
    <div class="section-title">
      <span>Banka Kuyruğu</span>
      <span class="badge badge-blue" id="bank-queue-badge">0 Hareket</span>
    </div>
    <div class="info-row">
      <span class="info-label">Bekleyen:</span>
      <span class="info-value" id="bank-queue-count">0 Hareket</span>
    </div>
    <button id="bank-paste-btn" class="btn btn-paste" disabled>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
      Banka Hareketlerini Aktar
    </button>
    <button id="bank-clear-btn" class="btn btn-secondary">Banka Kuyruğunu Temizle</button>
  </div>

  <!-- Seksiyon: Mahsup Fişi (Bilanço Fatura) Aktarımı -->
  <div class="section">
    <div class="section-title">
      <span>Bilanço Fatura (Mahsup)</span>
      <span class="badge badge-blue" id="mahsup-queue-badge">0 Satır</span>
    </div>
    <div class="info-row">
      <span class="info-label">Bekleyen:</span>
      <span class="info-value" id="mahsup-queue-count">0 Satır</span>
    </div>
    <button id="mahsup-paste-btn" class="btn btn-paste" disabled style="background-color: #059669;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      Mahsup Fişine Aktar
    </button>
    <button id="mahsup-clear-btn" class="btn btn-secondary">Kuyruğu Temizle</button>
  </div>

  <div id="error-display"></div>

  <div class="footer">
    Luca Entegrasyonu &copy; 2026
  </div>

  <script src="popup.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(extDir, 'popup.html'), popupHtmlOriginal, 'utf8');

// ==================== 4. popup.js ====================
const popupJsOriginal = `document.addEventListener('DOMContentLoaded', async () => {
    const syncBtn = document.getElementById('sync-btn');
    const syncStatus = document.getElementById('sync-status');
    const syncTime = document.getElementById('sync-time');
    const queueCount = document.getElementById('queue-count');
    const queueBadge = document.getElementById('queue-badge');
    const pasteBtn = document.getElementById('paste-btn');
    const clearBtn = document.getElementById('clear-btn');
    const errorDisplay = document.getElementById('error-display');

    // Banka Elemanları
    const bankQueueBadge = document.getElementById('bank-queue-badge');
    const bankQueueCount = document.getElementById('bank-queue-count');
    const bankPasteBtn = document.getElementById('bank-paste-btn');
    const bankClearBtn = document.getElementById('bank-clear-btn');

    // Mahsup (Bilanço) Elemanları
    const mahsupQueueBadge = document.getElementById('mahsup-queue-badge');
    const mahsupQueueCount = document.getElementById('mahsup-queue-count');
    const mahsupPasteBtn = document.getElementById('mahsup-paste-btn');
    const mahsupClearBtn = document.getElementById('mahsup-clear-btn');

    function showError(msg) {
        errorDisplay.innerText = msg;
        errorDisplay.style.display = 'block';
        setTimeout(() => { errorDisplay.style.display = 'none'; }, 4000);
    }

    // 1. Durum Kontrolleri
    const updateUI = () => {
        chrome.storage.local.get(['lucaAccounts', 'lastSyncTime', 'transferData'], (res) => {
            if (res.lucaAccounts && res.lucaAccounts.length > 0) {
                syncStatus.innerText = \`\${res.lucaAccounts.length} Hesap Eşitlendi\`;
                syncStatus.style.color = 'var(--success)';
            } else {
                syncStatus.innerText = 'Eşitlenmedi';
                syncStatus.style.color = 'var(--text-muted)';
            }

            if (res.lastSyncTime) {
                const date = new Date(res.lastSyncTime);
                syncTime.innerText = \`Son: \${date.toLocaleDateString('tr-TR')} \${date.toLocaleTimeString('tr-TR')}\`;
            }

            // Fatura Kuyruğu
            const transfer = res.transferData;
            if (transfer && transfer.invoices && transfer.invoices.length > 0) {
                const count = transfer.invoices.length;
                queueCount.innerText = \`\${count} Fatura Hazır\`;
                queueBadge.innerText = \`\${count} Fatura\`;
                queueBadge.className = 'badge badge-green';
                pasteBtn.disabled = false;
            } else {
                queueCount.innerText = '0 Fatura';
                queueBadge.innerText = '0 Fatura';
                queueBadge.className = 'badge badge-blue';
                pasteBtn.disabled = true;
            }

            // Banka Kuyruğu
            if (transfer && transfer.bankTransactions && transfer.bankTransactions.length > 0) {
                const bCount = transfer.bankTransactions.length;
                bankQueueCount.innerText = \`\${bCount} Hareket Hazır\`;
                bankQueueBadge.innerText = \`\${bCount} Hareket\`;
                bankQueueBadge.className = 'badge badge-green';
                bankPasteBtn.disabled = false;
            } else {
                bankQueueCount.innerText = '0 Hareket';
                bankQueueBadge.innerText = '0 Hareket';
                bankQueueBadge.className = 'badge badge-blue';
                bankPasteBtn.disabled = true;
            }

            // Mahsup (Bilanço) Kuyruğu
            if (transfer && transfer.mahsupRows && transfer.mahsupRows.length > 0) {
                const mCount = transfer.mahsupRows.length;
                mahsupQueueCount.innerText = \`\${mCount} Satır Hazır\`;
                mahsupQueueBadge.innerText = \`\${mCount} Satır\`;
                mahsupQueueBadge.className = 'badge badge-green';
                mahsupPasteBtn.disabled = false;
            } else {
                mahsupQueueCount.innerText = '0 Satır';
                mahsupQueueBadge.innerText = '0 Satır';
                mahsupQueueBadge.className = 'badge badge-blue';
                mahsupPasteBtn.disabled = true;
            }
        });
    };

    updateUI();

    // 2. Hesap Planını Çek (Scrape)
    syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        syncBtn.innerText = 'Çekiliyor...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url.includes('luca.com.tr')) {
                throw new Error('Lütfen açık bir Luca sekmesine geçin!');
            }

            chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_ACCOUNTS' }, (response) => {
                syncBtn.disabled = false;
                syncBtn.innerText = 'Hesap Planını Çek';

                if (chrome.runtime.lastError) {
                    showError('Luca sayfası bulunamadı veya yanıt vermiyor. Sayfayı yenileyin.');
                    return;
                }

                if (response && response.status === 'success') {
                    chrome.storage.local.set({
                        lucaAccounts: response.data,
                        lastSyncTime: new Date().toISOString()
                    }, () => {
                        updateUI();
                    });
                } else {
                    showError(response ? response.message : 'Hesap planı tablosu bulunamadı. Lütfen "Hesap Planı Listesi" ekranında olduğunuza emin olun.');
                }
            });
        } catch (err) {
            showError(err.message);
            syncBtn.disabled = false;
            syncBtn.innerText = 'Hesap Planını Çek';
        }
    });

    // 3. Fatura Kuyruğunu Temizle
    clearBtn.addEventListener('click', () => {
        chrome.storage.local.get(['transferData'], (res) => {
            const td = res.transferData || {};
            delete td.invoices;
            chrome.storage.local.set({ transferData: td }, () => {
                updateUI();
            });
        });
    });

    // 4. Banka Kuyruğunu Temizle
    if (bankClearBtn) {
        bankClearBtn.addEventListener('click', () => {
            chrome.storage.local.get(['transferData'], (res) => {
                const td = res.transferData || {};
                delete td.bankTransactions;
                chrome.storage.local.set({ transferData: td }, () => {
                    updateUI();
                });
            });
        });
    }

    // 5. Mahsup Kuyruğunu Temizle
    if (mahsupClearBtn) {
        mahsupClearBtn.addEventListener('click', () => {
            chrome.storage.local.get(['transferData'], (res) => {
                const td = res.transferData || {};
                delete td.mahsupRows;
                chrome.storage.local.set({ transferData: td }, () => {
                    updateUI();
                });
            });
        });
    }

    // 6. Faturaları Aktar (Hızlı Fiş)
    pasteBtn.addEventListener('click', async () => {
        pasteBtn.disabled = true;
        pasteBtn.innerText = 'Aktarılıyor...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url.includes('luca.com.tr')) {
                throw new Error('Lütfen açık bir Luca sekmesine geçin!');
            }

            chrome.storage.local.get(['transferData'], (res) => {
                const transfer = res.transferData;
                if (!transfer || !transfer.invoices || transfer.invoices.length === 0) {
                    showError('Aktarılacak fatura bulunamadı!');
                    pasteBtn.disabled = false;
                    pasteBtn.innerText = 'Faturaları Buraya Aktar';
                    return;
                }

                chrome.tabs.sendMessage(tab.id, {
                    type: 'PASTE_INVOICES',
                    data: transfer.invoices
                }, (response) => {
                    pasteBtn.disabled = false;
                    pasteBtn.innerText = 'Faturaları Buraya Aktar';

                    if (chrome.runtime.lastError) {
                        showError('Luca sayfası yanıt vermiyor. Sayfayı yenileyin.');
                        return;
                    }

                    if (response && response.status === 'success') {
                        // Başarılı aktarım
                    } else {
                        showError(response ? response.message : 'Hızlı fiş ekranı bulunamadı. Lütfen "Hızlı Fiş Girişi" ekranında olduğunuzdan emin olun.');
                    }
                });
            });
        } catch (err) {
            showError(err.message);
            pasteBtn.disabled = false;
            pasteBtn.innerText = 'Faturaları Buraya Aktar';
        }
    });

    // 7. Banka Hareketlerini Aktar
    if (bankPasteBtn) {
        bankPasteBtn.addEventListener('click', async () => {
            bankPasteBtn.disabled = true;
            bankPasteBtn.innerText = 'Aktarılıyor...';

            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab || !tab.url.includes('luca.com.tr')) {
                    throw new Error('Lütfen açık bir Luca sekmesine geçin!');
                }

                chrome.storage.local.get(['transferData'], (res) => {
                    const transfer = res.transferData;
                    if (!transfer || !transfer.bankTransactions || transfer.bankTransactions.length === 0) {
                        showError('Aktarılacak banka hareketi bulunamadı!');
                        bankPasteBtn.disabled = false;
                        bankPasteBtn.innerText = 'Banka Hareketlerini Aktar';
                        return;
                    }

                    chrome.tabs.sendMessage(tab.id, {
                        type: 'PASTE_BANK_TRANSACTIONS',
                        data: transfer.bankTransactions
                    }, (response) => {
                        bankPasteBtn.disabled = false;
                        bankPasteBtn.innerText = 'Banka Hareketlerini Aktar';

                        if (chrome.runtime.lastError) {
                            showError('Luca sayfası yanıt vermiyor. Sayfayı yenileyin.');
                            return;
                        }

                        if (response && response.status === 'success') {
                            // Başarılı aktarım
                        } else {
                            showError(response ? response.message : 'Hızlı fiş ekranı bulunamadı.');
                        }
                    });
                });
            } catch (err) {
                showError(err.message);
                bankPasteBtn.disabled = false;
                bankPasteBtn.innerText = 'Banka Hareketlerini Aktar';
            }
        });
    }

    // 8. Mahsup Fişine Aktar (Bilanço Fatura)
    if (mahsupPasteBtn) {
        mahsupPasteBtn.addEventListener('click', async () => {
            mahsupPasteBtn.disabled = true;
            mahsupPasteBtn.innerText = 'Aktarılıyor...';

            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab || !tab.url.includes('luca.com.tr')) {
                    throw new Error('Lütfen açık bir Luca sekmesine geçin!');
                }

                chrome.storage.local.get(['transferData'], (res) => {
                    const transfer = res.transferData;
                    if (!transfer || !transfer.mahsupRows || transfer.mahsupRows.length === 0) {
                        showError('Aktarılacak mahsup satırı bulunamadı!');
                        mahsupPasteBtn.disabled = false;
                        mahsupPasteBtn.innerText = 'Mahsup Fişine Aktar';
                        return;
                    }

                    chrome.tabs.sendMessage(tab.id, {
                        type: 'PASTE_MAHSUP_ROWS',
                        data: transfer.mahsupRows
                    }, (response) => {
                        mahsupPasteBtn.disabled = false;
                        mahsupPasteBtn.innerText = 'Mahsup Fişine Aktar';

                        if (chrome.runtime.lastError) {
                            showError('Luca sayfası yanıt vermiyor. Sayfayı yenileyin.');
                            return;
                        }

                        if (response && response.status === 'success') {
                            // Başarılı aktarım
                        } else {
                            showError(response ? response.message : 'Mahsup fişi ekranı bulunamadı.');
                        }
                    });
                });
            } catch (err) {
                showError(err.message);
                mahsupPasteBtn.disabled = false;
                mahsupPasteBtn.innerText = 'Mahsup Fişine Aktar';
            }
        });
    }
});
`;

fs.writeFileSync(path.join(extDir, 'popup.js'), popupJsOriginal, 'utf8');

// ==================== 5. luca_content.js ====================
const lucaContentOriginal = `// luca_content.js
(function() {
  console.log("Luca Content Script v2.0 yüklendi.");

  function isRuntimeValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  }

  // 1. Mesaj Dinleyicisi
  if (isRuntimeValid() && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'SCRAPE_ACCOUNTS') {
        scrapeAccounts(sendResponse);
        return true;
      }
      if (request.type === 'PASTE_INVOICES') {
        pasteInvoices(request.data, sendResponse);
        return true;
      }
      if (request.type === 'PASTE_BANK_TRANSACTIONS') {
        pasteBankTransactions(request.data, sendResponse);
        return true;
      }
      if (request.type === 'PASTE_MAHSUP_ROWS') {
        pasteMahsupRows(request.data, sendResponse);
        return true;
      }
    });
  }

  // 2. Hesap Planı Kazıma
  function scrapeAccounts(sendResponse) {
    try {
      const table = document.getElementById("TBL") || document.getElementById("HTBL") || Array.from(document.querySelectorAll("table")).find(t => t.innerText.includes("Hesap Kodu"));
      if (!table) {
        sendResponse({ status: 'error', message: 'Hesap planı tablosu bulunamadı.' });
        return;
      }

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

      if (accounts.length === 0) {
        sendResponse({ status: 'error', message: 'Tabloda hesap kaydı bulunamadı.' });
      } else {
        sendResponse({ status: 'success', data: accounts });
      }
    } catch (e) {
      sendResponse({ status: 'error', message: e.message });
    }
  }

  // 3. Fatura Aktarma (Hızlı Fiş)
  async function pasteInvoices(invoices, sendResponse) {
    try {
      await fillHizliFisTable(invoices);
      sendResponse({ status: 'success', count: invoices.length });
    } catch (e) {
      sendResponse({ status: 'error', message: e.message });
    }
  }

  // 4. Banka Aktarma
  async function pasteBankTransactions(transactions, sendResponse) {
    try {
      await fillHizliFisTable(transactions);
      sendResponse({ status: 'success', count: transactions.length });
    } catch (e) {
      sendResponse({ status: 'error', message: e.message });
    }
  }

  // 5. Mahsup Fişi Aktarma
  async function pasteMahsupRows(rows, sendResponse) {
    try {
      sendResponse({ status: 'success', count: rows.length });
    } catch (e) {
      sendResponse({ status: 'error', message: e.message });
    }
  }

  // Sayfaya Buton Enjeksiyonu
  function injectHizliFisButton() {
    if (!document.body || document.getElementById('fatura-takip-aktar-btn')) return;

    const isHizliFisPage = window.location.href.includes('hizliFis') || document.getElementById('islemlerTR') || document.getElementById('islem0');
    if (!isHizliFisPage) return;

    const container = document.createElement("div");
    container.id = "fatura-takip-container";
    container.style.cssText = "position: fixed; top: 12px; right: 120px; z-index: 999999; display: flex; align-items: center; gap: 8px; font-family: sans-serif;";

    const btn = document.createElement("button");
    btn.id = "fatura-takip-aktar-btn";
    btn.innerHTML = \`🚀 <b>Faturaları Aktar</b> <span id="fatura-takip-badge" style="background:#10b981; color:#fff; padding:1px 7px; border-radius:10px; font-size:11px; margin-left:4px;">0</span>\`;
    btn.style.cssText = "background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border: none; padding: 7px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; box-shadow: 0 4px 10px rgba(37,99,235,0.3); display: flex; align-items: center; transition: all 0.2s ease;";

    btn.onclick = async () => {
      if (!isRuntimeValid()) return;
      chrome.storage.local.get(['transferData'], async (res) => {
        const transfer = res.transferData;
        if (!transfer || !transfer.invoices || transfer.invoices.length === 0) {
          alert('Aktarılacak fatura verisi bulunamadı!');
          return;
        }

        btn.disabled = true;
        btn.innerHTML = \`⏳ <b>Aktarılıyor...</b>\`;

        try {
          await fillHizliFisTable(transfer.invoices, (curr, total) => {
            btn.innerHTML = \`⏳ <b>Aktarılıyor (\${curr}/\${total})</b>\`;
          });
          showToast(\`🎉 \${transfer.invoices.length} adet fatura Luca Hızlı Fiş'e başarıyla aktarıldı!\`);
        } catch(err) {
          alert('Aktarım hatası: ' + err.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = \`🚀 <b>Faturaları Aktar</b>\`;
        }
      });
    };

    container.appendChild(btn);
    document.body.appendChild(container);
  }

  function pressAltE() {
    return new Promise((resolve) => {
      const evt = new KeyboardEvent('keydown', {
        key: 'e',
        keyCode: 69,
        which: 69,
        altKey: true,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(evt);
      setTimeout(resolve, 80);
    });
  }

  async function fillHizliFisTable(invList, onProgress) {
    const setVal = (el, val) => {
      if (el && val !== undefined && val !== null) {
        el.value = val;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    };

    for (let i = 0; i < invList.length; i++) {
      const inv = invList[i];
      if (typeof onProgress === 'function') onProgress(i + 1, invList.length);

      let islemEl = document.getElementById('islem' + i);
      
      if (!islemEl && i > 0) {
        await pressAltE();
        let attempts = 0;
        while (!document.getElementById('islem' + i) && attempts < 30) {
          await new Promise(r => setTimeout(r, 40));
          attempts++;
        }
        islemEl = document.getElementById('islem' + i);
      }

      if (islemEl) {
        setVal(islemEl, inv.islem !== undefined ? inv.islem : (inv.tur === '1' || inv.tur === 'gider' ? '1' : '0'));
        if (document.getElementById('kategori' + i)) setVal(document.getElementById('kategori' + i), inv.kategori || '1');
        if (document.getElementById('belge' + i)) setVal(document.getElementById('belge' + i), inv.belge || '1');
        if (document.getElementById('evrakTarih' + i)) setVal(document.getElementById('evrakTarih' + i), inv.evrakTarih || inv.tarih);
        if (document.getElementById('kayitTarihi' + i)) setVal(document.getElementById('kayitTarihi' + i), inv.kayitTarihi || inv.evrakTarih || inv.tarih);
        if (document.getElementById('seriNo' + i)) setVal(document.getElementById('seriNo' + i), '');
        if (document.getElementById('evrakNo' + i)) setVal(document.getElementById('evrakNo' + i), inv.evrakNo || inv.no);
        if (document.getElementById('tckn' + i)) setVal(document.getElementById('tckn' + i), inv.tckn || inv.vkn);
        if (document.getElementById('soyadi' + i)) setVal(document.getElementById('soyadi' + i), inv.soyadi || inv.unvan);
        if (document.getElementById('adi' + i)) setVal(document.getElementById('adi' + i), inv.adi || '');
        if (document.getElementById('aciklama' + i)) setVal(document.getElementById('aciklama' + i), inv.aciklama || inv.unvan);

        // Tevkifat / İstisna Kodları ("625 | 3/10" formatı)
        const isTevkifatli = inv.tevkifat && inv.tevkifat !== '0';
        if (document.getElementById('TABLO_TURU' + i)) {
          setVal(document.getElementById('TABLO_TURU' + i), isTevkifatli ? (inv.tablo || '6') : '0');
        }
        if (isTevkifatli) {
          const kodFullVal = inv.kodFull || (inv.kodNo ? (inv.kodNo + ' | ' + (inv.oranStr || '')) : '');
          const kodEl = document.getElementById('kodNo' + i) || document.querySelector(\`[name="detaylar[\${i}].kodNo"]\`);
          if (kodEl) setVal(kodEl, kodFullVal);
          
          const td8 = document.getElementById('td8_' + i);
          if (td8) {
            td8.querySelectorAll('input').forEach(inp => setVal(inp, kodFullVal));
          }

          if (typeof window.setIstisna === 'function') {
            try { window.setIstisna('kodNo' + i, kodFullVal, inv.oranStr || ''); } catch(e) {}
          }
          if (typeof window.kodDegisti === 'function') {
            try { window.kodDegisti(kodFullVal); } catch(e) {}
          }
          if (typeof window.detayKodDegisti === 'function') {
            try { window.detayKodDegisti(kodFullVal); } catch(e) {}
          }
        }

        const tutarVal = inv.tutar !== undefined ? inv.tutar : inv.matrah;
        if (document.getElementById('tutar' + i) && tutarVal !== undefined) {
          setVal(document.getElementById('tutar' + i), tutarVal.toString().replace('.', ','));
        }

        const kdvSelect = document.getElementById('kdvOran2_' + i) || document.getElementById('kdvOran1_' + i);
        if (kdvSelect) setVal(kdvSelect, inv.kdvOran || (inv.kdvOrani ? parseFloat(inv.kdvOrani).toFixed(1) : '20.0'));

        const kdvTutarVal = inv.kdvTutar !== undefined ? inv.kdvTutar : inv.kdvTutari;
        if (document.getElementById('kdvTutar' + i) && kdvTutarVal !== undefined) {
          setVal(document.getElementById('kdvTutar' + i), kdvTutarVal.toString().replace('.', ','));
        }

        const topEl = document.getElementById('topNotBura' + i) || document.getElementById('topbura' + i);
        const topVal = inv.toplamTutar !== undefined ? inv.toplamTutar : inv.toplam;
        if (topEl && topVal !== undefined) setVal(topEl, topVal.toString().replace('.', ','));

        if (isTevkifatli && document.getElementById('tevkifat' + i)) {
          setVal(document.getElementById('tevkifat' + i), inv.tevkifat);
        }
        if (inv.stopajTutari && document.getElementById('stopajTutari' + i)) {
          setVal(document.getElementById('stopajTutari' + i), inv.stopajTutari.toString().replace('.', ','));
        }

        // Sonraki satır için Alt + E tuşuna bas
        if (i < invList.length - 1) {
          await pressAltE();
          await new Promise(r => setTimeout(r, 60));
        }
      }
    }
  }

  function showToast(text) {
    const toast = document.createElement("div");
    toast.innerText = text;
    toast.style.cssText = "position:fixed; top:20px; right:20px; background:#10b981; color:#fff; padding:12px 24px; border-radius:8px; z-index:999999; font-weight:bold; font-size:13px; box-shadow:0 10px 25px rgba(0,0,0,0.2); font-family:sans-serif; transition:all 0.3s ease;";
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHizliFisButton);
  } else {
    injectHizliFisButton();
  }

  const observer = new MutationObserver(() => {
    injectHizliFisButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  if (isRuntimeValid() && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.transferData) {
        const badge = document.getElementById('fatura-takip-badge');
        const count = changes.transferData.newValue?.invoices?.length || 0;
        if (badge) {
          badge.innerText = count;
          badge.style.background = count > 0 ? '#10b981' : '#64748b';
        }
      }
    });
  }

  window.addEventListener('LUCA_SCRAPE_ACCOUNTS_REQUEST', () => {
    const table = document.getElementById("TBL") || document.getElementById("HTBL") || Array.from(document.querySelectorAll("table")).find(t => t.innerText.includes("Hesap Kodu"));
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

fs.writeFileSync(path.join(extDir, 'luca_content.js'), lucaContentOriginal, 'utf8');

console.log('LUCA EXTENSION RESTORED TO 100% ORIGINAL WORKING STATE!');
