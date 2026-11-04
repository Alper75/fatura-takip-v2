// background.js - Luca Aktarım & Hesap Planı Servisi (v3.0.0)
console.log('[Luca Service Worker] Başlatıldı.');

// Aktif Luca Sunucusu Tespiti
async function getLucaHost() {
  try {
    const tabs = await chrome.tabs.query({ url: "*://*.luca.com.tr/*" });
    if (tabs && tabs.length > 0) {
      for (const t of tabs) {
        if (t.url) {
          const u = new URL(t.url);
          if (u.hostname && u.hostname.includes('luca.com.tr')) {
            return u.hostname;
          }
        }
      }
    }
  } catch (e) {}
  return "auygs.luca.com.tr";
}

// 1. OTURUM SORGULAMA (GetSessionInfoServlet)
async function getLucaSessionInfo() {
  const host = await getLucaHost();
  const url = `https://${host}/Luca/GetSessionInfoServlet?time=${Date.now()}`;
  try {
    const res = await fetch(url, { credentials: 'include' });
    const text = await res.text();
    
    const getTag = (tag) => {
      const match = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
      return match ? match[1].trim() : '';
    };

    const userId = getTag('cusimi1');
    const username = getTag('cusika3');
    const companyId = getTag('cusisi4');
    const termId = getTag('cusidi5');

    if (userId || username) {
      return {
        isLoggedIn: true,
        userId,
        username,
        companyId,
        termId,
        host
      };
    }
    return { isLoggedIn: false, host, error: 'Oturum açık değil' };
  } catch (err) {
    return { isLoggedIn: false, host, error: err.message };
  }
}

