const fs = require('fs');

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const target = "if (inv.stopajTutari && document.getElementById('stopajTutari' + i)) setVal(document.getElementById('stopajTutari' + i), inv.stopajTutari.toString().replace('.', ','));";
  
  if (content.includes('// Multiselect alanlari (td24: Beyan Belge Turu')) {
    console.log(filePath + ' already updated');
    return;
  }

  const addition = `
        // Multiselect alanlari (td24: Beyan Belge Turu, td25: Alis Satis Turu, td26: Kayit Alt Turu, td27: Stopaj Kodu)
        const setMultiSelect = (selId, val) => {
          if (!val) return;
          const el = document.getElementById(selId);
          if (el) {
            el.value = val;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            const m = el.closest('.multiselect');
            if (m) {
              const box = m.querySelector('.selectBox') || m.querySelector('.overSelect');
              if (box) box.click();
              const sCode = String(val).split('-')[0].trim();
              let chk = m.querySelector('.checkboxes input[value="' + val + '"]')
                || m.querySelector('.checkboxes input[value^="' + val + '-"]')
                || m.querySelector('.checkboxes input[value^="' + val + '"]')
                || m.querySelector('.checkboxes input[value="' + sCode + '"]')
                || m.querySelector('.checkboxes input[value^="' + sCode + '"]');
              if (!chk && sCode) {
                const labels = Array.from(m.querySelectorAll('.checkboxes label'));
                const foundLabel = labels.find(l => l.innerText && l.innerText.includes(sCode));
                if (foundLabel) chk = foundLabel.querySelector('input') || foundLabel;
              }
              if (!chk) chk = m.querySelector('.checkboxes input');
              if (chk && !chk.checked) {
                chk.click();
                chk.checked = true;
                chk.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
          }
        };

        if (document.getElementById('beyanBelgeTuru' + i)) setMultiSelect('beyanBelgeTuru' + i, inv.beyanBelgeTuru || '8');
        if (document.getElementById('alisSatisTuru' + i)) setMultiSelect('alisSatisTuru' + i, inv.alisSatisTuru || '1');
        if (document.getElementById('kayitAltTuru' + i)) setMultiSelect('kayitAltTuru' + i, inv.kayitAltTuru || '1');

        // Stopaj Kodu (td27)
        const stopajKoduVal = inv.stopajKodu || inv.stopaj_kodu || '';
        if (stopajKoduVal) {
          setMultiSelect('stopajKodu' + i, stopajKoduVal);
          const sSelect = document.getElementById('stopajKodu' + i);
          if (sSelect) {
            sSelect.value = stopajKoduVal;
            sSelect.dispatchEvent(new Event('change', { bubbles: true }));
            if (typeof window.stopaj_kodu_degisti === 'function') {
              try { window.stopaj_kodu_degisti(sSelect); } catch(e) {}
            }
          }
          const td27 = document.getElementById('td27_' + i) || document.querySelector('.stopajKoduTd#td27_' + i) || (sSelect ? sSelect.closest('td') : null);
          if (td27) {
            const m = td27.querySelector('.multiselect');
            if (m) {
              const box = m.querySelector('.selectBox') || m.querySelector('.overSelect');
              if (box) box.click();
              const sCode = String(stopajKoduVal).split('-')[0].trim();
              let targetRadio = td27.querySelector('input[value="' + stopajKoduVal + '"]')
                || td27.querySelector('input[value^="' + stopajKoduVal + '-"]')
                || td27.querySelector('input[value^="' + stopajKoduVal + '"]')
                || td27.querySelector('input[value="' + sCode + '"]')
                || td27.querySelector('input[value^="' + sCode + '"]');
              if (!targetRadio && sCode) {
                const labels = Array.from(td27.querySelectorAll('.checkboxes label'));
                const foundLabel = labels.find(l => l.innerText && l.innerText.includes(sCode));
                if (foundLabel) targetRadio = foundLabel.querySelector('input') || foundLabel;
              }
              if (targetRadio && !targetRadio.checked) {
                targetRadio.click();
                targetRadio.checked = true;
                targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
          }
        }`;

  if (content.includes(target)) {
    content = content.replace(target, target + '\n' + addition);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully updated ' + filePath);
  } else {
    console.error('Target not found in ' + filePath);
  }
}

updateFile('c:/Users/Alper/Desktop/fatura/luca_extension/luca_content.js');
updateFile('c:/Users/Alper/Desktop/fatura/luca_extension/popup.js');
