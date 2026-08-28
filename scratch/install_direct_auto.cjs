const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');

// ==================== 1. fatura_content.js ====================
const faturaContentCode = `// fatura_content.js - Fatura Takip Web Uygulaması Köprüsü
(function() {
  console.log("Fatura Takip Köprüsü v2.2 yüklendi.");

  function sendToBackground(type, data, callback) {
    if (chrome && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({ type, data }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn(chrome.runtime.lastError.message);
        }
        if (callback) callback(res);
      });
    }
  }

  // Fatura & Mahsup
  window.addEventListener('FATURA_APP_LUCA_DATA', (e) => {
    if (e.detail) sendToBackground('SET_TRANSFER_DATA', e.detail);
  });
  window.addEventListener('FATURA_APP_LUCA_SEND_ISLETME', (e) => {
    if (e.detail) sendToBackground('SET_TRANSFER_DATA', { isIsletme: true, invoices: e.detail });
  });
  window.addEventListener('FATURA_APP_LUCA_SEND_MAHSUP', (e) => {
    if (e.detail) sendToBackground('SET_TRANSFER_DATA', { isIsletme: false, mahsupRows: e.detail });
  });

  // TAM OTOMATİK CARİ OLUŞTURMA
  window.addEventListener('FATURA_APP_LUCA_CREATE_CARI', (e) => {
    if (e.detail) {
      sendToBackground('AUTO_CREATE_CARI_IN_LUCA', e.detail, (response) => {
        if (response && response.success) {
          window.postMessage({ type: 'LUCA_CARI_CREATED_SUCCESS', detail: response }, '*');
        } else if (response && response.error) {
          window.postMessage({ type: 'LUCA_CARI_CREATED_ERROR', detail: response }, '*');
        }
      });
      localStorage.setItem('fatura_app_luca_create_cari', JSON.stringify(e.detail));
    }
  });

  window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (e.data.type === 'FATURA_APP_LUCA_DATA') {
      sendToBackground('SET_TRANSFER_DATA', e.data.detail || e.data.payload || e.data.data);
    } else if (e.data.type === 'FATURA_APP_LUCA_CREATE_CARI') {
      const payload = e.data.detail || e.data.payload || e.data.cari;
      sendToBackground('AUTO_CREATE_CARI_IN_LUCA', payload, (response) => {
        if (response && response.success) {
          window.postMessage({ type: 'LUCA_CARI_CREATED_SUCCESS', detail: response }, '*');
        } else if (response && response.error) {
          window.postMessage({ type: 'LUCA_CARI_CREATED_ERROR', detail: response }, '*');
        }
      });
      localStorage.setItem('fatura_app_luca_create_cari', JSON.stringify(payload));
    }
  });
})();
`;

fs.writeFileSync(path.join(extDir, 'fatura_content.js'), faturaContentCode, 'utf8');
console.log('fatura_content.js updated');

// ==================== 2. background.js ====================
const backgroundCode = `// background.js - Otomasyon Yöneticisi
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_TRANSFER_DATA') {
    chrome.storage.local.set({ transferData: message.data }, () => {
      sendResponse({ status: 'ok' });
    });
    return true;
  }

  if (message.type === 'AUTO_CREATE_CARI_IN_LUCA') {
    const payload = message.data;
    // Luca tabını bul
    chrome.tabs.query({ url: "*://*.luca.com.tr/*" }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ success: false, error: 'Açık bir Luca sekmesi bulunamadı. Lütfen tarayıcınızda Luca sekmesinin açık olduğundan emin olun.' });
        return;
      }

      // İlk aktif Luca tabına mesaj gönder
      const lucaTab = tabs.find(t => t.active) || tabs[0];
      chrome.tabs.sendMessage(lucaTab.id, { type: 'EXECUTE_AUTO_CREATE_CARI', data: payload }, (res) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse(res || { success: true });
        }
      });
    });
    return true; // async response
  }

  if (message.type === 'GET_TRANSFER_DATA') {
    chrome.storage.local.get(['transferData', 'createCariData'], (result) => {
      sendResponse(result);
    });
    return true;
  }
});
`;