// 2. HESAP PLANI AYRIŞTIRICI (HTML, XML, JSON & Script Uyumlu)
function parseAccountsFromLucaHtml(html) {
  if (!html) return [];
  const accounts = [];
  const seen = new Set();

  const addAccount = (c, n, extra1 = '', extra2 = '') => {
    const code = String(c || '').trim();
    const name = String(n || '').trim();
    if (/^\d{3}(\.[0-9A-Za-z_]+)*$/.test(code) && name && !name.toLowerCase().includes('hesap ad') && !name.toLowerCase().includes('hesap adi') && !seen.has(code)) {
      seen.add(code);
      accounts.push({
        code,
        kod: code,
        name,
        ad: name,
        taxOrInfo: extra1,
        balanceInfo: extra2
      });
    }
  };

  // Yöntem A: JSON Formatı
  try {
    const trimmed = html.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : (parsed.data || parsed.items || parsed.accounts || parsed.hesaplar || []);
      for (const item of arr) {
        addAccount(item.hesapKodu || item.code || item.kod, item.hesapAdi || item.name || item.ad);
      }
      if (accounts.length > 0) return accounts;
    }
  } catch(e) {}

  // Yöntem B: XML Etiketleri (<hesapKodu>...</hesapKodu><hesapAdi>...</hesapAdi>)
  const xmlTagRegex = /<(?:hesapKodu|hesapkodu|kod|hk)[^>]*>([\s\S]*?)<\/(?:hesapKodu|hesapkodu|kod|hk)>[\s\S]*?<(?:hesapAdi|hesapadi|ad|ha)[^>]*>([\s\S]*?)<\/(?:hesapAdi|hesapadi|ad|ha)>/gi;
  let xm;
  while ((xm = xmlTagRegex.exec(html)) !== null) {
    addAccount(xm[1].replace(/<[^>]+>/g, ''), xm[2].replace(/<[^>]+>/g, ''));
  }
  if (accounts.length > 0) return accounts;

  // Yöntem C: XML Nitelikleri (<hesap kod="..." ad="..." />)
  const xmlAttrRegex = /<[^>]+(?:kod|code)=['"](\d{3}(?:\.[0-9A-Za-z_]+)*)['"][^>]+(?:ad|name)=['"]([^'"]+)['"]/gi;
  let am;
  while ((am = xmlAttrRegex.exec(html)) !== null) {
    addAccount(am[1], am[2]);
  }
  if (accounts.length > 0) return accounts;

  // Yöntem D: HTML <tr> Tablo Satırları (addFis.do, hesapPlaniListesi.do, popup vb.)
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const tdMatches = tr.match(/<td[\s\S]*?<\/td>/gi) || [];
    if (tdMatches.length < 2) continue;

    const cells = tdMatches.map(td => td.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

    let codeIdx = -1;
    for (let i = 0; i < Math.min(cells.length, 4); i++) {
      if (/^\d{3}(\.[0-9A-Za-z_]+)*$/.test(cells[i])) {
        codeIdx = i;
        break;
      }
    }

    if (codeIdx !== -1) {
      const code = cells[codeIdx];
      const name = cells[codeIdx + 1] || "";
      const extra1 = cells[codeIdx + 2] || "";
      const extra2 = cells.slice(codeIdx + 3).filter(Boolean).join(" | ");
      addAccount(code, name, extra1, extra2);
    }
  }
  if (accounts.length > 0) return accounts;

  // Yöntem E: <option> Açılır Menü Etiketleri
  const optRegex = /<option[^>]*>([\s\S]*?)<\/option>/gi;
  let optMatch;
  while ((optMatch = optRegex.exec(html)) !== null) {
    const text = optMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const m = text.match(/^(\d{3}(?:\.[0-9A-Za-z_]+)*)\s*[-–:]?\s*(.+)$/);
    if (m) addAccount(m[1], m[2]);
  }
  if (accounts.length > 0) return accounts;

  // Yöntem F: JavaScript Dizileri ve Metin Regex
  const jsRegex = /["']?(\d{3}(?:\.[0-9A-Za-z_]+)+)["']?\s*[,\-–—|]\s*["']?([^"'\r\n<]{2,80})["']?/g;
  let match;
  while ((match = jsRegex.exec(html)) !== null) {
    addAccount(match[1], match[2]);
  }

  return accounts;
}

// 3. HESAP PLANINI LUCA'DAN ÇEKME
async function fetchAccountsFromLuca(prefix = "") {
  const host = await getLucaHost();
  let accounts = [];

  // Yöntem 0: Açık Luca sekmelerinden sorgula (İçerik scripti veya executeScript)
  try {
    const tabs = await chrome.tabs.query({ url: "*://*.luca.com.tr/*" });
    for (const t of tabs) {
      if (t.id) {
        // 0.a Mesaj ile dene
        try {
          const domRes = await new Promise(resolve => {
            chrome.tabs.sendMessage(t.id, { type: 'SCRAPE_PAGE_ACCOUNTS' }, (resp) => {
              if (chrome.runtime.lastError || !resp || resp.status !== 'success') resolve(null);
              else resolve(resp.data);
            });
          });
          if (domRes && domRes.length > 0) {
            accounts = domRes;
            console.log('[Luca Background] Açık sekmeden hesap planı alındı (Message):', accounts.length);
            break;
          }
        } catch (e) {}

        // 0.b Scripting executeScript ile sekme içinden doğrudan çek
        if (accounts.length === 0) {
          try {
            const execRes = await chrome.scripting.executeScript({
              target: { tabId: t.id },
              func: async () => {
                const found = [];
                const seenKeys = new Set();
                const add = (c, n) => {
                  const code = (c || '').trim();
                  const name = (n || '').trim();
                  if (/^\d{3}(\.[0-9A-Za-z_]+)*$/.test(code) && name && !seenKeys.has(code)) {
                    seenKeys.add(code);
                    found.push({ code, kod: code, name, ad: name });
                  }
                };

                // Tüm frame'leri tara
                const docList = [document];
                try {
                  if (window.frames) {
                    for (let f = 0; f < window.frames.length; f++) {
                      try { if (window.frames[f]?.document) docList.push(window.frames[f].document); } catch(e) {}
                    }
                  }
                } catch(e) {}

                for (const d of docList) {
                  const trs = Array.from(d.querySelectorAll('tr'));
                  for (const tr of trs) {
                    if (tr.querySelector('th')) continue;
                    const tds = Array.from(tr.querySelectorAll('td')).map(x => (x.innerText || '').trim());
                    for (let i = 0; i < Math.min(tds.length, 3); i++) {
                      if (/^\d{3}(\.[0-9A-Za-z_]+)+$/.test(tds[i])) {
                        add(tds[i], tds[i + 1]);
                        break;
                      }
                    }
                  }
                }

                // Sayfa içinden yerel AJAX isteği (Session çerezi ile kesin çalışır)
                if (found.length === 0) {
                  try {
                    const r = await fetch('/Luca/listAltHesapTempAction.do?bakiyeGetir=1&hesapKodu=', { credentials: 'include' });
                    const txt = await r.text();
                    const xmlRegex = /<(?:hesapKodu|kod)[^>]*>([\s\S]*?)<\/(?:hesapKodu|kod)>[\s\S]*?<(?:hesapAdi|ad)[^>]*>([\s\S]*?)<\/(?:hesapAdi|ad)>/gi;
                    let m;
                    while ((m = xmlRegex.exec(txt)) !== null) {
                      add(m[1].replace(/<[^>]+>/g, ''), m[2].replace(/<[^>]+>/g, ''));
                    }
                  } catch(e) {}
                }

                return found;
              }
            });

            if (execRes && execRes[0]?.result && execRes[0].result.length > 0) {
              accounts = execRes[0].result;
              console.log('[Luca Background] Açık sekmeden hesap planı alındı (Scripting):', accounts.length);
              break;
            }
          } catch(e) {}
        }
      }
    }
  } catch (e) {}

  const standardHeaders = {
    'Referer': `https://${host}/Luca/menu.do`,
    'Origin': `https://${host}`,
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  };

  // 1. listAltHesapTempAction.do (GET & POST)
  if (accounts.length === 0) {
    try {
      const url = `https://${host}/Luca/listAltHesapTempAction.do?bakiyeGetir=1&hesapKodu=${encodeURIComponent(prefix)}`;
      console.log('[Luca Background] Alt Hesap Planı çekiliyor (GET):', url);
      const res = await fetch(url, { headers: standardHeaders, credentials: 'include' });
      const html = await res.text();
      accounts = parseAccountsFromLucaHtml(html);
    } catch (e) {
      console.warn('[Luca Background] listAltHesapTempAction GET hatası:', e);
    }
  }

  // 1.b Ana hesap kodları ile parça parça çekme (1..7)
  if (accounts.length === 0) {
    try {
      const mainPrefixes = ['1', '2', '3', '6', '7'];
      for (const p of mainPrefixes) {
        const url = `https://${host}/Luca/listAltHesapTempAction.do?bakiyeGetir=1&hesapKodu=${p}`;
        const res = await fetch(url, { headers: standardHeaders, credentials: 'include' });
        const html = await res.text();
        const parsed = parseAccountsFromLucaHtml(html);
        parsed.forEach(acc => {
          if (!accounts.some(a => (a.code || a.kod) === (acc.code || acc.kod))) {
            accounts.push(acc);
          }
        });
      }
    } catch (e) {
      console.warn('[Luca Background] prefix listAltHesapTempAction hatası:', e);
    }
  }

  // 2. listHesapPlaniBaBs.do POST
  if (accounts.length === 0) {
    try {
      const url = `https://${host}/Luca/listHesapPlaniBaBs.do`;
      const mainCodes = ["1", "3", "6", "7"];
      for (const mCode of mainCodes) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { ...standardHeaders, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: new URLSearchParams({ HKTEKSECILI: mCode }).toString(),
          credentials: 'include'
        });
        const html = await res.text();
        const parsed = parseAccountsFromLucaHtml(html);
        parsed.forEach(acc => {
          if (!accounts.some(a => (a.code || a.kod) === (acc.code || acc.kod))) {
            accounts.push(acc);
          }
        });
      }
    } catch (e) {
      console.warn('[Luca Background] listHesapPlaniBaBs hatası:', e);
    }
  }

  // 3. Alternatif Yöntem: hesapPlaniListesi.do / listHesapPlani.do
  if (accounts.length === 0) {
    try {
      const endpoints = ['/Luca/hesapPlaniListesi.do', '/Luca/listHesapPlani.do'];
      for (const ep of endpoints) {
        const res = await fetch(`https://${host}${ep}`, { headers: standardHeaders, credentials: 'include' });
        const html = await res.text();
        const parsed = parseAccountsFromLucaHtml(html);
        if (parsed.length > 0) {
          accounts = parsed;
          break;
        }
      }
    } catch (e) {
      console.warn('[Luca Background] alternatif hesap planı endpoint hatası:', e);
    }
  }

  if (accounts.length > 0) {
    chrome.storage.local.set({
      lucaAccounts: accounts,
      lastSyncTime: new Date().toISOString()
    });
    console.log(`[Luca Background] Toplam ${accounts.length} hesap yerel hafızaya kaydedildi.`);
  }

  return accounts;
}

// 4. VKN / TCKN İLE CARİ DOĞRULAMA (cariBilgiDogrulamaSistemdenAl.do)
function parseCariDogrulamaVars(html) {
  if (!html) return null;
  const extractVar = (varName) => {
    const regex = new RegExp(`var\\s+${varName}\\s*=\\s*['"]([^'"]*)['"]`, "i");
    const m = html.match(regex);
    return m ? m[1].trim() : "";
  };

  const info = {
    tckNo: extractVar("tckNo"),
    vergiNo: extractVar("vergiNo"),
    vergiDairesi: extractVar("vergiDairesi"),
    vergiDairesiAd: extractVar("vergiDairesiAd"),
    unvan: extractVar("unvan"),
    adres: extractVar("adres"),
    il: extractVar("il"),
    ilce: extractVar("ilce"),
    hesapId: extractVar("hesapId"),
    il_kodu: extractVar("il_kodu"),
    ilce_kodu: extractVar("ilce_kodu"),
    donemId: extractVar("donemId"),
    hataMesaji: extractVar("hataMesaji"),
    hataMesajiDevam: extractVar("hataMesajiDevam")
  };

  if (!info.tckNo && !info.vergiNo && !info.unvan && !info.hataMesaji) {
    return null;
  }
  return info;
}

async function verifyVknTcknInLuca(taxNo) {
  const host = await getLucaHost();
  const cleanTax = String(taxNo || '').trim();
  const queryParam = cleanTax.length === 11
    ? `TCK_NO=${encodeURIComponent(cleanTax)}&VERGI_NO=`
    : `TCK_NO=&VERGI_NO=${encodeURIComponent(cleanTax)}`;

  const url = `https://${host}/Luca/cariBilgiDogrulamaSistemdenAl.do?${queryParam}&HESAP_ID=&HESAP_KODU=&F10=1`;
  console.log('[Luca Background] VKN/TCKN sorgulanıyor:', url);

  // 1. Önce açık bir Luca sekmesinde sorgula (Oturum çerezleri kesinlikle aktiftir)
  try {
    const tabs = await chrome.tabs.query({ url: "*://*.luca.com.tr/*" });
    if (tabs && tabs.length > 0) {
      const tabRes = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: async (fetchUrl) => {
          try {
            const r = await fetch(fetchUrl, { credentials: 'include' });
            return await r.text();
          } catch(e) { return null; }
        },
        args: [url]
      });
      if (tabRes && tabRes[0]?.result) {
        const parsed = parseCariDogrulamaVars(tabRes[0].result);
        if (parsed && (parsed.unvan || parsed.vergiNo || parsed.tckNo)) {
          return parsed;
        }
      }
    }
  } catch(e) {}

  // 2. Arka plan fetch ile dene
  try {
    const res = await fetch(url, {
      headers: {
        'Referer': `https://${host}/Luca/menu.do`,
        'Origin': `https://${host}`,
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'include'
    });
    const html = await res.text();
    const parsed = parseCariDogrulamaVars(html);
    return parsed || { error: 'Cari bilgisi ayrıştırılamadı', rawHtml: html.slice(0, 300) };
  } catch(err) {
    return { error: err.message };
  }
}

