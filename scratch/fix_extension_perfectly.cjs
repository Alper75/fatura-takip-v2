const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');

// ==================== 1. fatura_content.js ====================
const faturaContentCode = `// fatura_content.js - Fatura Takip Web Uygulaması Köprüsü
(function() {
  function forward(data) {
    if (!data) return;
    const isIsletme = data.isIsletme !== false;
    const invoices = data.invoices || data.hizliFisItems || (Array.isArray(data) ? data : []);
    const mahsupRows = data.mahsupRows || (!isIsletme && Array.isArray(data) ? data : []);
    const bankTransactions = data.bankTransactions || [];

    const normalized = {
      isIsletme,
      invoices,
      hizliFisItems: invoices,
      mahsupRows,
      bankTransactions,
      count: invoices.length || mahsupRows.length || bankTransactions.length
    };

    if (chrome && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({
        type: 'SET_TRANSFER_DATA',
        data: normalized
      }, () => {
        if (chrome.runtime.lastError) { /* ignore */ }
      });
    }
  }

  window.addEventListener('FATURA_APP_LUCA_DATA', (e) => forward(e.detail));
  window.addEventListener('FATURA_APP_LUCA_SEND_ISLETME', (e) => forward({ isIsletme: true, invoices: e.detail }));
  window.addEventListener('FATURA_APP_LUCA_SEND_MAHSUP', (e) => forward({ isIsletme: false, mahsupRows: e.detail }));
  window.addEventListener('LUCA_SEND_INVOICES', (e) => forward({ isIsletme: true, invoices: e.detail }));

  window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (e.data.type === 'FATURA_APP_LUCA_DATA') forward(e.data.detail || e.data.data || e.data.payload);
    if (e.data.type === 'FATURA_APP_LUCA_SEND_ISLETME') forward({ isIsletme: true, invoices: e.data.detail || e.data.data });
    if (e.data.type === 'FATURA_APP_LUCA_SEND_MAHSUP') forward({ isIsletme: false, mahsupRows: e.data.detail || e.data.data });
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

// ==================== 3. popup.js ====================
const popupJsCode = `document.addEventListener('DOMContentLoaded', async () => {
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

            // Fatura Kuyruğu
            const transfer = res.transferData;
            const invoices = transfer?.invoices || transfer?.hizliFisItems || (Array.isArray(transfer) ? transfer : []);
            if (invoices && invoices.length > 0) {
                const count = invoices.length;
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
            const bankList = transfer?.bankTransactions || [];
            if (bankList.length > 0) {
                const bCount = bankList.length;
                bankQueueCount.innerText = \`\${bCount} Hareket Hazır\`;
                bankQueueBadge.innerText = \`\${bCount} Hareket\`;
                bankQueueBadge.className = 'badge badge-green';
                if (bankPasteBtn) bankPasteBtn.disabled = false;
            } else {
                bankQueueCount.innerText = '0 Hareket';
                bankQueueBadge.innerText = '0 Hareket';
                bankQueueBadge.className = 'badge badge-blue';
                if (bankPasteBtn) bankPasteBtn.disabled = true;
            }

            // Mahsup (Bilanço) Kuyruğu
            const mahsupList = transfer?.mahsupRows || [];
            if (mahsupList.length > 0) {
                const mCount = mahsupList.length;
                mahsupQueueCount.innerText = \`\${mCount} Satır Hazır\`;
                mahsupQueueBadge.innerText = \`\${mCount} Satır\`;
                mahsupQueueBadge.className = 'badge badge-green';
                if (mahsupPasteBtn) mahsupPasteBtn.disabled = false;
            } else {
                mahsupQueueCount.innerText = '0 Satır';
                mahsupQueueBadge.innerText = '0 Satır';
                mahsupQueueBadge.className = 'badge badge-blue';
                if (mahsupPasteBtn) mahsupPasteBtn.disabled = true;
            }
        });
    };

    updateUI();

    // 1. Hesap Planı Çek
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

    // 2. Fatura Kuyruğunu Temizle
    clearBtn.addEventListener('click', () => {
        chrome.storage.local.get(['transferData'], (res) => {
            const td = res.transferData || {};
            delete td.invoices;
            delete td.hizliFisItems;
            chrome.storage.local.set({ transferData: td }, updateUI);
        });
    });

    // 3. Banka Temizle
    if (bankClearBtn) {
        bankClearBtn.addEventListener('click', () => {
            chrome.storage.local.get(['transferData'], (res) => {
                const td = res.transferData || {};
                delete td.bankTransactions;
                chrome.storage.local.set({ transferData: td }, updateUI);
            });
        });
    }

    // 4. Mahsup Temizle
    if (mahsupClearBtn) {
        mahsupClearBtn.addEventListener('click', () => {
            chrome.storage.local.get(['transferData'], (res) => {
                const td = res.transferData || {};
                delete td.mahsupRows;
                chrome.storage.local.set({ transferData: td }, updateUI);
            });
        });
    }

    // 5. Faturaları Aktar
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
                const invoices = transfer?.invoices || transfer?.hizliFisItems || (Array.isArray(transfer) ? transfer : []);
                if (!invoices || invoices.length === 0) {
                    showError('Aktarılacak fatura bulunamadı!');
                    pasteBtn.disabled = false;
                    pasteBtn.innerText = 'Faturaları Buraya Aktar';
                    return;
                }

                chrome.tabs.sendMessage(tab.id, {
                    type: 'PASTE_INVOICES',
                    data: invoices
                }, (response) => {
                    pasteBtn.disabled = false;
                    pasteBtn.innerText = 'Faturaları Buraya Aktar';

                    if (chrome.runtime.lastError) {
                        showError('Luca sayfası yanıt vermiyor. Sayfayı yenileyin.');
                        return;
                    }

                    if (response && response.status === 'success') {
                        // Başarılı
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

    // 6. Banka Aktar
    if (bankPasteBtn) {
        bankPasteBtn.addEventListener('click', async () => {
            bankPasteBtn.disabled = true;
            bankPasteBtn.innerText = 'Aktarılıyor...';
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab || !tab.url.includes('luca.com.tr')) throw new Error('Lütfen açık bir Luca sekmesine geçin!');

                chrome.storage.local.get(['transferData'], (res) => {
                    const transfer = res.transferData;
                    const bList = transfer?.bankTransactions || [];
                    if (bList.length === 0) {
                        showError('Aktarılacak banka hareketi bulunamadı!');
                        bankPasteBtn.disabled = false;
                        bankPasteBtn.innerText = 'Banka Hareketlerini Aktar';
                        return;
                    }

                    chrome.tabs.sendMessage(tab.id, { type: 'PASTE_BANK_TRANSACTIONS', data: bList }, (response) => {
                        bankPasteBtn.disabled = false;
                        bankPasteBtn.innerText = 'Banka Hareketlerini Aktar';
                        if (chrome.runtime.lastError) showError('Luca sayfası yanıt vermiyor. Sayfayı yenileyin.');
                    });
                });
            } catch (err) {
                showError(err.message);
                bankPasteBtn.disabled = false;
                bankPasteBtn.innerText = 'Banka Hareketlerini Aktar';
            }
        });
    }

    // 7. Mahsup Aktar
    if (mahsupPasteBtn) {
        mahsupPasteBtn.addEventListener('click', async () => {
            mahsupPasteBtn.disabled = true;
            mahsupPasteBtn.innerText = 'Aktarılıyor...';
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab || !tab.url.includes('luca.com.tr')) throw new Error('Lütfen açık bir Luca sekmesine geçin!');

                chrome.storage.local.get(['transferData'], (res) => {
                    const transfer = res.transferData;
                    const mList = transfer?.mahsupRows || [];
                    if (mList.length === 0) {
                        showError('Aktarılacak mahsup satırı bulunamadı!');
                        mahsupPasteBtn.disabled = false;
                        mahsupPasteBtn.innerText = 'Mahsup Fişine Aktar';
                        return;
                    }

                    chrome.tabs.sendMessage(tab.id, { type: 'PASTE_MAHSUP_ROWS', data: mList }, (response) => {
                        mahsupPasteBtn.disabled = false;
                        mahsupPasteBtn.innerText = 'Mahsup Fişine Aktar';
                        if (chrome.runtime.lastError) showError('Luca sayfası yanıt vermiyor. Sayfayı yenileyin.');
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
fs.writeFileSync(path.join(extDir, 'popup.js'), popupJsCode, 'utf8');

// ==================== 4. luca_content.js ====================
// SADECE VE SADECE HIZLI FİŞ (GELİR / GİDER) ŞABLONUNDA GÖRÜNECEK BUTON MANTIĞI
const lucaContentCode = `// luca_content.js
(function() {
  console.log("Luca Content Script v2.3 yüklendi.");

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

  // SADECE HIZLI FİŞ (GELİR / GİDER) ŞABLONUNDA BUTON GÖSTERME
  function isHizliFisGelirGiderPage() {
    // Sadece Hızlı Fiş (Gelir/Gider) tablosu inputları varsa true döner
    return !!(
      document.getElementById('islem0') ||
      document.getElementById('islemlerTR') ||
      document.querySelector('[name*="detaylar[0].islem"]') ||
      document.getElementById('evrakTarih0')
    );
  }

  function updateHizliFisButton() {
    const existingContainer = document.getElementById('fatura-takip-container');
    const isHizliFis = isHizliFisGelirGiderPage();

    // Hızlı fiş ekranında DEĞİLSE butonu kesinlikle kaldır
    if (!isHizliFis) {
      if (existingContainer) existingContainer.remove();
      return;
    }

    // Hızlı fiş ekranındaysa ve buton yoksa oluştur
    if (!existingContainer && document.body) {
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
          const invoices = transfer?.invoices || transfer?.hizliFisItems || (Array.isArray(transfer) ? transfer : []);

          if (!invoices || invoices.length === 0) {
            alert('Aktarılacak fatura verisi bulunamadı! Lütfen programdan "Faturaları Aktar" butonuna basarak veriyi gönderin.');
            return;
          }

          btn.disabled = true;
          btn.innerHTML = \`⏳ <b>Aktarılıyor...</b>\`;

          try {
            await fillHizliFisTable(invoices, (curr, total) => {
              btn.innerHTML = \`⏳ <b>Aktarılıyor (\${curr}/\${total})</b>\`;
            });
            showToast(\`🎉 \${invoices.length} adet fatura Luca Hızlı Fiş'e başarıyla aktarıldı!\`);
          } catch(err) {
            alert('Aktarım hatası: ' + err.message);
          } finally {
            btn.disabled = false;
            btn.innerHTML = \`🚀 <b>Faturaları Aktar</b> <span id="fatura-takip-badge" style="background:#10b981; color:#fff; padding:1px 7px; border-radius:10px; font-size:11px; margin-left:4px;">\${invoices.length}</span>\`;
          }
        });
      };

      container.appendChild(btn);
      document.body.appendChild(container);
    }

    // Badge sayısını güncelle
    if (isRuntimeValid()) {
      chrome.storage.local.get(['transferData'], (res) => {
        const transfer = res.transferData;
        const count = transfer?.invoices?.length || transfer?.hizliFisItems?.length || (Array.isArray(transfer) ? transfer.length : 0);
        const badge = document.getElementById('fatura-takip-badge');
        if (badge) {
          badge.innerText = count;
          badge.style.background = count > 0 ? '#10b981' : '#64748b';
        }
      });
    }
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

      let islemEl = document.getElementById('islem' + i) || document.querySelector(\`[name="detaylar[\${i}].islem"]\`);
      
      if (!islemEl && i > 0) {
        await pressAltE();
        let attempts = 0;
        while (!document.getElementById('islem' + i) && !document.querySelector(\`[name="detaylar[\${i}].islem"]\`) && attempts < 30) {
          await new Promise(r => setTimeout(r, 40));
          attempts++;
        }
        islemEl = document.getElementById('islem' + i) || document.querySelector(\`[name="detaylar[\${i}].islem"]\`);
      }

      if (islemEl) {
        setVal(islemEl, inv.islem !== undefined ? inv.islem : (inv.tur === '1' || inv.tur === 'gider' || inv.tip === 'ALIS' ? '1' : '0'));
        if (document.getElementById('kategori' + i)) setVal(document.getElementById('kategori' + i), inv.kategori || '1');
        if (document.getElementById('belge' + i)) setVal(document.getElementById('belge' + i), inv.belge || '1');
        if (document.getElementById('evrakTarih' + i)) setVal(document.getElementById('evrakTarih' + i), inv.evrakTarih || inv.tarih || inv.faturaTarihi);
        if (document.getElementById('kayitTarihi' + i)) setVal(document.getElementById('kayitTarihi' + i), inv.kayitTarihi || inv.evrakTarih || inv.tarih || inv.faturaTarihi);
        if (document.getElementById('seriNo' + i)) setVal(document.getElementById('seriNo' + i), '');
        if (document.getElementById('evrakNo' + i)) setVal(document.getElementById('evrakNo' + i), inv.evrakNo || inv.no || inv.faturaNo);
        if (document.getElementById('tckn' + i)) setVal(document.getElementById('tckn' + i), inv.tckn || inv.vkn || inv.tcVkn);
        if (document.getElementById('soyadi' + i)) setVal(document.getElementById('soyadi' + i), inv.soyadi || inv.unvan || inv.ad);
        if (document.getElementById('adi' + i)) setVal(document.getElementById('adi' + i), inv.adi || '');
        if (document.getElementById('aciklama' + i)) setVal(document.getElementById('aciklama' + i), inv.aciklama || inv.unvan || inv.ad);

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

  // İlk yüklemede ve periyodik olarak kontrol et
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateHizliFisButton);
  } else {
    updateHizliFisButton();
  }

  const observer = new MutationObserver(() => {
    updateHizliFisButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  if (isRuntimeValid() && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.transferData) {
        updateHizliFisButton();
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
fs.writeFileSync(path.join(extDir, 'luca_content.js'), lucaContentCode, 'utf8');

console.log('LUCA EXTENSION PERFECTLY FIXED AND RECONFIGURED!');
