const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');
const popupPath = path.join(extDir, 'popup.js');

let popupJs = fs.readFileSync(popupPath, 'utf8');

// Replace pasteBtn function in popup.js with robust Alt+E row creation, empty seriNo, TABLO_TURU, kodNo
const targetStart = "    pasteBtn.addEventListener('click', async () => {";
const targetEnd = "    if (bankPasteBtn) {";

const startIndex = popupJs.indexOf(targetStart);
const endIndex = popupJs.indexOf(targetEnd);

if (startIndex !== -1 && endIndex !== -1) {
    const newPasteBtnSection = `    pasteBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url.includes("luca.com.tr")) {
            return showError("Lütfen Luca sekmesinde olduğunuza emin olun.");
        }

        const storage = await chrome.storage.local.get(['transferData']);
        const invoices = storage.transferData?.invoices || [];
        if (invoices.length === 0) return showError("Aktarılacak fatura yok.");

        pasteBtn.disabled = true;
        pasteBtn.innerText = "Aktarılıyor...";

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async (invList) => {
                    const setVal = (el, val) => {
                        if (!el) return;
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
                            const evtDown = new KeyboardEvent('keydown', {
                                key: 'e',
                                code: 'KeyE',
                                keyCode: 69,
                                which: 69,
                                altKey: true,
                                bubbles: true,
                                cancelable: true
                            });
                            const evtUp = new KeyboardEvent('keyup', {
                                key: 'e',
                                code: 'KeyE',
                                keyCode: 69,
                                which: 69,
                                altKey: true,
                                bubbles: true,
                                cancelable: true
                            });
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

                    // Hızlı Fiş (hizliFisPopUp.do) tespiti
                    const isHizliFis = !!document.getElementById('sablon') || !!document.getElementById('islem0');

                    for (let i = 0; i < invList.length; i++) {
                        const inv = invList[i];
                        
                        if (isHizliFis) {
                            let islemEl = document.getElementById('islem' + i);
                            
                            // Eğer satır i henüz yoksa Alt+E ile açılmasını bekle
                            if (!islemEl && i > 0) {
                                await pressAltE();
                                let attempts = 0;
                                while (!document.getElementById('islem' + i) && attempts < 25) {
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
                                
                                // Tevkifat / İstisna Kodları
                                if (document.getElementById('TABLO_TURU' + i)) {
                                    setVal(document.getElementById('TABLO_TURU' + i), inv.tablo || (inv.tevkifat && inv.tevkifat !== '0' ? '6' : '0'));
                                }
                                if (document.getElementById('kodNo' + i)) {
                                    setVal(document.getElementById('kodNo' + i), inv.kodNo || '');
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
                                
                                if (inv.tevkifat && inv.tevkifat !== '0' && document.getElementById('tevkifat' + i)) {
                                    setVal(document.getElementById('tevkifat' + i), inv.tevkifat);
                                }
                                if (inv.stopajTutari && document.getElementById('stopajTutari' + i)) {
                                    setVal(document.getElementById('stopajTutari' + i), inv.stopajTutari.toString().replace('.', ','));
                                }

                                // Bir sonraki satır için Alt + E tuşuna bas
                                if (i < invList.length - 1) {
                                    await pressAltE();
                                    await new Promise(r => setTimeout(r, 60));
                                }
                                continue;
                            }
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
                    }
                    return true;
                },
                args: [invoices]
            });
            pasteBtn.innerText = "Aktarıldı!";
            chrome.storage.local.get(['transferData'], (result) => {
                const data = result.transferData || {};
                delete data.invoices;
                chrome.storage.local.set({ transferData: data }, () => updateUI());
            });
            setTimeout(() => {
                pasteBtn.innerText = "Faturaları Buraya Aktar";
                pasteBtn.disabled = false;
            }, 2000);
        } catch (err) {
            showError(err.message);
            pasteBtn.disabled = false;
            pasteBtn.innerText = "Faturaları Buraya Aktar";
        }
    });

`;

    popupJs = popupJs.substring(0, startIndex) + newPasteBtnSection + popupJs.substring(endIndex);
    fs.writeFileSync(popupPath, popupJs, 'utf8');
    console.log('popup.js updated successfully!');
} else {
    console.error('Could not find slice target indices in popup.js');
}
