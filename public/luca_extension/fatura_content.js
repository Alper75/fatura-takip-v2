// fatura_content.js - Fatura Takip & Luca Aktarım Entegrasyon Köprüsü (v3.0.0)
console.log('[Luca Eklentisi] Fatura Takip entegrasyon köprüsü yüklendi.');

// Web sayfasına eklentinin hazır ve aktif olduğunu bildir
try {
  document.documentElement.setAttribute('data-luca-extension-ready', 'true');
  window.__LUCA_EXTENSION_INSTALLED__ = true;
  window.dispatchEvent(new CustomEvent('LUCA_EXTENSION_READY'));
} catch (e) {}

function sendToExtension(payload) {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({
        type: 'SET_TRANSFER_DATA',
        data: payload
      }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn('[Luca Eklentisi] Transfer verisi iletilemedi:', chrome.runtime.lastError.message);
        } else {
          console.log('[Luca Eklentisi] Transfer verisi başarıyla eklentiye aktarıldı:', res);
          window.postMessage({ type: 'FATURA_APP_LUCA_ACK', success: true }, '*');
        }
      });
    }
  } catch (err) {
    console.error('[Luca Eklentisi] runtime.sendMessage hatası:', err);
  }
}

// 1. Genel Veri
window.addEventListener('FATURA_APP_LUCA_DATA', (e) => {
  if (e.detail) sendToExtension(e.detail);
});

// 2. İşletme / Hızlı Fiş
window.addEventListener('FATURA_APP_LUCA_SEND_ISLETME', (e) => {
  if (e.detail) sendToExtension({ isIsletme: true, invoices: e.detail });
});

// 3. Mahsup Fişi (Bilanço)
window.addEventListener('FATURA_APP_LUCA_SEND_MAHSUP', (e) => {
  if (e.detail) sendToExtension({ isIsletme: false, mahsupRows: e.detail });
});

// 4. Banka Hareketleri
window.addEventListener('FATURA_APP_LUCA_SEND_BANKA_HAREKETLERI', (e) => {
  if (e.detail) {
    const items = Array.isArray(e.detail) ? e.detail : (e.detail.bankTransactions || e.detail.hareketler || e.detail.mahsupRows || []);
    sendToExtension({
      isIsletme: false,
      bankTransactions: items,
      mahsupRows: items,
      count: items.length
    });
  }
});

// 5. HESAP PLANINI LUCA'DAN ÇEKME İSTEĞİ (Web App -> Extension -> Web App)
async function handleAccountSync() {
  console.log('[Luca Eklentisi] Web uygulamasından hesap planı çekme isteği alındı...');
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_AUTO_SYNC_RESPONSE', {
      detail: { status: 'error', message: 'Luca eklentisi tarayıcıda yüklü değil veya erişilemiyor.' }
    }));
    return;
  }

  chrome.runtime.sendMessage({ type: 'FETCH_LUCA_ACCOUNTS' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Luca Eklentisi] FETCH_LUCA_ACCOUNTS hatası:', chrome.runtime.lastError.message);
      window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_AUTO_SYNC_RESPONSE', {
        detail: { status: 'error', message: chrome.runtime.lastError.message }
      }));
      window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_ACCOUNTS_RECEIVED', {
        detail: { status: 'error', message: chrome.runtime.lastError.message }
      }));
      return;
    }

    if (response && response.status === 'success' && response.data) {
      console.log(`[Luca Eklentisi] ${response.data.length} hesap başarıyla çekildi, web uygulamasına aktarılıyor.`);
      window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_ACCOUNTS_RECEIVED', {
        detail: { status: 'success', data: response.data }
      }));
      window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_AUTO_SYNC_RESPONSE', {
        detail: { status: 'success', count: response.data.length }
      }));
    } else {
      const errMsg = response?.message || 'Luca hesap planı alınamadı. Luca oturumunuzun açık olduğundan emin olun.';
      window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_AUTO_SYNC_RESPONSE', {
        detail: { status: 'error', message: errMsg }
      }));
      window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_ACCOUNTS_RECEIVED', {
        detail: { status: 'error', message: errMsg }
      }));
    }
  });
}

window.addEventListener('FATURA_APP_LUCA_SYNC_REQUEST', handleAccountSync);
window.addEventListener('FATURA_APP_LUCA_AUTO_SYNC', handleAccountSync);
window.addEventListener('FATURA_APP_LUCA_GET_ACCOUNTS', handleAccountSync);

// 6. LUCA OTURUMU SORGULAMA İSTEĞİ
window.addEventListener('FATURA_APP_LUCA_GET_SESSION', () => {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) return;
  chrome.runtime.sendMessage({ type: 'GET_LUCA_SESSION' }, (session) => {
    window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SESSION_RESPONSE', { detail: session }));
  });
});

// 7. VKN / TCKN SORGULAMA İSTEĞİ
window.addEventListener('FATURA_APP_LUCA_VERIFY_TAX', (e) => {
  const taxNo = e.detail?.taxNo || e.detail;
  if (!taxNo || typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) return;
  chrome.runtime.sendMessage({ type: 'VERIFY_VKN_TCKN', taxNo }, (res) => {
    window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_VERIFY_TAX_RESPONSE', { detail: res }));
  });
});

// 8. YENİ HESAP / CARİ AÇMA İSTEĞİ
window.addEventListener('FATURA_APP_LUCA_CREATE_ACCOUNT', (e) => {
  const accData = e.detail;
  if (!accData || typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) return;
  chrome.runtime.sendMessage({ type: 'CREATE_LUCA_ACCOUNT', data: accData }, (res) => {
    window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_CREATE_ACCOUNT_RESPONSE', { detail: res }));
  });
});

// 9. Cross-World window.postMessage Desteği
window.addEventListener('message', (e) => {
  if (!e.data || typeof e.data !== 'object') return;
  const { type, detail, data, payload } = e.data;

  if (type === 'FATURA_APP_LUCA_SEND_BANKA_HAREKETLERI') {
    const raw = detail || data || payload;
    const items = Array.isArray(raw) ? raw : (raw?.bankTransactions || raw?.hareketler || raw?.mahsupRows || []);
    sendToExtension({
      isIsletme: false,
      bankTransactions: items,
      mahsupRows: items,
      count: items.length
    });
  } else if (type === 'FATURA_APP_LUCA_DATA') {
    sendToExtension(detail || data || payload);
  } else if (type === 'FATURA_APP_LUCA_SEND_MAHSUP') {
    sendToExtension({ isIsletme: false, mahsupRows: detail || data || payload });
  } else if (type === 'FATURA_APP_LUCA_SEND_ISLETME') {
    sendToExtension({ isIsletme: true, invoices: detail || data || payload });
  } else if (type === 'FATURA_APP_LUCA_AUTO_SYNC' || type === 'FATURA_APP_LUCA_SYNC_REQUEST') {
    handleAccountSync();
  }
});
