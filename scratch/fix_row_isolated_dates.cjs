const fs = require('fs');
const path = require('path');

const popupPath = path.resolve(__dirname, '../../luca_extension/popup.js');
let code = fs.readFileSync(popupPath, 'utf8');

const accurateRowMahsupFunc = `                    func: async (rows) => {
                        const isFisFrame = !!document.forms['fisDetayFormArray'] || 
                                           !!document.querySelector('form[name*="fisDetay"]') || 
                                           !!document.getElementById('hpTable') || 
                                           !!document.getElementById('baslik')?.innerText?.includes('FİŞ DETAYI');
                        if (!isFisFrame) return false;

                        const formatDateTR = (dStr) => {
                            if (!dStr) return '';
                            const str = String(dStr).trim();
                            if (str.includes('/') || (str.includes('.') && str.split('.').length === 3)) return str;
                            const parts = str.split('-');
                            if (parts.length === 3) {
                                if (parts[0].length === 4) return parts[2] + '/' + parts[1] + '/' + parts[0];
                                return parts[0] + '/' + parts[1] + '/' + parts[2];
                            }
                            return str;
                        };

                        const formatTutarTR = (val) => {
                            if (val === undefined || val === null || val === '') return '';
                            const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/\\./g, '').replace(',', '.'));
                            if (isNaN(num) || num === 0) return '';
                            return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        };

                        const setVal = (el, val) => {
                            if (!el || val === undefined || val === null || val === '') return;
                            el.focus();
                            el.value = val;
                            el.setAttribute('value', val);
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                        };

                        const addNewRow = () => {
                            if (typeof window.satirEkle === 'function') {
                                window.satirEkle();
                                return;
                            }
                            if (window.top && window.top.frames && window.top.frames['frm6'] && typeof window.top.frames['frm6'].satirEkle === 'function') {
                                window.top.frames['frm6'].satirEkle();
                                return;
                            }
                            const plusBtn = document.querySelector("button[onclick*='satirEkle'], input[value*='Ekle'], [hotkey*='Alt+E'], [hotkey*='alt+e'], .fa-plus");
                            if (plusBtn) {
                                plusBtn.click();
                                return;
                            }
                            const evtDown = new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true });
                            const evtUp = new KeyboardEvent('keyup', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true });
                            document.dispatchEvent(evtDown);
                            document.dispatchEvent(evtUp);
                        };

                        const getRowTr = (index) => {
                            const byId = document.getElementById('tr' + (index + 1)) || 
                                         document.getElementById('tr_' + (index + 1)) || 
                                         document.getElementById('tr' + index);
                            if (byId) return byId;

                            // Form içindeki fiş tablosu satırları (en az 4 input içeren tr'ler)
                            const trs = Array.from(document.querySelectorAll('form[name*="fisDetay"] tr, table tr')).filter(tr => {
                                const inps = tr.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"])');
                                return inps.length >= 4;
                            });
                            return trs[index] || null;
                        };

                        for (let i = 0; i < rows.length; i++) {
                            const r = rows[i];
                            let tr = getRowTr(i);

                            // Satır yoksa Alt+E / satirEkle ile oluştur
                            if (!tr && i > 0) {
                                addNewRow();
                                let attempts = 0;
                                while (!getRowTr(i) && attempts < 50) {
                                    await new Promise(res => setTimeout(res, 60));
                                    attempts++;
                                }
                                tr = getRowTr(i);
                            }

                            if (!tr) {
                                console.warn('Satır bulunamadı:', i);
                                continue;
                            }

                            // Doğrudan SATIR (tr) İÇİNDEKİ inputları seç (Böylece üst başlıktaki tarihlerle asla kaymaz!)
                            const rowInputs = Array.from(tr.querySelectorAll('input[type="text"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'));

                            // 1. Hesap Kodu
                            const kodVal = (r.muhasebeKodu || r.hesapKodu || r['Hesap Kodu'] || '').trim();
                            const kodInput = tr.querySelector('[name*="HESAP_KODU"], [id*="HESAP_KODU"]') || rowInputs[0] || (tr.children[1] ? tr.children[1].querySelector('input') : null);
                            if (kodInput && kodVal) {
                                setVal(kodInput, kodVal);
                                kodInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, which: 9, bubbles: true }));
                                kodInput.dispatchEvent(new Event('blur', { bubbles: true }));
                            }

                            await new Promise(res => setTimeout(res, 40));

                            // 2. Evrak No
                            const evrakNoVal = r.evrakNo || r.no || r.faturaNo || r['Evrak No'] || '';
                            const evrakNoInput = tr.querySelector('[name*="EVRAK_NO"]') || rowInputs[1] || (tr.children[3] ? tr.children[3].querySelector('input') : null);
                            if (evrakNoInput && evrakNoVal) setVal(evrakNoInput, evrakNoVal);

                            // 3. Evrak Tarihi (Tam bu satırın kendi tarihi)
                            const tarihVal = r.tarih || r.evrakTarihi || r.faturaTarihi || r['Evrak Tarihi'] || '';
                            const evrakTarihInput = tr.querySelector('[name*="EVRAK_TARIH"], [name*="TARIH"]') || rowInputs[2] || (tr.children[4] ? tr.children[4].querySelector('input') : null);
                            if (evrakTarihInput && tarihVal) setVal(evrakTarihInput, formatDateTR(tarihVal));

                            // 4. Belge Türü
                            const belgeTurInput = tr.querySelector('[name*="BELGE_TUR"]') || rowInputs[3] || (tr.children[5] ? tr.children[5].querySelector('input') : null);
                            if (belgeTurInput) setVal(belgeTurInput, r.belgeTuru || r['Belge Türü'] || 'FT');

                            // 5. Açıklama
                            const aciklamaVal = r.aciklama || r.unvan || r['Detay Açıklama'] || '';
                            const aciklamaInput = tr.querySelector('[name*="ACIKLAMA"]') || rowInputs[4] || (tr.children[7] ? tr.children[7].querySelector('input') : null);
                            if (aciklamaInput && aciklamaVal) setVal(aciklamaInput, aciklamaVal);

                            // 6. Borç / Alacak Tutarı
                            const borcVal = r.borc !== undefined && Number(r.borc) > 0 ? r.borc : (r['Borç'] !== undefined && Number(r['Borç']) > 0 ? r['Borç'] : (r.tur === 'borc' ? r.tutar : 0));
                            const alacakVal = r.alacak !== undefined && Number(r.alacak) > 0 ? r.alacak : (r['Alacak'] !== undefined && Number(r['Alacak']) > 0 ? r['Alacak'] : (r.tur === 'alacak' ? r.tutar : 0));

                            const borcInput = tr.querySelector('[name*="BORC"]') || rowInputs[5] || (tr.children[8] ? tr.children[8].querySelector('input') : null);
                            const alacakInput = tr.querySelector('[name*="ALACAK"]') || rowInputs[6] || (tr.children[9] ? tr.children[9].querySelector('input') : null);

                            if (borcVal && Number(borcVal) > 0 && borcInput) {
                                setVal(borcInput, formatTutarTR(borcVal));
                            } else if (alacakVal && Number(alacakVal) > 0 && alacakInput) {
                                setVal(alacakInput, formatTutarTR(alacakVal));
                            }

                            if (i < rows.length - 1) {
                                await new Promise(res => setTimeout(res, 60));
                            }
                        }
                        return true;
                    }`;

const targetStart = "                    func: async (rows) => {";
const targetEnd = "                    args: [mList]";

const startIdx = code.indexOf(targetStart);
const endIdx = code.indexOf(targetEnd);

if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + accurateRowMahsupFunc + ",\n                    " + code.substring(endIdx);
    fs.writeFileSync(popupPath, code, 'utf8');
    console.log('popup.js updated with per-row tr-isolated date inputs!');
}
