/**
 * Luca Aktarım & Otomasyon Test Paneli (panel.js)
 * - Hem doğrudan Chrome Eklentisi içinden (`chrome-extension://<id>/panel.html`)
 * - Hem de yerel sunucudan (`http://localhost:8080/panel.html`) çalışabilir.
 * - Atlas Aktarım (`da-vinci`) içindeki gerçek Luca uç noktalarını kullanır:
 *   1. Oturum & Aktif Şirket/Dönem: GET /Luca/GetSessionInfoServlet?time=...
 *   2. Şirket/Dönem Seçimi: GET /Luca/TopFrameAction.do?time=...&SIRKET_ID=...&DONEM_ID=...
 *   3. Alt Hesap Planı Çekme: GET /Luca/listAltHesapTempAction.do?bakiyeGetir=1&hesapKodu=...
 *   4. Ana Koda Göre Hesap Planı (BaBs): POST /Luca/listHesapPlaniBaBs.do (Body: { HKTEKSECILI: "1" })
 *   5. VKN/TCKN Doğrulama & Cari Formu: GET /Luca/cariBilgiDogrulamaSistemdenAl.do?TCK_NO=...&VERGI_NO=...&HESAP_ID=&HESAP_KODU=&F10=1
 *   6. Yeni Hesap / Cari Kart Kaydetme: POST /Luca/hesapPlaniBaBs.do?popup=true&hpId=hk_kdvli0&parentDIV=cariIslemDiv&opr=kaydet&time=...&topluBeyan=null&donemId=null
 */

// Başlangıç Örnek Verileri
const bulkRows = [
  {
    vat_rate: "20",
    contact_account_code: "120.01.001",
    document_no: "GIB2026000000001",
    document_date: "20/10/2026",
    document_type: "FT",
    description: "Yazılım Danışmanlık Hizmet Faturası",
    quantity: "1",
    formatted_net_total: "12.000,00",
    invoice_account_code: "600.01.020",
    formatted_net_total_without_vat: "10.000,00",
    vat_account_code: "391.01.020",
    formatted_vat: "2.000,00",
    currency: "TRY",
    formatted_exchange_rate: "1,00",
    formatted_currency_vat: "0,00",
    formatted_currency_net_total: "0,00",
    formatted_currency_net_total_without_vat: "0,00",
    babs: true
  }
];

const singleRows = [
  {
    account_code: "120.01.001",
    document_no: "GIB2026000000001",
    document_date: "20/10/2026",
    document_type: "FT",
    description: "Örnek Teknoloji A.Ş. Satış Faturası",
    formatted_debit: "12.000,00",
    formatted_credit: "0,00",
    quantity: "1",
    currency: "TRY",
    formatted_exchange_rate: "1,00",
    formatted_currency_debit: "0,00",
    formatted_currency_credit: "0,00",
    babs: false,
    contact_account_code: "120.01.001"
  },
  {
    account_code: "600.01.020",
    document_no: "GIB2026000000001",
    document_date: "20/10/2026",
    document_type: "FT",
    description: "Yurtiçi Satışlar (%20 KDV Matrahı)",
    formatted_debit: "0,00",
    formatted_credit: "10.000,00",
    quantity: "1",
    currency: "TRY",
    formatted_exchange_rate: "1,00",
    formatted_currency_debit: "0,00",
    formatted_currency_credit: "0,00",
    babs: true,
    contact_account_code: "120.01.001"
  },
  {
    account_code: "391.01.020",
    document_no: "GIB2026000000001",
    document_date: "20/10/2026",
    document_type: "FT",
    description: "Hesaplanan KDV (%20)",
    formatted_debit: "0,00",
    formatted_credit: "2.000,00",
    quantity: "1",
    currency: "TRY",
    formatted_exchange_rate: "1,00",
    formatted_currency_debit: "0,00",
    formatted_currency_credit: "0,00",
    babs: false,
    contact_account_code: "120.01.001"
  }
];

// LUCA HIZLI FİŞ (sozluk7) KDV TEVKİFAT ORANLARI
const TEVKIFAT_RATES_LIST = [
  { value: "0", fraction: "Yok", ratio: 0, label: "0 - Tevkifat Yok" },
  { value: "10", fraction: "2/10", ratio: 0.2, label: "10 - 2/10 (%20 Tevkifat)" },
  { value: "12", fraction: "3/10", ratio: 0.3, label: "12 - 3/10 (%30 Tevkifat)" },
  { value: "13", fraction: "4/10", ratio: 0.4, label: "13 - 4/10 (%40 Tevkifat)" },
  { value: "11", fraction: "5/10", ratio: 0.5, label: "11 - 5/10 (%50 Tevkifat)" },
  { value: "9", fraction: "7/10", ratio: 0.7, label: "9 - 7/10 (%70 Tevkifat)" },
  { value: "4", fraction: "9/10", ratio: 0.9, label: "4 - 9/10 (%90 Tevkifat)" },
  { value: "5", fraction: "Tam", ratio: 1.0, label: "5 - Tam (10/10 Tevkifat)" },
  { value: "6", fraction: "1/6", ratio: 1 / 6, label: "6 - 1/6 Tevkifat" },
  { value: "8", fraction: "1/5", ratio: 0.2, label: "8 - 1/5 Tevkifat" },
  { value: "1", fraction: "1/3", ratio: 1 / 3, label: "1 - 1/3 Tevkifat" },
  { value: "2", fraction: "1/2", ratio: 0.5, label: "2 - 1/2 Tevkifat" },
  { value: "3", fraction: "2/3", ratio: 2 / 3, label: "3 - 2/3 Tevkifat" },
  { value: "7", fraction: "4/5", ratio: 0.8, label: "7 - 4/5 Tevkifat" }
];

// DEFTER BEYAN / GİB KDV TEVKİFAT KODLARI (601 - 627)
const DEFAULT_TEVKIFAT_CODES = [
  { code: "", name: "-- Tevkifat Kodu Yok --", rateCode: "0", fraction: "Yok" },
  { code: "601", name: "Yapım İşleri ile Mühendislik-Mimarlık Hizmetleri (4/10)", rateCode: "13", fraction: "4/10" },
  { code: "602", name: "Etüt, Plan-Proje, Danışmanlık, Denetim Hizmetleri (9/10)", rateCode: "4", fraction: "9/10" },
  { code: "603", name: "Makine, Teçhizat, Demirbaş, Taşıt Tadil, Bakım ve Onarım (7/10)", rateCode: "9", fraction: "7/10" },
  { code: "604", name: "Yemek Servis Hizmetleri (5/10)", rateCode: "11", fraction: "5/10" },
  { code: "605", name: "Organizasyon Hizmetleri (5/10)", rateCode: "11", fraction: "5/10" },
  { code: "606", name: "İşgücü Temin Hizmetleri (9/10)", rateCode: "4", fraction: "9/10" },
  { code: "607", name: "Özel Güvenlik Hizmetleri (9/10)", rateCode: "4", fraction: "9/10" },
  { code: "608", name: "Yapı Denetim Hizmetleri (9/10)", rateCode: "4", fraction: "9/10" },
  { code: "609", name: "Fason Tekstil ve Konfeksiyon, Çanta/Ayakkabı Dikim İşleri (7/10)", rateCode: "9", fraction: "7/10" },
  { code: "610", name: "Turistik Mağazalara Verilen Müşteri Bulma/Götürme (9/10)", rateCode: "4", fraction: "9/10" },
  { code: "611", name: "Spor Kulüplerinin Yayın, Reklam ve İsim Hakkı İşlemleri (9/10)", rateCode: "4", fraction: "9/10" },
  { code: "612", name: "Temizlik, Çevre ve Bahçe Bakım Hizmetleri (9/10)", rateCode: "4", fraction: "9/10" },
  { code: "613", name: "Servis Taşımacılığı Hizmetleri (5/10)", rateCode: "11", fraction: "5/10" },
  { code: "614", name: "Her Türlü Baskı ve Basım Hizmetleri (7/10)", rateCode: "9", fraction: "7/10" },
  { code: "615", name: "5018 Sayılı Kanuna Ekli İdarelere Yapılan Diğer Hizmetler (5/10)", rateCode: "11", fraction: "5/10" },
  { code: "616", name: "Diğer Hizmetler (5/10)", rateCode: "11", fraction: "5/10" },
  { code: "617", name: "Hurda ve Atık Teslimi (7/10)", rateCode: "9", fraction: "7/10" },
  { code: "618", name: "Hurda ve Atıklardan Elde Edilen Hammadde Teslimi (9/10)", rateCode: "4", fraction: "9/10" },
  { code: "619", name: "Bakır, Çinko, Alüminyum ve Kurşun Ürünlerinin Teslimi (7/10)", rateCode: "9", fraction: "7/10" },
  { code: "620", name: "Külçe Metal Teslimleri (7/10)", rateCode: "9", fraction: "7/10" },
  { code: "621", name: "Ağaç ve Orman Ürünleri Teslimi (5/10)", rateCode: "11", fraction: "5/10" },
  { code: "622", name: "Pamuk, Tiftik, Yün, Yapağı ile Ham Post ve Deri Teslimi (9/10)", rateCode: "4", fraction: "9/10" },
  { code: "623", name: "Büyük ve Küçükbaş Hayvan Etlerinin Teslimi (5/10)", rateCode: "11", fraction: "5/10" },
  { code: "624", name: "Ticari Reklam Hizmetleri (3/10)", rateCode: "12", fraction: "3/10" },
  { code: "625", name: "Karayoluyla Yapılan Yük Taşımacılığı Hizmetleri (2/10)", rateCode: "10", fraction: "2/10" },
  { code: "626", name: "Demir-Çelik Ürünlerinin Teslimi (5/10)", rateCode: "11", fraction: "5/10" },
  { code: "627", name: "Diğer Teslimler (2/10)", rateCode: "10", fraction: "2/10" }
];

