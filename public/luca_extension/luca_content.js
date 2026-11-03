// Luca Aktarım Eklentisi - Luca Sayfa Köprüsü ve Hızlı Fiş Menü Enjeksiyonu (v2.1.0)
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
          mainBtn.innerHTML = `🚀 <b>Faturaları Aktar</b> <span id="fatura-takip-badge" style="background:#10b981; color:#fff; padding:1px 7px; border-radius:10px; font-size:11px; margin-left:4px;">${invList.length}</span>`;
        } else {
          mainBtn.style.background = '#64748b';
          mainBtn.innerHTML = `⚡ <b>Fatura Aktar</b> <span id="fatura-takip-badge" style="background:#475569; color:#fff; padding:1px 6px; border-radius:10px; font-size:11px; margin-left:4px;">0</span>`;
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
        mainBtn.innerHTML = `⏳ <b>Aktarılıyor... (0/${invList.length})</b>`;

        try {
          await runHizliFisFill(invList, (current, total) => {
            mainBtn.innerHTML = `⏳ <b>Aktarılıyor... (${current}/${total})</b>`;
          });

          mainBtn.innerHTML = `✅ <b>Tamamlandı (${invList.length})</b>`;
          mainBtn.style.background = '#10b981';
          showToast(`${invList.length} adet fatura başarıyla aktarıldı!`);

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
          const kodEl = document.getElementById('kodNo' + i) || document.querySelector(`[name="detaylar[${i}].kodNo"]`);
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
        let topVal = inv.toplamTutar !== undefined ? inv.toplamTutar : inv.toplam;
        const matNum = parseFloat(String(inv.tutar !== undefined ? inv.tutar : (inv.matrah || 0)).replace(',', '.')) || 0;
        const kdvNum = parseFloat(String(inv.kdvTutar !== undefined ? inv.kdvTutar : (inv.kdvTutari || 0)).replace(',', '.')) || 0;
        if (matNum > 0 && kdvNum > 0 && (!topVal || parseFloat(String(topVal).replace(',', '.')) === matNum)) {
          topVal = Math.round((matNum + kdvNum) * 100) / 100;
        }
        if (topEl && topVal !== undefined) setVal(topEl, topVal.toString().replace('.', ','));

        if (isTevkifatli && document.getElementById('tevkifat' + i)) setVal(document.getElementById('tevkifat' + i), inv.tevkifat);

        // 1. Stopaj Tutarı: İşletme defterinde stopaj tutarı yazılmaz (0 veya boş bırakılır)

        // 2. Multiselect Alanlarını Doldurma Yardımcısı (td24, td25, td26, td27)
        const setMultiSelectField = async (colName, targetVal, labelKeywords, isStopaj = false) => {
          const sSelect = document.getElementById(colName + i) 
            || document.querySelector('select[name="detaylar[' + i + '].' + colName + '"]')
            || (document.getElementById('islem' + i) ? document.getElementById('islem' + i).closest('tr')?.querySelector('.' + colName + 'Td select') : null);
          
          const m = sSelect ? sSelect.closest('.multiselect') : (
            document.getElementById('islem' + i) ? document.getElementById('islem' + i).closest('tr')?.querySelector('.' + colName + 'Td .multiselect') : null
          );
          
          const valStr = (targetVal || '').toString().trim();

          if (!valStr || valStr === '0') {
            if (sSelect) {
              sSelect.value = '';
              sSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (m) {
              m.querySelectorAll('.checkboxes input:checked').forEach(c => {
                c.click();
                c.checked = false;
                c.dispatchEvent(new Event('change', { bubbles: true }));
              });
              const cbDiv = m.querySelector('.checkboxes');
              if (cbDiv && cbDiv.style.display !== 'none') {
                const box = m.querySelector('.overSelect') || m.querySelector('.selectBox');
                if (box) box.click();
              }
            }
            if (isStopaj && typeof window.stopaj_kodu_degisti === 'function' && sSelect) {
              try { window.stopaj_kodu_degisti(sSelect); } catch(e) {}
            }
            return;
          }

          // Değer varsa:
          if (sSelect) {
            sSelect.value = valStr;
            sSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }

          if (m) {
            const box = m.querySelector('.overSelect') || m.querySelector('.selectBox');
            const cbDiv = m.querySelector('.checkboxes');

            // Checkbox listesi dinamik yüklenir, kutuyu tıkla
            if (box) {
              box.click();
              if (!cbDiv || cbDiv.children.length === 0) {
                await new Promise(r => setTimeout(r, 40));
              }
            }

            const sCode = valStr.split('-')[0].trim();
            let chk = m.querySelector('.checkboxes input[value="' + valStr + '"]')
              || m.querySelector('.checkboxes input[value^="' + valStr + '-"]')
              || m.querySelector('.checkboxes input[value^="' + valStr + '"]')
              || (sCode ? m.querySelector('.checkboxes input[value="' + sCode + '"]') : null)
              || (sCode ? m.querySelector('.checkboxes input[value^="' + sCode + '"]') : null);

            if (!chk && labelKeywords && labelKeywords.length > 0) {
              const labels = Array.from(m.querySelectorAll('.checkboxes label'));
              const foundLabel = labels.find(l => {
                const txt = (l.innerText || '').toLowerCase();
                return labelKeywords.some(kw => txt.includes(kw.toLowerCase()));
              });
              if (foundLabel) chk = foundLabel.querySelector('input') || foundLabel;
            }

            if (chk) {
              if (!chk.checked) {
                chk.click();
                chk.checked = true;
                chk.dispatchEvent(new Event('change', { bubbles: true }));
              }
            } else {
              // Eğer spesifik checkbox bulunamazsa ama tek seçenek veya default varsa ilkini seç
              const firstChk = m.querySelector('.checkboxes input');
              if (firstChk && !isStopaj && !firstChk.checked) {
                firstChk.click();
                firstChk.checked = true;
                firstChk.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }

            // Dropdown açık kaldıysa kapat
            if (cbDiv && cbDiv.style.display !== 'none' && box) {
              box.click();
            }
          }

          if (isStopaj && typeof window.stopaj_kodu_degisti === 'function' && sSelect) {
            try { window.stopaj_kodu_degisti(sSelect); } catch(e) {}
          }
        };

        // 1. Belge Türü (DB)
        const isAlisRow = (inv.islem === '1' || inv.tur === '1' || inv.tur === 'gider' || inv.tip === 'ALIS');
        const fNoStr = (inv.evrakNo || inv.faturaNo || inv.no || '').toString().trim();
        const isSmm = fNoStr.startsWith('SMM') || inv.tur === 'smm' || inv.tip === 'smm';
        const isEBelge = fNoStr.length >= 16 || fNoStr.startsWith('GİB') || fNoStr.startsWith('EAR') || fNoStr.startsWith('EAF') || fNoStr.startsWith('FAT');
        
        let beyanVal = inv.beyanBelgeTuru;
        if (!beyanVal) {
          if (isSmm) beyanVal = '8';
          else if (isAlisRow) beyanVal = isEBelge ? '9' : '1';
          else beyanVal = isEBelge ? '7' : '1';
        }
        await setMultiSelectField('beyanBelgeTuru', beyanVal, isSmm ? ['serbest', 'smm'] : (isEBelge ? ['arşiv', 'fatura', 'e-'] : ['fatura']), false);

        // 2. Alış/Satış Türü
        await setMultiSelectField('alisSatisTuru', inv.alisSatisTuru || '1', ['normal', 'satış', 'alış', '1'], false);

        // 3. Kayıt Alt Türü
        await setMultiSelectField('kayitAltTuru', inv.kayitAltTuru || '1', ['mal', 'hizmet', '1'], false);

        // 4. Stopaj Kodu (Sadece fiilen stopaj tutari > 0 olanlarda secilir)
        const stopajKoduVal = (inv.stopajKodu || inv.stopaj_kodu || '').toString().trim();
        const sTutarNum = typeof inv.stopajTutari === 'number' 
          ? inv.stopajTutari 
          : (parseFloat(String(inv.stopajTutari || inv.stopaj_tutari || inv.stopajTutar || '0').replace(',', '.')) || 0);
        const hasStopaj = sTutarNum > 0 && stopajKoduVal && stopajKoduVal !== '0';
        await setMultiSelectField('stopajKodu', hasStopaj ? stopajKoduVal : '', hasStopaj ? [stopajKoduVal.split('-')[0]] : [], true);

        // 5. Stopaj Tutarı alanını her ihtimale karşı temizle / dokunma
        const sTutarEl = document.getElementById('stopajTutari' + i) || document.querySelector('input[name="detaylar[' + i + '].stopajTutari"]');
        if (sTutarEl && !hasStopaj) {
          sTutarEl.value = '';
          sTutarEl.dispatchEvent(new Event('input', { bubbles: true }));
          sTutarEl.dispatchEvent(new Event('change', { bubbles: true }));
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
            mainBtn.innerHTML = `🚀 <b>Faturaları Aktar</b> <span id="fatura-takip-badge" style="background:#10b981; color:#fff; padding:1px 7px; border-radius:10px; font-size:11px; margin-left:4px;">${count}</span>`;
          } else {
            mainBtn.style.background = '#64748b';
            mainBtn.innerHTML = `⚡ <b>Fatura Aktar</b> <span id="fatura-takip-badge" style="background:#475569; color:#fff; padding:1px 6px; border-radius:10px; font-size:11px; margin-left:4px;">0</span>`;
          }
        }
      }
    });
  }

  // --- 4. MAHSUP / YEVMİYE FİŞİ DOLDURMA MOTORU (Bilanço & Banka) ---
  async function runMahsupFill(rows, isBank = false) {
    if (!rows || rows.length === 0) {
      showToast("Aktarılacak satır bulunamadı!");
      return;
    }

    // Fiş çerçevesini bul (#frm3 veya aktif sayfa)
    let doc = document;
    if (window.frames && window.frames.frm3 && window.frames.frm3.document) {
      doc = window.frames.frm3.document;
    } else if (document.querySelector('#frm3') && document.querySelector('#frm3').contentDocument) {
      doc = document.querySelector('#frm3').contentDocument;
    }

    const isFisPage = !!doc.querySelector('input[name="HESAP_KODU"], input[name*="hesapKodu"]') ||
                      !!doc.getElementById('scroll') ||
                      !!doc.getElementById('hpTable') ||
                      !!doc.forms['fisDetayFormArray'];

    if (!isFisPage) {
      showToast("Lütfen Luca'da 'Yevmiye Fiş Girişi' (addFis.do) ekranını açın!");
      return;
    }

    showToast(`Mahsup satırları yazılıyor (${rows.length} satır)...`);

    const setVal = (el, val) => {
      if (!el || val === undefined || val === null || val === '') return;
      el.focus();
      el.value = val;
      el.setAttribute('value', val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    };

    const pressAltE = (prevTr) => {
      // 1. Önceki satırın "+" butonunu tıkla (varsa en güvenli 1 satır ekleme)
      if (prevTr) {
        const plusBtn = prevTr.querySelector('td.add_delete input[value="+"], input[title*="Ekle"], input[onclick*="addRow"]');
        if (plusBtn) {
          try {
            plusBtn.focus();
            plusBtn.click();
            return;
          } catch(e) {}
        }
      }

      // 2. Alt+E Klavye kısayolu (Luca standardı: keyCode 69)
      const evtDown = new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true, cancelable: true });
      const evtUp = new KeyboardEvent('keyup', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true, cancelable: true });
      
      if (window.frames?.frm3?.document) {
        window.frames.frm3.document.dispatchEvent(evtDown);
        window.frames.frm3.document.dispatchEvent(evtUp);
      }
      doc.dispatchEvent(evtDown);
      doc.dispatchEvent(evtUp);
      if (doc.body) {
        doc.body.dispatchEvent(evtDown);
        doc.body.dispatchEvent(evtUp);
      }

      // 3. addRow tek satır (kesinlikle 3 parametresi verilmez, tek satır için addRow(null, 1))
      if (typeof doc.defaultView?.satirEkle === 'function') {
        try { doc.defaultView.satirEkle(); return; } catch(e) {}
      } else if (typeof doc.defaultView?.addRow === 'function') {
        try { doc.defaultView.addRow(null, 1); return; } catch(e) {}
      }
    };

    const getRowByIndex = (idx) => {
      // 1. Doğrudan görünür HESAP_KODU inputları üzerinden satırı bul (en hızlı ve garantili yol)
      const isVisible = (el) => el && el.type !== 'hidden' && el.offsetParent !== null;
      const kodInputs = Array.from(doc.querySelectorAll('input[name="HESAP_KODU"], input[name*="hesapKodu"], input[id*="hesapKodu"]')).filter(isVisible);
      if (kodInputs[idx]) {
        const tr = kodInputs[idx].closest('tr');
        if (tr) return tr;
      }

      // 2. ID ile bul (#tr1, #tr2, #tr0, #tr_1 vb.)
      const trById = doc.getElementById('tr' + (idx + 1)) || doc.getElementById('tr' + idx) || doc.getElementById('tr_' + (idx + 1));
      if (trById) return trById;

      // 3. Tablo satırlarını tara
      const allRows = Array.from(doc.querySelectorAll('#scroll tbody tr, table tbody tr, tr[id*="tr"]')).filter(r => {
        return !!r.querySelector('input[name*="HESAP_KODU"], input[name*="hesapKodu"]') || (r.cells && r.cells.length >= 7);
      });
      return allRows[idx] || null;
    };

    const formatTutar = (val) => {
      if (val === undefined || val === null || val === '') return '';
      const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
      if (isNaN(num) || num === 0) return '';
      return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDateTR = (dStr) => {
      if (!dStr) return '';
      const str = String(dStr).trim().split(' ')[0].split('T')[0];
      if (str.includes('/')) {
        const p = str.split('/');
        if (p.length === 3) return p[0].length === 4 ? `${p[2].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[0]}` : `${p[0].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[2]}`;
      }
      if (str.includes('.')) {
        const p = str.split('.');
        if (p.length === 3) return p[0].length === 4 ? `${p[2].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[0]}` : `${p[0].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[2]}`;
      }
      if (str.includes('-')) {
        const p = str.split('-');
        if (p.length === 3) return `${p[2].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[0]}`;
      }
      return str;
    };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      let tr = getRowByIndex(i);

      if (!tr) {
        pressAltE(i > 0 ? getRowByIndex(i - 1) : null);
        let wait = 0;
        while (!getRowByIndex(i) && wait < 20) {
          await new Promise(res => setTimeout(res, 50));
          wait++;
        }
        tr = getRowByIndex(i);
      }

      if (!tr) {
        const allVisible = Array.from(doc.querySelectorAll('tr')).filter(row => row.querySelector('input[name="HESAP_KODU"], input[name*="hesapKodu"]'));
        if (allVisible[i]) {
          tr = allVisible[i];
        } else {
          console.warn(`[Luca Bridge] Satır #${i + 1} oluşturulamadı, devam ediliyor.`);
          continue;
        }
      }

      const codeInput = tr.querySelector('input[name="HESAP_KODU"], input[name*="hesapKodu"]') || 
                        tr.children?.HESAP_KODU || 
                        tr.cells?.[1]?.querySelector('input[type="text"]');
      const docNoInput = tr.querySelector('input[name="EVRAK_NO"], input[name*="evrakNo"]') || 
                         tr.children?.EVRAK_NO || 
                         tr.cells?.[3]?.querySelector('input[type="text"]');
      const dateInput = tr.querySelector('input[name="EVRAK_TARIH"], input[name*="evrakTarih"]') || 
                        tr.children?.EVRAK_TARIH || 
                        tr.cells?.[4]?.querySelector('input[type="text"]');
      const docTypeInput = tr.querySelector('input[name="BELGE_TURU"], input[name*="belgeTur"]') || 
                           tr.children?.BELGE_TURU || 
                           tr.cells?.[5]?.querySelector('input[type="text"]');
      const descInput = tr.querySelector('input[name="ACIKLAMA"], input[name*="aciklama"]') || 
                        tr.children?.ACIKLAMA || 
                        tr.cells?.[7]?.querySelector('input[type="text"]');
      const debitInput = tr.querySelector('input[name="BORC"], input[name*="borc"]') || 
                         tr.children?.BORC || 
                         tr.cells?.[8]?.querySelector('input[type="text"]');
      const creditInput = tr.querySelector('input[name="ALACAK"], input[name*="alacak"]') || 
                          tr.children?.ALACAK || 
                          tr.cells?.[9]?.querySelector('input[type="text"]');
      const qtyInput = tr.querySelector('input[name="MIKTAR"], input[name*="miktar"]') || 
                       tr.children?.MIKTAR || 
                       tr.cells?.[10]?.querySelector('input[type="text"]');

      // 1. Hesap Kodu
      const codeVal = (r.account_code || r.hesapKodu || r.muhasebeKodu || r['Hesap Kodu'] || r.kod || '').trim();
      if (codeInput && codeVal) {
        setVal(codeInput, codeVal);
        codeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, which: 9, bubbles: true }));
        codeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        if (tr.cells?.[2]) {
          const c2 = tr.cells[2].querySelector('input[type="text"]') || tr.cells[2];
          c2.click();
        }
      }

      // 2. Evrak No
      const evrakNoVal = r.document_no || r.evrakNo || r.no || '';
      if (docNoInput) setVal(docNoInput, evrakNoVal);

      // 3. Tarih
      const dateVal = formatDateTR(r.document_date || r.evrakTarihi || r.tarih || '');
      if (dateInput) setVal(dateInput, dateVal);

      // 4. Belge Türü
      const docTypeVal = r.document_type || r.belgeTuru || '1';
      if (docTypeInput) setVal(docTypeInput, docTypeVal);

      // 5. Açıklama
      const descVal = r.description || r.aciklama || '';
      if (descInput) setVal(descInput, descVal);

      // 6. Borç / Alacak Tutarları (Banka ve Mahsup için tam uyumlu)
      const debitRaw = (r.formatted_debit !== undefined && r.formatted_debit !== '') 
        ? r.formatted_debit 
        : (r.borc !== undefined ? r.borc : (r.tur === 'borc' ? r.tutar : ''));
      const creditRaw = (r.formatted_credit !== undefined && r.formatted_credit !== '') 
        ? r.formatted_credit 
        : (r.alacak !== undefined ? r.alacak : (r.tur === 'alacak' ? r.tutar : ''));

      const debitVal = formatTutar(debitRaw);
      const creditVal = formatTutar(creditRaw);
      if (debitInput) setVal(debitInput, debitVal);
      if (creditInput) setVal(creditInput, creditVal);

      // 7. Miktar
      const qtyVal = r.quantity || r.miktar || '';
      if (qtyInput && qtyVal) setVal(qtyInput, String(qtyVal));

      // 8. Ba-Bs Kutusu & Cari Modal
      if (r.babs) {
        const babsCb = tr.querySelector('.babs-td input[type="checkbox"], input[name*="babs"]');
        if (babsCb && !babsCb.checked) {
          babsCb.click();
          babsCb.checked = true;
          const cariCodeEl = doc.getElementById('cari_hesap_kodu_c');
          const cariTamamBtn = doc.getElementById('cari_tamam');
          if (cariCodeEl && r.contact_account_code) {
            cariCodeEl.value = r.contact_account_code;
            cariCodeEl.dispatchEvent(new FocusEvent('focus'));
            if (doc.getElementById('islem_turu_c')) doc.getElementById('islem_turu_c').value = '1';
            setTimeout(() => { if (cariTamamBtn) cariTamamBtn.click(); }, 30);
          }
        }
      }

      // 9. Satır Onay
      if (descInput) descInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));

      // SADECE son satır değilse ve sıradaki satır DOM'da henüz YOKSA bir sonraki satırı aç
      if (i < rows.length - 1) {
        await new Promise(res => setTimeout(res, 60));
        if (!getRowByIndex(i + 1)) {
          pressAltE(tr);
          let wait = 0;
          while (!getRowByIndex(i + 1) && wait < 20) {
            await new Promise(res => setTimeout(res, 40));
            wait++;
          }
        }
      }
    }

    showToast(`Tebrikler! ${rows.length} mahsup satırı başarıyla aktarıldı.`);
  }

  // --- 5. RUNTIME MESAJ DİNLEYİCİSİ (Popup ve Web App İstekleri) ---
  if (isRuntimeValid() && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // A. HESAP PLANI KAZIMA / ÇEKME
      if (message.type === 'SCRAPE_PAGE_ACCOUNTS' || message.type === 'SCRAPE_ACCOUNTS') {
        (async () => {
          const accounts = [];
          const seen = new Set();
          const addAcc = (code, name) => {
            const c = (code || '').trim();
            const n = (name || '').trim();
            if (/^\d{3}(\.[0-9A-Za-z_]+)*$/.test(c) && n && !seen.has(c)) {
              seen.add(c);
              accounts.push({ code: c, kod: c, name: n, ad: n });
            }
          };

          // 1. Tüm sayfa ve frame'lerdeki tabloları tara
          const docs = [document];
          try {
            if (window.frames) {
              for (let f = 0; f < window.frames.length; f++) {
                try { if (window.frames[f]?.document) docs.push(window.frames[f].document); } catch(e) {}
              }
            }
          } catch(e) {}

          for (const d of docs) {
            const tables = Array.from(d.querySelectorAll('table'));
            for (const table of tables) {
              const rows = Array.from(table.querySelectorAll('tr'));
              for (const row of rows) {
                if (row.querySelector('th')) continue;
                const cells = Array.from(row.querySelectorAll('td')).map(td => (td.innerText || '').trim());
                for (let ci = 0; ci < Math.min(cells.length, 3); ci++) {
                  if (/^\d{3}(\.[0-9A-Za-z_]+)+$/.test(cells[ci])) {
                    addAcc(cells[ci], cells[ci + 1]);
                    break;
                  }
                }
              }
            }
          }

          // 2. Eğer tabloda bulunamadıysa, sayfa bağlamından listAltHesapTempAction.do isteği at
          if (accounts.length === 0) {
            try {
              const endpoints = [
                '/Luca/listAltHesapTempAction.do?bakiyeGetir=1&hesapKodu=',
                '/Luca/listAltHesapTempAction.do?hesapKodu='
              ];
              for (const ep of endpoints) {
                const res = await fetch(ep, { credentials: 'include' });
                const txt = await res.text();
                // XML parsing
                const xmlRegex = /<(?:hesapKodu|kod)[^>]*>([\s\S]*?)<\/(?:hesapKodu|kod)>[\s\S]*?<(?:hesapAdi|ad)[^>]*>([\s\S]*?)<\/(?:hesapAdi|ad)>/gi;
                let xm;
                while ((xm = xmlRegex.exec(txt)) !== null) {
                  addAcc(xm[1].replace(/<[^>]+>/g, ''), xm[2].replace(/<[^>]+>/g, ''));
                }
                if (accounts.length > 0) break;
              }
            } catch(e) {}
          }

          if (accounts.length > 0) {
            chrome.storage.local.set({ lucaAccounts: accounts, lastSyncTime: new Date().toISOString() });
            sendResponse({ status: 'success', data: accounts });
          } else {
            sendResponse({ status: 'error', message: 'Hesap planı tablosu veya verisi bulunamadı.' });
          }
        })();
        return true;
      }

      // B. HIZLI FİŞ AKTARIMI
      if (message.type === 'TRIGGER_HIZLI_FIS_AKTAR') {
        chrome.storage.local.get(['transferData'], async (res) => {
          const invList = res.transferData?.invoices || res.transferData?.hizliFisItems || [];
          if (invList && invList.length > 0) {
            await runHizliFisFill(invList);
            sendResponse({ status: 'success', count: invList.length });
          } else {
            sendResponse({ status: 'error', message: 'Kuyrukta fatura bulunamadı.' });
          }
        });
        return true;
      }

      // C. MAHSUP VE BANKA AKTARIMI
      if (message.type === 'TRIGGER_MAHSUP_AKTAR' || message.type === 'TRIGGER_BANKA_AKTAR') {
        // Eğer ana penceredeysek ve alt fiş penceresi (frm3) varsa, işlemi doğrudan o iframe'in içerik scripti yürütür
        if (window.self === window.top && (window.frames?.frm3 || document.querySelector('#frm3'))) {
          return false;
        }

        // Fiş ekranı olmayan frame'ler sessizce atlasın
        const docCheck = document;
        const isFis = !!docCheck.querySelector('input[name="HESAP_KODU"], input[name*="hesapKodu"]') ||
                      !!docCheck.getElementById('scroll') ||
                      !!docCheck.getElementById('hpTable') ||
                      !!docCheck.forms['fisDetayFormArray'];
        if (!isFis && window.self !== window.top) return false;
        chrome.storage.local.get(['transferData'], async (res) => {
          const isBank = message.type === 'TRIGGER_BANKA_AKTAR';
          const rows = isBank 
            ? (res.transferData?.bankTransactions || res.transferData?.mahsupRows || [])
            : (res.transferData?.mahsupRows || []);
          if (rows && rows.length > 0) {
            await runMahsupFill(rows, isBank);
            sendResponse({ status: 'success', count: rows.length });
          } else {
            sendResponse({ status: 'error', message: 'Kuyrukta aktarılacak satır bulunamadı.' });
          }
        });
        return true;
      }
    });
  }

  // Hesap Planı Kazıma Eski Destek
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
