const fs = require('fs');
const path = require('path');

const popupPath = path.resolve(__dirname, '../../luca_extension/popup.js');
let code = fs.readFileSync(popupPath, 'utf8');

const flawlessDynamicMahsupFunc = `                    func: async (rows) => {
                        const formatDateTR = (dStr) => {
                            if (!dStr) return '';
                            const str = String(dStr).trim();
                            if (str.includes('/') || (str.includes('.') && str.split('.').length === 3)) return str;
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

                        const setVal = (el, val) => {
                            if (!el || val === undefined || val === null || val === '') return;
                            el.focus();
                            el.value = val;
                            el.setAttribute('value', val);
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                        };

                        const getRowEl = (index) => {
                            const byId = document.getElementById('tr' + (index + 1)) || 
                                         document.getElementById('tr_' + (index + 1)) || 
                                         document.getElementById('tr' + index) || 
                                         document.getElementById('tr_' + index);
                            if (byId) return byId;

                            const tables = Array.from(document.querySelectorAll('table'));
                            const fisTable = tables.find(t => t.innerText.includes('Hesap Kodu') && t.querySelector('tbody'));
                            if (fisTable) {
                                const trs = Array.from(fisTable.querySelectorAll('tbody tr')).filter(tr => tr.querySelectorAll('input').length >= 3);
                                if (trs[index]) return trs[index];
                            }

                            const allInputRows = Array.from(document.querySelectorAll('tr')).filter(tr => tr.querySelectorAll('input').length >= 4);
                            if (allInputRows[index]) return allInputRows[index];

                            return null;
                        };

                        const addNewRow = () => {
                            if (typeof window.satirEkle === 'function') {
                                window.satirEkle();
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
                            window.dispatchEvent(evtDown);
                            window.dispatchEvent(evtUp);
                        };

                        // Eğer bu frame fiş tablosu içermiyorsa çalıştırma
                        if (!getRowEl(0)) {
                            return false;
                        }

                        for (let i = 0; i < rows.length; i++) {
                            const r = rows[i];
                            let tr = getRowEl(i);

                            if (!tr && i > 0) {
                                addNewRow();
                                let attempts = 0;
                                while (!getRowEl(i) && attempts < 50) {
                                    await new Promise(res => setTimeout(res, 60));
                                    attempts++;
                                }
                                tr = getRowEl(i);
                            }

                            if (!tr) {
                                console.warn('Satır bulunamadı:', i);
                                break;
                            }

                            const inputs = Array.from(tr.querySelectorAll('input[type="text"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'));

                            // 0: HESAP KODU
                            const kodVal = (r.muhasebeKodu || r.hesapKodu || r['Hesap Kodu'] || '').trim();
                            if (inputs[0] && kodVal) {
                                inputs[0].focus();
                                inputs[0].value = kodVal;
                                inputs[0].setAttribute('value', kodVal);
                                inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                                inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
                                inputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, which: 9, bubbles: true }));
                                inputs[0].dispatchEvent(new Event('blur', { bubbles: true }));

                                if (inputs[1]) {
                                    inputs[1].focus();
                                    inputs[1].click();
                                }
                            }

                            await new Promise(res => setTimeout(res, 40));

                            // 1: EVRAK NO
                            const evrakNoVal = r.evrakNo || r.no || r.faturaNo || r['Evrak No'] || '';
                            if (inputs[1] && evrakNoVal) setVal(inputs[1], evrakNoVal);

                            // 2: EVRAK TARİHİ
                            const tarihVal = r.tarih || r.evrakTarihi || r.faturaTarihi || r['Evrak Tarihi'] || '';
                            if (inputs[2] && tarihVal) setVal(inputs[2], formatDateTR(tarihVal));

                            // 3: BELGE TÜRÜ
                            if (inputs[3]) setVal(inputs[3], r.belgeTuru || r['Belge Türü'] || 'FT');

                            // 4: AÇIKLAMA
                            const aciklamaVal = r.aciklama || r.unvan || r['Detay Açıklama'] || '';
                            if (inputs[4] && aciklamaVal) setVal(inputs[4], aciklamaVal);

                            // 5: BORÇ / 6: ALACAK
                            const borcVal = r.borc !== undefined && Number(r.borc) > 0 ? r.borc : (r['Borç'] !== undefined && Number(r['Borç']) > 0 ? r['Borç'] : (r.tur === 'borc' ? r.tutar : 0));
                            const alacakVal = r.alacak !== undefined && Number(r.alacak) > 0 ? r.alacak : (r['Alacak'] !== undefined && Number(r['Alacak']) > 0 ? r['Alacak'] : (r.tur === 'alacak' ? r.tutar : 0));

                            if (borcVal && Number(borcVal) > 0 && inputs[5]) {
                                setVal(inputs[5], formatTutarTR(borcVal));
                            } else if (alacakVal && Number(alacakVal) > 0 && inputs[6]) {
                                setVal(inputs[6], formatTutarTR(alacakVal));
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
    code = code.substring(0, startIdx) + flawlessDynamicMahsupFunc + ",\n                    " + code.substring(endIdx);
    fs.writeFileSync(popupPath, code, 'utf8');
    console.log('popup.js updated with dynamic getRowEl and direct indexed inputs[0] mapping!');
}
