const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');

// ==================== 1. fatura_content.js ====================
const faturaContentCode = `// fatura_content.js - Fatura Takip uygulamasından verileri yakalar
(function() {
  console.log("Fatura Takip Content Script yüklendi.");

  function forwardToExtension(type, data) {
    if (chrome && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({ type, data }, (res) => {
        if (chrome.runtime.lastError) {
          // ignore
        }
      });
    }
  }

  // Fatura & Mahsup
  window.addEventListener('FATURA_APP_LUCA_DATA', (e) => {
    if (e.detail) forwardToExtension('SET_TRANSFER_DATA', e.detail);
  });
  window.addEventListener('FATURA_APP_LUCA_SEND_ISLETME', (e) => {
    if (e.detail) forwardToExtension('SET_TRANSFER_DATA', { isIsletme: true, invoices: e.detail });
  });
  window.addEventListener('FATURA_APP_LUCA_SEND_MAHSUP', (e) => {
    if (e.detail) forwardToExtension('SET_TRANSFER_DATA', { isIsletme: false, mahsupRows: e.detail });
  });

  // Cari Oluşturma
  window.addEventListener('FATURA_APP_LUCA_CREATE_CARI', (e) => {
    if (e.detail) {
      forwardToExtension('SET_CREATE_CARI', e.detail);
      localStorage.setItem('fatura_app_luca_create_cari', JSON.stringify(e.detail));
    }
  });

  window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (e.data.type === 'FATURA_APP_LUCA_DATA') {
      forwardToExtension('SET_TRANSFER_DATA', e.data.detail || e.data.payload || e.data.data);
    } else if (e.data.type === 'FATURA_APP_LUCA_CREATE_CARI') {
      const payload = e.data.detail || e.data.payload || e.data.cari;
      forwardToExtension('SET_CREATE_CARI', payload);
      localStorage.setItem('fatura_app_luca_create_cari', JSON.stringify(payload));
    }
  });

  // Periyodik kontrol
  setInterval(() => {
    const rawCari = localStorage.getItem('fatura_app_luca_create_cari');
    if (rawCari) {
      try {
        const parsed = JSON.parse(rawCari);
        forwardToExtension('SET_CREATE_CARI', parsed);
      } catch(e) {}
    }
  }, 2000);
})();
`;

fs.writeFileSync(path.join(extDir, 'fatura_content.js'), faturaContentCode, 'utf8');
console.log('fatura_content.js updated');