// DEFTER BEYAN / GVK STOPAJ KODLARI
const DEFAULT_STOPAJ_CODES = [
  { code: "", name: "-- Stopaj Yok --", rate: 0 },
  { code: "011", name: "Çiftçilerden Satın Alınan Zirai Mahsuller - Hayvan ve Ürünleri (%2)", rate: 2 },
  { code: "012", name: "Çiftçilerden Satın Alınan Diğer Zirai Mahsuller (%4)", rate: 4 },
  { code: "013", name: "Zirai Faaliyet Kapsamında Orman İdaresi Hizmetleri (%2)", rate: 2 },
  { code: "014", name: "Zirai Faaliyet Kapsamında Diğer Hizmetler (%4)", rate: 4 },
  { code: "021", name: "18. Madde Kapsamına Giren Serbest Meslek İşleri (Telif) (%17)", rate: 17 },
  { code: "022", name: "Diğer Serbest Meslek Kazançları (SMMM, Avukat, Mühendis vb.) (%20)", rate: 20 },
  { code: "031", name: "Yıllara Sari İnşaat ve Onarım İşleri - Gelir Vergisi (%5)", rate: 5 },
  { code: "032", name: "Yıllara Sari İnşaat ve Onarım İşleri - Kurumlar Vergisi (%5)", rate: 5 },
  { code: "041", name: "Gayrimenkul Sermaye İradı (Kira Ödemeleri - GVK Md. 70) (%20)", rate: 20 },
  { code: "042", name: "Kooperatiflere Ait Gayrimenkul Kira Ödemeleri (%20)", rate: 20 },
  { code: "091", name: "Esnaf Muaflığı - Mal ve Emtia Alımları (%2)", rate: 2 },
  { code: "092", name: "Esnaf Muaflığı - Hurda Mal Alımları (%2)", rate: 2 },
  { code: "093", name: "Esnaf Muaflığı - Diğer Mal Alımları (%5)", rate: 5 },
  { code: "094", name: "Esnaf Muaflığı - Hizmet Alımları (%10)", rate: 10 },
  { code: "141", name: "Kapıcı, Bahçıvan, Kaloriferci Ücretleri (%0)", rate: 0 },
  { code: "151", name: "Diğer Ücret ve Ödemeler (%20)", rate: 20 },
  { code: "252", name: "Gider Pusulası İle Yapılan Diğer Stopajlı Ödemeler (%10)", rate: 10 }
];

let tevkifatCodesList = [...DEFAULT_TEVKIFAT_CODES];
let stopajCodesList = [...DEFAULT_STOPAJ_CODES];

try {
  const savedTev = JSON.parse(localStorage.getItem("ATLAS_CUSTOM_TEVKIFAT_CODES") || "[]");
  savedTev.forEach((item) => {
    if (item.code && !tevkifatCodesList.some((x) => x.code === item.code)) {
      tevkifatCodesList.push(item);
    }
  });
  const savedStp = JSON.parse(localStorage.getItem("ATLAS_CUSTOM_STOPAJ_CODES") || "[]");
  savedStp.forEach((item) => {
    if (item.code && !stopajCodesList.some((x) => x.code === item.code)) {
      stopajCodesList.push(item);
    }
  });
} catch (e) {}

const basicRows = [
  {
    tur: "1",
    kategori: "1",
    item_type: "invoice",
    document_date: "20/10/2026",
    document_no: "GIB2026000000105",
    description: "Danışmanlık ve Denetim Hizmeti (Tevkifatlı)",
    quantity: "1",
    unit_price: "5.000,00",
    formatted_net_total_without_vat: "5.000,00",
    vat_rate: "20",
    vat_withholding: 1,
    vat_withholding_rate: "4",
    table_code: "2",
    luca_vat_withholding_reason_code: "602",
    formatted_vat: "100,00",
    formatted_net_total: "5.100,00",
    credit_amount: "0,00",
    first_name: "ALPER",
    last_name: "ÇETİN",
    tax_number: "2430911751",
    e_document_type: "EInvoice",
    beyanBelgeTuru: "9",
    alisSatisTuru: "1",
    kayitAltTuru: "1",
    stopajKodu: "",
    stopajTutari: "0,00"
  }
];

let fetchedAccountsList = [];
let detectedCariInfo = null;

// Aktif Luca Sunucu Adresini Al
function getLucaHost() {
  return (document.getElementById("lucaHostInput")?.value || "auygs.luca.com.tr").trim();
}

function buildLucaUrl(path) {
  const host = getLucaHost();
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `https://${host}${cleanPath}`;
}

// LOG YARDIMCISI
function addLog(title, data = null, level = "info") {
  const container = document.getElementById("logContainer");
  const entry = document.createElement("div");
  entry.className = `log-entry ${level}`;
  const timeStr = new Date().toLocaleTimeString("tr-TR");
  let html = `<div class="log-time">[${timeStr}]</div><div><strong>${title}</strong></div>`;
  if (data !== null && data !== undefined) {
    const str = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    html += `<pre class="log-pre">${str.slice(0, 1500)}</pre>`;
  }
  entry.innerHTML = html;
  container.prepend(entry);
}

