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
  const btnCreateAccount = document.getElementById('btn-create-account');
  const accountResultBox = document.getElementById('account-result-box');

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
    chrome.storage.local.get(['transferData', 'lucaAccounts', 'lastSyncTime'], (res) => {
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
      const invoices = transfer.invoices || transfer.hizliFisItems || [];
      queueCount.textContent = invoices.length;
      queueBadge.textContent = `${invoices.length} Fatura`;
      queueBadge.className = invoices.length > 0 ? 'badge badge-green' : 'badge badge-blue';
      pasteBtn.disabled = invoices.length === 0;

      // Mahsup (Bilanço)
      const mahsupRows = transfer.mahsupRows || [];
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

  // 5. TÜM HESAP PLANINI ÇEK BUTONU (listAltHesapTempAction.do)
  btnFetchAccounts.addEventListener('click', async () => {
    btnFetchAccounts.disabled = true;
    btnFetchAccounts.textContent = '⏳ Luca\'dan Çekiliyor...';

    chrome.runtime.sendMessage({ type: 'FETCH_LUCA_ACCOUNTS' }, (response) => {
      btnFetchAccounts.disabled = false;
      btnFetchAccounts.textContent = '🔄 Tüm Hesap Planını Çek';

      if (chrome.runtime.lastError) {
        return showAlert('Eklenti hatası: ' + chrome.runtime.lastError.message, true);
      }

      if (response && response.status === 'success') {
        loadedAccounts = response.data || [];
        showAlert(`Başarılı! ${loadedAccounts.length} hesap Luca'dan çekildi.`, false);
        renderAccountsTable(accSearchInput.value);
      } else {
        showAlert(response?.message || 'Hesap planı çekilemedi. Luca oturumunuzun açık olduğunu kontrol edin.', true);
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
      adres: detectedCariInfo?.adres || '',
      il_kodu: detectedCariInfo?.il_kodu || '0',
      ilce_kodu: detectedCariInfo?.ilce_kodu || '0'
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

  // 11. HIZLI FİŞE AKTAR (İşletme Defteri)
  pasteBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url.includes('luca.com.tr')) {
      return showAlert('Lütfen aktif sekmede Luca sayfasını açın!', true);
    }

    pasteBtn.disabled = true;
    pasteBtn.textContent = 'Aktarılıyor...';

    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_HIZLI_FIS_AKTAR' }, (res) => {
      pasteBtn.disabled = false;
      pasteBtn.textContent = '⚡ Faturaları Hızlı Fişe Aktar';
      if (chrome.runtime.lastError) {
        return showAlert('Luca sekmesine ulaşılamadı. Sayfayı yenileyip tekrar deneyin.', true);
      }
      showAlert('Aktarım işlemi başlatıldı.', false);
    });
  });

  // 12. MAHSUP FİŞİNE AKTAR (Bilanço)
  mahsupPasteBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url.includes('luca.com.tr')) {
      return showAlert('Lütfen aktif sekmede Luca sayfasını açın!', true);
    }

    mahsupPasteBtn.disabled = true;
    mahsupPasteBtn.textContent = 'Satırlar Yazılıyor...';

    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_MAHSUP_AKTAR' }, (res) => {
      mahsupPasteBtn.disabled = false;
      mahsupPasteBtn.textContent = '📥 Mahsup Fişine Aktar';
      if (chrome.runtime.lastError) {
        return showAlert('Luca sekmesine ulaşılamadı. Sayfayı yenileyip tekrar deneyin.', true);
      }
      showAlert('Mahsup satırları yazılmaya başlandı.', false);
    });
  });

  // 13. BANKA HAREKETLERİNİ AKTAR
  bankPasteBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url.includes('luca.com.tr')) {
      return showAlert('Lütfen aktif sekmede Luca sayfasını açın!', true);
    }

    bankPasteBtn.disabled = true;
    bankPasteBtn.textContent = 'Banka Yazılıyor...';

    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_BANKA_AKTAR' }, (res) => {
      bankPasteBtn.disabled = false;
      bankPasteBtn.textContent = '🏦 Banka Hareketlerini Aktar';
      if (chrome.runtime.lastError) {
        return showAlert('Luca sekmesine ulaşılamadı. Sayfayı yenileyip tekrar deneyin.', true);
      }
      showAlert('Banka hareketleri aktarılıyor.', false);
    });
  });

  // İlk yükleme
  checkSession();
  updateTransferUI();
});
