const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');

// ==================== 1. popup.js ====================
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

            // Fatura Kuyruğu (Hızlı Fiş - İşletme)
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

    // 5. Faturaları Aktar (Hızlı Fiş - İşletme)
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

    // 6. Mahsup Fişine Aktar (Bilanço Fatura)
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
                        if (chrome.runtime.lastError) {
                            showError('Luca sayfası yanıt vermiyor. Lütfen Muhasebe > Fiş İşlemleri > Fiş Girişi (Mahsup) ekranında olduğunuza emin olun.');
                        } else if (response && response.status === 'error') {
                            showError(response.message || 'Mahsup fişi aktarım hatası.');
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
fs.writeFileSync(path.join(extDir, 'popup.js'), popupJsCode, 'utf8');

// ==================== 2. luca_content.js ====================
const lucaContentCode = `// luca_content.js - Luca Otomasyon İçerik Scripti
(function() {
  console.log("Luca Content Script v2.4 yüklendi.");

  function isRuntimeValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  }

  // Mesaj Dinleyicisi
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

  // 1. Hesap Planı Kazıma
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

  // 2. Hızlı Fiş (İşletme) Aktarma
  async function pasteInvoices(invoices, sendResponse) {
    try {
      await fillHizliFisTable(invoices);
      sendResponse({ status: 'success', count: invoices.length });
    } catch (e) {
      sendResponse({ status: 'error', message: e.message });
    }
  }

  // 3. Banka Aktarma
  async function pasteBankTransactions(transactions, sendResponse) {
    try {
      await fillHizliFisTable(transactions);
      sendResponse({ status: 'success', count: transactions.length });
    } catch (e) {
      sendResponse({ status: 'error', message: e.message });
    }
  }

  // 4. Mahsup Fişi (Bilanço) Aktarma
  async function pasteMahsupRows(rows, sendResponse) {
    try {
      const res = await fillMahsupTable(rows);
      if (res && res.success) {
        showToast(\`🎉 \${rows.length} satır Mahsup Fişine başarıyla aktarıldı!\`);
        sendResponse({ status: 'success', count: rows.length });
      } else {
        sendResponse({ status: 'error', message: res?.error || 'Mahsup fişi tablosu bulunamadı. Lütfen "Fiş Girişi" ekranında olduğunuzdan emin olun.' });
      }
    } catch (e) {
      sendResponse({ status: 'error', message: e.message });
    }
  }

  // MAHSUP FİŞİ TABLOSUNU DOLDURMA MOTORU
  async function fillMahsupTable(rows) {
    // Fiş giriş sayfası document / iframe tespiti
    let targetDoc = document;
    if (window.frames && window.frames.frm3 && window.frames.frm3.document) {
      targetDoc = window.frames.frm3.document;
    } else {
      const frm3El = document.querySelector('#frm3, iframe[name="frm3"]');
      if (frm3El && frm3El.contentDocument) {
        targetDoc = frm3El.contentDocument;
      }
    }

    const scrollTbody = targetDoc.querySelector('#scroll tbody') || targetDoc.querySelector('#scroll') || targetDoc.querySelector('table tbody');
    let firstRow = targetDoc.getElementById('tr1') || targetDoc.querySelector('[id^="tr"]');

    if (!firstRow && !scrollTbody) {
      return { success: false, error: 'Luca Fiş Girişi tablosu bulunamadı. Lütfen Muhasebe > Fiş İşlemleri > Fiş Girişi (Mahsup) ekranını açın.' };
    }

    const setInputVal = (el, val) => {
      if (!el || val === undefined || val === null) return;
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
        // Yeni satır aç (Alt + E)
        targetDoc.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, keyCode: 69, which: 69, bubbles: true }));
        let attempts = 0;
        while (!targetDoc.getElementById('tr' + rowIdx) && attempts < 35) {
          await new Promise(res => setTimeout(res, 50));
          attempts++;
        }
        tr = targetDoc.getElementById('tr' + rowIdx);
      }

      if (tr) {
        // 1. Hesap Kodu
        const kodInput = tr.querySelector('[name*="HESAP_KODU"]') || tr.querySelector('.hesap-kodu') || (tr.children[1] ? tr.children[1].querySelector('input') : null);
        if (kodInput) {
          setInputVal(kodInput, r.muhasebeKodu || '');
          kodInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
        }

        // 2. Evrak No
        const evrakNoInput = tr.children[3] ? tr.children[3].querySelector('input') : null;
        if (evrakNoInput) setInputVal(evrakNoInput, r.evrakNo || '');

        // 3. Evrak Tarihi
        const evrakTarihInput = tr.children[4] ? tr.children[4].querySelector('input') : null;
        if (evrakTarihInput) setInputVal(evrakTarihInput, r.tarih || '');

        // 4. Belge Türü
        const belgeTurInput = tr.children[5] ? tr.children[5].querySelector('input') : null;
        if (belgeTurInput) setInputVal(belgeTurInput, r.belgeTuru || 'FT');

        // 5. Açıklama
        const aciklamaInput = tr.children[7] ? tr.children[7].querySelector('input') : null;
        if (aciklamaInput) setInputVal(aciklamaInput, r.aciklama || '');

        // 6. Borç / Alacak Tutar
        const rawNum = typeof r.tutar === 'number' ? r.tutar : parseFloat(String(r.tutar).replace(',', '.'));
        const formattedTutar = (!isNaN(rawNum) ? rawNum : 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const isBorc = r.tur === 'borc' || (r.borc && Number(r.borc) > 0);
        if (isBorc) {
          const borcInput = tr.children[8] ? tr.children[8].querySelector('input') : null;
          if (borcInput) setInputVal(borcInput, formattedTutar);
        } else {
          const alacakInput = tr.children[9] ? tr.children[9].querySelector('input') : null;
          if (alacakInput) setInputVal(alacakInput, formattedTutar);
        }

        // Sıradaki satır için Alt + E
        if (i < rows.length - 1) {
          targetDoc.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, keyCode: 69, which: 69, bubbles: true }));
          await new Promise(res => setTimeout(res, 60));
        }
      }
    }

    return { success: true };
  }

  // HIZLI FİŞ BUTON KONTROLÜ (SADECE GELİR/GİDER SAYFASINDA GÖZÜKÜR)
  function isHizliFisGelirGiderPage() {
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

    if (!isHizliFis) {
      if (existingContainer) existingContainer.remove();
      return;
    }

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
            alert('Aktarılacak fatura verisi bulunamadı!');
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
      const evt = new KeyboardEvent('keydown', { key: 'e', keyCode: 69, which: 69, altKey: true, bubbles: true, cancelable: true });
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

console.log('MAHSUP FİŞİ TABLO DOLDURMA MOTORU EKLENDİ VE GÜNCELLENDİ!');
