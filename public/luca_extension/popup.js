// popup.js - Luca Aktarım, Hesap Planı & Otomatik Cari Açma Yönetimi (v3.0.0)
document.addEventListener('DOMContentLoaded', async () => {
  // Elements - Session
  const sessionLabel = document.getElementById('session-label');
  const lucaHostLabel = document.getElementById('luca-host-label');
  const globalAlert = document.getElementById('global-alert');

  // Elements - Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Elements - Aktarım
  const queueCount = document.getElementById('queue-count');
  const queueBadge = document.getElementById('queue-badge');
  const pasteBtn = document.getElementById('paste-btn');
  const clearBtn = document.getElementById('clear-btn');

  const mahsupQueueCount = document.getElementById('mahsup-queue-count');
  const mahsupQueueBadge = document.getElementById('mahsup-queue-badge');
  const mahsupPasteBtn = document.getElementById('mahsup-paste-btn');
  const mahsupClearBtn = document.getElementById('mahsup-clear-btn');

  const bankQueueCount = document.getElementById('bank-queue-count');
  const bankQueueBadge = document.getElementById('bank-queue-badge');
  const bankPasteBtn = document.getElementById('bank-paste-btn');
  const bankClearBtn = document.getElementById('bank-clear-btn');

  // Elements - Hesap Planı
  const btnFetchAccounts = document.getElementById('btn-fetch-accounts');
  const btnSyncToWebapp = document.getElementById('btn-sync-to-webapp');
  const accCountBadge = document.getElementById('acc-count-badge');
  const accLastSync = document.getElementById('acc-last-sync');
  const btnPullWebapp = document.getElementById('btn-pull-webapp');
  const accSearchInput = document.getElementById('acc-search-input');
  const accTableBody = document.getElementById('acc-table-body');

  // Elements - Yeni Hesap / Cari
  const newAccVkn = document.getElementById('new-acc-vkn');
  const btnQueryVkn = document.getElementById('btn-query-vkn');
  const newAccTemplate = document.getElementById('new-acc-template');
  const newAccCode = document.getElementById('new-acc-code');
  const btnNextCode = document.getElementById('btn-next-code');
  const newAccName = document.getElementById('new-acc-name');
  const newAccVdCode = document.getElementById('new-acc-vd-code');
  const newAccVdName = document.getElementById('new-acc-vd-name');
  const btnOpenPanel = document.getElementById('btn-open-panel');
  const btnCreateAccount = document.getElementById('btn-create-account');
  const accountResultBox = document.getElementById('account-result-box');
  const newAccAddress = document.getElementById('new-acc-address');
  const newAccIl = document.getElementById('new-acc-il');
  const newAccIlce = document.getElementById('new-acc-ilce');
  const btnAddToWebapp = document.getElementById('btn-add-to-webapp');

  let loadedAccounts = [];
  let detectedCariInfo = null;

  function showAlert(msg, isError = false) {
    if (!globalAlert) return;
    globalAlert.textContent = msg;
    globalAlert.className = `alert-box ${isError ? 'alert-error' : 'alert-success'}`;
    globalAlert.style.display = 'block';
    setTimeout(() => { globalAlert.style.display = 'none'; }, 4500);
  }

  // 1. SEKME GEÇİŞLERİ
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.add('active');
    });
  });

  // 1.b GENİŞ PANEL BUTONU
  if (btnOpenPanel) {
    btnOpenPanel.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('panel.html') });
    });
  }

  // 2. OTURUM DURUMU SORGULAMA
  async function checkSession() {
    try {
      chrome.runtime.sendMessage({ type: 'GET_LUCA_SESSION' }, (session) => {
        if (chrome.runtime.lastError || !session) {
          sessionLabel.textContent = 'Bağlantı kurulamadı';
          return;
        }
        if (session.host && lucaHostLabel) lucaHostLabel.textContent = session.host;
        if (session.isLoggedIn) {
          const sText = session.username ? `${session.username} (Şirket: ${session.companyId || '-'})` : `Şirket: ${session.companyId || 'Aktif'}`;
          sessionLabel.textContent = sText;
          sessionLabel.style.color = '#34d399';
        } else {
          sessionLabel.textContent = 'Giriş Yapılmadı';
          sessionLabel.style.color = '#fca5a5';
        }
      });
    } catch (e) {
      sessionLabel.textContent = 'Oturum Hatası';
    }
  }

  // 3. TRANSFER VERİLERİ VE UI GÜNCELLEMESİ
  const updateTransferUI = () => {
    chrome.storage.local.get(['transferData', 'lucaAccounts', 'lastSyncTime', 'lucaBucket'], (res) => {
      // Hesap planı önbelleği
      if (res.lucaAccounts && res.lucaAccounts.length > 0) {
        loadedAccounts = res.lucaAccounts;
        accCountBadge.textContent = `${loadedAccounts.length} Hesap`;
        renderAccountsTable(accSearchInput.value);
      }
      if (res.lastSyncTime) {
        const d = new Date(res.lastSyncTime);
        accLastSync.textContent = `Son: ${d.toLocaleDateString('tr-TR')} ${d.toLocaleTimeString('tr-TR')}`;
      }

      const transfer = res.transferData || {};

      // Hızlı Fiş (İşletme)
      const invoices = transfer.invoices || transfer.hizliFisItems || (res.lucaBucket?.accounting_type === 'basic' ? res.lucaBucket.ledger_rows : []) || [];
      queueCount.textContent = invoices.length;
      queueBadge.textContent = `${invoices.length} Fatura`;
      queueBadge.className = invoices.length > 0 ? 'badge badge-green' : 'badge badge-blue';
      pasteBtn.disabled = invoices.length === 0;

      // Mahsup (Bilanço)
      const mahsupRows = (transfer.mahsupRows && transfer.mahsupRows.length > 0)
        ? transfer.mahsupRows
        : (res.lucaBucket?.accounting_type !== 'basic' && res.lucaBucket?.ledger_rows ? res.lucaBucket.ledger_rows : []);
      mahsupQueueCount.textContent = mahsupRows.length;
      mahsupQueueBadge.textContent = `${mahsupRows.length} Satır`;
      mahsupQueueBadge.className = mahsupRows.length > 0 ? 'badge badge-green' : 'badge badge-blue';
      mahsupPasteBtn.disabled = mahsupRows.length === 0;

      // Banka
      const bankItems = transfer.bankTransactions || (transfer.mahsupRows && transfer.mahsupRows.some(r => r.banka || r.islemTuru) ? transfer.mahsupRows : []);
      bankQueueCount.textContent = bankItems.length;
      bankQueueBadge.textContent = `${bankItems.length} Hareket`;
      bankQueueBadge.className = bankItems.length > 0 ? 'badge badge-green' : 'badge badge-amber';
      bankPasteBtn.disabled = bankItems.length === 0;
    });
  };

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.transferData || changes.lucaAccounts)) {
      updateTransferUI();
  syncFromOpenWebApp(false);
    }
  });

  // 4. HESAP PLANINI TABLODA GÖSTERME & ARAMA
  function renderAccountsTable(filterText = '') {
    if (!accTableBody) return;
    const q = (filterText || '').trim().toLowerCase();
    const filtered = q
      ? loadedAccounts.filter(a => {
          const c = (a.code || a.kod || '').toLowerCase();
          const n = (a.name || a.ad || '').toLowerCase();
          return c.includes(q) || n.includes(q);
        })
      : loadedAccounts;

    accCountBadge.textContent = `${filtered.length} / ${loadedAccounts.length} Hesap`;

    if (filtered.length === 0) {
      accTableBody.innerHTML = `
        <tr>
          <td colspan="2" style="text-align:center; padding:16px; color: var(--text-muted);">
            ${loadedAccounts.length === 0 ? 'Hesap planı bulunamadı. "Tüm Hesap Planını Çek" butonuna tıklayın.' : 'Arama kriterine uygun hesap bulunamadı.'}
          </td>
        </tr>
      `;
      return;
    }

    accTableBody.innerHTML = '';
    filtered.slice(0, 100).forEach(acc => {
      const tr = document.createElement('tr');
      const code = acc.code || acc.kod;
      const name = acc.name || acc.ad;
      tr.innerHTML = `
        <td><strong style="color:#818cf8;">${code}</strong></td>
        <td>${name}</td>
      `;
      tr.style.cursor = 'pointer';
      tr.title = 'Tıkla ve yeni hesap formuna aktar';
      tr.addEventListener('click', () => {
        newAccCode.value = code;
        newAccName.value = name;
        document.querySelector('.tab-btn[data-tab="tab-yeni-hesap"]').click();
      });
      accTableBody.appendChild(tr);
    });
  }

  accSearchInput.addEventListener('input', (e) => {
    renderAccountsTable(e.target.value);
  });

  // 4.b FATURA TAKİP WEB UYGULAMASINDAN AKTARIM VERİLERİNİ ÇEKME
  async function syncFromOpenWebApp(showNotification = false) {
    try {
      const tabs = await chrome.tabs.query({});
      let foundData = false;
      for (const t of tabs) {
        if (t.id && t.url && (t.url.includes('localhost') || t.url.includes('127.0.0.1') || t.url.includes('dilekcehanem') || t.url.includes('fatura'))) {
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: t.id },
              func: () => {
                try {
                  const bRaw = localStorage.getItem('fatura_app_luca_banka');
                  const tRaw = localStorage.getItem('transferData') || localStorage.getItem('fatura_app_luca_data');
                  const mRaw = localStorage.getItem('fatura_app_luca_mahsup');
                  return { bRaw, tRaw, mRaw };
                } catch(e) { return null; }
              }
            });

            if (results && results[0]?.result) {
              const { bRaw, tRaw, mRaw } = results[0].result;
              const bList = bRaw ? JSON.parse(bRaw) : [];
              const tData = tRaw ? JSON.parse(tRaw) : {};
              const mList = mRaw ? JSON.parse(mRaw) : [];

              const bankItems = (Array.isArray(bList) && bList.length > 0) ? bList : (tData.bankTransactions || []);
              const mahsupItems = (Array.isArray(mList) && mList.length > 0) ? mList : (tData.mahsupRows || []);
              const invoices = tData.invoices || [];

              if (bankItems.length > 0 || mahsupItems.length > 0 || invoices.length > 0) {
                chrome.storage.local.get(['transferData'], (sRes) => {
                  const current = sRes.transferData || {};
                  const merged = {
                    ...current,
                    bankTransactions: bankItems.length > 0 ? bankItems : current.bankTransactions,
                    mahsupRows: mahsupItems.length > 0 ? mahsupItems : current.mahsupRows,
                    invoices: invoices.length > 0 ? invoices : current.invoices
                  };
                  chrome.storage.local.set({ transferData: merged }, () => {
                    updateTransferUI();
                    if (showNotification) {
                      showAlert(`Fatura Takip'ten ${bankItems.length} banka hareketi güncellendi.`, false);
                    }
                  });
                });
                foundData = true;
                break;
              }
            }
          } catch (e) {}
        }
      }
      if (!foundData && showNotification) {
        showAlert('Fatura Takip sekmesinde aktarılacak yeni veri bulunamadı.', true);
      }
    } catch (e) {
      if (showNotification) showAlert('Web senkronizasyon hatası: ' + e.message, true);
    }
  }

  if (btnPullWebapp) {
    btnPullWebapp.addEventListener('click', (e) => {
      e.preventDefault();
      syncFromOpenWebApp(true);
    });
  }

  // 5. TÜM HESAP PLANINI ÇEK BUTONU (Açık Luca sekmesi veya arka plan servisi)
  btnFetchAccounts.addEventListener('click', async () => {
    btnFetchAccounts.disabled = true;
    btnFetchAccounts.textContent = '⏳ Luca\'dan Çekiliyor...';

    // 1. Önce açık Luca sekmelerinde ara
    try {
      const lucaTabs = await chrome.tabs.query({ url: "*://*.luca.com.tr/*" });
      if (lucaTabs && lucaTabs.length > 0) {
        for (const lt of lucaTabs) {
          try {
            const resInTab = await chrome.scripting.executeScript({
              target: { tabId: lt.id },
              func: async () => {
                const accounts = [];
                const seen = new Set();
                const add = (c, n) => {
                  const code = (c || '').trim();
                  const name = (n || '').trim();
                  if (/^\d{3}(\.[0-9A-Za-z_]+)*$/.test(code) && name && !seen.has(code)) {
                    seen.add(code);
                    accounts.push({ code, kod: code, name, ad: name });
                  }
                };

                // Tüm frame'lerdeki tabloları tara
                const docList = [document];
                try {
                  if (window.frames) {
                    for (let f = 0; f < window.frames.length; f++) {
                      try { if (window.frames[f]?.document) docList.push(window.frames[f].document); } catch(e) {}
                    }
                  }
                } catch(e) {}

                for (const d of docList) {
                  const trs = Array.from(d.querySelectorAll('tr'));
                  for (const tr of trs) {
                    if (tr.querySelector('th')) continue;
                    const tds = Array.from(tr.querySelectorAll('td')).map(x => (x.innerText || '').trim());
                    for (let i = 0; i < Math.min(tds.length, 3); i++) {
                      if (/^\d{3}(\.[0-9A-Za-z_]+)+$/.test(tds[i])) {
                        add(tds[i], tds[i + 1]);
                        break;
                      }
                    }
                  }
                }

                // Sayfa içi AJAX ile F10 alt hesap listesini çek
                if (accounts.length === 0) {
                  const eps = [
                    '/Luca/listAltHesapTempAction.do?bakiyeGetir=1&hesapKodu=',
                    '/Luca/listAltHesapTempAction.do?hesapKodu='
                  ];
                  for (const ep of eps) {
                    try {
                      const r = await fetch(ep, { credentials: 'include' });
                      const txt = await r.text();
                      const xmlRegex = /<(?:hesapKodu|kod)[^>]*>([\s\S]*?)<\/(?:hesapKodu|kod)>[\s\S]*?<(?:hesapAdi|ad)[^>]*>([\s\S]*?)<\/(?:hesapAdi|ad)>/gi;
                      let m;
                      while ((m = xmlRegex.exec(txt)) !== null) {
                        add(m[1].replace(/<[^>]+>/g, ''), m[2].replace(/<[^>]+>/g, ''));
                      }
                      if (accounts.length > 0) break;
                    } catch(e) {}
                  }
                }
                return accounts;
              }
            });

            if (resInTab && resInTab[0]?.result && resInTab[0].result.length > 0) {
              loadedAccounts = resInTab[0].result;
              chrome.storage.local.set({ lucaAccounts: loadedAccounts, lastSyncTime: new Date().toISOString() });
              btnFetchAccounts.disabled = false;
              btnFetchAccounts.textContent = '🔄 Tüm Hesap Planını Çek';
              showAlert(`Başarılı! ${loadedAccounts.length} hesap Luca sekmesinden çekildi.`, false);
              renderAccountsTable(accSearchInput.value);
              return;
            }
          } catch(e) {}
        }
      }
    } catch(e) {}

    // 2. Background service worker ile çek
    chrome.runtime.sendMessage({ type: 'FETCH_LUCA_ACCOUNTS' }, (response) => {
      btnFetchAccounts.disabled = false;
      btnFetchAccounts.textContent = '🔄 Tüm Hesap Planını Çek';

      if (chrome.runtime.lastError) {
        return showAlert('Eklenti hatası: ' + chrome.runtime.lastError.message, true);
      }

      if (response && response.status === 'success' && response.data && response.data.length > 0) {
        loadedAccounts = response.data;
        showAlert(`Başarılı! ${loadedAccounts.length} hesap Luca'dan çekildi.`, false);
        renderAccountsTable(accSearchInput.value);
      } else {
        showAlert('Luca\'dan hesap planı çekilemedi. Luca sekmenizin açık olduğunu kontrol edin veya Luca menüsünden Muhasebe -> Hesap Planı -> Hesap Planı Listesi sayfasını açıp tekrar tıklayın.', true);
      }
    });
  });

  // 6. WEB UYGULAMASINA EŞİTLE BUTONU
  btnSyncToWebapp.addEventListener('click', async () => {
    if (loadedAccounts.length === 0) {
      return showAlert('Önce hesap planını çekmelisiniz.', true);
    }
    btnSyncToWebapp.disabled = true;
    btnSyncToWebapp.textContent = 'Eşitleniyor...';

    try {
      const tabs = await chrome.tabs.query({});
      let notifiedCount = 0;
      for (const tab of tabs) {
        if (tab.url && (tab.url.includes('localhost') || tab.url.includes('127.0.0.1') || tab.url.includes('dilekcehanem') || tab.url.includes('fatura'))) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'FATURA_APP_LUCA_ACCOUNTS_RECEIVED',
            status: 'success',
            data: loadedAccounts
          }, () => {});
          notifiedCount++;
        }
      }
      showAlert(`Hesap planı ${notifiedCount} açık Fatura Takip sekmesine iletildi.`, false);
    } catch (e) {
      showAlert('Web uygulamasına iletilemedi: ' + e.message, true);
    } finally {
      btnSyncToWebapp.disabled = false;
      btnSyncToWebapp.textContent = '🌐 Web\'e Eşitle';
    }
  });

  // 7. VKN / TCKN SORGULA BUTONU (cariBilgiDogrulamaSistemdenAl.do)
  btnQueryVkn.addEventListener('click', async () => {
    const taxNo = newAccVkn.value.trim();
    if (!taxNo || (taxNo.length !== 10 && taxNo.length !== 11)) {
      return showAlert('Lütfen 10 haneli VKN veya 11 haneli TCKN girin.', true);
    }

    btnQueryVkn.disabled = true;
    btnQueryVkn.textContent = 'Sorgulanıyor...';

    chrome.runtime.sendMessage({ type: 'VERIFY_VKN_TCKN', taxNo }, (res) => {
      btnQueryVkn.disabled = false;
      btnQueryVkn.textContent = '🔎 Sorgula';

      if (chrome.runtime.lastError || !res || res.status === 'error') {
        return showAlert('Luca cari sorgulama hatası: ' + (res?.message || chrome.runtime.lastError?.message), true);
      }

      const info = res.data;
      if (info && !info.error) {
        detectedCariInfo = info;
        if (info.unvan) newAccName.value = info.unvan;
        if (info.vergiDairesi) newAccVdCode.value = info.vergiDairesi;
        if (info.vergiDairesiAd) newAccVdName.value = info.vergiDairesiAd;
        if (info.adres && newAccAddress) newAccAddress.value = info.adres;
        if (info.il && newAccIl) newAccIl.value = info.il;
        if (info.ilce && newAccIlce) newAccIlce.value = info.ilce;

        // Sonraki kodu da otomatik öner
        suggestNextAccountCode();

        showAlert(`Cari bilgileri Luca'dan alındı: ${info.unvan || 'Kayıt bulundu'}`, false);
      } else {
        showAlert('Cari bilgisi Luca sisteminde bulunamadı veya oturum kapalı.', true);
      }
    });
  });

  // 8. BOŞTAKİ SONRAKİ HESAP KODUNU BULMA
  function suggestNextAccountCode() {
    const prefix = newAccTemplate.value; // "120", "320", "600", vb.
    const subPrefix = `${prefix}.01.`;
    
    // Mevcut hesaplar içinde subPrefix ile başlayanları bul
    const matching = loadedAccounts.filter(a => {
      const c = a.code || a.kod || '';
      return c.startsWith(subPrefix) || c.startsWith(`${prefix}.`);
    });

    let maxNum = 0;
    matching.forEach(a => {
      const c = a.code || a.kod || '';
      const parts = c.split('.');
      if (parts.length >= 3) {
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    const nextCode = `${subPrefix}${String(nextNum).padStart(3, '0')}`;
    newAccCode.value = nextCode;
  }

  btnNextCode.addEventListener('click', (e) => {
    e.preventDefault();
    suggestNextAccountCode();
  });

  newAccTemplate.addEventListener('change', () => {
    suggestNextAccountCode();
  });

  // 9. HESAP KARTINI LUCA'YA KAYDET BUTONU (hesapPlaniBaBs.do)
  btnCreateAccount.addEventListener('click', async () => {
    const code = newAccCode.value.trim();
    const name = newAccName.value.trim();
    const vkn = newAccVkn.value.trim().length === 10 ? newAccVkn.value.trim() : '';
    const tckn = newAccVkn.value.trim().length === 11 ? newAccVkn.value.trim() : '';
    const vdCode = newAccVdCode.value.trim();
    const vdName = newAccVdName.value.trim();

    if (!code || !name) {
      return showAlert('Lütfen Hesap Kodu ve Hesap Adı alanlarını doldurun.', true);
    }

    btnCreateAccount.disabled = true;
    btnCreateAccount.textContent = '⏳ Luca\'ya Kaydediliyor...';

    const payload = {
      code,
      name,
      vkn,
      tckn,
      vdCode,
      vdName,
      currency: '0',
      hesapId: detectedCariInfo?.hesapId || '',
      adres: (newAccAddress ? newAccAddress.value.trim() : '') || detectedCariInfo?.adres || '',
      il_kodu: (newAccIl ? newAccIl.value.trim() : '') || detectedCariInfo?.il || '0',
      ilce_kodu: (newAccIlce ? newAccIlce.value.trim() : '') || detectedCariInfo?.ilce || '0'
    };

    chrome.runtime.sendMessage({ type: 'CREATE_LUCA_ACCOUNT', data: payload }, (res) => {
      btnCreateAccount.disabled = false;
      btnCreateAccount.textContent = '💾 Hesap Kartını Luca\'ya Kaydet';

      if (chrome.runtime.lastError || !res) {
        return showAlert('Kayıt isteği başarısız: ' + (chrome.runtime.lastError?.message || 'Bilinmeyen hata'), true);
      }

      if (res.success) {
        showAlert(`Hesap Kartı Başarıyla Açıldı! [${code} - ${name}]`, false);
        accountResultBox.className = 'alert-box alert-success';
        accountResultBox.textContent = `✔ Luca Yanıtı: ${res.message || 'Başarıyla kaydedildi.'} ${res.createdId ? `(ID: ${res.createdId})` : ''}`;
        accountResultBox.style.display = 'block';

        // Listeye de ekle
        loadedAccounts.push({ code, kod: code, name, ad: name });
        renderAccountsTable(accSearchInput.value);
      } else {
        showAlert(res.message || 'Kayıt sırasında uyarı/hata oluştu.', true);
        accountResultBox.className = 'alert-box alert-error';
        accountResultBox.textContent = `❌ Luca Yanıtı: ${res.message || 'Kayıt başarısız.'}`;
        accountResultBox.style.display = 'block';
      }
    });
  });

  // 9.b FATURA TAKİP'E CARİ EKLEME
  if (btnAddToWebapp) {
    btnAddToWebapp.addEventListener('click', async () => {
      const unvan = newAccName.value.trim();
      const vknTckn = newAccVkn.value.trim();
      if (!unvan || !vknTckn) {
        return showAlert('Lütfen Ünvan ve VKN/TCKN alanlarını doldurun.', true);
      }
      const newCari = {
        unvan,
        vknTckn,
        vergiDairesi: newAccVdName.value.trim(),
        adres: newAccAddress ? newAccAddress.value.trim() : '',
        muhasebeKodu: newAccCode.value.trim(),
        tip: newAccTemplate.value === '120' ? 'musteri' : 'tedarikci'
      };

      try {
        const tabs = await chrome.tabs.query({});
        let added = false;
        for (const t of tabs) {
          if (t.url && (t.url.includes('localhost') || t.url.includes('127.0.0.1') || t.url.includes('dilekcehanem') || t.url.includes('fatura'))) {
            await chrome.scripting.executeScript({
              target: { tabId: t.id },
              func: (c) => {
                try {
                  window.dispatchEvent(new CustomEvent('FATURA_APP_ADD_CARI', { detail: c }));
                  return true;
                } catch(e) { return false; }
              },
              args: [newCari]
            });
            added = true;
          }
        }
        if (added) {
          showAlert(`'${unvan}' Fatura Takip uygulamasına iletildi!`, false);
        } else {
          showAlert('Fatura Takip sekmesi açık bulunamadı.', true);
        }
      } catch(err) {
        showAlert('Web uygulamasına iletilemedi: ' + err.message, true);
      }
    });
  }

  // 10. TEMİZLEME BUTONLARI
  clearBtn.addEventListener('click', () => {
    if (!confirm('Hızlı fiş kuyruğundaki faturalar temizlensin mi?')) return;
    chrome.storage.local.get(['transferData'], (res) => {
      const data = res.transferData || {};
      delete data.invoices;
      delete data.hizliFisItems;
      chrome.storage.local.set({ transferData: data }, () => updateTransferUI());
    });
  });

  mahsupClearBtn.addEventListener('click', () => {
    if (!confirm('Mahsup fişi kuyruğu temizlensin mi?')) return;
    chrome.storage.local.get(['transferData'], (res) => {
      const data = res.transferData || {};
      delete data.mahsupRows;
      chrome.storage.local.set({ transferData: data }, () => updateTransferUI());
    });
  });

  bankClearBtn.addEventListener('click', () => {
    if (!confirm('Banka hareketleri kuyruğu temizlensin mi?')) return;
    chrome.storage.local.get(['transferData'], (res) => {
      const data = res.transferData || {};
      delete data.bankTransactions;
      chrome.storage.local.set({ transferData: data }, () => updateTransferUI());
    });
  });

  // 11. AKILLI AKTARIM YÖNETİCİSİ (Açık Luca sekmesini bulur, addFis.do açar ve satırları yazar)
  async function triggerTransferOnLucaTab(actionType, btn, originalText, activeText) {
    btn.disabled = true;
    btn.textContent = activeText;

    try {
      const tabs = await chrome.tabs.query({ url: "*://*.luca.com.tr/*" });
      if (!tabs || tabs.length === 0) {
        btn.disabled = false;
        btn.textContent = originalText;
        return showAlert("Açık bir Luca sekmesi bulunamadı! Lütfen önce Luca'ya giriş yapın.", true);
      }

      // En uygun Luca sekmesini seç
      const lucaTab = tabs.find(t => t.url && (t.url.includes('menu.do') || t.url.includes('luca.do'))) || tabs[0];

      // Sekmeyi ve pencereyi öne getir
      await chrome.tabs.update(lucaTab.id, { active: true });
      if (lucaTab.windowId) {
        try { await chrome.windows.update(lucaTab.windowId, { focused: true }); } catch (e) {}
      }

      // Mahsup veya Banka ise addFis.do kontrolü ve otomatik yönlendirme
      if (actionType === 'TRIGGER_MAHSUP_AKTAR' || actionType === 'TRIGGER_BANKA_AKTAR') {
        try {
          const navCheck = await chrome.scripting.executeScript({
            target: { tabId: lucaTab.id },
            func: () => {
              try {
                const frm3 = document.querySelector('#frm3') || window.frames?.frm3;
                const cur = frm3?.contentWindow?.location?.href || frm3?.src || window.location.href;
                if (frm3 && !cur.includes('addFis.do')) {
                  frm3.src = '/Luca/addFis.do';
                  return { navigated: true };
                }
                return { navigated: false, isAddFis: cur.includes('addFis.do') };
              } catch (e) {
                return { error: e.message };
              }
            }
          });

          if (navCheck && navCheck[0]?.result?.navigated) {
            showAlert("Luca Fiş Girişi (addFis.do) açılıyor, lütfen bekleyin...", false);
            await new Promise(r => setTimeout(r, 1600));
          }
        } catch (e) {}
      }

      // İlgili aktarım emrini gönder
      chrome.tabs.sendMessage(lucaTab.id, { type: actionType }, (res) => {
        btn.disabled = false;
        btn.textContent = originalText;

        if (chrome.runtime.lastError) {
          return showAlert("Luca sekmesine aktarım emri iletildi (arka planda işleniyor).", false);
        }
        if (res && res.status === 'error') {
          return showAlert(res.message || "Aktarım hatası.", true);
        }
        showAlert("Aktarım işlemi açık Luca sekmesinde başarıyla başlatıldı!", false);
      });
    } catch (err) {
      btn.disabled = false;
      btn.textContent = originalText;
      showAlert("Hata: " + (err.message || String(err)), true);
    }
  }

  // Hızlı Fiş (İşletme)
  pasteBtn.addEventListener('click', () => {
    triggerTransferOnLucaTab('TRIGGER_HIZLI_FIS_AKTAR', pasteBtn, '⚡ Faturaları Hızlı Fişe Aktar', 'Aktarılıyor...');
  });

  // Mahsup Fişi (Bilanço)
  mahsupPasteBtn.addEventListener('click', () => {
    triggerTransferOnLucaTab('TRIGGER_MAHSUP_AKTAR', mahsupPasteBtn, '📥 Mahsup Fişine Aktar', 'Satırlar Yazılıyor...');
  });

  // Banka Hareketleri
  bankPasteBtn.addEventListener('click', () => {
    triggerTransferOnLucaTab('TRIGGER_BANKA_AKTAR', bankPasteBtn, '🏦 Banka Hareketlerini Aktar', 'Banka Yazılıyor...');
  });

  // İlk yükleme
  checkSession();
  updateTransferUI();
});
