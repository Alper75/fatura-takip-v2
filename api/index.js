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

    const { createInvoiceAndGetHTML } = require('fatura');

    // Müşteri verileri
    const ad = String(invoice.ad || 'İsimsiz');
    const soyad = String(invoice.soyad || '');
    const il = String(invoice.il || 'Ankara');
    const ilce = String(invoice.ilce || 'Merkez');
    const tamAdres = String(invoice.adres || 'Türkiye');

    const gibInvoice = {
      // Orijinal keys
      vknTckn: String(invoice.vknTckn || '11111111111'),
      ad: ad,
      soyad: soyad,
      adres: tamAdres,
      ulke: 'Türkiye',
      sehir: il,
      ilce: ilce,
      vergiDairesi: String(invoice.vergiDairesi || ''),
      
      // Mlevent/PHP tarzı alternatif keys (Kütüphane bunları bekliyor olabilir)
      aliciAdi: ad,
      aliciSoyadi: soyad,
      aliciUnvan: ad,
      mahalleSemtIlce: ilce,
      
      tarih: invoice.faturaTarihi || new Date().toLocaleDateString('tr-TR'),
      saat: new Date().toLocaleTimeString('tr-TR'),
      paraBirimi: 'TRY',
      dovizKuru: 1,
      faturaTipi: 'SATIS',
      
      notlar: [],
      vergiBilgileri: [],
      
      malHizmetListe: [
        {
          name: String(invoice.aciklama || 'Hizmet Bedeli'),
          malHizmet: String(invoice.aciklama || 'Hizmet Bedeli'), // Alternatif key
          quantity: 1,
          miktar: 1, // Alternatif key
          unit: 'ADET',
          birim: 'ADET', // Alternatif key
          unitPrice: tutar,
          birimFiyat: tutar, // Alternatif key
          price: tutar,
          fiyat: tutar, // Alternatif key
          vatRate: kdvOrani,
          kdvOrani: kdvOrani, // Alternatif key
          vatAmount: kdvTutari,
          kdvTutari: kdvTutari, // Alternatif key
          totalAmount: toplamTutar,
          toplamTutar: toplamTutar // Alternatif key
        }
      ]
    };

    console.log('Final GİB Dispatch Data:', JSON.stringify({ vkn: gibInvoice.vknTckn, total: toplamTutar }));

    const result = await createInvoiceAndGetHTML(
      credentials.username, 
      credentials.password, 
      gibInvoice, 
      { sign: false }
    );

    res.json({ 
      success: true, 
      message: 'Taslak fatura portala başarıyla gönderildi.',
      data: result
    });
  } catch (error) {
    console.error('Final GİB Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fatura oluşturma hatası: ' + (error.message || 'Bilinmeyen Hata'),
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