// EKLENTİ İLE HABERLEŞME KÖPRÜSÜ
function sendExtensionMessage(payload) {
  return new Promise((resolve, reject) => {
    const extId = document.getElementById("extIdInput").value.trim();
    const fullPayload = {
      userInfo: { userId: "test-panel-user", parasutCompanyId: "test-company-1" },
      ...payload
    };

    if (typeof chrome === "undefined" || !chrome.runtime) {
      addLog("Chrome Eklenti API'si bulunamadı! Lütfen sayfayı Chrome'da açın.", null, "error");
      return reject(new Error("chrome.runtime mevcut değil"));
    }

    if (window.location.protocol === "chrome-extension:") {
      chrome.runtime.sendMessage(fullPayload, (response) => {
        if (chrome.runtime.lastError) {
          addLog(`Hata (${payload.actionKey})`, chrome.runtime.lastError.message, "error");
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } else {
      chrome.runtime.sendMessage(extId, fullPayload, (response) => {
        if (chrome.runtime.lastError) {
          addLog(
            `Bağlantı Hatası (${payload.actionKey})`,
            `${chrome.runtime.lastError.message}\nİpucu: chrome://extensions sayfasından eklentiyi 'Yenile' yapın ve Eklenti ID'sinin doğru olduğundan emin olun.`,
            "error"
          );
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    }
  });
}

// GERÇEK LUCA OTURUM SORGULAMA (/Luca/GetSessionInfoServlet)
function parseGetSessionInfoXml(xmlStr) {
  if (!xmlStr) return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr.trim(), "text/xml");
    const responseEl = doc.getElementsByTagName("response")[0];
    if (!responseEl) return null;
    const getTag = (tag) => {
      const el = responseEl.getElementsByTagName(tag)[0];
      return el ? el.textContent.trim() : "";
    };
    const userID = getTag("cusimi1");
    const username = getTag("cusika3");
    const currentCompanyID = getTag("cusisi4");
    const currentTermId = getTag("cusidi5");
    if (!userID && !username) return null;
    return { userID, username, currentCompanyID, currentTermId };
  } catch (e) {
    return null;
  }
}

async function checkLucaSessionInfo() {
  const badgeSession = document.getElementById("badgeLucaSession");
  const summaryInput = document.getElementById("sessionSummaryInput");
  try {
    const url = buildLucaUrl(`/Luca/GetSessionInfoServlet?time=${Date.now()}`);
    const res = await sendExtensionMessage({
      actionKey: "FETCH_LUCA_URL_AS_HTML",
      fetchUrl: url
    });
    const html = res?.html || "";
    const session = parseGetSessionInfoXml(html);
    if (session) {
      const text = `Kullanıcı: ${session.username} (#${session.userID}) | Şirket ID: ${session.currentCompanyID || "Seçilmedi"} | Dönem ID: ${session.currentTermId || "Seçilmedi"}`;
      if (badgeSession) {
        badgeSession.textContent = `Oturum: ${session.username} (Şirket: ${session.currentCompanyID || "-"}) ✔`;
        badgeSession.className = "badge badge-ok";
      }
      if (summaryInput) summaryInput.value = text;
      if (session.currentTermId && document.getElementById("termIdInput")) {
        document.getElementById("termIdInput").value = session.currentTermId;
      }
      addLog("Luca Aktif Oturum Bilgisi Alındı (GetSessionInfoServlet)", session, "success");
      return session;
    } else {
      if (badgeSession) {
        badgeSession.textContent = "Luca Oturumu: Açık Değil / Giriş Yapın";
        badgeSession.className = "badge badge-warn";
      }
      if (summaryInput) summaryInput.value = "Luca oturumu bulunamadı veya süresi doldu. Lütfen Luca'ya giriş yapın.";
      addLog("GetSessionInfoServlet Yanıtı (Oturum Açık Değil)", html.slice(0, 400), "warn");
      return null;
    }
  } catch (err) {
    if (badgeSession) {
      badgeSession.textContent = "Oturum Sorgulanamadı";
      badgeSession.className = "badge badge-warn";
    }
    return null;
  }
}

// 1. BAĞLANTI & LUCA DURUM KONTROLÜ
async function checkConnectionAndLucaStatus() {
  const badgeStatus = document.getElementById("badgeExtStatus");
  const badgeIp = document.getElementById("badgeLucaIp");
  const badgeToken = document.getElementById("badgeLucaToken");

  try {
    const pingRes = await sendExtensionMessage({ actionKey: "PING" });
    if (pingRes) {
      badgeStatus.textContent = "Eklenti Bağlı ✔";
      badgeStatus.className = "badge badge-ok";
      addLog("PING Başarılı", "Eklenti (v1.1.24) aktif ve komutlara hazır.", "success");
    }

    const ipRes = await sendExtensionMessage({ actionKey: "GET_CURRENT_LUCA_WINDOW_IP" });
    if (ipRes) {
      badgeIp.textContent = `Sunucu: ${ipRes}`;
      document.getElementById("lucaHostInput").value = ipRes;
    }

    const tokenRes = await sendExtensionMessage({ actionKey: "GET_LUCA_TOKEN" });
    if (tokenRes) {
      badgeToken.textContent = `SSO Token: ${String(tokenRes).slice(0, 10)}...`;
      badgeToken.className = "badge badge-ok";
    } else {
      badgeToken.textContent = "SSO Token: Henüz Yok";
    }

    await checkLucaSessionInfo();
  } catch (err) {
    badgeStatus.textContent = "Eklentiye Bağlanılamadı ✖";
    badgeStatus.className = "badge badge-warn";
  }
}

// ŞİRKET VE DÖNEM LİSTESİNİ ÇEKME (TopFrameAction.do)
async function fetchLucaCompaniesAndPeriods() {
  try {
    const url = buildLucaUrl(`/Luca/TopFrameAction.do?time=${Date.now()}`);
    addLog(`Şirket/Dönem Listesi Çekiliyor -> ${url}`, null, "info");
    const res = await sendExtensionMessage({
      actionKey: "FETCH_LUCA_URL_AS_HTML",
      fetchUrl: url
    });
    const html = res?.html || "";
    document.getElementById("rawHtmlOutput").value = html;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const selects = Array.from(doc.querySelectorAll("select"));
    const companySelectEl = document.getElementById("companySelect");
    let foundCompanies = 0;

    selects.forEach((sel) => {
      const nameOrId = (sel.name || sel.id || "").toUpperCase();
      const options = Array.from(sel.querySelectorAll("option"));
      if (nameOrId.includes("SIRKET") || options.length > 2) {
        if (foundCompanies === 0 && options.length > 0) {
          companySelectEl.innerHTML = "";
          options.forEach((opt) => {
            const o = document.createElement("option");
            o.value = opt.value;
            o.textContent = `${opt.textContent.trim()} (${opt.value})`;
            if (opt.selected) o.selected = true;
            companySelectEl.appendChild(o);
            foundCompanies++;
          });
        }
      }
      if (nameOrId.includes("DONEM")) {
        const selectedOpt = sel.querySelector("option[selected]") || sel.querySelector("option");
        if (selectedOpt && selectedOpt.value) {
          document.getElementById("termIdInput").value = selectedOpt.value;
        }
      }
    });

    addLog(
      "TopFrameAction.do Yanıtı İşlendi",
      foundCompanies > 0
        ? `${foundCompanies} şirket seçeneği bulundu ve listeye eklendi.`
        : `HTML alındı (${html.length} karakter). Sağ alttaki Ham HTML kutusundan inceleyebilirsiniz.`,
      foundCompanies > 0 ? "success" : "info"
    );
  } catch (err) {
    addLog("Şirket Listesi Çekme Hatası", err.message, "error");
  }
}

// AKTİF ŞİRKET VE DÖNEM DEĞİŞTİRME (switchCompany)
async function switchLucaCompanyAndPeriod() {
  const sirketId = document.getElementById("companySelect").value.trim();
  const donemId = document.getElementById("termIdInput").value.trim();
  if (!sirketId && !donemId) {
    addLog("Uyarı", "Lütfen Şirket ID veya Dönem ID girin.", "warn");
    return;
  }
  try {
    const url = buildLucaUrl(`/Luca/TopFrameAction.do?time=${Date.now()}&SIRKET_ID=${encodeURIComponent(sirketId)}&DONEM_ID=${encodeURIComponent(donemId)}`);
    addLog(`Aktif Şirket/Dönem Değiştiriliyor -> ${url}`, null, "info");
    const res = await sendExtensionMessage({
      actionKey: "FETCH_LUCA_URL_AS_HTML",
      fetchUrl: url
    });
    document.getElementById("rawHtmlOutput").value = res?.html || "";
    await checkLucaSessionInfo();
  } catch (err) {
    addLog("Şirket/Dönem Değiştirme Hatası", err.message, "error");
  }
}

// GERÇEK HESAP PLANI HTML PARSER (listAltHesapTempAction.do & listHesapPlaniBaBs.do)
function parseAccountsFromLucaHtml(html) {
  if (!html) return [];
  const accounts = [];
  const seen = new Set();

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // 1. Tablo satırlarını (<tr>) tara
  const rows = Array.from(doc.querySelectorAll("tr"));
  rows.forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll("td")).map((td) =>
      td.textContent.replace(/\s+/g, " ").trim()
    );
    if (cells.length < 2) return;

    // Hesap kodu formatına uyan hücreyi bul (Örn: 100, 120.01.001, 320.01, 600.01)
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
      if (!seen.has(key) && name && !name.toLowerCase().includes("hesap adı")) {
        seen.add(key);
        accounts.push({
          code,
          name,
          taxOrInfo: extra1,
          balanceInfo: extra2
        });
      }
    }
  });

  // 2. Eğer tabloda değil de JS dizisi veya <option> içinde döndüyse onları da tara
  if (accounts.length === 0) {
    const options = Array.from(doc.querySelectorAll("option"));
    options.forEach((opt) => {
      const text = opt.textContent.replace(/\s+/g, " ").trim();
      const m = text.match(/^(\d{3}(?:\.[0-9A-Za-z_]+)*)\s*[-–:]?\s*(.+)$/);
      if (m) {
        const key = `${m[1]}|${m[2]}`;
        if (!seen.has(key)) {
          seen.add(key);
          accounts.push({ code: m[1], name: m[2], taxOrInfo: opt.value || "", balanceInfo: "" });
        }
      }
    });
  }

  // 3. Script bloklarındaki hesap kodlarını yakala (Örn: "120.01.001", "ÖRNEK A.Ş.")
  if (accounts.length === 0) {
    const regex = /["'](\d{3}(?:\.[0-9A-Za-z_]+)+)["']\s*,\s*["']([^"']{2,100})["']/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const key = `${match[1]}|${match[2]}`;
      if (!seen.has(key)) {
        seen.add(key);
        accounts.push({ code: match[1], name: match[2], taxOrInfo: "", balanceInfo: "" });
      }
    }
  }

  return accounts;
}

function renderFetchedAccountsTable(filterText = "") {
  const tbody = document.getElementById("fetchedAccountsTbody");
  const badge = document.getElementById("accCountBadge");
  const q = filterText.trim().toLowerCase();

  const filtered = q
    ? fetchedAccountsList.filter(
        (a) =>
          a.code.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          (a.taxOrInfo && a.taxOrInfo.toLowerCase().includes(q))
      )
    : fetchedAccountsList;

  badge.textContent = `${filtered.length} / ${fetchedAccountsList.length} Hesap Listelendi`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:16px; color:#64748b;">
          ${
            fetchedAccountsList.length === 0
              ? 'Hesap bulunamadı veya henüz çekilmedi. Sağ alttaki "Ham HTML / XML Yanıtı" kutusundan Luca\'nın döndürdüğü yanıtı kontrol edebilirsiniz.'
              : "Arama kriterine uygun hesap bulunamadı."
          }
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = "";
  filtered.slice(0, 500).forEach((acc, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><strong><code>${acc.code}</code></strong></td>
      <td>${acc.name}</td>
      <td>${acc.taxOrInfo || "-"}</td>
      <td><small>${acc.balanceInfo || "-"}</small></td>
      <td>
        <button class="btn btn-xs btn-primary" data-use-acc-idx="${i}">Faturada Kullan</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-use-acc-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const acc = filtered[Number(btn.dataset.useAccIdx)];
      if (!acc) return;
      document.getElementById("accCode").value = acc.code;
      document.getElementById("accName").value = acc.name;
      updateAccountPostBodyPreview();

      if (bulkRows.length > 0) {
        if (acc.code.startsWith("6") || acc.code.startsWith("15") || acc.code.startsWith("7")) {
          bulkRows[0].invoice_account_code = acc.code;
        } else if (acc.code.startsWith("191") || acc.code.startsWith("391")) {
          bulkRows[0].vat_account_code = acc.code;
        } else {
          bulkRows[0].contact_account_code = acc.code;
          bulkRows[0].description = `${acc.name} Faturası`;
        }
        renderBulkTable();
      }
      if (singleRows.length > 0) {
        singleRows[0].account_code = acc.code;
        singleRows[0].contact_account_code = acc.code;
        singleRows[0].description = `${acc.name}`;
        renderSingleTable();
      }
      addLog("Hesap Seçildi ✔", `${acc.code} - ${acc.name} aktif formlara aktarıldı.`, "success");
    });
  });
}

function isLucaBlankReleaseMenuPage(html) {
  if (!html) return true;
  return (
    html.includes('onload="releaseMenu()"') &&
    html.includes("mainback2.jpg") &&
    html.replace(/<[^>]+>/g, "").trim().length < 50
  );
}

// 1. YÖNTEM: listAltHesapTempAction.do İLE ALT HESAP PLANINI ÇEK
async function fetchAltHesapPlani() {
  try {
    const prefix = document.getElementById("accFilterPrefix").value.trim();
    const url = buildLucaUrl(
      `/Luca/listAltHesapTempAction.do?bakiyeGetir=1&hesapKodu=${encodeURIComponent(prefix)}`
    );
    document.getElementById("rawFetchUrl").value = url;
    addLog(`Alt Hesap Planı Çekiliyor (GET) -> ${url}`, null, "info");

    const res = await sendExtensionMessage({
      actionKey: "FETCH_LUCA_URL_AS_HTML",
      fetchUrl: url
    });
    const html = res?.html || "";
    document.getElementById("rawHtmlOutput").value = html;

    if (isLucaBlankReleaseMenuPage(html)) {
      addLog(
        "Luca Boş Sayfa (releaseMenu) Döndürdü!",
        "1) chrome://extensions sayfasından eklentiyi 'Yenile' yaptığınızdan emin olun (rules_1.json Referer kuralı için).\n2) Luca'da aktif bir Şirket ve Dönem seçili olduğundan emin olun ('Oturum Sorgula' butonu ile kontrol edin).",
        "warn"
      );
      return;
    }

    fetchedAccountsList = parseAccountsFromLucaHtml(html);
    renderFetchedAccountsTable(document.getElementById("accTableSearch").value);
    addLog(
      "Alt Hesap Planı Yanıtı Alındı ✔",
      `${html.length} karakter HTML içinden ${fetchedAccountsList.length} hesap ayrıştırıldı.`,
      fetchedAccountsList.length > 0 ? "success" : "info"
    );
  } catch (err) {
    addLog("Alt Hesap Planı Çekme Hatası", err.message, "error");
  }
}

// 2. YÖNTEM: listHesapPlaniBaBs.do İLE ANA GRUBA GÖRE HESAP PLANINI ÇEK
async function fetchBaBsHesapPlani() {
  try {
    const mainCode = document.getElementById("babsMainCodeSelect").value;
    const url = buildLucaUrl("/Luca/listHesapPlaniBaBs.do");
    const body = { HKTEKSECILI: mainCode };
    document.getElementById("rawFetchUrl").value = url;
    addLog(`Ana Gruba Göre Hesap Planı Çekiliyor (POST) -> ${url}`, body, "info");

    const res = await sendExtensionMessage({
      actionKey: "POST_LUCA_URL_AS_HTML",
      fetchUrl: url,
      body
    });
    const html = res?.html || "";
    document.getElementById("rawHtmlOutput").value = html;

    if (isLucaBlankReleaseMenuPage(html)) {
      addLog(
        "Luca Boş Sayfa (releaseMenu) Döndürdü!",
        "Lütfen chrome://extensions sayfasından eklentiyi yenileyin ve Luca'da aktif bir şirket/dönem seçili olduğunu kontrol edin.",
        "warn"
      );
      return;
    }

    fetchedAccountsList = parseAccountsFromLucaHtml(html);
    renderFetchedAccountsTable(document.getElementById("accTableSearch").value);
    addLog(
      `listHesapPlaniBaBs.do (HKTEKSECILI=${mainCode}) Yanıtı Alındı ✔`,
      `${html.length} karakter HTML içinden ${fetchedAccountsList.length} hesap ayrıştırıldı.`,
      fetchedAccountsList.length > 0 ? "success" : "info"
    );
  } catch (err) {
    addLog("listHesapPlaniBaBs.do Hatası", err.message, "error");
  }
}