fs.writeFileSync(path.join(extDir, 'background.js'), backgroundCode, 'utf8');
console.log('background.js updated');

// ==================== 3. luca_content.js ====================
const lucaContentCode = `// luca_content.js - Luca Otomasyonu & Güvenlik Kilidi
(function() {
  console.log("Luca Content Script v2.2 (Tam Otomatik Cari Açma & Firma Kilidi) aktif.");

  function isRuntimeValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  }

  // ==================== 🛡️ FİRMA DOĞRULAMA GÜVENLİK KİLİDİ ====================
  function getLucaActiveCompanyInfo() {
    try {
      const topDoc = window.top ? window.top.document : document;
      const allText = (topDoc.body ? topDoc.body.innerText : '') + ' ' + (topDoc.title || '');
      
      const elMusteri = topDoc.getElementById('musteriAdi') || topDoc.querySelector('.musteri-adi') || topDoc.querySelector('#sirketAdi') || topDoc.querySelector('.customer-name');
      const unvan = elMusteri ? elMusteri.innerText.trim() : (topDoc.title || '');
      
      return { unvan, allText };
    } catch(e) {
      return { unvan: '', allText: '' };
    }
  }

  function verifyCompanyGuard(targetCompany) {
    if (!targetCompany || (!targetCompany.vkn && !targetCompany.unvan)) {
      return { ok: true };
    }

    const { allText } = getLucaActiveCompanyInfo();
    const targetVkn = (targetCompany.vkn || '').trim();
    const targetUnvan = (targetCompany.unvan || '').trim();
    const targetFirstWord = targetUnvan.split(/\\s+/)[0].toLocaleLowerCase('tr-TR');

    if (targetVkn && targetVkn.length >= 10 && allText.includes(targetVkn)) {
      return { ok: true, matchedBy: 'VKN (' + targetVkn + ')' };
    }

    if (targetFirstWord && targetFirstWord.length > 2 && allText.toLocaleLowerCase('tr-TR').includes(targetFirstWord)) {
      return { ok: true, matchedBy: 'Ünvan (' + targetFirstWord + ')' };
    }

    return {
      ok: false,
      targetVkn,
      targetUnvan
    };
  }

  function showSecurityBlockDialog(targetCompany) {
    const existing = document.getElementById('luca-security-block-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'luca-security-block-modal';
    modal.style.cssText = "position:fixed; inset:0; z-index:99999999; background:rgba(15, 23, 42, 0.85); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;";
    modal.innerHTML = \`
      <div style="background:white; border-radius:16px; width:480px; max-width:90vw; padding:24px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); border:2px solid #ef4444; text-align:center;">
        <div style="width:56px; height:56px; background:#fee2e2; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 16px auto; font-size:28px;">
          ⛔
        </div>
        <h2 style="margin:0 0 8px 0; color:#991b1b; font-size:19px; font-weight:800;">FİRMA UYUŞMAZLIĞI GÜVENLİK KİLİDİ!</h2>
        <p style="margin:0 0 16px 0; color:#475569; font-size:13px; line-height:1.5;">
          Yanlış firmaya işlem yapılmaması için işlem güvenlik kilidi tarafından <b>durduruldu</b>.
        </p>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; text-align:left; font-size:13px; margin-bottom:16px;">
          <div style="color:#64748b; font-size:11px; font-weight:bold; text-transform:uppercase;">İşlem Yapılmak İstenen Firma:</div>
          <div style="color:#0f172a; font-weight:bold; font-size:14px; margin-top:2px;">\${targetCompany.unvan || 'Bilinmiyor'}</div>
          <div style="color:#475569; font-size:12px; font-family:monospace; margin-top:2px;">VKN: \${targetCompany.vkn || '-'}</div>
        </div>
        <p style="color:#b91c1c; font-size:12px; font-weight:600; margin-bottom:20px; line-height:1.4;">
          Lütfen Luca'da yukarıdaki doğru mükellefi açın ve tekrar deneyin.
        </p>
        <button id="close-security-modal-btn" style="width:100%; padding:11px 16px; background:#0f172a; color:white; border:none; border-radius:8px; font-weight:bold; font-size:13px; cursor:pointer;">
          Anladım, Kapat
        </button>
      </div>
    \`;
    document.body.appendChild(modal);
    document.getElementById('close-security-modal-btn').onclick = () => modal.remove();
  }

  function showToast(text, isError = false) {
    const toast = document.createElement("div");
    toast.innerText = text;
    toast.style.cssText = \`position:fixed; top:20px; right:20px; background:\${isError ? '#ef4444' : '#10b981'}; color:#fff; padding:14px 24px; border-radius:10px; z-index:99999999; font-weight:bold; font-size:13px; box-shadow:0 10px 25px rgba(0,0,0,0.25); font-family:sans-serif; transition:all 0.3s ease;\`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  // ==================== ⚡ TAM OTOMATİK CARİ OLUŞTURUCU ====================
  async function executeDirectCariCreation(payload) {
    const { cari, targetCompany } = payload;
    if (!cari || !cari.hesapKodu) {
      return { success: false, error: 'Cari bilgisi veya hesap kodu eksik.' };
    }

    // 1. Güvenlik doğrulaması
    const guard = verifyCompanyGuard(targetCompany);
    if (!guard.ok) {
      showSecurityBlockDialog(targetCompany);
      return { success: false, error: 'Firma uyuşmazlığı: Luca\\'da açık olan firma ile hedef firma eşleşmiyor.' };
    }

    // 2. Gizli iframe ile Luca Hesap Planı'na arka planda kaydet
    return new Promise((resolve) => {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.id = 'luca-auto-cari-iframe-' + Date.now();
        iframe.src = window.location.origin + '/Luca/hesapPlani.do?r=' + Math.random();
        
        let attempts = 0;
        const cleanup = () => {
          try { iframe.remove(); } catch(e) {}
        };

        iframe.onload = () => {
          setTimeout(() => {
            try {
              const iDoc = iframe.contentDocument || iframe.contentWindow.document;
              if (!iDoc) {
                cleanup();
                resolve({ success: false, error: 'Luca iframe dokümanına erişilemedi.' });
                return;
              }

              const setInputVal = (el, val) => {
                if (!el || val === undefined || val === null) return;
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
                el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
              };

              const kodInput = iDoc.getElementById('HESAP_KODU') || iDoc.querySelector('[name="hesapKodu"]') || iDoc.querySelector('[name="HESAP_KODU"]');
              const adInput = iDoc.getElementById('HESAP_ADI') || iDoc.querySelector('[name="hesapAdi"]') || iDoc.querySelector('[name="HESAP_ADI"]');
              const vknInput = iDoc.getElementById('VERGI_NO') || iDoc.querySelector('[name="vergiNo"]') || iDoc.querySelector('[name="VERGI_NO"]');
              const vdInput = iDoc.getElementById('VERGI_DAIRESI') || iDoc.querySelector('[name="vergiDairesi"]') || iDoc.querySelector('[name="VERGI_DAIRESI"]');

              if (kodInput) setInputVal(kodInput, cari.hesapKodu);
              if (adInput) setInputVal(adInput, cari.unvan);
              if (vknInput) setInputVal(vknInput, cari.vknTckn);
              if (vdInput) setInputVal(vdInput, cari.vergiDairesi);

              // Kaydet
              const saveBtn = iDoc.getElementById('kaydetHref') || iDoc.querySelector('button[type="submit"]') || iDoc.getElementById('kaydetBtn');
              if (saveBtn) {
                saveBtn.click();
                showToast(\`🎉 \${cari.hesapKodu} - \${cari.unvan} hesabı Luca'da başarıyla oluşturuldu!\`);
                setTimeout(() => {
                  cleanup();
                  resolve({ success: true, message: 'Cari Luca\\'da otomatik olarak açıldı.' });
                }, 1000);
              } else {
                // Alternatif doğrudan submit
                const form = iDoc.forms[0];
                if (form) {
                  form.submit();
                  showToast(\`🎉 \${cari.hesapKodu} - \${cari.unvan} hesabı Luca'da başarıyla oluşturuldu!\`);
                  setTimeout(() => {
                    cleanup();
                    resolve({ success: true, message: 'Cari form submit edildi.' });
                  }, 1000);
                } else {
                  cleanup();
                  resolve({ success: false, error: 'Hesap planı kayıt butonu bulunamadı.' });
                }
              }
            } catch(err) {
              cleanup();
              resolve({ success: false, error: err.message });
            }
          }, 600);
        };

        document.body.appendChild(iframe);

        // Timeout (10 saniye)
        setTimeout(() => {
          cleanup();
          resolve({ success: false, error: 'Zaman aşımı: Luca hesap planı sayfası yanıt vermedi.' });
        }, 10000);

      } catch(e) {
        resolve({ success: false, error: e.message });
      }
    });
  }

  // Background'dan gelen mesajları dinle
  if (isRuntimeValid() && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResp) => {
      if (msg.type === 'EXECUTE_AUTO_CREATE_CARI') {
        executeDirectCariCreation(msg.data).then(result => {
          sendResp(result);
        });
        return true; // async
      }
    });
  }

  // ==================== ⚡ FATURA & MAHSUP AKTARIM ====================
  function injectHizliFisButton() {
    if (!document.body || document.getElementById('fatura-takip-aktar-btn')) return;

    const isHizliFisPage = window.location.href.includes('hizliFis') || document.getElementById('islemlerTR') || document.getElementById('islem0');
    const isMahsupPage = window.location.href.includes('addFis') || window.location.href.includes('fisGiris') || document.getElementById('scroll');

    if (!isHizliFisPage && !isMahsupPage) return;

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
        if (!transfer) return alert('Aktarılacak fatura verisi bulunamadı!');

        if (transfer.targetCompany) {
          const guard = verifyCompanyGuard(transfer.targetCompany);
          if (!guard.ok) {
            showSecurityBlockDialog(transfer.targetCompany);
            return;
          }
        }

        btn.disabled = true;
        btn.innerHTML = \`⏳ <b>Aktarılıyor...</b>\`;

        try {
          if (transfer.isIsletme && transfer.invoices) {
            await fillHizliFisTable(transfer.invoices, (curr, total) => {
              btn.innerHTML = \`⏳ <b>Aktarılıyor (\${curr}/\${total})</b>\`;
            });
            showToast(\`🎉 \${transfer.invoices.length} adet fatura Luca Hızlı Fiş'e aktarıldı!\`);
          }
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
        if (document.getElementById('TABLO_TURU' + i)) setVal(document.getElementById('TABLO_TURU' + i), isTevkifatli ? (inv.tablo || '6') : '0');
        if (isTevkifatli) {
          const kodFullVal = inv.kodFull || (inv.kodNo ? (inv.kodNo + ' | ' + (inv.oranStr || '')) : '');
          const kodEl = document.getElementById('kodNo' + i) || document.querySelector(\`[name="detaylar[\${i}].kodNo"]\`);
          if (kodEl) setVal(kodEl, kodFullVal);
        }

        const tutarVal = inv.tutar !== undefined ? inv.tutar : inv.matrah;
        if (document.getElementById('tutar' + i) && tutarVal !== undefined) setVal(document.getElementById('tutar' + i), tutarVal.toString().replace('.', ','));

        const kdvSelect = document.getElementById('kdvOran2_' + i) || document.getElementById('kdvOran1_' + i);
        if (kdvSelect) setVal(kdvSelect, inv.kdvOran || (inv.kdvOrani ? parseFloat(inv.kdvOrani).toFixed(1) : '20.0'));

        const kdvTutarVal = inv.kdvTutar !== undefined ? inv.kdvTutar : inv.kdvTutari;
        if (document.getElementById('kdvTutar' + i) && kdvTutarVal !== undefined) setVal(document.getElementById('kdvTutar' + i), kdvTutarVal.toString().replace('.', ','));

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHizliFisButton);
  } else {
    injectHizliFisButton();
  }

  const observer = new MutationObserver(injectHizliFisButton);
  observer.observe(document.body, { childList: true, subtree: true });
})();
`;

fs.writeFileSync(path.join(extDir, 'luca_content.js'), lucaContentCode, 'utf8');
console.log('luca_content.js updated');

console.log('BACKGROUND DIRECT AUTOMATION ENGINE INSTALLED!');
