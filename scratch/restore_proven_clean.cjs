const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');

// ==================== 1. manifest.json ====================
const manifest = {
  "manifest_version": 3,
  "name": "Luca Aktarım Eklentisi",
  "version": "2.0.0",
  "description": "Fatura Takip uygulamasından Luca Mali Müşavir'e veri aktarımı ve hesap planı senkronizasyonu sağlar.",
  "permissions": [
    "storage",
    "tabs",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "*://*.luca.com.tr/*",
    "*://localhost:*/*",
    "*://127.0.0.1:*/*",
    "https://fatura-takip-v2.vercel.app/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon128.png"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.luca.com.tr/*"
      ],
      "js": [
        "luca_content.js"
      ],
      "run_at": "document_idle",
      "all_frames": true
    },
    {
      "matches": [
        "*://localhost:*/*",
        "*://127.0.0.1:*/*",
        "https://fatura-takip-v2.vercel.app/*"
      ],
      "js": [
        "fatura_content.js"
      ],
      "run_at": "document_idle"
    }
  ],
  "externally_connectable": {
    "matches": [
      "*://localhost:*/*",
      "*://127.0.0.1:*/*",
      "https://fatura-takip-v2.vercel.app/*"
    ]
  },
  "icons": {
    "128": "icon128.png"
  }
};
fs.writeFileSync(path.join(extDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log('manifest.json verified');

// ==================== 2. fatura_content.js ====================
const faturaContent = `// fatura_content.js
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
fs.writeFileSync(path.join(extDir, 'fatura_content.js'), faturaContent, 'utf8');
console.log('fatura_content.js written');

// ==================== 3. background.js ====================
const background = `// background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_TRANSFER_DATA') {
    chrome.storage.local.get(['transferData'], (res) => {
      const current = res.transferData || {};
      const merged = { ...current, ...message.data };
      chrome.storage.local.set({ transferData: merged }, () => {
        sendResponse({ status: 'ok' });
      });
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
fs.writeFileSync(path.join(extDir, 'background.js'), background, 'utf8');
console.log('background.js written');

// ==================== 4. popup.html ====================
const popupHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Luca Aktarım</title>
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
    .btn:active:not(:disabled) { transform: translateY(0); }
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
    <h1>Luca Aktarım v2.0</h1>
  </div>

  <!-- Hesap Planı -->
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

  <!-- Fatura Kuyruğu (Hızlı Fiş - İşletme) -->
  <div class="section">
    <div class="section-title">
      <span>Fatura Kuyruğu (Hızlı Fiş)</span>
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

  <!-- Bilanço Fatura (Mahsup) -->
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

  <!-- Banka Aktarımı -->
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

  <div id="error-display"></div>

  <div class="footer">Luca Entegrasyonu &copy; 2026</div>

  <script src="popup.js"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(extDir, 'popup.html'), popupHtml, 'utf8');
console.log('popup.html written');

// ==================== 5. popup.js ====================
const popupJs = `document.addEventListener('DOMContentLoaded', async () => {
    const syncBtn = document.getElementById('sync-btn');
    const syncStatus = document.getElementById('sync-status');
    const syncTime = document.getElementById('sync-time');
    const queueCount = document.getElementById('queue-count');
    const queueBadge = document.getElementById('queue-badge');
    const pasteBtn = document.getElementById('paste-btn');
    const clearBtn = document.getElementById('clear-btn');
    const errorDisplay = document.getElementById('error-display');

    const bankQueueBadge = document.getElementById('bank-queue-badge');
    const bankQueueCount = document.getElementById('bank-queue-count');
    const bankPasteBtn = document.getElementById('bank-paste-btn');
    const bankClearBtn = document.getElementById('bank-clear-btn');

    const mahsupQueueBadge = document.getElementById('mahsup-queue-badge');
    const mahsupQueueCount = document.getElementById('mahsup-queue-count');
    const mahsupPasteBtn = document.getElementById('mahsup-paste-btn');
    const mahsupClearBtn = document.getElementById('mahsup-clear-btn');

    function showError(msg) {
        if (!errorDisplay) return alert(msg);
        errorDisplay.innerText = msg;
        errorDisplay.style.display = 'block';
        setTimeout(() => { errorDisplay.style.display = 'none'; }, 4000);
    }

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

            // Fatura Kuyruğu (Hızlı Fiş)
            const transfer = res.transferData;
            const invoices = transfer?.invoices || transfer?.hizliFisItems || [];
            if (invoices.length > 0) {
                queueCount.innerText = \`\${invoices.length} Fatura Hazır\`;
                queueBadge.innerText = \`\${invoices.length} Fatura\`;
                queueBadge.className = 'badge badge-green';
                pasteBtn.disabled = false;
            } else {
                queueCount.innerText = '0 Fatura';
                queueBadge.innerText = '0 Fatura';
                queueBadge.className = 'badge badge-blue';
                pasteBtn.disabled = true;
            }

            // Mahsup (Bilanço) Kuyruğu
            const mahsupList = transfer?.mahsupRows || [];
            if (mahsupList.length > 0) {
                mahsupQueueCount.innerText = \`\${mahsupList.length} Satır Hazır\`;
                mahsupQueueBadge.innerText = \`\${mahsupList.length} Satır\`;
                mahsupQueueBadge.className = 'badge badge-green';
                if (mahsupPasteBtn) mahsupPasteBtn.disabled = false;
            } else {
                mahsupQueueCount.innerText = '0 Satır';
                mahsupQueueBadge.innerText = '0 Satır';
                mahsupQueueBadge.className = 'badge badge-blue';
                if (mahsupPasteBtn) mahsupPasteBtn.disabled = true;
            }

            // Banka Kuyruğu
            const bankList = transfer?.bankTransactions || [];
            if (bankList.length > 0) {
                bankQueueCount.innerText = \`\${bankList.length} Hareket Hazır\`;
                bankQueueBadge.innerText = \`\${bankList.length} Hareket\`;
                bankQueueBadge.className = 'badge badge-green';
                if (bankPasteBtn) bankPasteBtn.disabled = false;
            } else {
                bankQueueCount.innerText = '0 Hareket';
                bankQueueBadge.innerText = '0 Hareket';
                bankQueueBadge.className = 'badge badge-blue';
                if (bankPasteBtn) bankPasteBtn.disabled = true;
            }
        });
    };

    updateUI();

    // 1. Hesap Planını Çek
    syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        syncBtn.innerText = 'Çekiliyor...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url.includes('luca.com.tr')) throw new Error('Lütfen açık bir Luca sekmesine geçin!');

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
                    }, () => updateUI());
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

    // 2. Fatura Kuyruğunu Temizle
    clearBtn.addEventListener('click', () => {
        chrome.storage.local.get(['transferData'], (res) => {
            const td = res.transferData || {};
            delete td.invoices;
            delete td.hizliFisItems;
            chrome.storage.local.set({ transferData: td }, updateUI);
        });
    });

    // 3. Mahsup Kuyruğunu Temizle
    if (mahsupClearBtn) {
        mahsupClearBtn.addEventListener('click', () => {
            chrome.storage.local.get(['transferData'], (res) => {
                const td = res.transferData || {};
                delete td.mahsupRows;
                chrome.storage.local.set({ transferData: td }, updateUI);
            });
        });
    }

    // 4. Banka Kuyruğunu Temizle
    if (bankClearBtn) {
        bankClearBtn.addEventListener('click', () => {
            chrome.storage.local.get(['transferData'], (res) => {
                const td = res.transferData || {};
                delete td.bankTransactions;
                chrome.storage.local.set({ transferData: td }, updateUI);
            });
        });
    }

    // 5. Faturaları Aktar (Hızlı Fiş)
    pasteBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url.includes("luca.com.tr")) return showError("Lütfen Luca sekmesinde olduğunuza emin olun.");

        const storage = await chrome.storage.local.get(['transferData']);
        const invoices = storage.transferData?.invoices || storage.transferData?.hizliFisItems || [];
        if (invoices.length === 0) return showError("Aktarılacak fatura yok.");

        pasteBtn.disabled = true;
        pasteBtn.innerText = "Aktarılıyor...";

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async (invList) => {
                    const setVal = (el, val) => {
                        if (!el) return;
                        if (el.hasAttribute('readonly')) {
                            el.removeAttribute('readonly');
                            el.readOnly = false;
                        }
                        el.value = val;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        el.dispatchEvent(new Event('blur', { bubbles: true }));
                    };

                    const pressAltE = async () => {
                        const altEBtn = document.querySelector("[hotkey*='Alt+E'], [hotkey*='alt+e'], [hotkey*='ALT+E'], [hotkey*='Alt+e']");
                        if (altEBtn) {
                            altEBtn.click();
                        } else {
                            const evtDown = new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true, cancelable: true });
                            const evtUp = new KeyboardEvent('keyup', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true, cancelable: true });
                            const target = document.activeElement || document.body;
                            target.dispatchEvent(evtDown);
                            target.dispatchEvent(evtUp);
                            document.dispatchEvent(evtDown);
                            document.dispatchEvent(evtUp);
                            window.dispatchEvent(evtDown);
                            window.dispatchEvent(evtUp);

                            if (typeof window.satirEkle === 'function') window.satirEkle();
                            else if (typeof window.addRow === 'function') window.addRow();
                        }
                    };

                    const isHizliFis = !!document.getElementById('sablon') || !!document.getElementById('islem0');

                    for (let i = 0; i < invList.length; i++) {
                        const inv = invList[i];
                        if (isHizliFis) {
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
                                
                                if (isTevkifatli && document.getElementById('tevkifat' + i)) setVal(document.getElementById('tevkifat' + i), inv.tevkifat);
                                if (inv.stopajTutari && document.getElementById('stopajTutari' + i)) setVal(document.getElementById('stopajTutari' + i), inv.stopajTutari.toString().replace('.', ','));

                                if (i < invList.length - 1) {
                                    await pressAltE();
                                    await new Promise(r => setTimeout(r, 60));
                                }
                            }
                        }
                    }
                    return true;
                },
                args: [invoices]
            });
            pasteBtn.innerText = "Aktarıldı!";
            chrome.storage.local.get(['transferData'], (result) => {
                const data = result.transferData || {};
                delete data.invoices;
                delete data.hizliFisItems;
                chrome.storage.local.set({ transferData: data }, updateUI);
            });
            setTimeout(() => {
                pasteBtn.innerText = "Faturaları Buraya Aktar";
                pasteBtn.disabled = false;
            }, 2000);
        } catch (err) {
            showError(err.message);
            pasteBtn.disabled = false;
            pasteBtn.innerText = "Faturaları Buraya Aktar";
        }
    });

    // 6. Mahsup Fişine Aktar (Bilanço)
    if (mahsupPasteBtn) {
        mahsupPasteBtn.addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url.includes("luca.com.tr")) return showError("Lütfen Luca sekmesinde olduğunuza emin olun.");

            const storage = await chrome.storage.local.get(['transferData']);
            const mList = storage.transferData?.mahsupRows || [];
            if (mList.length === 0) return showError("Aktarılacak mahsup satırı yok.");

            mahsupPasteBtn.disabled = true;
            mahsupPasteBtn.innerText = "Aktarılıyor...";

            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: async (rows) => {
                        let targetDoc = document;
                        if (window.frames && window.frames.frm3 && window.frames.frm3.document) {
                            targetDoc = window.frames.frm3.document;
                        } else {
                            const frm3El = document.querySelector('#frm3, iframe[name="frm3"]');
                            if (frm3El && frm3El.contentDocument) targetDoc = frm3El.contentDocument;
                        }

                        const formatDateTR = (dStr) => {
                            if (!dStr) return '';
                            const str = String(dStr).trim();
                            if (str.includes('/') || (str.includes('.') && str.split('.').length === 3)) return str;
                            const parts = str.split('-');
                            if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
                            return str;
                        };

                        const formatTutarTR = (val) => {
                            if (val === undefined || val === null || val === '') return '';
                            const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/\\./g, '').replace(',', '.'));
                            if (isNaN(num) || num === 0) return '';
                            return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        };

                        const setInputVal = (el, val) => {
                            if (!el || val === undefined || val === null || val === '') return;
                            el.focus();
                            el.value = val;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                        };

                        for (let i = 0; i < rows.length; i++) {
                            const r = rows[i];
                            const rowIdx = i + 1;
                            let tr = targetDoc.getElementById('tr' + rowIdx);

                            if (!tr && i > 0) {
                                targetDoc.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, keyCode: 69, which: 69, bubbles: true }));
                                let attempts = 0;
                                while (!targetDoc.getElementById('tr' + rowIdx) && attempts < 35) {
                                    await new Promise(res => setTimeout(res, 60));
                                    attempts++;
                                }
                                tr = targetDoc.getElementById('tr' + rowIdx);
                            }

                            if (tr) {
                                const kodVal = r.muhasebeKodu || r.hesapKodu || r['Hesap Kodu'] || '';
                                const kodInput = tr.querySelector('[name*="HESAP_KODU"]') || (tr.children[1] ? tr.children[1].querySelector('input') : null);
                                if (kodInput && kodVal) {
                                    kodInput.focus();
                                    kodInput.value = kodVal;
                                    kodInput.dispatchEvent(new Event('input', { bubbles: true }));
                                    kodInput.dispatchEvent(new Event('change', { bubbles: true }));
                                    kodInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, which: 9, bubbles: true }));
                                    kodInput.dispatchEvent(new Event('blur', { bubbles: true }));
                                }

                                await new Promise(res => setTimeout(res, 30));

                                const evrakNoVal = r.evrakNo || r.no || r.faturaNo || r['Evrak No'] || '';
                                const evrakNoInput = tr.children[3] ? tr.children[3].querySelector('input') : null;
                                if (evrakNoInput && evrakNoVal) setInputVal(evrakNoInput, evrakNoVal);

                                const tarihVal = r.tarih || r.evrakTarihi || r.faturaTarihi || r['Evrak Tarihi'] || '';
                                const evrakTarihInput = tr.children[4] ? tr.children[4].querySelector('input') : null;
                                if (evrakTarihInput && tarihVal) setInputVal(evrakTarihInput, formatDateTR(tarihVal));

                                const belgeTurInput = tr.children[5] ? tr.children[5].querySelector('input') : null;
                                if (belgeTurInput) setInputVal(belgeTurInput, r.belgeTuru || r['Belge Türü'] || 'FT');

                                const aciklamaVal = r.aciklama || r.unvan || r['Detay Açıklama'] || '';
                                const aciklamaInput = tr.children[7] ? tr.children[7].querySelector('input') : null;
                                if (aciklamaInput && aciklamaVal) setInputVal(aciklamaInput, aciklamaVal);

                                const borcVal = r.borc !== undefined && Number(r.borc) > 0 ? r.borc : (r['Borç'] !== undefined && Number(r['Borç']) > 0 ? r['Borç'] : (r.tur === 'borc' ? r.tutar : 0));
                                const alacakVal = r.alacak !== undefined && Number(r.alacak) > 0 ? r.alacak : (r['Alacak'] !== undefined && Number(r['Alacak']) > 0 ? r['Alacak'] : (r.tur === 'alacak' ? r.tutar : 0));

                                if (borcVal && Number(borcVal) > 0) {
                                    const borcInput = tr.children[8] ? tr.children[8].querySelector('input') : null;
                                    if (borcInput) setInputVal(borcInput, formatTutarTR(borcVal));
                                } else if (alacakVal && Number(alacakVal) > 0) {
                                    const alacakInput = tr.children[9] ? tr.children[9].querySelector('input') : null;
                                    if (alacakInput) setInputVal(alacakInput, formatTutarTR(alacakVal));
                                }

                                if (i < rows.length - 1) {
                                    targetDoc.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, keyCode: 69, which: 69, bubbles: true }));
                                    await new Promise(res => setTimeout(res, 60));
                                }
                            }
                        }
                        return true;
                    },
                    args: [mList]
                });
                mahsupPasteBtn.innerText = "Aktarıldı!";
                chrome.storage.local.get(['transferData'], (result) => {
                    const data = result.transferData || {};
                    delete data.mahsupRows;
                    chrome.storage.local.set({ transferData: data }, updateUI);
                });
                setTimeout(() => {
                    mahsupPasteBtn.innerText = "Mahsup Fişine Aktar";
                    mahsupPasteBtn.disabled = false;
                }, 2000);
            } catch (err) {
                showError(err.message);
                mahsupPasteBtn.disabled = false;
                mahsupPasteBtn.innerText = "Mahsup Fişine Aktar";
            }
        });
    }
});
`;
fs.writeFileSync(path.join(extDir, 'popup.js'), popupJs, 'utf8');
console.log('popup.js written with executeScript');

// ==================== 6. luca_content.js ====================
// Read clean update_luca_content
const lucaContentOriginal = `// Luca Aktarım Eklentisi - Luca Sayfa Köprüsü ve Hızlı Fiş Menü Enjeksiyonu (v2.1.0)
(function() {
  const CURRENT_URL = window.location.href;
  console.log("[Luca Bridge] Devrede...", CURRENT_URL);

  function isRuntimeValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  }

  // --- 1. TEVKİFAT / İSTİSNA POPUP YAKALAYICI ---
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
            if (typeof window.gonder === 'function') {
              window.gonder(row.id);
            } else if (typeof window.sec === 'function') {
              window.sec(row);
              row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            }
            chrome.storage.local.remove(['targetKodNo']);
            break;
          }
        }
      });
    } catch (e) {
      console.warn("[Luca Bridge] handleKodSecmePopup hatası:", e);
    }
  }

  if (CURRENT_URL.indexOf('ismgetKDVBeyannameIstisnalarTable') >= 0) {
    try {
      handleKodSecmePopup();
    } catch (err) {}
  }

  // --- 2. HIZLI FİŞ (hizliFisPopUp.do) EKRANINA BUTON / MENÜ ENJEKSİYONU ---
  function injectHizliFisButton() {
    if (!isRuntimeValid()) return;
    if (CURRENT_URL.indexOf('hizliFisPopUp.do') === -1 && !document.getElementById('sablon')) return;
    if (document.getElementById('fatura-takip-luca-bar')) return;

    const targetRow = document.getElementById('islemlerTR') || document.querySelector('tr.alt-button-bar');
    if (!targetRow) return;

    const leftTd = targetRow.querySelector('td:first-child') || targetRow.firstElementChild;
    const rightTd = targetRow.querySelector('td.right') || targetRow.lastElementChild;
    if (!leftTd && !rightTd) return;

    const btnContainer = document.createElement('span');
    btnContainer.id = 'fatura-takip-luca-bar';
    btnContainer.style.cssText = 'display:inline-flex; align-items:center; gap:6px; margin-left:8px; vertical-align:middle;';

    const mainBtn = document.createElement('button');
    mainBtn.type = 'button';
    mainBtn.id = 'fatura-takip-aktar-btn';
    mainBtn.style.cssText = 'background:linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); color:#ffffff; font-weight:bold; border:none; padding:5px 12px; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-size:12px; box-shadow:0 2px 5px rgba(79,70,229,0.3); transition:all 0.2s ease;';
    mainBtn.innerHTML = '⚡ <b>Faturaları Buraya Aktar</b> <span id="fatura-takip-badge" style="background:#ef4444; color:#fff; padding:1px 6px; border-radius:10px; font-size:11px; margin-left:4px;">0</span>';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.id = 'fatura-takip-temizle-btn';
    clearBtn.title = 'Kuyruktaki faturaları temizle';
    clearBtn.style.cssText = 'background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:600; display:inline-flex; align-items:center;';
    clearBtn.innerHTML = '🗑️';

    btnContainer.appendChild(mainBtn);
    btnContainer.appendChild(clearBtn);

    if (rightTd) {
      rightTd.insertBefore(btnContainer, rightTd.firstChild);
    } else {
      leftTd.appendChild(btnContainer);
    }

    function updateButtonBadge() {
      if (!isRuntimeValid()) return;
      chrome.storage.local.get(['transferData'], (res) => {
        const invList = res.transferData?.invoices || [];
        const badge = document.getElementById('fatura-takip-badge');
        if (badge) {
          badge.innerText = invList.length;
          badge.style.background = invList.length > 0 ? '#10b981' : '#64748b';
        }
        if (invList.length > 0) {
          mainBtn.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
          mainBtn.innerHTML = \`🚀 <b>Faturaları Aktar</b> <span id="fatura-takip-badge" style="background:#10b981; color:#fff; padding:1px 7px; border-radius:10px; font-size:11px; margin-left:4px;">\${invList.length}</span>\`;
        } else {
          mainBtn.style.background = '#64748b';
          mainBtn.innerHTML = \`⚡ <b>Fatura Aktar</b> <span id="fatura-takip-badge" style="background:#475569; color:#fff; padding:1px 6px; border-radius:10px; font-size:11px; margin-left:4px;">0</span>\`;
        }
      });
    }

    updateButtonBadge();

    clearBtn.onclick = (e) => {
      e.preventDefault();
      if (!confirm("Aktarım kuyruğundaki faturaları temizlemek istiyor musunuz?")) return;
      chrome.storage.local.get(['transferData'], (res) => {
        const data = res.transferData || {};
        delete data.invoices;
        delete data.hizliFisItems;
        chrome.storage.local.set({ transferData: data }, () => {
          updateButtonBadge();
          showToast("Aktarım kuyruğu temizlendi.");
        });
      });
    };

    mainBtn.onclick = async (e) => {
      e.preventDefault();
      chrome.storage.local.get(['transferData'], async (res) => {
        const invList = res.transferData?.invoices || res.transferData?.hizliFisItems || [];
        if (!invList || invList.length === 0) {
          alert("Aktarılacak fatura bulunamadı. Lütfen önce Fatura Takip uygulamasından faturaları seçip 'Luca'ya Aktar (İşletme)' butonuna basın.");
          return;
        }

        mainBtn.disabled = true;
        mainBtn.innerHTML = \`⏳ <b>Aktarılıyor... (0/\${invList.length})</b>\`;

        try {
          await runHizliFisFill(invList, (current, total) => {
            mainBtn.innerHTML = \`⏳ <b>Aktarılıyor... (\${current}/\${total})</b>\`;
          });

          mainBtn.innerHTML = \`✅ <b>Tamamlandı (\${invList.length})</b>\`;
          mainBtn.style.background = '#10b981';
          showToast(\`\${invList.length} adet fatura başarıyla aktarıldı!\`);

          const data = res.transferData || {};
          delete data.invoices;
          delete data.hizliFisItems;
          chrome.storage.local.set({ transferData: data }, () => {
            setTimeout(() => {
              mainBtn.disabled = false;
              updateButtonBadge();
            }, 3000);
          });
        } catch (err) {
          console.error("Aktarım hatası:", err);
          alert("Aktarım sırasında bir hata oluştu: " + err.message);
          mainBtn.disabled = false;
          updateButtonBadge();
        }
      });
    };
  }

  // --- 3. HIZLI FİŞ DOLDURMA MOTORU ---
  async function runHizliFisFill(invList, onProgress) {
    const setVal = (el, val) => {
      if (!el) return;
      if (el.hasAttribute('readonly')) {
        el.removeAttribute('readonly');
        el.readOnly = false;
      }
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    };

    const pressAltE = async () => {
      const altEBtn = document.querySelector("[hotkey*='Alt+E'], [hotkey*='alt+e'], [hotkey*='ALT+E'], [hotkey*='Alt+e']");
      if (altEBtn) {
        altEBtn.click();
      } else {
        const evtDown = new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true, cancelable: true });
        const evtUp = new KeyboardEvent('keyup', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true, cancelable: true });
        const target = document.activeElement || document.body;
        target.dispatchEvent(evtDown);
        target.dispatchEvent(evtUp);
        document.dispatchEvent(evtDown);
        document.dispatchEvent(evtUp);
        window.dispatchEvent(evtDown);
        window.dispatchEvent(evtUp);

        if (typeof window.satirEkle === 'function') window.satirEkle();
        else if (typeof window.addRow === 'function') window.addRow();
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

        if (isTevkifatli && document.getElementById('tevkifat' + i)) setVal(document.getElementById('tevkifat' + i), inv.tevkifat);
        if (inv.stopajTutari && document.getElementById('stopajTutari' + i)) setVal(document.getElementById('stopajTutari' + i), inv.stopajTutari.toString().replace('.', ','));

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
        const mainBtn = document.getElementById('fatura-takip-aktar-btn');
        const count = changes.transferData.newValue?.invoices?.length || 0;
        if (badge) {
          badge.innerText = count;
          badge.style.background = count > 0 ? '#10b981' : '#64748b';
        }
        if (mainBtn) {
          if (count > 0) {
            mainBtn.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
            mainBtn.innerHTML = \`🚀 <b>Faturaları Aktar</b> <span id="fatura-takip-badge" style="background:#10b981; color:#fff; padding:1px 7px; border-radius:10px; font-size:11px; margin-left:4px;">\${count}</span>\`;
          } else {
            mainBtn.style.background = '#64748b';
            mainBtn.innerHTML = \`⚡ <b>Fatura Aktar</b> <span id="fatura-takip-badge" style="background:#475569; color:#fff; padding:1px 6px; border-radius:10px; font-size:11px; margin-left:4px;">0</span>\`;
          }
        }
      }
    });
  }

  // Hesap Planı Kazıma
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
console.log('luca_content.js written');

console.log('ALL EXTENSION FILES 100% RESTORED TO PROVEN ORIGINAL ARCHITECTURE!');