// cariBilgiDogrulamaSistemdenAl.do İÇERİĞİNDEKİ JAVASCRIPT DEĞİŞKENLERİNİ AYRIŞTIRICI
function parseCariDogrulamaScriptVars(html) {
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

// ADIM 1: VKN / TCKN İLE LUCA'DAN CARİ DOĞRULAMA VE FORM ŞABLONU ALMA (cariBilgiDogrulamaSistemdenAl.do)
async function queryContactStateInfoFromLuca() {
  try {
    const taxNo = (document.getElementById("accQueryTaxInput")?.value || "").trim();
    if (!taxNo) {
      addLog("Uyarı", "Lütfen 10 haneli VKN veya 11 haneli TCKN girin.", "warn");
      return;
    }
    const queryParam =
      taxNo.length === 11
        ? `TCK_NO=${encodeURIComponent(taxNo)}&VERGI_NO=`
        : `TCK_NO=&VERGI_NO=${encodeURIComponent(taxNo)}`;

    const url = buildLucaUrl(
      `/Luca/cariBilgiDogrulamaSistemdenAl.do?${queryParam}&HESAP_ID=&HESAP_KODU=&F10=1`
    );
    document.getElementById("rawFetchUrl").value = url;
    addLog(`1. Adım: VKN/TCKN Doğrulanıyor -> ${url}`, null, "info");

    const res = await sendExtensionMessage({
      actionKey: "FETCH_LUCA_URL_AS_HTML",
      fetchUrl: url
    });
    const html = res?.html || "";
    document.getElementById("rawHtmlOutput").value = html;

    if (isLucaBlankReleaseMenuPage(html)) {
      addLog(
        "Luca Boş Sayfa (releaseMenu) Döndürdü!",
        "Lütfen chrome://extensions sayfasından eklentiyi yenileyin ve Luca oturumunuzun açık olduğundan emin olun.",
        "warn"
      );
      return;
    }

    const cariInfo = parseCariDogrulamaScriptVars(html);
    if (cariInfo) {
      detectedCariInfo = cariInfo;
      if (cariInfo.hataMesaji || cariInfo.hataMesajiDevam) {
        addLog(
          "Luca Cari Sorgulama Uyarı/Hata Döndürdü",
          `${cariInfo.hataMesaji} ${cariInfo.hataMesajiDevam}`.trim(),
          "warn"
        );
      } else {
        if (cariInfo.unvan) document.getElementById("accName").value = cariInfo.unvan;
        if (cariInfo.vergiNo !== undefined) document.getElementById("accVkn").value = cariInfo.vergiNo;
        if (cariInfo.tckNo !== undefined) document.getElementById("accTckn").value = cariInfo.tckNo;
        if (cariInfo.vergiDairesi !== undefined) document.getElementById("accVdCode").value = cariInfo.vergiDairesi;
        if (cariInfo.vergiDairesiAd !== undefined) document.getElementById("accVdName").value = cariInfo.vergiDairesiAd;

        updateAccountPostBodyPreview();
        addLog(
          "1. Adım Başarılı: Cari Bilgiler Luca'dan Alındı ✔",
          {
            unvan: cariInfo.unvan,
            vergiNo: cariInfo.vergiNo,
            tckNo: cariInfo.tckNo,
            vergiDairesi: `${cariInfo.vergiDairesi} - ${cariInfo.vergiDairesiAd}`,
            hesapKodu: document.getElementById("accCode").value
          },
          "success"
        );
      }
    } else {
      addLog(
        "Yanıt Alındı",
        `HTML alındı (${html.length} karakter), ancak script değişkenleri bulunamadı. Sağ alttaki Ham HTML kutusundan inceleyebilirsiniz.`,
        "info"
      );
    }
  } catch (err) {
    addLog("VKN/TCKN Sorgulama Hatası", err.message, "error");
  }
}

// 2. TABLOLARI RENDER ETME
function renderBulkTable() {
  const tbody = document.getElementById("bulkTbody");
  tbody.innerHTML = "";
  bulkRows.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>
        <select data-field="vat_rate" data-idx="${i}">
          <option value="20" ${row.vat_rate === "20" ? "selected" : ""}>%20</option>
          <option value="10" ${row.vat_rate === "10" ? "selected" : ""}>%10</option>
          <option value="1" ${row.vat_rate === "1" ? "selected" : ""}>%1</option>
          <option value="0" ${row.vat_rate === "0" ? "selected" : ""}>%0</option>
        </select>
      </td>
      <td><input type="text" data-field="contact_account_code" data-idx="${i}" value="${row.contact_account_code}" /></td>
      <td><input type="text" data-field="document_no" data-idx="${i}" value="${row.document_no}" /></td>
      <td><input type="text" data-field="document_date" data-idx="${i}" value="${row.document_date}" /></td>
      <td><input type="text" class="input-sm" data-field="document_type" data-idx="${i}" value="${row.document_type}" /></td>
      <td><input type="text" class="input-lg" data-field="description" data-idx="${i}" value="${row.description}" /></td>
      <td><input type="text" class="input-sm" data-field="quantity" data-idx="${i}" value="${row.quantity}" /></td>
      <td><input type="text" data-field="formatted_net_total" data-idx="${i}" value="${row.formatted_net_total}" /></td>
      <td><input type="text" data-field="invoice_account_code" data-idx="${i}" value="${row.invoice_account_code}" /></td>
      <td><input type="text" data-field="formatted_net_total_without_vat" data-idx="${i}" value="${row.formatted_net_total_without_vat}" /></td>
      <td><input type="text" data-field="vat_account_code" data-idx="${i}" value="${row.vat_account_code}" /></td>
      <td><input type="text" data-field="formatted_vat" data-idx="${i}" value="${row.formatted_vat}" /></td>
      <td>
        <select data-field="currency" data-idx="${i}">
          <option value="TRY" ${row.currency === "TRY" ? "selected" : ""}>TRY</option>
          <option value="USD" ${row.currency === "USD" ? "selected" : ""}>USD</option>
          <option value="EUR" ${row.currency === "EUR" ? "selected" : ""}>EUR</option>
        </select>
      </td>
      <td style="text-align:center;">
        <input type="checkbox" data-field="babs" data-idx="${i}" ${row.babs ? "checked" : ""} />
      </td>
      <td><button class="btn btn-xs btn-danger" data-del-bulk="${i}">✖</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      bulkRows[idx][field] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      updateBucketPreview("BULK");
    });
  });

  tbody.querySelectorAll("[data-del-bulk]").forEach((btn) => {
    btn.addEventListener("click", () => {
      bulkRows.splice(Number(btn.dataset.delBulk), 1);
      renderBulkTable();
      updateBucketPreview("BULK");
    });
  });
}

function parseTrNumber(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/\./g, "").replace(",", ".")) || 0;
}