// 5. YENİ HESAP / CARİ KART AÇMA (hesapPlaniBaBs.do)
async function createAccountInLuca(accData) {
  const host = await getLucaHost();
  const code = (accData.code || accData.kod || '').trim();
  const name = (accData.name || accData.ad || '').trim();
  const vkn = (accData.vkn || accData.vergiNo || '').trim();
  const tckn = (accData.tckn || accData.tckNo || '').trim();
  const vdCode = (accData.vdCode || accData.vergiDairesi || '').trim();
  const vdName = (accData.vdName || accData.vergiDairesiAd || '').trim();
  const currency = accData.currency || '0';
  const hesapId = accData.hesapId || '';
  const adres = accData.adres || '';
  const il_kodu = accData.il_kodu || '0';
  const ilce_kodu = accData.ilce_kodu || '0';

  const payload = {
    N: code.includes(".") ? "B" : "K",
    SONGUNLEYEN: "",
    SONGUNLEME_TARIHI: "",
    EKLEYEN: "",
    EKLEME_TARIHI: "",
    HESAP_ID: hesapId,
    HESAP_KOD: code,
    HESAP_AD: name,
    BIRIM: "",
    DOVIZKOD: currency,
    VERGI_NO: vkn,
    TCK_NO: tckn,
    KDV_HESAP_ID: "",
    KDV_HESAP_KOD: "",
    KDV_HESAP_AD: "",
    KDV_ORAN: "",
    CARI_HESAP_ID: "",
    CARI_HESAP_KOD: "",
    CARI_HESAP_AD: "",
    ADRES: adres,
    ADRES_NO: "",
    IL: il_kodu,
    ILCE: ilce_kodu,
    ULKE_KOD: "",
    ULKE_AD: "",
    EMAIL: "",
    CEP: "",
    VERGI_DAIRESI: vdCode,
    VERGI_DAIRESI_AD: vdName,
    IBAN: ""
  };

  const url = `https://${host}/Luca/hesapPlaniBaBs.do?popup=true&hpId=hk_kdvli0&parentDIV=cariIslemDiv&opr=kaydet&time=${Date.now()}&topluBeyan=null&donemId=null`;
  console.log('[Luca Background] Yeni hesap kaydediliyor:', url, payload);

  // 1. Önce açık Luca sekmesinden post et
  try {
    const tabs = await chrome.tabs.query({ url: "*://*.luca.com.tr/*" });
    if (tabs && tabs.length > 0) {
      const tabRes = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: async (postUrl, formBody) => {
          try {
            const r = await fetch(postUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
              body: new URLSearchParams(formBody).toString(),
              credentials: 'include'
            });
            return await r.text();
          } catch(e) { return null; }
        },
        args: [url, payload]
      });

      if (tabRes && tabRes[0]?.result) {
        const html = tabRes[0].result;
        const notMatch = html.match(/lucaNotYaz\s*\(\s*["']([^"']+)["'](?:\s*,\s*["']([^"']+)["'])?\s*\)/i);
        const idMatch = html.match(/name=["']HESAP_ID["'][^>]*value=["']([^'"]*)["']/i);
        const createdId = idMatch ? idMatch[1] : "";
        fetchAccountsFromLuca().catch(() => {});
        if (notMatch) {
          const msg = notMatch[1];
          const isError = msg.toLowerCase().includes("hata") || msg.toLowerCase().includes("uyarı");
          return { success: !isError, message: msg, createdId, code, name };
        }
        return { success: true, message: "Hesap planı başarıyla kaydedildi.", createdId, code, name };
      }
    }
  } catch(e) {}

  // 2. Arka plan fetch ile dene
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'Referer': `https://${host}/Luca/menu.do`,
      'Origin': `https://${host}`
    },
    body: new URLSearchParams(payload).toString(),
    credentials: 'include'
  });

  const html = await res.text();
  const notMatch = html.match(/lucaNotYaz\s*\(\s*["']([^"']+)["'](?:\s*,\s*["']([^"']+)["'])?\s*\)/i);
  const idMatch = html.match(/name=["']HESAP_ID["'][^>]*value=["']([^'"]*)["']/i);
  const createdId = idMatch ? idMatch[1] : "";

  fetchAccountsFromLuca().catch(() => {});

  if (notMatch) {
    const msg = notMatch[1];
    const isError = msg.toLowerCase().includes("hata") || msg.toLowerCase().includes("uyarı");
    return { success: !isError, message: msg, createdId, code, name };
  }

  return { success: true, message: "Hesap planı kaydedildi.", createdId, code, name };
}

