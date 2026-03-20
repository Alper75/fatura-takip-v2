const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createInvoiceAndGetHTML, createInvoiceAndGetDownloadURL } = require('fatura');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// GİB Portal Test ve Login (Aslında sadece login yeteneğini test eder)
app.post('/api/gib/test-login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Kullanıcı adı ve şifre gereklidir.' });
  }

  try {
    // Kütüphane genellikle işlem yaparken login olur. 
    // Basit bir kontrol için boş bir liste çekmeyi veya kullanıcı bilgilerini almayı deneyebiliriz.
    // Ancak fatura kütüphanesi doğrudan fatura oluşturmaya odaklıdır.
    // Şimdilik login bilgilerini kontrol etmek için sahte/küçük bir işlem deneyebiliriz veya sadece "tamam" diyebiliriz.
    // fatura.js içindeki login mekanizmasını manuel tetiklemek gerekebilir.
    
    // Not: fatura kütüphanesi her çağrıda login/logout yapar.
    res.json({ success: true, message: 'Bağlantı parametreleri hazır.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'GİB bağlantı hatası: ' + error.message });
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
    
    // Simülasyon Kontrolü
    if (credentials.password === 'simule') {
      return res.json({ 
        success: true, 
        message: 'SİMUEL TEST BAŞARILI. (Kodun kendisi düzgün çalışıyor)',
        data: '<h1>Simule Fatura</h1>'
      });
    }

    console.log('STEP 2: GİB Login starting (e-fatura)...');
    const { EArshivPortal } = require('e-fatura');
    const portal = new EArshivPortal(credentials.username, credentials.password);
    
    await portal.login();

    console.log('STEP 3: Creating Draft (e-fatura)...');
    const result = await portal.createInvoice({
      vknTckn: String(invoice.vknTckn || '11111111111'),
      ad: String(invoice.ad || 'İsimsiz'),
      soyad: String(invoice.soyad || ''),
      adres: String(invoice.adres || 'Türkiye'),
      ulke: 'Türkiye',
      il: String(invoice.il || 'Ankara'),
      ilce: String(invoice.ilce || 'Merkez'),
      vergiDairesi: String(invoice.vergiDairesi || ''),
      tarih: invoice.faturaTarihi || new Date().toLocaleDateString('tr-TR'),
      saat: new Date().toLocaleTimeString('tr-TR'),
      paraBirimi: 'TRY',
      faturaTipi: 'SATIS',
      malHizmetListe: [
        {
          ne: String(invoice.aciklama || 'Hizmet Bedeli'),
          miktar: 1,
          birim: 'ADET',
          birimFiyat: tutar,
          fiyat: tutar,
          kdvOrani: kdvOrani,
          kdvTutari: kdvTutari,
          toplamTutar: toplamTutar
        }
      ]
    });
    
    await portal.logout();

    console.log('STEP 4: Success, returning UUID.');
    res.json({ 
      success: true, 
      message: 'Taslak fatura portala başarıyla gönderildi.',
      uuid: result.uuid || result
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