function updateSingleBalance() {
  let debitSum = 0;
  let creditSum = 0;
  singleRows.forEach((r) => {
    debitSum += parseTrNumber(r.formatted_debit);
    creditSum += parseTrNumber(r.formatted_credit);
  });
  const box = document.getElementById("singleBalanceBox");
  const diff = Math.abs(debitSum - creditSum);
  box.textContent = `Borç: ${debitSum.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} | Alacak: ${creditSum.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
  box.style.color = diff < 0.01 ? "#166534" : "#dc2626";
}

function renderSingleTable() {
  const tbody = document.getElementById("singleTbody");
  tbody.innerHTML = "";
  singleRows.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><input type="text" data-field="account_code" data-idx="${i}" value="${row.account_code}" /></td>
      <td><input type="text" data-field="document_no" data-idx="${i}" value="${row.document_no}" /></td>
      <td><input type="text" data-field="document_date" data-idx="${i}" value="${row.document_date}" /></td>
      <td><input type="text" class="input-sm" data-field="document_type" data-idx="${i}" value="${row.document_type}" /></td>
      <td><input type="text" class="input-lg" data-field="description" data-idx="${i}" value="${row.description}" /></td>
      <td><input type="text" data-field="formatted_debit" data-idx="${i}" value="${row.formatted_debit}" /></td>
      <td><input type="text" data-field="formatted_credit" data-idx="${i}" value="${row.formatted_credit}" /></td>
      <td><input type="text" class="input-sm" data-field="quantity" data-idx="${i}" value="${row.quantity}" /></td>
      <td>
        <select data-field="currency" data-idx="${i}">
          <option value="TRY" ${row.currency === "TRY" ? "selected" : ""}>TRY</option>
          <option value="USD" ${row.currency === "USD" ? "selected" : ""}>USD</option>
          <option value="EUR" ${row.currency === "EUR" ? "selected" : ""}>EUR</option>
        </select>
      </td>
      <td><input type="text" class="input-sm" data-field="formatted_exchange_rate" data-idx="${i}" value="${row.formatted_exchange_rate}" /></td>
      <td><input type="text" class="input-sm" data-field="formatted_currency_debit" data-idx="${i}" value="${row.formatted_currency_debit}" /></td>
      <td style="text-align:center;">
        <input type="checkbox" data-field="babs" data-idx="${i}" ${row.babs ? "checked" : ""} />
      </td>
      <td><input type="text" data-field="contact_account_code" data-idx="${i}" value="${row.contact_account_code}" /></td>
      <td><button class="btn btn-xs btn-danger" data-del-single="${i}">✖</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      singleRows[idx][field] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      updateSingleBalance();
      updateBucketPreview("SINGLE");
    });
  });

  tbody.querySelectorAll("[data-del-single]").forEach((btn) => {
    btn.addEventListener("click", () => {
      singleRows.splice(Number(btn.dataset.delSingle), 1);
      renderSingleTable();
      updateSingleBalance();
      updateBucketPreview("SINGLE");
    });
  });

  updateSingleBalance();
}

function formatTrNumber(num) {
  return (Number(num) || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getTevkifatRatioByRateCode(rateVal) {
  const v = String(rateVal || "0").trim();
  const found = TEVKIFAT_RATES_LIST.find((r) => r.value === v || r.fraction === v);
  if (found) return found.ratio;
  if (v.includes("/")) {
    const [a, b] = v.split("/").map(Number);
    if (a && b) return a / b;
  }
  return 0;
}

function recalcBasicRow(row) {
  const autoCalcEl = document.getElementById("basicAutoCalcCheck");
  if (autoCalcEl && !autoCalcEl.checked) return;

  const matrah = parseTrNumber(row.formatted_net_total_without_vat);
  const kdvOran = parseFloat(row.vat_rate) || 0;
  const hamKdv = matrah * (kdvOran / 100);

  const tevRatio = getTevkifatRatioByRateCode(row.vat_withholding_rate);
  if (tevRatio > 0 || (row.luca_vat_withholding_reason_code && String(row.luca_vat_withholding_reason_code).trim() !== "")) {
    row.vat_withholding = 1;
    if (!row.table_code) row.table_code = "2";
  } else {
    row.vat_withholding = 0;
  }

  const netKdv = hamKdv * (1 - tevRatio);
  row.formatted_vat = formatTrNumber(netKdv);

  let stopajTutarNum = parseTrNumber(row.stopajTutari);
  if (row.stopajKodu) {
    const stpObj = stopajCodesList.find(
      (s) => s.code === row.stopajKodu || String(row.stopajKodu).endsWith(`-${s.code}`)
    );
    if (stpObj && stpObj.rate > 0) {
      stopajTutarNum = matrah * (stpObj.rate / 100);
      row.stopajTutari = formatTrNumber(stopajTutarNum);
    }
  } else {
    row.stopajTutari = "0,00";
    stopajTutarNum = 0;
  }

  row.formatted_net_total = formatTrNumber(matrah + netKdv - stopajTutarNum);
}

function renderBasicQuickSelectors() {
  const quickTevCodeEl = document.getElementById("quickApplyTevCode");
  const quickTevRateEl = document.getElementById("quickApplyTevRate");
  const quickStopajEl = document.getElementById("quickApplyStopajCode");

  if (quickTevCodeEl) {
    quickTevCodeEl.innerHTML = tevkifatCodesList
      .map(
        (t) =>
          `<option value="${t.code}" data-rate="${t.rateCode || "0"}">${
            t.code ? `${t.code} - ${t.name}` : t.name
          }</option>`
      )
      .join("");
  }

  if (quickTevRateEl) {
    quickTevRateEl.innerHTML = TEVKIFAT_RATES_LIST.map(
      (r) => `<option value="${r.value}">${r.label}</option>`
    ).join("");
  }

  if (quickStopajEl) {
    quickStopajEl.innerHTML = stopajCodesList
      .map(
        (s) =>
          `<option value="${s.code}">${
            s.code ? `${s.code} - ${s.name}` : s.name
          }</option>`
      )
      .join("");
  }
}

async function pullLiveHizliFisOptions() {
  try {
    addLog("Açık Hızlı Fiş (hizliFisPopUp.do) Penceresinden Canlı Kodlar Çekiliyor...", null, "info");
    const res = await sendExtensionMessage({
      actionKey: "GET_HIZLI_FIS_OPTIONS"
    });
    if (!res || res.error) {
      addLog(
        "Hızlı Fiş Penceresi Bulunamadı / Uyarı",
        res?.error || "Lütfen Luca'da Hızlı Fiş (hizliFisPopUp.do) penceresinin açık olduğundan emin olun.",
        "warn"
      );
      return;
    }

    let addedTev = 0;
    let addedStp = 0;

    (res.kodNo || []).concat(res.tevkifat || []).forEach((opt) => {
      if (!opt.value || opt.value === "0") return;
      if (!tevkifatCodesList.some((x) => x.code === opt.value)) {
        tevkifatCodesList.push({
          code: opt.value,
          name: opt.label || opt.value,
          rateCode: "11",
          fraction: "5/10"
        });
        addedTev++;
      }
    });

    (res.stopajKodu || []).forEach((opt) => {
      if (!opt.value) return;
      if (!stopajCodesList.some((x) => x.code === opt.value)) {
        stopajCodesList.push({
          code: opt.value,
          name: opt.label || opt.value,
          rate: 20
        });
        addedStp++;
      }
    });

    renderBasicQuickSelectors();
    renderBasicTable();
    addLog(
      "Canlı Hızlı Fiş Seçenekleri Alındı ✔",
      {
        tevkifatSecenekSayisi: (res.tevkifat || []).length,
        kodNoSecenekSayisi: (res.kodNo || []).length,
        stopajKoduSecenekSayisi: (res.stopajKodu || []).length,
        beyanBelgeTuruSayisi: (res.beyanBelgeTuru || []).length,
        alisSatisTuruSayisi: (res.alisSatisTuru || []).length,
        kayitAltTuruSayisi: (res.kayitAltTuru || []).length,
        eklenenYeniTevkifat: addedTev,
        eklenenYeniStopaj: addedStp
      },
      "success"
    );
  } catch (err) {
    addLog("Canlı Kod Çekme Hatası", err.message, "error");
  }
}

function renderBasicTable() {
  const tbody = document.getElementById("basicTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const defaultTur = document.getElementById("basicLedgerType")?.value || "1";

  basicRows.forEach((row, i) => {
    if (row.tur === undefined) row.tur = defaultTur;
    if (row.kategori === undefined) row.kategori = "1";
    if (row.vat_withholding_rate === undefined) row.vat_withholding_rate = "0";
    if (row.luca_vat_withholding_reason_code === undefined) row.luca_vat_withholding_reason_code = "";
    if (row.table_code === undefined) row.table_code = row.vat_withholding ? "2" : "";
    if (row.stopajTutari === undefined) row.stopajTutari = "0,00";

    const tevRateOptionsHtml = TEVKIFAT_RATES_LIST.map(
      (r) =>
        `<option value="${r.value}" ${
          String(row.vat_withholding_rate) === r.value || String(row.vat_withholding_rate) === r.fraction
            ? "selected"
            : ""
        }>${r.label}</option>`
    ).join("");

    const tevCodeOptionsHtml = tevkifatCodesList
      .map(
        (t) =>
          `<option value="${t.code}" ${
            String(row.luca_vat_withholding_reason_code || "") === t.code ? "selected" : ""
          }>${t.code ? `${t.code} - ${t.name}` : t.name}</option>`
      )
      .join("");

    const stopajOptionsHtml = stopajCodesList
      .map(
        (s) =>
          `<option value="${s.code}" ${String(row.stopajKodu || "") === s.code ? "selected" : ""}>${
            s.code ? `${s.code} - ${s.name}` : s.name
          }</option>`
      )
      .join("");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>
        <select data-field="tur" data-idx="${i}" style="min-width:85px;">
          <option value="0" ${String(row.tur) === "0" ? "selected" : ""}>0 - Gelir</option>
          <option value="1" ${String(row.tur) === "1" ? "selected" : ""}>1 - Gider</option>
        </select>
      </td>
      <td>
        <select data-field="kategori" data-idx="${i}" style="min-width:120px;">
          <option value="1" ${String(row.kategori) === "1" ? "selected" : ""}>1 - Defter Fişi</option>
          <option value="2" ${String(row.kategori) === "2" ? "selected" : ""}>2 - Personel Fişi</option>
          <option value="3" ${String(row.kategori) === "3" ? "selected" : ""}>3 - Serbest Meslek</option>
          <option value="4" ${String(row.kategori) === "4" ? "selected" : ""}>4 - Sabit Kıymet</option>
        </select>
      </td>
      <td>
        <select data-field="item_type" data-idx="${i}" style="min-width:95px;">
          <option value="invoice" ${row.item_type === "invoice" ? "selected" : ""}>Fatura (1)</option>
          <option value="refund" ${row.item_type === "refund" ? "selected" : ""}>İade (3)</option>
        </select>
      </td>
      <td><input type="text" data-field="document_date" data-idx="${i}" value="${row.document_date}" style="min-width:85px;" /></td>
      <td><input type="text" data-field="document_no" data-idx="${i}" value="${row.document_no}" style="min-width:130px;" /></td>
      <td><input type="text" class="input-lg" data-field="description" data-idx="${i}" value="${row.description}" /></td>
      <td><input type="text" class="input-sm" data-field="quantity" data-idx="${i}" value="${row.quantity}" /></td>
      <td><input type="text" data-field="unit_price" data-idx="${i}" value="${row.unit_price}" style="min-width:85px;" /></td>
      <td><input type="text" data-field="formatted_net_total_without_vat" data-idx="${i}" value="${row.formatted_net_total_without_vat}" style="min-width:90px;" /></td>
      <td>
        <select data-field="vat_rate" data-idx="${i}" style="min-width:72px;">
          <option value="20" ${String(row.vat_rate) === "20" ? "selected" : ""}>%20</option>
          <option value="18" ${String(row.vat_rate) === "18" ? "selected" : ""}>%18</option>
          <option value="10" ${String(row.vat_rate) === "10" ? "selected" : ""}>%10</option>
          <option value="8" ${String(row.vat_rate) === "8" ? "selected" : ""}>%8</option>
          <option value="1" ${String(row.vat_rate) === "1" ? "selected" : ""}>%1</option>
          <option value="0" ${String(row.vat_rate) === "0" ? "selected" : ""}>%0</option>
        </select>
      </td>
      <td>
        <select data-field="vat_withholding_rate" data-idx="${i}" style="min-width:145px;">
          ${tevRateOptionsHtml}
        </select>
      </td>
      <td>
        <div style="display:flex; gap:4px; min-width:210px;">
          <select data-field="luca_vat_withholding_reason_code" data-idx="${i}" style="flex:1;">
            ${tevCodeOptionsHtml}
          </select>
          <input type="text" data-field="luca_vat_withholding_reason_code" data-idx="${i}" value="${row.luca_vat_withholding_reason_code || ""}" placeholder="Kod" title="Özel Tevkifat / İstisna Kodu (Örn: 601)" style="width:58px;" />
        </div>
      </td>
      <td><input type="text" data-field="formatted_vat" data-idx="${i}" value="${row.formatted_vat}" style="min-width:85px;" /></td>
      <td><input type="text" data-field="formatted_net_total" data-idx="${i}" value="${row.formatted_net_total}" style="min-width:90px;" /></td>
      <td>
        <div style="display:flex; gap:4px; min-width:210px;">
          <select data-field="stopajKodu" data-idx="${i}" style="flex:1;">
            ${stopajOptionsHtml}
          </select>
          <input type="text" data-field="stopajKodu" data-idx="${i}" value="${row.stopajKodu || ""}" placeholder="Kod" title="Özel Stopaj Kodu (Örn: 022, 041)" style="width:58px;" />
        </div>
      </td>
      <td><input type="text" data-field="stopajTutari" data-idx="${i}" value="${row.stopajTutari || "0,00"}" style="min-width:85px;" /></td>
      <td><input type="text" data-field="first_name" data-idx="${i}" value="${row.first_name}" style="min-width:85px;" /></td>
      <td><input type="text" data-field="last_name" data-idx="${i}" value="${row.last_name}" style="min-width:130px;" /></td>
      <td><input type="text" data-field="tax_number" data-idx="${i}" value="${row.tax_number}" style="min-width:100px;" /></td>
      <td>
        <select data-field="beyanBelgeTuru" data-idx="${i}" style="min-width:125px;">
          <option value="1" ${String(row.beyanBelgeTuru) === "1" ? "selected" : ""}>1 - Fatura</option>
          <option value="2" ${String(row.beyanBelgeTuru) === "2" ? "selected" : ""}>2 - ÖKC Fişi</option>
          <option value="7" ${String(row.beyanBelgeTuru) === "7" ? "selected" : ""}>7 - e-Fatura (Gelir)</option>
          <option value="8" ${String(row.beyanBelgeTuru) === "8" ? "selected" : ""}>8 - e-Arşiv (Gelir)</option>
          <option value="9" ${String(row.beyanBelgeTuru) === "9" ? "selected" : ""}>9 - e-Fatura (Gider)</option>
          <option value="10" ${String(row.beyanBelgeTuru) === "10" ? "selected" : ""}>10 - e-Arşiv (Gider)</option>
          <option value="11" ${String(row.beyanBelgeTuru) === "11" ? "selected" : ""}>11 - Çoklu Belge</option>
          <option value="14" ${String(row.beyanBelgeTuru) === "14" ? "selected" : ""}>14 - e-SMM / Makbuz</option>
          <option value="15" ${String(row.beyanBelgeTuru) === "15" ? "selected" : ""}>15 - Müstahsil</option>
        </select>
      </td>
      <td>
        <select data-field="alisSatisTuru" data-idx="${i}" style="min-width:110px;">
          <option value="1" ${String(row.alisSatisTuru) === "1" ? "selected" : ""}>1 - Normal</option>
          <option value="2" ${String(row.alisSatisTuru) === "2" ? "selected" : ""}>2 - Diğer</option>
          <option value="3" ${String(row.alisSatisTuru) === "3" ? "selected" : ""}>3 - İade</option>
          <option value="4" ${String(row.alisSatisTuru) === "4" ? "selected" : ""}>4 - Tevkifatlı</option>
        </select>
      </td>
      <td><input type="text" class="input-sm" data-field="kayitAltTuru" data-idx="${i}" value="${row.kayitAltTuru}" title="Kayıt Alt Türü Kodu (Örn: 1)" /></td>
      <td><button class="btn btn-xs btn-danger" data-del-basic="${i}">✖</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("input, select").forEach((el) => {
    const evtName = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(evtName, (e) => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      const val = e.target.value;
      const row = basicRows[idx];
      row[field] = val;

      if (field === "luca_vat_withholding_reason_code") {
        const matchedTev = tevkifatCodesList.find((t) => t.code === val);
        if (matchedTev && matchedTev.rateCode) {
          row.vat_withholding_rate = matchedTev.rateCode;
          row.vat_withholding = val ? 1 : 0;
          row.table_code = val ? "2" : "";
        }
        recalcBasicRow(row);
        renderBasicTable();
      } else if (field === "vat_withholding_rate") {
        row.vat_withholding = val && val !== "0" && val !== "Yok" ? 1 : 0;
        if (row.vat_withholding && !row.table_code) row.table_code = "2";
        if (!row.vat_withholding) row.luca_vat_withholding_reason_code = "";
        recalcBasicRow(row);
        renderBasicTable();
      } else if (field === "stopajKodu") {
        recalcBasicRow(row);
        renderBasicTable();
      } else if (field === "formatted_net_total_without_vat" || field === "vat_rate") {
        recalcBasicRow(row);
        const trEl = e.target.closest("tr");
        if (trEl) {
          const vatIn = trEl.querySelector("input[data-field='formatted_vat']");
          const totIn = trEl.querySelector("input[data-field='formatted_net_total']");
          const stpIn = trEl.querySelector("input[data-field='stopajTutari']");
          if (vatIn) vatIn.value = row.formatted_vat;
          if (totIn) totIn.value = row.formatted_net_total;
          if (stpIn) stpIn.value = row.stopajTutari;
        }
      }

      updateBucketPreview("BASIC");
    });
  });

  tbody.querySelectorAll("[data-del-basic]").forEach((btn) => {
    btn.addEventListener("click", () => {
      basicRows.splice(Number(btn.dataset.delBasic), 1);
      renderBasicTable();
      updateBucketPreview("BASIC");
    });
  });
}

// BUCKET OLUŞTURUCULAR
function buildBucket(mode) {
  if (mode === "BULK") {
    return {
      accounting_type: "standard",
      entry_method: "BULK",
      ledger_date: document.getElementById("bulkLedgerDate").value,
      ledger_type_value: Number(document.getElementById("bulkLedgerType").value),
      ledger_rows: bulkRows
    };
  }
  if (mode === "SINGLE") {
    return {
      accounting_type: "standard",
      entry_method: "SINGLE",
      ledger_date: document.getElementById("singleLedgerDate").value,
      ledger_type_value: Number(document.getElementById("singleLedgerType").value),
      ledger_rows: singleRows
    };
  }
  if (mode === "BASIC") {
    return {
      accounting_type: "basic",
      month_number: document.getElementById("basicMonth").value,
      ledger_type_basic_value: document.getElementById("basicLedgerType").value,
      ledger_rows: basicRows
    };
  }
}

function updateBucketPreview(mode = "BULK") {
  const bucket = buildBucket(mode);
  const previewEl = document.getElementById("bucketPreviewJson");
  if (previewEl) {
    previewEl.value = JSON.stringify(bucket, null, 2);
  }
}

// LUCA'YA AKTARIM TETİKLEYİCİ (SET_LUCA_BUCKET + AÇIK LUCA SEKMESİNE BAĞLAN / SSO İLE AÇ)
async function transferBucketToLuca(bucket) {
  try {
    const host = getLucaHost();
    addLog("1/2: SET_LUCA_BUCKET Gönderiliyor...", bucket, "info");
    await sendExtensionMessage({
      actionKey: "SET_LUCA_BUCKET",
      bucket
    });

    const targetUrl = `https://${host}/Luca/luca.do`;
    addLog(
      "2/2: Açık Luca Sekmesine Bağlanılıyor (veya SSO ile Başlatılıyor)...",
      "Tarayıcıda açık olan Luca sekmesi (Örn: 2HB GÜZELL) varsa doğrudan onun içindeki #frm3 çerçevesinde addFis.do açılır; yoksa ssoGiris.do üzerinden açılır.",
      "info"
    );
    const tabId = await sendExtensionMessage({
      actionKey: "CREATE_TAB",
      options: { url: targetUrl }
    });

    addLog(
      "Aktarım Başlatıldı ✔",
      `Hedef Luca Sekmesi (Tab ID: ${tabId}) aktif edildi ve fiş/fatura satırları yazılıyor.`,
      "success"
    );
  } catch (err) {
    addLog("Aktarım Hatası", err.message || String(err), "error");
  }
}

