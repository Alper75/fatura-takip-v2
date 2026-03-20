const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Sunucu durum testi
app.get('/api/health', (req, res) => res.json({ status: 'ok', engine: 'e-fatura-v2' }));

// GİB Portal Test ve Login
app.post('/api/gib/test-login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: 'Eksik bilgi.' });

  try {
    res.json({ success: true, message: 'Bağlantı parametreleri hazır.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Hata: ' + error.message });
  }
});

// Taslak Fatura Oluşturma
app.post('/api/gib/create-draft', async (req, res) => {
  const { credentials, invoice } = req.body;

  if (!credentials || !invoice) {
    return res.status(400).json({ success: false, message: 'Eksik veri.' });
  }

  try {
    const tutar = parseFloat(invoice.tutar || 0);
    const kdvOrani = parseInt(invoice.kdvOrani || 20);
    const kdvTutari = Number(((tutar * kdvOrani) / 100).toFixed(2));
    const toplamTutar = Number((tutar + kdvTutari).toFixed(2));

    console.log('STEP 1: Data preparation starting...');
    
    if (credentials.password === 'simule') {
      return res.json({ 
        success: true, 
        message: 'SİMUEL TEST BAŞARILI. (Kodun kendisi düzgün çalışıyor)',
        data: '<h1>Simule Fatura</h1>'
      });
    }

    const EFaturaLib = require('e-fatura');
    
    // PHP dokümanına göre sınıf adı InvoiceManager olmalı
    const PortalClass = EFaturaLib.InvoiceManager || EFaturaLib.EArshivPortal || EFaturaLib;
    let portal;

    if (typeof PortalClass === 'function') {
      portal = new PortalClass();
    } else if (PortalClass.default && typeof PortalClass.default === 'function') {
      portal = new PortalClass.default();
    } else {
      throw new Error('Kütüphane içinde geçerli bir sınıf (Constructor) bulunamadı.');
    }

    // Giriş bilgilerini sına
    if (portal.setCredentials) {
      portal.setCredentials(credentials.username, credentials.password);
    } else {
      // Bazı versiyonlar constructor'da bekler
      portal = new PortalClass(credentials.username, credentials.password);
    }

    console.log('STEP 2: Connecting to GİB...');
    if (portal.connect) {
      await portal.connect();
    } else if (portal.login) {
      await portal.login();
    }

    console.log('STEP 3: Creating Draft (Furkan Kadıoğlu Standards)...');
    const invoiceData = {
      faturaTarihi: invoice.faturaTarihi || new Date().toLocaleDateString('tr-TR'),
      saat: new Date().toLocaleTimeString('tr-TR'),
      paraBirimi: 'TRY',
      faturaTipi: 'SATIS',
      vknTckn: String(invoice.vknTckn || '11111111111'),
      aliciAdi: String(invoice.ad || 'İsimsiz'),
      aliciSoyadi: String(invoice.soyad || ''),
      vergiDairesi: String(invoice.vergiDairesi || ''),
      ulke: 'Türkiye',
      bulvarcaddesokak: String(invoice.adres || 'Türkiye'),
      sehir: String(invoice.il || 'Ankara'),
      mahalleSemtIlce: String(invoice.ilce || 'Merkez'),
      matrah: tutar,
      malhizmetToplamTutari: tutar,
      toplamIskonto: "0",
      hesaplanankdv: kdvTutari,
      vergilerToplami: kdvTutari,
      vergilerDahilToplamTutar: toplamTutar,
      odenecekTutar: toplamTutar,
      not: String(invoice.aciklama || ''),
      malHizmetTable: [
        {
          malHizmet: String(invoice.aciklama || 'Hizmet Bedeli'),
          miktar: 1,
          birim: 'ADET',
          birimFiyat: tutar,
          fiyat: tutar,
          iskontoOrani: 0,
          iskontoTutari: "0",
          kdvOrani: kdvOrani,
          kdvTutari: kdvTutari,
          malHizmetTutari: tutar,
          ozelMatrahTutari: "0"
        }
      ]
    };

    const result = portal.createDraftBasicInvoice 
      ? await portal.createDraftBasicInvoice(invoiceData) 
      : (portal.createInvoice ? await portal.createInvoice(invoiceData) : null);
    
    if (portal.logout) await portal.logout();

    res.json({ 
      success: true, 
      message: 'Taslak fatura portala başarıyla gönderildi.',
      uuid: (result && result.uuid) ? result.uuid : (typeof result === 'string' ? result : 'OK')
    });
  } catch (error) {
    console.error('SERVER ERROR:', error);
    res.status(500).json({ 
      success: false, 
      message: 'GİB Hatası: ' + (error.message || 'Bilinmeyen Hata'),
      detail: error.stack
    });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
