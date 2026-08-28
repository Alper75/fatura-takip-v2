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

                        const setVal = (el, val) => {
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

                            // Satır henüz açılmadıysa tek sefer Alt+E bas ve DOM'a eklenene kadar bekle
                            if (!tr && i > 0) {
                                targetDoc.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, keyCode: 69, which: 69, bubbles: true }));
                                let attempts = 0;
                                while (!targetDoc.getElementById('tr' + rowIdx) && attempts < 40) {
                                    await new Promise(res => setTimeout(res, 60));
                                    attempts++;
                                }
                                tr = targetDoc.getElementById('tr' + rowIdx);
                            }

                            if (tr) {
                                // tr içindeki tüm görünür text inputlarını sırayla al
                                const textInputs = Array.from(tr.querySelectorAll('input[type="text"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'));

                                // 1. HESAP KODU (İlk input)
                                const kodVal = r.muhasebeKodu || r.hesapKodu || r['Hesap Kodu'] || '';
                                const kodInput = tr.querySelector('[name*="HESAP_KODU"], [name*="hesapKodu"]') || textInputs[0] || (tr.children[1] ? tr.children[1].querySelector('input') : null);
                                if (kodInput && kodVal) {
                                    kodInput.focus();
                                    kodInput.value = kodVal;
                                    kodInput.dispatchEvent(new Event('input', { bubbles: true }));
                                    kodInput.dispatchEvent(new Event('change', { bubbles: true }));
                                    kodInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, which: 9, bubbles: true }));
                                    kodInput.dispatchEvent(new Event('blur', { bubbles: true }));

                                    // Luca'nın hesap adını getirmesi için sonraki hücreye tıkla
                                    if (tr.children[2]) {
                                        tr.children[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                    }
                                }

                                await new Promise(res => setTimeout(res, 50));

                                // 2. EVRAK NO (İkinci input / children[3])
                                const evrakNoVal = r.evrakNo || r.no || r.faturaNo || r['Evrak No'] || '';
                                const evrakNoInput = tr.querySelector('[name*="EVRAK_NO"], [name*="evrakNo"]') || textInputs[1] || (tr.children[3] ? tr.children[3].querySelector('input') : null);
                                if (evrakNoInput && evrakNoVal) setVal(evrakNoInput, evrakNoVal);

                                // 3. EVRAK TARİHİ (Üçüncü input / children[4])
                                const tarihVal = r.tarih || r.evrakTarihi || r.faturaTarihi || r['Evrak Tarihi'] || '';
                                const evrakTarihInput = tr.querySelector('[name*="EVRAK_TARIH"], [name*="evrakTarih"], [name*="TARIH"]') || textInputs[2] || (tr.children[4] ? tr.children[4].querySelector('input') : null);
                                if (evrakTarihInput && tarihVal) setVal(evrakTarihInput, formatDateTR(tarihVal));

                                // 4. BELGE TÜRÜ (Dördüncü input / children[5])
                                const belgeTurInput = tr.querySelector('[name*="BELGE_TUR"], [name*="belgeTur"]') || textInputs[3] || (tr.children[5] ? tr.children[5].querySelector('input') : null);
                                if (belgeTurInput) setVal(belgeTurInput, r.belgeTuru || r['Belge Türü'] || 'FT');

                                // 5. AÇIKLAMA (Beşinci input / children[7])
                                const aciklamaVal = r.aciklama || r.unvan || r['Detay Açıklama'] || '';
                                const aciklamaInput = tr.querySelector('[name*="ACIKLAMA"], [name*="aciklama"]') || textInputs[4] || (tr.children[7] ? tr.children[7].querySelector('input') : null);
                                if (aciklamaInput && aciklamaVal) setVal(aciklamaInput, aciklamaVal);

                                // 6. BORÇ / ALACAK TUTARI (Altıncı ve Yedinci inputlar)
                                const borcVal = r.borc !== undefined && Number(r.borc) > 0 ? r.borc : (r['Borç'] !== undefined && Number(r['Borç']) > 0 ? r['Borç'] : (r.tur === 'borc' ? r.tutar : 0));
                                const alacakVal = r.alacak !== undefined && Number(r.alacak) > 0 ? r.alacak : (r['Alacak'] !== undefined && Number(r['Alacak']) > 0 ? r['Alacak'] : (r.tur === 'alacak' ? r.tutar : 0));

                                const borcInput = tr.querySelector('[name*="BORC"], [name*="borc"]') || textInputs[5] || (tr.children[8] ? tr.children[8].querySelector('input') : null);
                                const alacakInput = tr.querySelector('[name*="ALACAK"], [name*="alacak"]') || textInputs[6] || (tr.children[9] ? tr.children[9].querySelector('input') : null);

                                if (borcVal && Number(borcVal) > 0 && borcInput) {
                                    setVal(borcInput, formatTutarTR(borcVal));
                                } else if (alacakVal && Number(alacakVal) > 0 && alacakInput) {
                                    setVal(alacakInput, formatTutarTR(alacakVal));
                                }

                                // Sıradaki satıra geçmeden önce kısa bekle
                                if (i < rows.length - 1) {
                                    targetDoc.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, keyCode: 69, which: 69, bubbles: true }));
                                    await new Promise(res => setTimeout(res, 80));
                                }
                            }
                        }
                        return true;
                    }`;

const targetStart = "                    func: async (rows) => {";
const targetEnd = "                    args: [mList]";

const startIdx = code.indexOf(targetStart);
const endIdx = code.indexOf(targetEnd);

if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + flawlessMahsupFunc + "\n                    " + code.substring(endIdx);
    fs.writeFileSync(popupPath, code, 'utf8');
    console.log('popup.js updated with flawless indexed textInputs Mahsup mapping!');
}