// HESAP PLANI POST BODY GÜNCELLEYİCİ (hesapPlaniBaBsForm Birebir Alanları)
function updateAccountPostBodyPreview() {
  const code = document.getElementById("accCode")?.value.trim() || "";
  const name = document.getElementById("accName")?.value.trim() || "";
  const vkn = document.getElementById("accVkn")?.value.trim() || "";
  const tckn = document.getElementById("accTckn")?.value.trim() || "";
  const vdCode = document.getElementById("accVdCode")?.value.trim() || "";
  const vdName = document.getElementById("accVdName")?.value.trim() || "";
  const currency = document.getElementById("accCurrency")?.value || "0";

  // Luca hesapPlaniBaBsForm içindeki gonder('kaydet') fonksiyonunun birebir alanları:
  // if(frms['frm6'].noktaVarMi(byId("HESAP_KOD").value)) byId("N").value = "B"; else byId("N").value = "K";
  const payload = {
    N: code.includes(".") ? "B" : "K",
    SONGUNLEYEN: "",
    SONGUNLEME_TARIHI: "",
    EKLEYEN: "",
    EKLEME_TARIHI: "",
    HESAP_ID: detectedCariInfo?.hesapId || "",
    HESAP_KOD: code,
    HESAP_AD: name,
    BIRIM: "",
    DOVIZKOD: currency || "0",
    VERGI_NO: vkn,
    TCK_NO: tckn,
    KDV_HESAP_ID: "",
    KDV_HESAP_KOD: "",
    KDV_HESAP_AD: "",
    KDV_ORAN: "",
    CARI_HESAP_ID: "",
    CARI_HESAP_KOD: "",
    CARI_HESAP_AD: "",
    ADRES: detectedCariInfo?.adres || "",
    ADRES_NO: "",
    IL: detectedCariInfo?.il_kodu || "0",
    ILCE: detectedCariInfo?.ilce_kodu || "0",
    ULKE_KOD: "",
    ULKE_AD: "",
    EMAIL: "",
    CEP: "",
    VERGI_DAIRESI: vdCode,
    VERGI_DAIRESI_AD: vdName,
    IBAN: ""
  };

  const url = buildLucaUrl(
    `/Luca/hesapPlaniBaBs.do?popup=true&hpId=hk_kdvli0&parentDIV=cariIslemDiv&opr=kaydet&time=${Date.now()}&topluBeyan=null&donemId=null`
  );
  const endpointEl = document.getElementById("accEndpointUrl");
  if (endpointEl) endpointEl.value = url;

  document.getElementById("accPostBody").value = JSON.stringify(payload, null, 2);
}

