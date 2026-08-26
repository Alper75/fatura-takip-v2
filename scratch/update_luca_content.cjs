const fs = require('fs');
const path = require('path');

const lucaContentPath = path.resolve(__dirname, '../../luca_extension/luca_content.js');

const newContent = `// Luca Aktarım Eklentisi - Luca Sayfa Köprüsü ve Hızlı Fiş Menü Enjeksiyonu (v2.1.0)

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
            console.log("[Luca Bridge] İstisna kodu otomatik seçiliyor:", target);
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
    } catch (err) {
      console.warn("[Luca Bridge] İstisna popup yakalanamadı:", err);
    }
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

    // Özel Enjeksiyon Konteyneri
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

    // Buton Durumunu Güncelle
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

    // Temizle Butonu Olayı
    clearBtn.onclick = (e) => {
      e.preventDefault();
      if (!confirm("Aktarım kuyruğundaki faturaları temizlemek istiyor musunuz?")) return;
      chrome.storage.local.get(['transferData'], (res) => {
        const data = res.transferData || {};
        delete data.invoices;
        chrome.storage.local.set({ transferData: data }, () => {
          updateButtonBadge();
          showToast("Aktarım kuyruğu temizlendi.");
        });
      });
    };

    // Aktar Butonu Olayı
    mainBtn.onclick = async (e) => {
      e.preventDefault();
      chrome.storage.local.get(['transferData'], async (res) => {
        const invList = res.transferData?.invoices || [];
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
          showToast(\`\${invList.length} adet fatura başarıyla aktarıldı! Şimdi 'Ekranı Kaydet' veya 'Fiş Kes' butonuna basabilirsiniz.\`);

          // Kuyruğu temizle
          const data = res.transferData || {};
          delete data.invoices;
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
      
      // Satır henüz yoksa Alt+E ile açılmasını bekle
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

  // Sayfa yüklendiğinde ve dinamik güncellemelerde butonu yerleştir
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHizliFisButton);
  } else {
    injectHizliFisButton();
  }

  const observer = new MutationObserver(() => {
    injectHizliFisButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Chrome storage değiştiğinde buton rozetini güncelle
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

fs.writeFileSync(lucaContentPath, newContent, 'utf8');
console.log('luca_content.js updated with Hızlı Fiş direct button injection!');
