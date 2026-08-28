const fs = require('fs');
const path = require('path');

const popupPath = path.resolve(__dirname, '../../luca_extension/popup.js');
let code = fs.readFileSync(popupPath, 'utf8');

const flawlessMahsupFunc = `                    func: async (rows) => {
                        let targetDoc = document;
                        if (window.frames && window.frames.frm3 && window.frames.frm3.document) {
                            targetDoc = window.frames.frm3.document;
                        } else {
                            const frm3El = document.querySelector('#frm3, iframe[name="frm3"]');
                            if (frm3El && frm3El.contentDocument) targetDoc = frm3El.contentDocument;
                        }

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

                        const setNativeVal = (el, val) => {
                            if (!el || val === undefined || val === null || val === '') return;
                            el.focus();
                            try {
                                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                                if (nativeSetter) nativeSetter.call(el, val);
                                else el.value = val;
                            } catch (e) {
                                el.value = val;
                            }
                            el.setAttribute('value', val);
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, which: 9, bubbles: true }));
                            el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', keyCode: 9, which: 9, bubbles: true }));
                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                        };

                        const pressAltE = () => {
                            const altEBtn = targetDoc.querySelector("[hotkey*='Alt+E'], [hotkey*='alt+e'], [hotkey*='ALT+E'], [hotkey*='Alt+e']");
                            if (altEBtn) {
                                altEBtn.click();
                            } else {
                                targetDoc.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true }));
                                targetDoc.dispatchEvent(new KeyboardEvent('keyup', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true }));
                            }
                        };

                        for (let i = 0; i < rows.length; i++) {
                            const r = rows[i];
                            const rowIdx = i + 1;
                            let tr = targetDoc.getElementById('tr' + rowIdx);

                            // Satır yoksa Alt+E bas ve açılmasını bekle
                            if (!tr && i > 0) {
                                pressAltE();
                                let attempts = 0;
                                while (!targetDoc.getElementById('tr' + rowIdx) && attempts < 50) {
                                    await new Promise(res => setTimeout(res, 80));
                                    attempts++;
                                }
                                tr = targetDoc.getElementById('tr' + rowIdx);
                            }

                            if (!tr) {
                                console.warn('Satır açılamadı: tr' + rowIdx);
                                break;
                            }

                            // 1. HESAP KODU (Column 1 / children[1])
                            const kodVal = (r.muhasebeKodu || r.hesapKodu || r['Hesap Kodu'] || '').trim();
                            const kodInput = tr.children[1]?.querySelector('input') || 
                                             tr.querySelector('[name*="HESAP_KODU"], [id*="HESAP_KODU"], [name*="hesapKodu"]') || 
                                             tr.querySelector('input');
                            if (kodInput && kodVal) {
                                setNativeVal(kodInput, kodVal);

                                // Luca'nın hesap adını çekmesi için sonraki hücreye tıkla
                                if (tr.children[2]) {
                                    const hAdInput = tr.children[2].querySelector('input');
                                    if (hAdInput) hAdInput.click();
                                    else tr.children[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                }
                            }

                            await new Promise(res => setTimeout(res, 60));

                            // 2. EVRAK NO (Column 3 / children[3])
                            const evrakNoVal = r.evrakNo || r.no || r.faturaNo || r['Evrak No'] || '';
                            const evrakNoInput = tr.children[3]?.querySelector('input') || tr.querySelector('[name*="EVRAK_NO"], [name*="evrakNo"]');
                            if (evrakNoInput && evrakNoVal) setNativeVal(evrakNoInput, evrakNoVal);

                            // 3. EVRAK TARİHİ (Column 4 / children[4])
                            const tarihVal = r.tarih || r.evrakTarihi || r.faturaTarihi || r['Evrak Tarihi'] || '';
                            const evrakTarihInput = tr.children[4]?.querySelector('input') || tr.querySelector('[name*="EVRAK_TARIH"], [name*="TARIH"]');
                            if (evrakTarihInput && tarihVal) setNativeVal(evrakTarihInput, formatDateTR(tarihVal));

                            // 4. BELGE TÜRÜ (Column 5 / children[5])
                            const belgeTurInput = tr.children[5]?.querySelector('input') || tr.querySelector('[name*="BELGE_TUR"]');
                            if (belgeTurInput) setNativeVal(belgeTurInput, r.belgeTuru || r['Belge Türü'] || 'FT');

                            // 5. AÇIKLAMA (Column 7 / children[7] veya children[6])
                            const aciklamaVal = r.aciklama || r.unvan || r['Detay Açıklama'] || '';
                            const aciklamaInput = tr.children[7]?.querySelector('input') || tr.children[6]?.querySelector('input') || tr.querySelector('[name*="ACIKLAMA"]');
                            if (aciklamaInput && aciklamaVal) setNativeVal(aciklamaInput, aciklamaVal);

                            // 6. BORÇ / ALACAK TUTARI
                            const borcVal = r.borc !== undefined && Number(r.borc) > 0 ? r.borc : (r['Borç'] !== undefined && Number(r['Borç']) > 0 ? r['Borç'] : (r.tur === 'borc' ? r.tutar : 0));
                            const alacakVal = r.alacak !== undefined && Number(r.alacak) > 0 ? r.alacak : (r['Alacak'] !== undefined && Number(r['Alacak']) > 0 ? r['Alacak'] : (r.tur === 'alacak' ? r.tutar : 0));

                            const borcInput = tr.children[8]?.querySelector('input') || tr.children[7]?.querySelector('input') || tr.querySelector('[name*="BORC"]');
                            const alacakInput = tr.children[9]?.querySelector('input') || tr.children[8]?.querySelector('input') || tr.querySelector('[name*="ALACAK"]');

                            if (borcVal && Number(borcVal) > 0 && borcInput) {
                                setNativeVal(borcInput, formatTutarTR(borcVal));
                            } else if (alacakVal && Number(alacakVal) > 0 && alacakInput) {
                                setNativeVal(alacakInput, formatTutarTR(alacakVal));
                            }

                            // Sıradaki satıra geçmeden önce kısa bekle
                            if (i < rows.length - 1) {
                                await new Promise(res => setTimeout(res, 80));
                            }
                        }
                        return true;
                    }`;

const targetStart = "                    func: async (rows) => {";
const targetEnd = "                    args: [mList]";

const startIdx = code.indexOf(targetStart);
const endIdx = code.indexOf(targetEnd);

if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + flawlessMahsupFunc + ",\n                    " + code.substring(endIdx);
    fs.writeFileSync(popupPath, code, 'utf8');
    console.log('popup.js updated with setNativeVal for Luca Account Code!');
}
