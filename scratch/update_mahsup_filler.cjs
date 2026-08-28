const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');
const lucaContentPath = path.join(extDir, 'luca_content.js');

let code = fs.readFileSync(lucaContentPath, 'utf8');

const newFillMahsupTable = `  // MAHSUP FİŞİ TABLOSUNU DOLDURMA MOTORU (HESAP KODLARI, TARİH, EVRAK NO, BORÇ/ALACAK)
  async function fillMahsupTable(rows) {
    let targetDoc = document;
    if (window.frames && window.frames.frm3 && window.frames.frm3.document) {
      targetDoc = window.frames.frm3.document;
    } else {
      const frm3El = document.querySelector('#frm3, iframe[name="frm3"]');
      if (frm3El && frm3El.contentDocument) {
        targetDoc = frm3El.contentDocument;
      }
    }

    const formatDateTR = (dStr) => {
      if (!dStr) return '';
      const str = String(dStr).trim();
      if (str.includes('/') || (str.includes('.') && str.split('.').length === 3)) return str;
      // YYYY-MM-DD -> DD/MM/YYYY
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
        // Alt + E ile yeni satır oluştur
        targetDoc.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, keyCode: 69, which: 69, bubbles: true }));
        let attempts = 0;
        while (!targetDoc.getElementById('tr' + rowIdx) && attempts < 40) {
          await new Promise(res => setTimeout(res, 70));
          attempts++;
        }
        tr = targetDoc.getElementById('tr' + rowIdx);
      }

      if (tr) {
        // 1. Hesap Kodu (children[1] veya [name*="HESAP_KODU"])
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

        await new Promise(res => setTimeout(res, 40));

        // 2. Evrak No (children[3])
        const evrakNoVal = r.evrakNo || r.no || r.faturaNo || r['Evrak No'] || '';
        const evrakNoInput = tr.children[3] ? tr.children[3].querySelector('input') : null;
        if (evrakNoInput && evrakNoVal) setInputVal(evrakNoInput, evrakNoVal);

        // 3. Evrak Tarihi (children[4])
        const tarihVal = r.tarih || r.evrakTarihi || r.faturaTarihi || r['Evrak Tarihi'] || '';
        const evrakTarihInput = tr.children[4] ? tr.children[4].querySelector('input') : null;
        if (evrakTarihInput && tarihVal) setInputVal(evrakTarihInput, formatDateTR(tarihVal));

        // 4. Belge Türü (children[5])
        const belgeTurInput = tr.children[5] ? tr.children[5].querySelector('input') : null;
        if (belgeTurInput) setInputVal(belgeTurInput, r.belgeTuru || r['Belge Türü'] || 'FT');

        // 5. Açıklama (children[7])
        const aciklamaVal = r.aciklama || r.unvan || r['Detay Açıklama'] || '';
        const aciklamaInput = tr.children[7] ? tr.children[7].querySelector('input') : null;
        if (aciklamaInput && aciklamaVal) setInputVal(aciklamaInput, aciklamaVal);

        // 6. Borç / Alacak Tutar (children[8] / children[9])
        const borcVal = r.borc !== undefined && Number(r.borc) > 0 ? r.borc : (r['Borç'] !== undefined && Number(r['Borç']) > 0 ? r['Borç'] : (r.tur === 'borc' ? r.tutar : 0));
        const alacakVal = r.alacak !== undefined && Number(r.alacak) > 0 ? r.alacak : (r['Alacak'] !== undefined && Number(r['Alacak']) > 0 ? r['Alacak'] : (r.tur === 'alacak' ? r.tutar : 0));

        if (borcVal && Number(borcVal) > 0) {
          const borcInput = tr.children[8] ? tr.children[8].querySelector('input') : null;
          if (borcInput) setInputVal(borcInput, formatTutarTR(borcVal));
        } else if (alacakVal && Number(alacakVal) > 0) {
          const alacakInput = tr.children[9] ? tr.children[9].querySelector('input') : null;
          if (alacakInput) setInputVal(alacakInput, formatTutarTR(alacakVal));
        }

        // Sonraki satıra geç
        if (i < rows.length - 1) {
          targetDoc.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, keyCode: 69, which: 69, bubbles: true }));
          await new Promise(res => setTimeout(res, 80));
        }
      }
    }

    return { success: true };
  }`;

// Replace fillMahsupTable in code
code = code.replace(/\/\/ MAHSUP FİŞİ TABLOSUNU DOLDURMA MOTORU[\s\S]*?return \{ success: true \};\s*\}/, newFillMahsupTable);

fs.writeFileSync(lucaContentPath, code, 'utf8');
console.log('fillMahsupTable replaced with accurate event/timing and field mappings!');