// ==================== 2. background.js ====================
const backgroundCode = `// background.js - Service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_TRANSFER_DATA') {
    chrome.storage.local.set({ transferData: message.data }, () => {
      sendResponse({ status: 'ok' });
    });
    return true;
  }
  if (message.type === 'SET_CREATE_CARI') {
    chrome.storage.local.set({ createCariData: message.data }, () => {
      sendResponse({ status: 'ok' });
    });
    return true;
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
const lucaContentCode = `// luca_content.js - Luca Sayfası İçi Otomasyon ve Güvenlik Kilidi
(function() {
  console.log("Luca Content Script v2.1 (Firma Güvenlik Kilidi + Cari Açma) yüklendi.");

  function isRuntimeValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  }

  // ==================== 🛡️ FİRMA DOĞRULAMA GÜVENLİK KİLİDİ ====================
  function getLucaActiveCompanyInfo() {
    try {
      const topDoc = window.top ? window.top.document : document;
      const allText = (topDoc.body ? topDoc.body.innerText : '') + ' ' + (topDoc.title || '');
      
      const elMusteri = topDoc.getElementById('musteriAdi') || topDoc.querySelector('.musteri-adi') || topDoc.querySelector('#sirketAdi');
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

    // 1. VKN Kontrolü
    if (targetVkn && targetVkn.length >= 10 && allText.includes(targetVkn)) {
      return { ok: true, matchedBy: 'VKN (' + targetVkn + ')' };
    }

    // 2. Ünvan İlk Kelime Kontrolü
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
      <div style="background:white; border-radius:16px; width:480px; max-width:90vw; padding:24px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); border:2px solid #ef4444; text-align:center; animation:popIn 0.2s ease;">
        <div style="width:56px; height:56px; background:#fee2e2; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 16px auto; font-size:28px;">
          ⛔
        </div>
        <h2 style="margin:0 0 8px 0; color:#991b1b; font-size:19px; font-weight:800;">FİRMA UYUŞMAZLIĞI GÜVENLİK KİLİDİ!</h2>
        <p style="margin:0 0 16px 0; color:#475569; font-size:13px; line-height:1.5;">
          Yanlış firmaya işlem yapılmaması için aktarım güvenlik kilidi tarafından <b>anında durduruldu</b>.
        </p>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; text-align:left; font-size:13px; margin-bottom:16px;">
          <div style="color:#64748b; font-size:11px; font-weight:bold; text-transform:uppercase;">İşlem Yapılmak İstenen Firma:</div>
          <div style="color:#0f172a; font-weight:bold; font-size:14px; margin-top:2px;">\${targetCompany.unvan || 'Bilinmiyor'}</div>
          <div style="color:#475569; font-size:12px; font-family:monospace; margin-top:2px;">VKN: \${targetCompany.vkn || '-'}</div>
        </div>
        <p style="color:#b91c1c; font-size:12px; font-weight:600; margin-bottom:20px; line-height:1.4;">
          Lütfen Luca'da yukarıdaki doğru mükellefi açın ve işlemi ardından tekrar başlatın.
        </p>
        <button id="close-security-modal-btn" style="width:100%; padding:11px 16px; background:#0f172a; color:white; border:none; border-radius:8px; font-weight:bold; font-size:13px; cursor:pointer; transition:all 0.2s;">
          Anladım, Kapat
        </button>
      </div>
    \`;
    document.body.appendChild(modal);
    document.getElementById('close-security-modal-btn').onclick = () => modal.remove();
  }

  // ==================== 🚀 CARİ KARTI OLUŞTURMA OTOMASYONU ====================
  function checkAndInjectCariBar() {
    if (!isRuntimeValid()) return;
    chrome.storage.local.get(['createCariData'], (res) => {
      const data = res.createCariData;
      if (!data || !data.cari || !data.cari.hesapKodu) {
        const existingBar = document.getElementById('luca-cari-create-bar');
        if (existingBar) existingBar.remove();
        return;
      }

      if (document.getElementById('luca-cari-create-bar')) return;

      const cari = data.cari;
      const targetCompany = data.targetCompany || {};

      const bar = document.createElement('div');
      bar.id = 'luca-cari-create-bar';
      bar.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:9999999; background:#0f172a; color:white; padding:14px 20px; border-radius:12px; box-shadow:0 20px 35px rgba(0,0,0,0.35); border:1px solid #334155; display:flex; align-items:center; gap:16px; font-family:sans-serif;";
      bar.innerHTML = \`
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div style="font-size:11px; color:#38bdf8; font-weight:bold; text-transform:uppercase; display:flex; align-items:center; gap:6px;">
            <span>⚡ Yeni Cari Açma Paketi</span>
            <span style="background:#1e293b; color:#94a3b8; padding:1px 6px; border-radius:4px; font-size:10px;">\${targetCompany.unvan || ''}</span>
          </div>
          <div style="font-size:13px; font-weight:bold; color:#fff;">
            \${cari.hesapKodu} - \${cari.unvan}
          </div>
          <div style="font-size:11px; color:#94a3b8;">VKN: \${cari.vknTckn || '-'} | VD: \${cari.vergiDairesi || '-'}</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button id="luca-cari-fill-btn" style="background:#10b981; hover:background:#059669; color:white; border:none; padding:8px 16px; border-radius:8px; font-weight:bold; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(16,185,129,0.3);">
            🚀 Forma Doldur & Kaydet
          </button>
          <button id="luca-cari-dismiss-btn" style="background:#334155; color:#cbd5e1; border:none; padding:8px 12px; border-radius:8px; font-size:11px; cursor:pointer;">
            ✕
          </button>
        </div>
      \`;

      document.body.appendChild(bar);

      document.getElementById('luca-cari-dismiss-btn').onclick = () => {
        bar.remove();
        chrome.storage.local.remove(['createCariData']);
      };

      document.getElementById('luca-cari-fill-btn').onclick = async () => {
        // Güvenlik doğrulaması
        const guard = verifyCompanyGuard(targetCompany);
        if (!guard.ok) {
          showSecurityBlockDialog(targetCompany);
          return;
        }

        // Form alanlarını doldur
        const fillResult = fillLucaCariForm(cari);
        if (fillResult.success) {
          showToast('✅ Cari (' + cari.hesapKodu + ') formuna başarıyla dolduruldu!');
          bar.remove();
          chrome.storage.local.remove(['createCariData']);
        } else {
          showToast('⚠️ Luca Hesap Planı / Cari giriş ekranı bulunamadı. Lütfen Muhasebe > Hesap Planı menüsüne geçin.');
        }
      };
    });
  }

  function fillLucaCariForm(cari) {
    let filledAny = false;

    const setInputVal = (el, val) => {
      if (!el || val === undefined || val === null) return;
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      filledAny = true;
    };

    // Luca Hesap Planı & Cari Girişi input selector'ları
    const kodInput = document.getElementById('HESAP_KODU') || document.querySelector('[name="hesapKodu"]') || document.querySelector('[name="HESAP_KODU"]') || document.getElementById('hesapKodu');
    const adInput = document.getElementById('HESAP_ADI') || document.querySelector('[name="hesapAdi"]') || document.querySelector('[name="HESAP_ADI"]') || document.getElementById('hesapAdi');
    const vknInput = document.getElementById('VERGI_NO') || document.querySelector('[name="vergiNo"]') || document.querySelector('[name="VERGI_NO"]') || document.getElementById('tckn') || document.getElementById('vkn');
    const vdInput = document.getElementById('VERGI_DAIRESI') || document.querySelector('[name="vergiDairesi"]') || document.querySelector('[name="VERGI_DAIRESI"]');

    if (kodInput) setInputVal(kodInput, cari.hesapKodu);
    if (adInput) setInputVal(adInput, cari.unvan);
    if (vknInput) setInputVal(vknInput, cari.vknTckn);
    if (vdInput) setInputVal(vdInput, cari.vergiDairesi);

    // Kaydet butonu tetikleme
    const saveBtn = document.getElementById('kaydetHref') || document.querySelector('button[type="submit"]') || document.getElementById('kaydetBtn');
    if (saveBtn && filledAny) {
      setTimeout(() => {
        saveBtn.click();
      }, 300);
    }

    return { success: filledAny };
  }

  // ==================== ⚡ FATURA & MAHSUP AKTARIM BUTONU ====================
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

    btn.onmouseover = () => { btn.style.transform = 'translateY(-1px)'; btn.style.filter = 'brightness(1.1)'; };
    btn.onmouseout = () => { btn.style.transform = 'none'; btn.style.filter = 'none'; };

    btn.onclick = async () => {
      if (!isRuntimeValid()) return;
      chrome.storage.local.get(['transferData'], async (res) => {
        const transfer = res.transferData;
        if (!transfer) return alert('Aktarılacak fatura verisi bulunamadı!');

        // 🛡️ Firma Güvenlik Kilidi Kontrolü
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
            showToast(\`🎉 \${transfer.invoices.length} adet fatura Luca Hızlı Fiş'e başarıyla aktarıldı!\`);
          } else if (transfer.mahsupRows) {
            showToast(\`🎉 \${transfer.mahsupRows.length} satır mahsup fişine aktarılıyor...\`);
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

        const isTevkifatli = inv.tevkifat && inv.tevkifat !== '0';
        if (document.getElementById('TABLO_TURU' + i)) {
          setVal(document.getElementById('TABLO_TURU' + i), isTevkifatli ? (inv.tablo || '6') : '0');
        }
        if (isTevkifatli) {
          const kodFullVal = inv.kodFull || (inv.kodNo ? (inv.kodNo + ' | ' + (inv.oranStr || '')) : '');
          const kodEl = document.getElementById('kodNo' + i) || document.querySelector(\`[name="detaylar[\${i}].kodNo"]\`);
          if (kodEl) setVal(kodEl, kodFullVal);
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
    toast.style.cssText = "position:fixed; top:20px; right:20px; background:#10b981; color:#fff; padding:12px 24px; border-radius:8px; z-index:99999999; font-weight:bold; font-size:13px; box-shadow:0 10px 25px rgba(0,0,0,0.2); font-family:sans-serif; transition:all 0.3s ease;";
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Başlatıcılar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectHizliFisButton();
      checkAndInjectCariBar();
    });
  } else {
    injectHizliFisButton();
    checkAndInjectCariBar();
  }

  const observer = new MutationObserver(() => {
    injectHizliFisButton();
    checkAndInjectCariBar();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  setInterval(checkAndInjectCariBar, 2500);

  // Storage listener
  if (isRuntimeValid() && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        if (changes.transferData) {
          const badge = document.getElementById('fatura-takip-badge');
          const count = changes.transferData.newValue?.invoices?.length || changes.transferData.newValue?.mahsupRows?.length || 0;
          if (badge) {
            badge.innerText = count;
            badge.style.background = count > 0 ? '#10b981' : '#64748b';
          }
        }
        if (changes.createCariData) {
          checkAndInjectCariBar();
        }
      }
    });
  }
})();
`;

fs.writeFileSync(path.join(extDir, 'luca_content.js'), lucaContentCode, 'utf8');
console.log('luca_content.js updated');

// ==================== 4. popup.html & popup.js ====================
const popupHtmlCode = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Luca Aktarım</title>
  <style>
    :root {
      --primary: #4f46e5;
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }
    .logo-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 18px;
    }
    h1 {
      font-size: 16px;
      font-weight: 700;
      margin: 0;
    }
    .section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      margin-bottom: 6px;
    }
    .btn {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 6px;
      transition: all 0.2s;
    }
    .btn-primary { background: var(--primary); color: white; }
    .btn-success { background: var(--success); color: white; }
    .btn-secondary { background: white; border: 1px solid var(--border); color: var(--text-muted); font-size: 11px; padding: 6px; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-green { background: #dcfce7; color: #166534; }
    .footer { text-align: center; font-size: 10px; color: var(--text-muted); margin-top: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-icon">L</div>
    <div>
      <h1>Luca Aktarım v2.1</h1>
      <div style="font-size: 10px; color: #10b981; font-weight: bold;">🛡️ Güvenlik Kilidi Aktif</div>
    </div>
  </div>

  <!-- Cari Açma Bölümü -->
  <div class="section" id="cari-section">
    <div class="section-title">
      <span>Bekleyen Cari Kartı</span>
      <span class="badge badge-blue" id="cari-badge">Yok</span>
    </div>
    <div class="info-row">
      <span style="color: var(--text-muted);">Cari:</span>
      <span id="cari-unvan" style="font-weight: bold; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">-</span>
    </div>
    <div class="info-row">
      <span style="color: var(--text-muted);">Hesap Kodu:</span>
      <span id="cari-kod" style="font-family: monospace; font-weight: bold; color: var(--primary);">-</span>
    </div>
    <button id="cari-clear-btn" class="btn btn-secondary" style="display: none;">Cari Kuyruğunu Temizle</button>
  </div>

  <!-- Fatura Kuyruğu -->
  <div class="section">
    <div class="section-title">
      <span>Fatura / Mahsup Kuyruğu</span>
      <span class="badge badge-green" id="fatura-badge">0 Fatura</span>
    </div>
    <div class="info-row">
      <span style="color: var(--text-muted);">Bekleyen:</span>
      <span id="fatura-count" style="font-weight: bold;">0 Kayıt</span>
    </div>
    <button id="fatura-clear-btn" class="btn btn-secondary">Fatura Kuyruğunu Temizle</button>
  </div>

  <div class="footer">Luca Entegrasyonu &copy; 2026</div>

  <script src="popup.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(extDir, 'popup.html'), popupHtmlCode, 'utf8');
console.log('popup.html updated');

const popupJsCode = `// popup.js
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['transferData', 'createCariData'], (res) => {
    // Cari
    const cariData = res.createCariData;
    const cariBadge = document.getElementById('cari-badge');
    const cariUnvan = document.getElementById('cari-unvan');
    const cariKod = document.getElementById('cari-kod');
    const cariClearBtn = document.getElementById('cari-clear-btn');

    if (cariData && cariData.cari) {
      cariBadge.innerText = 'Hazır';
      cariBadge.className = 'badge badge-green';
      cariUnvan.innerText = cariData.cari.unvan || '-';
      cariKod.innerText = cariData.cari.hesapKodu || '-';
      cariClearBtn.style.display = 'block';
    } else {
      cariBadge.innerText = 'Yok';
      cariBadge.className = 'badge badge-blue';
      cariUnvan.innerText = '-';
      cariKod.innerText = '-';
      cariClearBtn.style.display = 'none';
    }

    // Fatura
    const transfer = res.transferData;
    const faturaBadge = document.getElementById('fatura-badge');
    const faturaCount = document.getElementById('fatura-count');
    const count = transfer?.invoices?.length || transfer?.mahsupRows?.length || 0;
    faturaBadge.innerText = count + ' Kayıt';
    faturaCount.innerText = count + ' Kayıt';

    // Clear handlers
    cariClearBtn.onclick = () => {
      chrome.storage.local.remove(['createCariData'], () => {
        window.location.reload();
      });
    };

    document.getElementById('fatura-clear-btn').onclick = () => {
      chrome.storage.local.remove(['transferData'], () => {
        window.location.reload();
      });
    };
  });
});
`;

fs.writeFileSync(path.join(extDir, 'popup.js'), popupJsCode, 'utf8');
console.log('popup.js updated');

console.log('ALL LUCAS EXTENSION FILES SUCCESSFULLY UPDATED!');
