const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');

// 1. Update fatura_content.js
const faturaContentPath = path.join(extDir, 'fatura_content.js');
let faturaContent = fs.readFileSync(faturaContentPath, 'utf8');

const isletmeListener = `
  // İşletme Defteri (Hızlı Fiş) Faturaları Gönderme Köprüsü
  window.addEventListener('FATURA_APP_LUCA_SEND_ISLETME', (e) => {
    if (!isRuntimeValid()) {
      alert("Eklenti bağlantısı kesildi. Lütfen sayfayı yenileyin.");
      return;
    }
    const faturalar = e.detail;
    if (!faturalar || faturalar.length === 0) return;

    // Normal kuyruk (invoices) ve isletme kuyruğuna ekle
    chrome.runtime.sendMessage({ 
      action: "SET_TRANSFER_DATA", 
      data: { invoices: faturalar, isletmeFisleri: faturalar } 
    }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.status === "success") {
        showToast(\`\${faturalar.length} fatura İşletme Defteri kuyruğuna alındı.\`);
      }
    });
  });

  window.addEventListener('FATURA_APP_LUCA_SEND_INVOICES', (e) => {
    if (!isRuntimeValid()) return;
    const faturalar = e.detail;
    if (!faturalar || faturalar.length === 0) return;
    chrome.runtime.sendMessage({ 
      action: "SET_TRANSFER_DATA", 
      data: { invoices: faturalar } 
    });
  });
`;

if (!faturaContent.includes('FATURA_APP_LUCA_SEND_ISLETME')) {
  faturaContent = faturaContent.replace(
    "window.addEventListener('FATURA_APP_LUCA_SEND_MAHSUP',",
    isletmeListener + "\n  window.addEventListener('FATURA_APP_LUCA_SEND_MAHSUP',"
  );
  fs.writeFileSync(faturaContentPath, faturaContent, 'utf8');
  console.log('fatura_content.js updated successfully!');
} else {
  console.log('fatura_content.js already has FATURA_APP_LUCA_SEND_ISLETME');
}

// 2. Update popup.js pasteBtn to support hizliFisPopUp.do
const popupPath = path.join(extDir, 'popup.js');
let popupJs = fs.readFileSync(popupPath, 'utf8');

const oldPasteLoop = `                    for (let i = 0; i < invList.length; i++) {
                        const inv = invList[i];
                        const dateEl = document.getElementById('evrakTarih' + i);
                        if (!dateEl) break;

                        setVal(dateEl, inv.tarih);
                        setVal(document.getElementById('evrakNo' + i), inv.no);
                        setVal(document.getElementById('tckn' + i), inv.vkn);
                        setVal(document.getElementById('aciklama' + i), inv.unvan);
                        setVal(document.getElementById('tutar' + i), inv.matrah);
                        setVal(document.getElementById('kdvTutar' + i), inv.kdvTutari);
                        setVal(document.getElementById('topbura' + i), inv.toplam);
                    }`;

const newPasteLoop = `                    // Hızlı Fiş (hizliFisPopUp.do) veya Normal Fiş tespiti
                    for (let i = 0; i < invList.length; i++) {
                        const inv = invList[i];
                        
                        // 1. Luca Hızlı Fiş Sayfası Kontrolü (hizliFisPopUp.do)
                        const islemEl = document.getElementById('islem' + i);
                        if (islemEl) {
                            setVal(islemEl, inv.islem !== undefined ? inv.islem : (inv.tur === '1' || inv.tur === 'gider' ? '1' : '0'));
                            if (document.getElementById('kategori' + i)) setVal(document.getElementById('kategori' + i), inv.kategori || '1');
                            if (document.getElementById('belge' + i)) setVal(document.getElementById('belge' + i), inv.belge || '1');
                            if (document.getElementById('evrakTarih' + i)) setVal(document.getElementById('evrakTarih' + i), inv.evrakTarih || inv.tarih);
                            if (document.getElementById('kayitTarihi' + i)) setVal(document.getElementById('kayitTarihi' + i), inv.kayitTarihi || inv.evrakTarih || inv.tarih);
                            if (document.getElementById('seriNo' + i)) setVal(document.getElementById('seriNo' + i), inv.seriNo || '');
                            if (document.getElementById('evrakNo' + i)) setVal(document.getElementById('evrakNo' + i), inv.evrakNo || inv.no);
                            if (document.getElementById('tckn' + i)) setVal(document.getElementById('tckn' + i), inv.tckn || inv.vkn);
                            if (document.getElementById('soyadi' + i)) setVal(document.getElementById('soyadi' + i), inv.soyadi || inv.unvan);
                            if (document.getElementById('adi' + i)) setVal(document.getElementById('adi' + i), inv.adi || '');
                            if (document.getElementById('aciklama' + i)) setVal(document.getElementById('aciklama' + i), inv.aciklama || inv.unvan);
                            
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
                            
                            if (inv.tevkifat && inv.tevkifat !== '0' && document.getElementById('tevkifat' + i)) {
                                setVal(document.getElementById('tevkifat' + i), inv.tevkifat);
                            }
                            if (inv.stopajTutari && document.getElementById('stopajTutari' + i)) {
                                setVal(document.getElementById('stopajTutari' + i), inv.stopajTutari.toString().replace('.', ','));
                            }
                            continue;
                        }

                        // 2. Normal Luca Fatura Ekranı
                        const dateEl = document.getElementById('evrakTarih' + i);
                        if (!dateEl) break;

                        setVal(dateEl, inv.evrakTarih || inv.tarih);
                        setVal(document.getElementById('evrakNo' + i), inv.evrakNo || inv.no);
                        setVal(document.getElementById('tckn' + i), inv.tckn || inv.vkn);
                        setVal(document.getElementById('aciklama' + i), inv.aciklama || inv.unvan);
                        
                        const matrahVal = inv.tutar !== undefined ? inv.tutar : inv.matrah;
                        if (document.getElementById('tutar' + i) && matrahVal !== undefined) {
                            setVal(document.getElementById('tutar' + i), matrahVal.toString().replace('.', ','));
                        }
                        const kdvVal = inv.kdvTutar !== undefined ? inv.kdvTutar : inv.kdvTutari;
                        if (document.getElementById('kdvTutar' + i) && kdvVal !== undefined) {
                            setVal(document.getElementById('kdvTutar' + i), kdvVal.toString().replace('.', ','));
                        }
                        const topV = inv.toplamTutar !== undefined ? inv.toplamTutar : inv.toplam;
                        const topFld = document.getElementById('topbura' + i) || document.getElementById('topNotBura' + i);
                        if (topFld && topV !== undefined) setVal(topFld, topV.toString().replace('.', ','));
                    }`;

if (popupJs.includes('const dateEl = document.getElementById(\'evrakTarih\' + i);')) {
  popupJs = popupJs.replace(oldPasteLoop, newPasteLoop);
  fs.writeFileSync(popupPath, popupJs, 'utf8');
  console.log('popup.js updated successfully!');
} else {
  console.log('popup.js could not find exact paste loop target');
}
