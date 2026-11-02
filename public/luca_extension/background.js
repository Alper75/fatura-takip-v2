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

// 2. HESAP PLANI HTML AYRIŞTIRICI (listAltHesapTempAction.do & listHesapPlaniBaBs.do)
function parseAccountsFromLucaHtml(html) {
  if (!html) return [];
  const accounts = [];
  const seen = new Set();

  // Yöntem A: <tr> satırlarını ayrıştır (regex ile DOMParser'a gerek kalmadan Service Worker uyumlu)
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const tdMatches = tr.match(/<td[\s\S]*?<\/td>/gi) || [];
    if (tdMatches.length < 2) continue;

    const cells = tdMatches.map(td => td.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

    // Hesap kodu formatı: 100, 120.01.001, 320.01, vb.
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
      const key = `${code}|${name}`;
      if (!seen.has(key) && name && !name.toLowerCase().includes("hesap adı") && !name.toLowerCase().includes("hesap adi")) {
        seen.add(key);
        accounts.push({
          code,
          kod: code,
          name,
          ad: name,
          taxOrInfo: extra1,
          balanceInfo: extra2
        });
      }
    }
  }

  // Yöntem B: <option> etiketlerini ayrıştır
  if (accounts.length === 0) {
    const optRegex = /<option[^>]*>([\s\S]*?)<\/option>/gi;
    let optMatch;
    while ((optMatch = optRegex.exec(html)) !== null) {
      const text = optMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const m = text.match(/^(\d{3}(?:\.[0-9A-Za-z_]+)*)\s*[-–:]?\s*(.+)$/);
      if (m) {
        const key = `${m[1]}|${m[2]}`;
        if (!seen.has(key)) {
          seen.add(key);
          accounts.push({ code: m[1], kod: m[1], name: m[2], ad: m[2] });
        }
      }
    }
  }

  // Yöntem C: Script değişkenleri / dizileri
  if (accounts.length === 0) {
    const jsRegex = /["'](\d{3}(?:\.[0-9A-Za-z_]+)+)["']\s*,\s*["']([^"']{2,100})["']/g;
    let match;
    while ((match = jsRegex.exec(html)) !== null) {
      const key = `${match[1]}|${match[2]}`;
      if (!seen.has(key)) {
        seen.add(key);
        accounts.push({ code: match[1], kod: match[1], name: match[2], ad: match[2] });
      }
    }
  }

  return accounts;
}

// 3. HESAP PLANINI LUCA'DAN ÇEKME
async function fetchAccountsFromLuca(prefix = "") {
  const host = await getLucaHost();
  let accounts = [];

  // Yöntem 0: Eğer Luca sekmesi açıksa oradan anlık DOM/sayfa tablosunu sorgula
  try {
    const tabs = await chrome.tabs.query({ url: "*://*.luca.com.tr/*" });
    for (const t of tabs) {
      if (t.id) {
        try {
          const domRes = await new Promise(resolve => {
            chrome.tabs.sendMessage(t.id, { type: 'SCRAPE_PAGE_ACCOUNTS' }, (resp) => {
              if (chrome.runtime.lastError || !resp || resp.status !== 'success') resolve(null);
              else resolve(resp.data);
            });
          });
          if (domRes && domRes.length > 0) {
            accounts = domRes;
            console.log('[Luca Background] Açık sekmeden hesap planı alındı:', accounts.length);
            break;
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  // 1. Öncelikli Yöntem: listAltHesapTempAction.do (GET ve POST)
  if (accounts.length === 0) {
    try {
      const url = `https://${host}/Luca/listAltHesapTempAction.do?bakiyeGetir=1&hesapKodu=${encodeURIComponent(prefix)}`;
      console.log('[Luca Background] Alt Hesap Planı çekiliyor (GET):', url);
      const res = await fetch(url, { credentials: 'include' });
      const html = await res.text();
      accounts = parseAccountsFromLucaHtml(html);
    } catch (e) {
      console.warn('[Luca Background] listAltHesapTempAction GET hatası:', e);
    }
  }

  // 1.b listAltHesapTempAction.do POST ile deneme
  if (accounts.length === 0) {
    try {
      const url = `https://${host}/Luca/listAltHesapTempAction.do`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ bakiyeGetir: '1', hesapKodu: prefix }).toString(),
        credentials: 'include'
      });
      const html = await res.text();
      accounts = parseAccountsFromLucaHtml(html);
    } catch (e) {
      console.warn('[Luca Background] listAltHesapTempAction POST hatası:', e);
    }
  }

  // 2. Tamamlayıcı / Alternatif Yöntem: listHesapPlaniBaBs.do
  if (accounts.length === 0) {
    try {
      const url = `https://${host}/Luca/listHesapPlaniBaBs.do`;
      const mainCodes = ["1", "3", "6", "7"];
      for (const mCode of mainCodes) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
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
        const res = await fetch(`https://${host}${ep}`, { credentials: 'include' });
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

  const res = await fetch(url, { credentials: 'include' });
  const html = await res.text();
  const parsed = parseCariDogrulamaVars(html);
  return parsed || { error: 'Cari bilgisi ayrıştırılamadı', rawHtml: html.slice(0, 300) };
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

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams(payload).toString(),
    credentials: 'include'
  });

  const html = await res.text();

  // Dönen yanıttaki lucaNotYaz mesajını yakala
  const notMatch = html.match(/lucaNotYaz\s*\(\s*["']([^"']+)["'](?:\s*,\s*["']([^"']+)["'])?\s*\)/i);
  const idMatch = html.match(/name=["']HESAP_ID["'][^>]*value=["']([^"']*)["']/i);
  const createdId = idMatch ? idMatch[1] : "";

  // Arka planda hesap planını güncelle
  fetchAccountsFromLuca().catch(() => {});

  if (notMatch) {
    const msg = notMatch[1];
    const isError = msg.toLowerCase().includes("hata") || msg.toLowerCase().includes("uyarı");
    return {
      success: !isError,
      message: msg,
      createdId,
      code,
      name
    };
  }

  return {
    success: true,
    message: "Hesap planı kaydedildi.",
    createdId,
    code,
    name
  };
}

// 6. MESAJ DİNLEYİCİ
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, actionKey } = message;

  // A. Transfer Verisi Yönetimi
  if (type === 'SET_TRANSFER_DATA') {
    chrome.storage.local.get(['transferData'], (res) => {
      const current = res.transferData || {};
      const merged = { ...current, ...message.data };
      chrome.storage.local.set({ transferData: merged }, () => {
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

  // F. Atlas Uyumluluk Eylemleri (FETCH_LUCA_URL_AS_HTML & POST_LUCA_URL_AS_HTML)
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
});
