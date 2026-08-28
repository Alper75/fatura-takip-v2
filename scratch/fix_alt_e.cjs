const fs = require('fs');
const path = require('path');

const popupPath = path.resolve(__dirname, '../../luca_extension/popup.js');

const perfectAllInOnePopup = `document.addEventListener('DOMContentLoaded', async () => {
    const syncBtn = document.getElementById('sync-btn');
    const syncStatus = document.getElementById('sync-status');
    const syncTime = document.getElementById('sync-time');
    const queueCount = document.getElementById('queue-count');
    const queueBadge = document.getElementById('queue-badge');
    const pasteBtn = document.getElementById('paste-btn');
    const clearBtn = document.getElementById('clear-btn');
    const errorDisplay = document.getElementById('error-display');

    const bankQueueBadge = document.getElementById('bank-queue-badge');
    const bankQueueCount = document.getElementById('bank-queue-count');
    const bankPasteBtn = document.getElementById('bank-paste-btn');
    const bankClearBtn = document.getElementById('bank-clear-btn');

    const mahsupQueueBadge = document.getElementById('mahsup-queue-badge');
    const mahsupQueueCount = document.getElementById('mahsup-queue-count');
    const mahsupPasteBtn = document.getElementById('mahsup-paste-btn');
    const mahsupClearBtn = document.getElementById('mahsup-clear-btn');

    function showError(msg) {
        if (!errorDisplay) return alert(msg);
        errorDisplay.innerText = msg;
        errorDisplay.style.display = 'block';
        setTimeout(() => { errorDisplay.style.display = 'none'; }, 4000);
    }

    const updateUI = () => {
        chrome.storage.local.get(['lucaAccounts', 'lastSyncTime', 'transferData'], (res) => {
            if (res.lucaAccounts && res.lucaAccounts.length > 0) {
                syncStatus.innerText = \`\${res.lucaAccounts.length} Hesap Eşitlendi\`;
                syncStatus.style.color = 'var(--success)';
            } else {
                syncStatus.innerText = 'Eşitlenmedi';
                syncStatus.style.color = 'var(--text-muted)';
            }

            if (res.lastSyncTime) {
                const date = new Date(res.lastSyncTime);
                syncTime.innerText = \`Son: \${date.toLocaleDateString('tr-TR')} \${date.toLocaleTimeString('tr-TR')}\`;
            }

            // Fatura Kuyruğu (Hızlı Fiş)
            const transfer = res.transferData;
            const invoices = transfer?.invoices || transfer?.hizliFisItems || [];
            if (invoices.length > 0) {
                queueCount.innerText = \`\${invoices.length} Fatura Hazır\`;
                queueBadge.innerText = \`\${invoices.length} Fatura\`;
                queueBadge.className = 'badge badge-green';
                pasteBtn.disabled = false;
            } else {
                queueCount.innerText = '0 Fatura';
                queueBadge.innerText = '0 Fatura';
                queueBadge.className = 'badge badge-blue';
                pasteBtn.disabled = true;
            }

            // Mahsup (Bilanço) Kuyruğu
            const mahsupList = transfer?.mahsupRows || [];
            if (mahsupList.length > 0) {
                mahsupQueueCount.innerText = \`\${mahsupList.length} Satır Hazır\`;
                mahsupQueueBadge.innerText = \`\${mahsupList.length} Satır\`;
                mahsupQueueBadge.className = 'badge badge-green';
                if (mahsupPasteBtn) mahsupPasteBtn.disabled = false;
            } else {
                mahsupQueueCount.innerText = '0 Satır';
                mahsupQueueBadge.innerText = '0 Satır';
                mahsupQueueBadge.className = 'badge badge-blue';
                if (mahsupPasteBtn) mahsupPasteBtn.disabled = true;
            }

            // Banka Kuyruğu
            const bankList = transfer?.bankTransactions || [];
            if (bankList.length > 0) {
                bankQueueCount.innerText = \`\${bankList.length} Hareket Hazır\`;
                bankQueueBadge.innerText = \`\${bankList.length} Hareket\`;
                bankQueueBadge.className = 'badge badge-green';
                if (bankPasteBtn) bankPasteBtn.disabled = false;
            } else {
                bankQueueCount.innerText = '0 Hareket';
                bankQueueBadge.innerText = '0 Hareket';
                bankQueueBadge.className = 'badge badge-blue';
                if (bankPasteBtn) bankPasteBtn.disabled = true;
            }
        });
    };

    updateUI();

    // 1. Hesap Planını Çek
    syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        syncBtn.innerText = 'Çekiliyor...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url.includes('luca.com.tr')) throw new Error('Lütfen açık bir Luca sekmesine geçin!');

            chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_ACCOUNTS' }, (response) => {
                syncBtn.disabled = false;
                syncBtn.innerText = 'Hesap Planını Çek';

                if (chrome.runtime.lastError) {
                    showError('Luca sayfası bulunamadı veya yanıt vermiyor. Sayfayı yenileyin.');
                    return;
                }

                if (response && response.status === 'success') {
                    chrome.storage.local.set({
                        lucaAccounts: response.data,
                        lastSyncTime: new Date().toISOString()
                    }, () => updateUI());
                } else {
                    showError(response ? response.message : 'Hesap planı tablosu bulunamadı. Lütfen "Hesap Planı Listesi" ekranında olduğunuza emin olun.');
                }
            });
        } catch (err) {
            showError(err.message);
            syncBtn.disabled = false;
            syncBtn.innerText = 'Hesap Planını Çek';
        }
    });

    // 2. Fatura Kuyruğunu Temizle
    clearBtn.addEventListener('click', () => {
        chrome.storage.local.get(['transferData'], (res) => {
            const td = res.transferData || {};
            delete td.invoices;
            delete td.hizliFisItems;
            chrome.storage.local.set({ transferData: td }, updateUI);
        });
    });

    // 3. Mahsup Kuyruğunu Temizle
    if (mahsupClearBtn) {
        mahsupClearBtn.addEventListener('click', () => {
            chrome.storage.local.get(['transferData'], (res) => {
                const td = res.transferData || {};
                delete td.mahsupRows;
                chrome.storage.local.set({ transferData: td }, updateUI);
            });
        });
    }

    // 4. Banka Kuyruğunu Temizle
    if (bankClearBtn) {
        bankClearBtn.addEventListener('click', () => {
            chrome.storage.local.get(['transferData'], (res) => {
                const td = res.transferData || {};
                delete td.bankTransactions;
                chrome.storage.local.set({ transferData: td }, updateUI);
            });
        });
    }

    // 5. Faturaları Aktar (Hızlı Fiş)
    pasteBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url.includes("luca.com.tr")) return showError("Lütfen Luca sekmesinde olduğunuza emin olun.");

        const storage = await chrome.storage.local.get(['transferData']);
        const invoices = storage.transferData?.invoices || storage.transferData?.hizliFisItems || [];
        if (invoices.length === 0) return showError("Aktarılacak fatura yok.");

        pasteBtn.disabled = true;
        pasteBtn.innerText = "Aktarılıyor...";

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                func: async (invList) => {
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
                            const evtDown = new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true });
                            const evtUp = new KeyboardEvent('keyup', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true });
                            document.dispatchEvent(evtDown);
                            document.dispatchEvent(evtUp);
                            window.dispatchEvent(evtDown);
                            window.dispatchEvent(evtUp);

                            if (typeof window.satirEkle === 'function') window.satirEkle();
                            else if (typeof window.addRow === 'function') window.addRow();
                        }
                    };

                    const isHizliFis = !!document.getElementById('sablon') || !!document.getElementById('islem0');
                    if (!isHizliFis) return false;

                    for (let i = 0; i < invList.length; i++) {
                        const inv = invList[i];
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
                                const kodEl = document.getElementById('kodNo' + i) || document.querySelector(\`[name="detaylar[\${i}].kodNo"]\`);
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
                            const topVal = inv.toplamTutar !== undefined ? inv.toplamTutar : inv.toplam;
                            if (topEl && topVal !== undefined) setVal(topEl, topVal.toString().replace('.', ','));
                            
                            if (isTevkifatli && document.getElementById('tevkifat' + i)) setVal(document.getElementById('tevkifat' + i), inv.tevkifat);
                            if (inv.stopajTutari && document.getElementById('stopajTutari' + i)) setVal(document.getElementById('stopajTutari' + i), inv.stopajTutari.toString().replace('.', ','));

                            if (i < invList.length - 1) {
                                await pressAltE();
                                await new Promise(r => setTimeout(r, 60));
                            }
                        }
                    }
                    return true;
                },
                args: [invoices]
            });
            pasteBtn.innerText = "Aktarıldı!";
            chrome.storage.local.get(['transferData'], (result) => {
                const data = result.transferData || {};
                delete data.invoices;
                delete data.hizliFisItems;
                chrome.storage.local.set({ transferData: data }, updateUI);
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

    // 6. Mahsup Fişine Aktar (Bilanço - fisDetayFormArray & Alt+E ile çok satırlı)
    if (mahsupPasteBtn) {
        mahsupPasteBtn.addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url.includes("luca.com.tr")) return showError("Lütfen Luca sekmesinde olduğunuza emin olun.");

            const storage = await chrome.storage.local.get(['transferData']);
            let mList = storage.transferData?.mahsupRows || [];
            if (mList.length === 0) return showError("Aktarılacak mahsup satırı yok.");

            // Kronolojik sıralama (1. günden 31. güne doğru)
            const parseTs = (d) => {
                if (!d) return 0;
                const str = String(d).trim();
                if (str.includes('/') || str.includes('.')) {
                    const sep = str.includes('/') ? '/' : '.';
                    const p = str.split(sep);
                    if (p.length >= 3) return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0])).getTime() || 0;
                }
                return new Date(str).getTime() || 0;
            };
            mList = [...mList].sort((a, b) => {
                const tA = parseTs(a.tarih || a.evrakTarihi || a['Evrak Tarihi']);
                const tB = parseTs(b.tarih || b.evrakTarihi || b['Evrak Tarihi']);
                if (tA !== tB) return tA - tB;
                return String(a.evrakNo || a.no || '').localeCompare(String(b.evrakNo || b.no || ''), undefined, { numeric: true });
            });

            mahsupPasteBtn.disabled = true;
            mahsupPasteBtn.innerText = "Aktarılıyor...";

            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id, allFrames: true },
                    func: async (rows) => {
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

                        const pressAltE = async () => {
                            // 1. Sayfa veya frame içindeki satirEkle
                            if (typeof window.satirEkle === 'function') {
                                try { window.satirEkle(); } catch(e) {}
                            } else if (window.top && window.top.frames && window.top.frames['frm3'] && typeof window.top.frames['frm3'].satirEkle === 'function') {
                                try { window.top.frames['frm3'].satirEkle(); } catch(e) {}
                            } else if (window.top && window.top.frames && window.top.frames['frm6'] && typeof window.top.frames['frm6'].satirEkle === 'function') {
                                try { window.top.frames['frm6'].satirEkle(); } catch(e) {}
                            }

                            // 2. Ekle butonu veya simgesi
                            const plusBtn = document.querySelector("button[onclick*='satirEkle'], input[value*='Ekle'], a[onclick*='satirEkle'], [hotkey*='Alt+E'], [hotkey*='alt+e'], .fa-plus");
                            if (plusBtn) {
                                try { plusBtn.click(); } catch(e) {}
                            }

                            // 3. Klavye Alt+E
                            const evtDown = new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true });
                            const evtUp = new KeyboardEvent('keyup', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true });
                            document.dispatchEvent(evtDown);
                            document.dispatchEvent(evtUp);
                            window.dispatchEvent(evtDown);
                            window.dispatchEvent(evtUp);
                        };

                        const getFields = () => {
                            const isVisible = (el) => el && el.type !== 'hidden' && el.type !== 'checkbox' && el.type !== 'radio' && el.name !== 'eskiTarih' && el.id !== 'eskiTarih';
                            
                            const kods = Array.from(document.querySelectorAll('input[name="HESAP_KODU"], input[name*="hesapKodu"], input[id*="hesapKodu"]')).filter(isVisible);
                            const evrakNos = Array.from(document.querySelectorAll('input[name="EVRAK_NO"], input[name*="evrakNo"], input[id*="evrakNo"]')).filter(isVisible);
                            const tarihs = Array.from(document.querySelectorAll('input[name="EVRAK_TARIH"], input[name="EVRAK_TARIHI"], input[name*="evrakTarih"], input[name*="TARIH"], input[id*="tarih"]')).filter(isVisible);
                            const belgeTurs = Array.from(document.querySelectorAll('input[name="BELGE_TURU"], input[name*="belgeTur"], input[id*="belgeTur"]')).filter(isVisible);
                            const aciklamas = Array.from(document.querySelectorAll('input[name="ACIKLAMA"], input[name*="aciklama"], input[id*="aciklama"]')).filter(isVisible);
                            const borcs = Array.from(document.querySelectorAll('input[name="BORC"], input[name*="borc"], input[id*="borc"]')).filter(isVisible);
                            const alacaks = Array.from(document.querySelectorAll('input[name="ALACAK"], input[name*="alacak"], input[id*="alacak"]')).filter(isVisible);
                            return { kods, evrakNos, tarihs, belgeTurs, aciklamas, borcs, alacaks };
                        };

                        for (let i = 0; i < rows.length; i++) {
                            const r = rows[i];
                            let fields = getFields();

                            // Eğer satır i henüz tabloda yoksa Alt+E ile yeni satır oluştur
                            if (!fields.kods[i] && i > 0) {
                                await pressAltE();
                                let attempts = 0;
                                while (!getFields().kods[i] && attempts < 20) {
                                    await new Promise(res => setTimeout(res, 40));
                                    attempts++;
                                }
                                fields = getFields();
                            }

                            if (!fields.kods[i]) {
                                continue;
                            }

                            // 1. Hesap Kodu
                            const kodVal = (r.muhasebeKodu || r.hesapKodu || r['Hesap Kodu'] || '').trim();
                            if (fields.kods[i] && kodVal) {
                                setVal(fields.kods[i], kodVal);
                                fields.kods[i].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, which: 9, bubbles: true }));
                                fields.kods[i].dispatchEvent(new Event('blur', { bubbles: true }));
                            }

                            await new Promise(res => setTimeout(res, 20));

                            // 2. Evrak No
                            const evrakNoVal = r.evrakNo || r.no || r.faturaNo || r['Evrak No'] || '';
                            if (fields.evrakNos[i] && evrakNoVal) setVal(fields.evrakNos[i], evrakNoVal);

                            // 3. Evrak Tarihi
                            const tarihVal = r.tarih || r.evrakTarihi || r.faturaTarihi || r['Evrak Tarihi'] || '';
                            if (fields.tarihs[i] && tarihVal) setVal(fields.tarihs[i], formatDateTR(tarihVal));

                            // 4. Belge Türü
                            if (fields.belgeTurs[i]) setVal(fields.belgeTurs[i], r.belgeTuru || r['Belge Türü'] || 'FT');

                            // 5. Açıklama
                            const aciklamaVal = r.aciklama || r.unvan || r['Detay Açıklama'] || '';
                            if (fields.aciklamas[i] && aciklamaVal) setVal(fields.aciklamas[i], aciklamaVal);

                            // 6. Borç / Alacak Tutarı
                            const borcVal = r.borc !== undefined && Number(r.borc) > 0 ? r.borc : (r['Borç'] !== undefined && Number(r['Borç']) > 0 ? r['Borç'] : (r.tur === 'borc' ? r.tutar : 0));
                            const alacakVal = r.alacak !== undefined && Number(r.alacak) > 0 ? r.alacak : (r['Alacak'] !== undefined && Number(r['Alacak']) > 0 ? r['Alacak'] : (r.tur === 'alacak' ? r.tutar : 0));

                            if (borcVal && Number(borcVal) > 0 && fields.borcs[i]) {
                                setVal(fields.borcs[i], formatTutarTR(borcVal));
                            } else if (alacakVal && Number(alacakVal) > 0 && fields.alacaks[i]) {
                                setVal(fields.alacaks[i], formatTutarTR(alacakVal));
                            }

                            // Her satır yazıldıktan sonra sıradaki satıra geçmek için Alt+E tetikle
                            if (i < rows.length - 1) {
                                await pressAltE();
                                await new Promise(res => setTimeout(res, 50));
                            }
                        }
                        return true;
                    },
                    args: [mList]
                });
                mahsupPasteBtn.innerText = "Aktarıldı!";
                chrome.storage.local.get(['transferData'], (result) => {
                    const data = result.transferData || {};
                    delete data.mahsupRows;
                    chrome.storage.local.set({ transferData: data }, updateUI);
                });
                setTimeout(() => {
                    mahsupPasteBtn.innerText = "Mahsup Fişine Aktar";
                    mahsupPasteBtn.disabled = false;
                }, 2000);
            } catch (err) {
                showError(err.message);
                mahsupPasteBtn.disabled = false;
                mahsupPasteBtn.innerText = "Mahsup Fişine Aktar";
            }
        });
    }
});
`;

fs.writeFileSync(popupPath, perfectAllInOnePopup, 'utf8');
console.log('popup.js updated with Alt+E row creation and exact date mapping!');