// 6. DENEME EKLENTİSİ (ATLAS) BİREBİR FİŞ OLUŞTURMA & AKTARIM MOTORU
let currentTabId = null;
let currentBucket = null;

function formatDateSlash(dStr) {
  if (!dStr) {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }
  const str = String(dStr).trim().split(' ')[0].split('T')[0];
  if (str.includes('/')) {
    const p = str.split('/');
    if (p.length === 3) {
      return p[0].length === 4
        ? `${p[2].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[0]}`
        : `${p[0].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[2]}`;
    }
  }
  if (str.includes('.')) {
    const p = str.split('.');
    if (p.length === 3) {
      return p[0].length === 4
        ? `${p[2].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[0]}`
        : `${p[0].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[2]}`;
    }
  }
  if (str.includes('-')) {
    const p = str.split('-');
    if (p.length === 3) {
      return p[0].length === 4
        ? `${p[2].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[0]}`
        : `${p[0].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[2]}`;
    }
  }
  return str;
}

function formatMoneyTR(val) {
  if (val === undefined || val === null || val === '') return '0,00';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(trimmed) || /^\d+,\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const parsed = parseFloat(trimmed.replace(/\./g, '').replace(',', '.'));
    if (isNaN(parsed)) return '0,00';
    return parsed.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (typeof val === 'number') {
    if (isNaN(val)) return '0,00';
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '0,00';
}

// Her türlü BULK / Mahsup / Banka satırını doğrudan Standart Mahsup Fişi (SINGLE) formatına dönüştürür (Toplu fişe gitmez)
function normalizeBucketToSingleMahsup(rawBucket) {
  if (!rawBucket) return null;
  if (rawBucket.accounting_type === 'basic') return rawBucket;

  const isSatis = rawBucket.ledger_type_value ? Number(rawBucket.ledger_type_value) === 2 : true;
  const rawRows = Array.isArray(rawBucket.ledger_rows) ? rawBucket.ledger_rows : [];
  const expandedRows = [];

  rawRows.forEach((r) => {
    // Eğer satır BULK formatındaysa (invoice_account_code veya vat_account_code varsa) 3'lü mahsup maddesine aç
    if (r.invoice_account_code || r.vat_account_code) {
      const docNo = String(r.document_no || r.evrakNo || '').trim();
      const docDate = formatDateSlash(r.document_date || r.evrakTarihi || r.tarih || rawBucket.ledger_date);
      const docType = String(r.document_type || r.belgeTuru || 'FT').trim();
      const desc = String(r.description || r.aciklama || (isSatis ? 'Satış Faturası' : 'Alış Faturası')).trim();
      const qty = String(r.quantity !== undefined ? r.quantity : '1');
      const curr = String(r.currency || 'TRY');
      const rate = String(r.formatted_exchange_rate || '1,00');
      const cariKod = String(r.contact_account_code || r.account_code || (isSatis ? '120.01.001' : '320.01.001')).trim();
      const faturaKod = String(r.invoice_account_code || (isSatis ? '600.01.020' : '153.01.001')).trim();
      const kdvKod = String(r.vat_account_code || (isSatis ? '391.01.020' : '191.01.020')).trim();
      const netTotal = formatMoneyTR(r.formatted_net_total || r.tutar || '0,00');
      const matrah = formatMoneyTR(r.formatted_net_total_without_vat || '0,00');
      const vat = formatMoneyTR(r.formatted_vat || '0,00');

      if (isSatis) {
        expandedRows.push({
          account_code: cariKod,
          document_no: docNo,
          document_date: docDate,
          document_type: docType,
          description: desc,
          formatted_debit: netTotal,
          formatted_credit: '0,00',
          quantity: qty,
          currency: curr,
          formatted_exchange_rate: rate,
          formatted_currency_debit: r.formatted_currency_net_total || '0,00',
          formatted_currency_credit: '0,00',
          babs: Boolean(r.babs),
          contact_account_code: cariKod
        });
        expandedRows.push({
          account_code: faturaKod,
          document_no: docNo,
          document_date: docDate,
          document_type: docType,
          description: `${desc} (Matrah)`,
          formatted_debit: '0,00',
          formatted_credit: matrah,
          quantity: qty,
          currency: curr,
          formatted_exchange_rate: rate,
          formatted_currency_debit: '0,00',
          formatted_currency_credit: r.formatted_currency_net_total_without_vat || '0,00',
          babs: false,
          contact_account_code: cariKod
        });
        if (vat !== '0,00' && vat !== '0') {
          expandedRows.push({
            account_code: kdvKod,
            document_no: docNo,
            document_date: docDate,
            document_type: docType,
            description: `${desc} (KDV)`,
            formatted_debit: '0,00',
            formatted_credit: vat,
            quantity: qty,
            currency: curr,
            formatted_exchange_rate: rate,
            formatted_currency_debit: '0,00',
            formatted_currency_credit: r.formatted_currency_vat || '0,00',
            babs: false,
            contact_account_code: cariKod
          });
        }
      } else {
        expandedRows.push({
          account_code: cariKod,
          document_no: docNo,
          document_date: docDate,
          document_type: docType,
          description: desc,
          formatted_debit: '0,00',
          formatted_credit: netTotal,
          quantity: qty,
          currency: curr,
          formatted_exchange_rate: rate,
          formatted_currency_debit: '0,00',
          formatted_currency_credit: r.formatted_currency_net_total || '0,00',
          babs: Boolean(r.babs),
          contact_account_code: cariKod
        });
        expandedRows.push({
          account_code: faturaKod,
          document_no: docNo,
          document_date: docDate,
          document_type: docType,
          description: `${desc} (Matrah)`,
          formatted_debit: matrah,
          formatted_credit: '0,00',
          quantity: qty,
          currency: curr,
          formatted_exchange_rate: rate,
          formatted_currency_debit: r.formatted_currency_net_total_without_vat || '0,00',
          formatted_currency_credit: '0,00',
          babs: false,
          contact_account_code: cariKod
        });
        if (vat !== '0,00' && vat !== '0') {
          expandedRows.push({
            account_code: kdvKod,
            document_no: docNo,
            document_date: docDate,
            document_type: docType,
            description: `${desc} (KDV)`,
            formatted_debit: vat,
            formatted_credit: '0,00',
            quantity: qty,
            currency: curr,
            formatted_exchange_rate: rate,
            formatted_currency_debit: r.formatted_currency_vat || '0,00',
            formatted_currency_credit: '0,00',
            babs: false,
            contact_account_code: cariKod
          });
        }
      }
    } else {
      // Standart Mahsup veya Banka satırı
      const accCode = String(
        r.account_code || r.hesapKodu || r.muhasebeKodu || r['Hesap Kodu'] || r.kod || r.contact_account_code || ''
      ).trim();
      const docNo = String(r.document_no || r.evrakNo || r['Evrak No'] || r.no || '').trim();
      const docDate = formatDateSlash(r.document_date || r.evrakTarihi || r.tarih || r['Evrak Tarihi'] || rawBucket.ledger_date);
      const docType = String(r.document_type || r.belgeTuru || r['Belge Türü'] || 'FT').trim();
      const desc = String(r.description || r.aciklama || r['Detay Açıklama'] || '').trim();
      const qty = String(r.quantity !== undefined ? r.quantity : (r.miktar !== undefined ? r.miktar : ''));

      const debitRaw = (r.formatted_debit !== undefined && r.formatted_debit !== '')
        ? r.formatted_debit
        : (r.borc !== undefined && Number(r.borc) > 0 ? r.borc : (r.tur === 'borc' ? (r.tutar || r.formatted_net_total) : '0,00'));
      const creditRaw = (r.formatted_credit !== undefined && r.formatted_credit !== '')
        ? r.formatted_credit
        : (r.alacak !== undefined && Number(r.alacak) > 0 ? r.alacak : (r.tur === 'alacak' ? (r.tutar || r.formatted_net_total) : '0,00'));

      expandedRows.push({
        account_code: accCode,
        document_no: docNo,
        document_date: docDate,
        document_type: docType,
        description: desc,
        formatted_debit: formatMoneyTR(debitRaw),
        formatted_credit: formatMoneyTR(creditRaw),
        quantity: qty,
        currency: String(r.currency || r.dovizTuru || 'TRY').trim(),
        formatted_exchange_rate: String(r.formatted_exchange_rate || (r.dovizKuru ? formatMoneyTR(r.dovizKuru) : '1,00')),
        formatted_currency_debit: String(r.formatted_currency_debit || '0,00'),
        formatted_currency_credit: String(r.formatted_currency_credit || '0,00'),
        babs: Boolean(r.babs),
        contact_account_code: String(r.contact_account_code || accCode).trim()
      });
    }
  });

  const ledgerDate = formatDateSlash(
    rawBucket.ledger_date || expandedRows[0]?.document_date
  );

  return {
    ...rawBucket,
    accounting_type: 'standard',
    entry_method: 'SINGLE',
    ledger_date: ledgerDate,
    ledger_type_value: rawBucket.ledger_type_value || 2,
    ledger_rows: expandedRows
  };
}

function queryOpenHizliFisOptions(cb) {
  chrome.tabs.query({ url: "*://*.luca.com.tr/Luca/hizliFisPopUp.do*" }, (tabs) => {
    const hTab = (tabs || [])[0];
    if (!hTab) return cb({ error: "Açık Hızlı Fiş (hizliFisPopUp.do) penceresi bulunamadı." });
    chrome.tabs.sendMessage(hTab.id, { actionKey: "EXTRACT_HIZLI_FIS_OPTIONS" }, (res) => {
      if (chrome.runtime.lastError || !res) {
        chrome.scripting.executeScript(
          {
            target: { tabId: hTab.id },
            files: ["bugsnagConfig.js", "luca-app-content-script-basic.js"]
          },
          () => {
            setTimeout(() => {
              chrome.tabs.sendMessage(hTab.id, { actionKey: "EXTRACT_HIZLI_FIS_OPTIONS" }, (res2) => {
                cb(res2 || { error: "Seçenekler okunamadı." });
              });
            }, 200);
          }
        );
      } else {
        cb(res);
      }
    });
  });
}

function launchOrAttachLucaTab(options, sendResponse) {
  const proceed = (bkt) => {
    if (bkt && bkt.accounting_type === "basic") {
      chrome.tabs.query({ url: "*://*.luca.com.tr/Luca/hizliFisPopUp.do*" }, (hTabs) => {
        const hTab = (hTabs || [])[0];
        if (hTab) {
          if (hTab.windowId) {
            try { chrome.windows.update(hTab.windowId, { focused: true }); } catch (e) {}
          }
          chrome.tabs.update(hTab.id, { active: true });
          chrome.tabs.sendMessage(hTab.id, { actionKey: "RUN_BASIC_TRANSFER" }, (res) => {
            if (chrome.runtime.lastError || !res) {
              chrome.scripting.executeScript({
                target: { tabId: hTab.id },
                files: ["bugsnagConfig.js", "luca-app-content-script-basic.js"]
              });
            }
          });
          return sendResponse(hTab.id);
        }
        attachToMainLucaTab(options, sendResponse);
      });
      return;
    }
    attachToMainLucaTab(options, sendResponse);
  };

  if (currentBucket) {
    proceed(currentBucket);
  } else {
    chrome.storage.local.get(['lucaBucket'], (res) => {
      currentBucket = res?.lucaBucket || null;
      proceed(currentBucket);
    });
  }
}

function attachToMainLucaTab(options, sendResponse) {
  chrome.tabs.query({ url: "*://*.luca.com.tr/*" }, (tabs) => {
    let targetTab = null;
    (tabs || []).forEach((t) => {
      if (t.title && t.title.toUpperCase().includes("HATA")) {
        try { chrome.tabs.remove(t.id); } catch (e) {}
      } else if (t.url && !t.url.includes("hizliFisPopUp.do") && !t.url.includes("agiris.luca.com.tr")) {
        if (!targetTab || t.url.includes("luca.do") || t.url.includes("menu.do")) {
          targetTab = t;
        }
      }
    });

    if (targetTab) {
      let hostIp = "auygs.luca.com.tr";
      try {
        if (targetTab.url) hostIp = new URL(targetTab.url).hostname || "auygs.luca.com.tr";
      } catch (e) {}
      chrome.storage.sync.set({ CURRENT_LUCA_WINDOW_IP: hostIp });
      currentTabId = targetTab.id;
      if (targetTab.windowId) {
        try { chrome.windows.update(targetTab.windowId, { focused: true }); } catch (e) {}
      }
      chrome.tabs.update(targetTab.id, { active: true });
      chrome.tabs.sendMessage(targetTab.id, { actionKey: "RESET_LUCA_STATE" }, (res) => {
        if (chrome.runtime.lastError || !res) {
          chrome.scripting.executeScript(
            {
              target: { tabId: targetTab.id },
              files: ["bugsnagConfig.js", "luca-app-content-script.js"]
            },
            () => {
              setTimeout(() => {
                chrome.tabs.connect(targetTab.id, { name: "TAB_LOADED" });
              }, 150);
            }
          );
        } else {
          chrome.tabs.connect(targetTab.id, { name: "TAB_LOADED" });
        }
      });
      sendResponse(targetTab.id);
    } else {
      const createUrl =
        options && options.url && !options.url.endsWith("/Luca/luca.do")
          ? options.url
          : chrome.runtime.getURL("veri-aktarma.html");
      chrome.tabs.create({ url: createUrl }, (newTab) => {
        currentTabId = newTab.id;
        sendResponse(newTab.id);
      });
    }
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  chrome.storage.sync.get(["CURRENT_LUCA_WINDOW_IP"], (res) => {
    const hostIp = res.CURRENT_LUCA_WINDOW_IP || "auygs.luca.com.tr";
    if (
      currentTabId &&
      tabId === currentTabId &&
      changeInfo.status === "complete" &&
      tab.url &&
      (tab.url === `https://${hostIp}/Luca/luca.do` || tab.url.includes("/Luca/luca.do") || tab.url.includes("/Luca/menu.do"))
    ) {
      try {
        chrome.tabs.connect(currentTabId, { name: "TAB_LOADED" });
      } catch (e) {}
    }
  });
});

// 7. MESAJ DİNLEYİCİ (INTERNAL & EXTERNAL)
function handleExtensionMessage(message, sender, sendResponse) {
  if (!message || typeof message !== 'object') return false;
  const { type, actionKey } = message;

  // A. Transfer Verisi Yönetimi
  if (type === 'SET_TRANSFER_DATA') {
    chrome.storage.local.get(['transferData'], (res) => {
      const current = res.transferData || {};
      const merged = { ...current, ...message.data };
      const rowsForBucket = merged.mahsupRows || merged.bankTransactions || [];
      let updatedBucket = currentBucket;
      if (Array.isArray(rowsForBucket) && rowsForBucket.length > 0 && !message.data?.isIsletme) {
        updatedBucket = normalizeBucketToSingleMahsup({
          accounting_type: 'standard',
          entry_method: 'SINGLE',
          ledger_type_value: 2,
          ledger_rows: rowsForBucket
        });
        currentBucket = updatedBucket;
      }
      const toSave = updatedBucket ? { transferData: merged, lucaBucket: updatedBucket } : { transferData: merged };
      chrome.storage.local.set(toSave, () => {
        console.log('[Luca Background] transferData güncellendi:', Object.keys(merged));
        sendResponse({ status: 'ok', data: merged });
      });
    });
    return true;
  }

  if (type === 'GET_TRANSFER_DATA') {
    chrome.storage.local.get(['transferData'], (result) => {
      sendResponse(result.transferData || {});
    });
    return true;
  }

  // B. Oturum Bilgisi
  if (type === 'GET_LUCA_SESSION') {
    getLucaSessionInfo().then(session => sendResponse(session));
    return true;
  }

  // C. Hesap Planı Çekme
  if (type === 'FETCH_LUCA_ACCOUNTS') {
    fetchAccountsFromLuca(message.prefix || "").then(accounts => {
      sendResponse({ status: 'success', data: accounts, count: accounts.length });
    }).catch(err => {
      sendResponse({ status: 'error', message: err.message });
    });
    return true;
  }

  // D. VKN / TCKN Doğrulama
  if (type === 'VERIFY_VKN_TCKN') {
    verifyVknTcknInLuca(message.taxNo).then(info => {
      sendResponse({ status: 'success', data: info });
    }).catch(err => {
      sendResponse({ status: 'error', message: err.message });
    });
    return true;
  }

  // E. Yeni Hesap / Cari Kart Açma
  if (type === 'CREATE_LUCA_ACCOUNT') {
    createAccountInLuca(message.data).then(res => {
      sendResponse(res);
    }).catch(err => {
      sendResponse({ success: false, message: err.message });
    });
    return true;
  }

  // F. Deneme Eklentisi (Atlas) & Panel.js Uyumluluk Eylemleri
  if (actionKey === 'FETCH_LUCA_URL_AS_HTML') {
    fetch(message.fetchUrl, { credentials: 'include' })
      .then(res => res.text())
      .then(html => sendResponse({ html }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (actionKey === 'POST_LUCA_URL_AS_HTML') {
    const bodyStr = typeof message.body === 'object' 
      ? new URLSearchParams(message.body).toString() 
      : String(message.body || '');
    fetch(message.fetchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: bodyStr,
      credentials: 'include'
    })
      .then(res => res.text())
      .then(html => sendResponse({ html }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (actionKey === 'PING') {
    sendResponse(true);
    return true;
  }

  if (actionKey === 'GET_CURRENT_LUCA_WINDOW_IP') {
    getLucaHost().then(host => sendResponse(host || 'auygs.luca.com.tr'));
    return true;
  }

  if (actionKey === 'GET_LUCA_TOKEN') {
    chrome.storage.sync?.get(['LUCA_TOKEN'], (res) => {
      sendResponse(res?.LUCA_TOKEN || '');
    });
    return true;
  }

  if (actionKey === 'SET_LUCA_BUCKET') {
    const rawBucket = message.bucket || {};
    const normalized = rawBucket.accounting_type === 'basic'
      ? rawBucket
      : normalizeBucketToSingleMahsup(rawBucket);
    currentBucket = normalized;

    chrome.storage.local.set({ lucaBucket: normalized }, () => {
      if (normalized && normalized.ledger_rows && Array.isArray(normalized.ledger_rows)) {
        chrome.storage.local.get(['transferData'], (tRes) => {
          const current = tRes.transferData || {};
          const isBasic = normalized.accounting_type === 'basic';
          chrome.storage.local.set({
            transferData: {
              ...current,
              invoices: isBasic ? normalized.ledger_rows : current.invoices,
              mahsupRows: !isBasic ? normalized.ledger_rows : current.mahsupRows
            }
          });
        });
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (actionKey === 'GET_LUCA_BUCKET') {
    if (currentBucket) {
      sendResponse(currentBucket);
      return true;
    }
    chrome.storage.local.get(['lucaBucket'], (res) => {
      const bkt = res?.lucaBucket ? normalizeBucketToSingleMahsup(res.lucaBucket) : null;
      currentBucket = bkt;
      sendResponse(bkt);
    });
    return true;
  }

  if (actionKey === 'GET_ACCOUNTING_TYPE') {
    if (currentBucket && currentBucket.accounting_type) {
      sendResponse(currentBucket.accounting_type);
      return true;
    }
    chrome.storage.local.get(['lucaBucket'], (res) => {
      const bkt = res?.lucaBucket;
      if (bkt) currentBucket = bkt;
      sendResponse(bkt?.accounting_type || 'standard');
    });
    return true;
  }

  if (actionKey === 'GET_HIZLI_FIS_OPTIONS') {
    queryOpenHizliFisOptions(sendResponse);
    return true;
  }

  if (actionKey === 'GET_EXTENSION_INFO') {
    sendResponse({ version: '3.1.0', installType: 'development' });
    return true;
  }

  if (actionKey === 'GET_USER_INFO') {
    sendResponse({ id: 'fatura_user', userId: 'fatura_user', parasutCompanyId: 'fatura_company' });
    return true;
  }

  if (actionKey === 'CLEAN_TEMPORARY_STORAGE') {
    currentBucket = undefined;
    currentTabId = null;
    chrome.storage.local.remove(['lucaBucket'], () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (actionKey === 'TRACK_EVENT') {
    sendResponse({ ok: true });
    return true;
  }

  if (actionKey === 'CREATE_TAB') {
    launchOrAttachLucaTab(message.options, sendResponse);
    return true;
  }

  return false;
}

chrome.runtime.onMessage.addListener(handleExtensionMessage);
if (chrome.runtime.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener(handleExtensionMessage);
}