// SAYFA YÜKLENDİĞİNDE EVENTLERİ BAĞLA
document.addEventListener("DOMContentLoaded", () => {
  // Sekme Geçişleri
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");

      if (btn.dataset.tab === "tab-bulk") updateBucketPreview("BULK");
      if (btn.dataset.tab === "tab-single") updateBucketPreview("SINGLE");
      if (btn.dataset.tab === "tab-basic") updateBucketPreview("BASIC");
    });
  });

  // Tabloları Çiz
  renderBasicQuickSelectors();
  renderBulkTable();
  renderSingleTable();
  renderBasicTable();
  updateBucketPreview("BULK");
  updateAccountPostBodyPreview();

  // Bağlantı ve Oturum Butonları
  document.getElementById("btnPing").addEventListener("click", checkConnectionAndLucaStatus);
  document.getElementById("btnRefreshLucaInfo").addEventListener("click", checkConnectionAndLucaStatus);
  document.getElementById("btnCheckSession")?.addEventListener("click", checkLucaSessionInfo);
  document.getElementById("btnFetchCompanies")?.addEventListener("click", fetchLucaCompaniesAndPeriods);
  document.getElementById("btnSwitchCompany")?.addEventListener("click", switchLucaCompanyAndPeriod);

  document.getElementById("btnOpenLucaLogin").addEventListener("click", () => {
    window.open("https://agiris.luca.com.tr/", "_blank");
  });
  document.getElementById("btnClearLogs").addEventListener("click", () => {
    document.getElementById("logContainer").innerHTML = "";
  });

  // Gerçek Hesap Planı Çekme Butonları
  document.getElementById("btnFetchAltHesap")?.addEventListener("click", fetchAltHesapPlani);
  document.getElementById("btnFetchBaBsHesap")?.addEventListener("click", fetchBaBsHesapPlani);
  document.getElementById("accTableSearch")?.addEventListener("input", (e) => {
    renderFetchedAccountsTable(e.target.value);
  });
  document.getElementById("btnQueryTaxNo")?.addEventListener("click", queryContactStateInfoFromLuca);

  // 1. BULK Butonları
  document.getElementById("btnBulkAddSample").addEventListener("click", () => {
    bulkRows.push({
      vat_rate: "20",
      contact_account_code: document.getElementById("accCode").value || "120.01.001",
      document_no: `GIB202600000000${bulkRows.length + 1}`,
      document_date: document.getElementById("bulkLedgerDate").value,
      document_type: "FT",
      description: "Yeni Fatura Kaydı",
      quantity: "1",
      formatted_net_total: "6.000,00",
      invoice_account_code: "600.01.020",
      formatted_net_total_without_vat: "5.000,00",
      vat_account_code: "391.01.020",
      formatted_vat: "1.000,00",
      currency: "TRY",
      formatted_exchange_rate: "1,00",
      formatted_currency_vat: "0,00",
      formatted_currency_net_total: "0,00",
      formatted_currency_net_total_without_vat: "0,00",
      babs: false
    });
    renderBulkTable();
    updateBucketPreview("BULK");
  });

  document.getElementById("btnBulkSend").addEventListener("click", () => {
    transferBucketToLuca(buildBucket("BULK"));
  });

  // 2. SINGLE Butonları
  document.getElementById("btnSingleAddRow").addEventListener("click", () => {
    singleRows.push({
      account_code: document.getElementById("accCode").value || "120.01.001",
      document_no: "EVRAK001",
      document_date: document.getElementById("singleLedgerDate").value,
      document_type: "FT",
      description: "Muhasebe Fiş Satırı",
      formatted_debit: "1.000,00",
      formatted_credit: "0,00",
      quantity: "1",
      currency: "TRY",
      formatted_exchange_rate: "1,00",
      formatted_currency_debit: "0,00",
      formatted_currency_credit: "0,00",
      babs: false,
      contact_account_code: "120.01.001"
    });
    renderSingleTable();
    updateBucketPreview("SINGLE");
  });

  document.getElementById("btnSingleAddInvoiceSet").addEventListener("click", () => {
    const docNo = `GIB202600000${singleRows.length + 1}`;
    const dt = document.getElementById("singleLedgerDate").value;
    const cari = document.getElementById("accCode").value || "120.01.001";
    singleRows.push(
      {
        account_code: cari,
        document_no: docNo,
        document_date: dt,
        document_type: "FT",
        description: "Cari Hesap Borç Kaydı",
        formatted_debit: "12.000,00",
        formatted_credit: "0,00",
        quantity: "1",
        currency: "TRY",
        formatted_exchange_rate: "1,00",
        formatted_currency_debit: "0,00",
        formatted_currency_credit: "0,00",
        babs: false,
        contact_account_code: cari
      },
      {
        account_code: "600.01.020",
        document_no: docNo,
        document_date: dt,
        document_type: "FT",
        description: "Yurtiçi Satış Matrahı",
        formatted_debit: "0,00",
        formatted_credit: "10.000,00",
        quantity: "1",
        currency: "TRY",
        formatted_exchange_rate: "1,00",
        formatted_currency_debit: "0,00",
        formatted_currency_credit: "0,00",
        babs: true,
        contact_account_code: cari
      },
      {
        account_code: "391.01.020",
        document_no: docNo,
        document_date: dt,
        document_type: "FT",
        description: "Hesaplanan KDV (%20)",
        formatted_debit: "0,00",
        formatted_credit: "2.000,00",
        quantity: "1",
        currency: "TRY",
        formatted_exchange_rate: "1,00",
        formatted_currency_debit: "0,00",
        formatted_currency_credit: "0,00",
        babs: false,
        contact_account_code: cari
      }
    );
    renderSingleTable();
    updateBucketPreview("SINGLE");
  });

  document.getElementById("btnSingleSend").addEventListener("click", () => {
    transferBucketToLuca(buildBucket("SINGLE"));
  });

  // 3. BASIC (Hızlı Fiş) Butonları & Tevkifat / Stopaj Yönetimi
  document.getElementById("btnPullBasicOptions")?.addEventListener("click", pullLiveHizliFisOptions);

  document.getElementById("quickApplyTevCode")?.addEventListener("change", (e) => {
    const val = e.target.value;
    const matched = tevkifatCodesList.find((t) => t.code === val);
    const rateEl = document.getElementById("quickApplyTevRate");
    if (matched && matched.rateCode && rateEl) {
      rateEl.value = matched.rateCode;
    }
  });

  document.getElementById("btnApplyTevAll")?.addEventListener("click", () => {
    const tevCode = document.getElementById("quickApplyTevCode")?.value || "";
    const tevRate = document.getElementById("quickApplyTevRate")?.value || "0";
    basicRows.forEach((row) => {
      row.luca_vat_withholding_reason_code = tevCode;
      row.vat_withholding_rate = tevRate;
      row.vat_withholding = tevRate !== "0" || tevCode ? 1 : 0;
      row.table_code = row.vat_withholding ? "2" : "";
      recalcBasicRow(row);
    });
    renderBasicTable();
    updateBucketPreview("BASIC");
    addLog("KDV Tevkifatı Tüm Satırlara Uygulandı ✔", { tevkifatKodu: tevCode, tevkifatOranKodu: tevRate }, "success");
  });

  document.getElementById("btnAddNewTevCode")?.addEventListener("click", () => {
    const code = (document.getElementById("newTevCodeInput")?.value || "").trim();
    const name = (document.getElementById("newTevNameInput")?.value || "").trim();
    const rateCode = document.getElementById("newTevRateSelect")?.value || "11";
    if (!code) {
      addLog("Uyarı", "Lütfen eklenecek KDV Tevkifat Kodunu girin (Örn: 601).", "warn");
      return;
    }
    const rateObj = TEVKIFAT_RATES_LIST.find((r) => r.value === rateCode);
    const newItem = {
      code,
      name: name || `${code} Tevkifat (${rateObj?.fraction || rateCode})`,
      rateCode,
      fraction: rateObj?.fraction || "5/10"
    };
    const existingIdx = tevkifatCodesList.findIndex((x) => x.code === code);
    if (existingIdx >= 0) {
      tevkifatCodesList[existingIdx] = newItem;
    } else {
      tevkifatCodesList.push(newItem);
    }
    try {
      const saved = JSON.parse(localStorage.getItem("ATLAS_CUSTOM_TEVKIFAT_CODES") || "[]");
      const filtered = saved.filter((x) => x.code !== code);
      filtered.push(newItem);
      localStorage.setItem("ATLAS_CUSTOM_TEVKIFAT_CODES", JSON.stringify(filtered));
    } catch (e) {}

    renderBasicQuickSelectors();
    renderBasicTable();
    document.getElementById("newTevCodeInput").value = "";
    document.getElementById("newTevNameInput").value = "";
    addLog("Yeni KDV Tevkifat Kodu Eklendi ✔", newItem, "success");
  });

  document.getElementById("btnApplyStopajAll")?.addEventListener("click", () => {
    const stpCode = document.getElementById("quickApplyStopajCode")?.value || "";
    basicRows.forEach((row) => {
      row.stopajKodu = stpCode;
      recalcBasicRow(row);
    });
    renderBasicTable();
    updateBucketPreview("BASIC");
    addLog("Stopaj Kodu Tüm Satırlara Uygulandı ✔", { stopajKodu: stpCode }, "success");
  });

  document.getElementById("btnAddNewStopajCode")?.addEventListener("click", () => {
    const code = (document.getElementById("newStopajCodeInput")?.value || "").trim();
    const name = (document.getElementById("newStopajNameInput")?.value || "").trim();
    const rate = parseFloat(document.getElementById("newStopajRateInput")?.value) || 0;
    if (!code) {
      addLog("Uyarı", "Lütfen eklenecek Stopaj Kodunu girin (Örn: 022).", "warn");
      return;
    }
    const newItem = {
      code,
      name: name || `${code} Stopaj (%${rate})`,
      rate
    };
    const existingIdx = stopajCodesList.findIndex((x) => x.code === code);
    if (existingIdx >= 0) {
      stopajCodesList[existingIdx] = newItem;
    } else {
      stopajCodesList.push(newItem);
    }
    try {
      const saved = JSON.parse(localStorage.getItem("ATLAS_CUSTOM_STOPAJ_CODES") || "[]");
      const filtered = saved.filter((x) => x.code !== code);
      filtered.push(newItem);
      localStorage.setItem("ATLAS_CUSTOM_STOPAJ_CODES", JSON.stringify(filtered));
    } catch (e) {}

    renderBasicQuickSelectors();
    renderBasicTable();
    document.getElementById("newStopajCodeInput").value = "";
    document.getElementById("newStopajNameInput").value = "";
    addLog("Yeni Stopaj Kodu Eklendi ✔", newItem, "success");
  });

  document.getElementById("btnBasicAddRow").addEventListener("click", () => {
    const defaultTur = document.getElementById("basicLedgerType")?.value || "1";
    basicRows.push({
      tur: defaultTur,
      kategori: "1",
      item_type: "invoice",
      document_date: "20/10/2026",
      document_no: `GIB202600000010${basicRows.length + 1}`,
      description: "Normal Mal / Hizmet Faturası",
      quantity: "1",
      unit_price: "2.500,00",
      formatted_net_total_without_vat: "2.500,00",
      vat_rate: "20",
      vat_withholding: 0,
      vat_withholding_rate: "0",
      table_code: "",
      luca_vat_withholding_reason_code: "",
      formatted_vat: "500,00",
      formatted_net_total: "3.000,00",
      credit_amount: "0,00",
      first_name: "ALPER",
      last_name: "ÇETİN",
      tax_number: "2430911751",
      e_document_type: "EInvoice",
      beyanBelgeTuru: defaultTur === "0" ? "7" : "9",
      alisSatisTuru: "1",
      kayitAltTuru: "1",
      stopajKodu: "",
      stopajTutari: "0,00"
    });
    renderBasicTable();
    updateBucketPreview("BASIC");
  });

  document.getElementById("btnBasicAddTevkifatRow")?.addEventListener("click", () => {
    const defaultTur = document.getElementById("basicLedgerType")?.value || "1";
    const newRow = {
      tur: defaultTur,
      kategori: "1",
      item_type: "invoice",
      document_date: "20/10/2026",
      document_no: `GIB202600000020${basicRows.length + 1}`,
      description: "Tevkifatlı Hizmet Faturası (9/10)",
      quantity: "1",
      unit_price: "10.000,00",
      formatted_net_total_without_vat: "10.000,00",
      vat_rate: "20",
      vat_withholding: 1,
      vat_withholding_rate: "4",
      table_code: "2",
      luca_vat_withholding_reason_code: "602",
      formatted_vat: "200,00",
      formatted_net_total: "10.200,00",
      credit_amount: "0,00",
      first_name: "ALPER",
      last_name: "ÇETİN",
      tax_number: "2430911751",
      e_document_type: "EInvoice",
      beyanBelgeTuru: defaultTur === "0" ? "7" : "9",
      alisSatisTuru: "1",
      kayitAltTuru: "1",
      stopajKodu: "",
      stopajTutari: "0,00"
    };
    recalcBasicRow(newRow);
    basicRows.push(newRow);
    renderBasicTable();
    updateBucketPreview("BASIC");
  });

  document.getElementById("btnBasicAddStopajRow")?.addEventListener("click", () => {
    const newRow = {
      tur: "1",
      kategori: "3",
      item_type: "invoice",
      document_date: "20/10/2026",
      document_no: `SMM202600000030${basicRows.length + 1}`,
      description: "Serbest Meslek / Kira Stopajlı Gider",
      quantity: "1",
      unit_price: "10.000,00",
      formatted_net_total_without_vat: "10.000,00",
      vat_rate: "20",
      vat_withholding: 0,
      vat_withholding_rate: "0",
      table_code: "",
      luca_vat_withholding_reason_code: "",
      formatted_vat: "2.000,00",
      formatted_net_total: "10.000,00",
      credit_amount: "0,00",
      first_name: "ALPER",
      last_name: "ÇETİN",
      tax_number: "2430911751",
      e_document_type: "EInvoice",
      beyanBelgeTuru: "14",
      alisSatisTuru: "1",
      kayitAltTuru: "1",
      stopajKodu: "022",
      stopajTutari: "2.000,00"
    };
    recalcBasicRow(newRow);
    basicRows.push(newRow);
    renderBasicTable();
    updateBucketPreview("BASIC");
  });

  document.getElementById("btnBasicSend").addEventListener("click", () => {
    transferBucketToLuca(buildBucket("BASIC"));
  });

  // 4. HESAP PLANI AÇMA & HTTP KÖPRÜSÜ
  document.getElementById("accTemplateSelect").addEventListener("change", (e) => {
    const val = e.target.value;
    const codeInput = document.getElementById("accCode");
    const nameInput = document.getElementById("accName");
    if (val === "120") {
      codeInput.value = "120.01.001";
      if (!detectedCariInfo?.unvan) nameInput.value = "ALPER ÇETIN";
    } else if (val === "320") {
      codeInput.value = "320.01.001";
      if (!detectedCariInfo?.unvan) nameInput.value = "TEDARİKÇİ BİLİŞİM LTD. ŞTİ.";
    } else if (val === "600") {
      codeInput.value = "600.01.020";
      nameInput.value = "%20 KDV'Lİ YURTİÇİ SATIŞLAR";
    } else if (val === "191") {
      codeInput.value = "191.01.020";
      nameInput.value = "%20 İNDİRİLECEK KDV";
    } else if (val === "391") {
      codeInput.value = "391.01.020";
      nameInput.value = "%20 HESAPLANAN KDV";
    } else if (val === "770") {
      codeInput.value = "770.01.001";
      nameInput.value = "GENEL YÖNETİM GİDERLERİ";
    }
    updateAccountPostBodyPreview();
  });

  ["accCode", "accName", "accVkn", "accTckn", "accVdCode", "accVdName", "accCurrency"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateAccountPostBodyPreview);
  });

  document.getElementById("btnCreateAccountPost").addEventListener("click", async () => {
    try {
      const fetchUrl = buildLucaUrl(
        `/Luca/hesapPlaniBaBs.do?popup=true&hpId=hk_kdvli0&parentDIV=cariIslemDiv&opr=kaydet&time=${Date.now()}&topluBeyan=null&donemId=null`
      );
      document.getElementById("accEndpointUrl").value = fetchUrl;
      const bodyObj = JSON.parse(document.getElementById("accPostBody").value);
      if (bodyObj.ILCE === "") {
        bodyObj.IL = "0";
        bodyObj.ILCE = "0";
      }
      addLog(`2. Adım: Hesap Planı Kaydediliyor (POST) -> ${fetchUrl}`, bodyObj, "info");
      const res = await sendExtensionMessage({
        actionKey: "POST_LUCA_URL_AS_HTML",
        fetchUrl,
        body: bodyObj
      });
      const html = res?.html || JSON.stringify(res);
      document.getElementById("rawHtmlOutput").value = html;

      // Dönen ekranDuzenle() içindeki lucaNotYaz mesajını ve HESAP_ID'yi ayrıştır
      const ekranMatch = html.match(/function\s+ekranDuzenle\s*\(\)\s*\{([\s\S]*?)\}/i);
      const ekranBody = ekranMatch ? ekranMatch[1] : html;
      const notMatch = ekranBody.match(/lucaNotYaz\s*\(\s*["']([^"']+)["'](?:\s*,\s*["']([^"']+)["'])?\s*\)/i);
      const idMatch = html.match(/name=["']HESAP_ID["'][^>]*value=["']([^"']*)["']/i);
      const createdId = idMatch ? idMatch[1] : "";
      const hasKapat = /kapat\s*\(/i.test(ekranBody);

      if (notMatch) {
        const msg = notMatch[1];
        const statusType = notMatch[2] || (msg.toLowerCase().includes("hata") ? "error" : "success");
        addLog(
          `Luca Yanıtı: "${msg}" ${createdId ? `(HESAP_ID: ${createdId})` : ""}`,
          { lucaMesaji: msg, hesapId: createdId, otomatikKapat: hasKapat },
          statusType === "success" ? "success" : "warn"
        );
      } else {
        addLog(
          `Hesap Planı Kayıt (hesapPlaniBaBs.do) Tamamlandı ${createdId ? `(HESAP_ID: ${createdId})` : ""} ✔`,
          res?.html ? `${res.html.length} karakter HTML döndü.` : res,
          "success"
        );
      }
    } catch (err) {
      addLog("Hesap Planı POST Hatası", err.message, "error");
    }
  });

  document.getElementById("btnUseAccountInForms").addEventListener("click", () => {
    const newCode = document.getElementById("accCode").value.trim();
    const newName = document.getElementById("accName").value.trim();
    if (bulkRows.length > 0) {
      bulkRows[0].contact_account_code = newCode;
      bulkRows[0].description = `${newName} Faturası`;
      renderBulkTable();
    }
    if (singleRows.length > 0) {
      singleRows[0].account_code = newCode;
      singleRows[0].contact_account_code = newCode;
      singleRows[0].description = `${newName} Cari Kaydı`;
      renderSingleTable();
    }
    addLog("Hesap Kodu Formlara Aktarıldı", `${newCode} - ${newName} Fatura ve Muhasebe Fişi sekmelerine uygulandı.`, "success");
  });

  document.getElementById("quickEndpointSelect").addEventListener("change", (e) => {
    const path = e.target.value;
    document.getElementById("rawFetchUrl").value = buildLucaUrl(path);
    if (path.includes("listHesapPlaniBaBs.do")) {
      document.getElementById("accPostBody").value = JSON.stringify({ HKTEKSECILI: "1" }, null, 2);
    }
  });

  document.getElementById("btnRawGet").addEventListener("click", async () => {
    try {
      const fetchUrl = document.getElementById("rawFetchUrl").value.trim();
      addLog(`FETCH_LUCA_URL_AS_HTML -> ${fetchUrl}`, null, "info");
      const res = await sendExtensionMessage({
        actionKey: "FETCH_LUCA_URL_AS_HTML",
        fetchUrl
      });
      const html = res?.html || JSON.stringify(res);
      document.getElementById("rawHtmlOutput").value = html;

      if (fetchUrl.includes("listAltHesapTempAction") || fetchUrl.includes("HesapPlani")) {
        fetchedAccountsList = parseAccountsFromLucaHtml(html);
        renderFetchedAccountsTable(document.getElementById("accTableSearch").value);
      }

      addLog("GET Yanıtı Alındı", `${(res?.html || "").length} karakter yanıt alındı.`, "success");
    } catch (err) {
      addLog("GET Hatası", err.message, "error");
    }
  });

  document.getElementById("btnRawPost").addEventListener("click", async () => {
    try {
      const fetchUrl = document.getElementById("rawFetchUrl").value.trim();
      const bodyObj = JSON.parse(document.getElementById("accPostBody").value || "{}");
      addLog(`POST_LUCA_URL_AS_HTML -> ${fetchUrl}`, bodyObj, "info");
      const res = await sendExtensionMessage({
        actionKey: "POST_LUCA_URL_AS_HTML",
        fetchUrl,
        body: bodyObj
      });
      const html = res?.html || JSON.stringify(res);
      document.getElementById("rawHtmlOutput").value = html;

      if (fetchUrl.includes("listHesapPlaniBaBs")) {
        fetchedAccountsList = parseAccountsFromLucaHtml(html);
        renderFetchedAccountsTable(document.getElementById("accTableSearch").value);
      }

      addLog("POST Yanıtı Alındı", `${(res?.html || "").length} karakter yanıt alındı.`, "success");
    } catch (err) {
      addLog("POST Hatası", err.message, "error");
    }
  });

  // 5. ÖZEL BUCKET GÖNDERİMİ
  document.getElementById("btnSendCustomBucket").addEventListener("click", async () => {
    try {
      const customBucket = JSON.parse(document.getElementById("bucketPreviewJson").value);
      await sendExtensionMessage({
        actionKey: "SET_LUCA_BUCKET",
        bucket: customBucket
      });
      addLog("SET_LUCA_BUCKET Başarılı", customBucket, "success");
    } catch (err) {
      addLog("JSON / Gönderim Hatası", err.message, "error");
    }
  });

  document.getElementById("btnSendCustomAndOpen").addEventListener("click", () => {
    try {
      const customBucket = JSON.parse(document.getElementById("bucketPreviewJson").value);
      transferBucketToLuca(customBucket);
    } catch (err) {
      addLog("JSON Hatası", err.message, "error");
    }
  });

  // İlk açılışta bağlantıyı ve Luca oturumunu kontrol et
  checkConnectionAndLucaStatus();
});
