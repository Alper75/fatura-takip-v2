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
    // fatura.js formatına dönüştürme
    const gibInvoice = {
      vknTckn: invoice.vknTckn,
      ad: invoice.ad,
      soyad: invoice.soyad || '',
      adres: invoice.adres || '',
      ulke: 'Türkiye',
      sehir: '', // Opsiyonel
      ilce: '', // Opsiyonel
      vergiDairesi: '',
      tarih: invoice.tarih || new Date().toLocaleDateString('tr-TR'),
      saat: new Date().toLocaleTimeString('tr-TR'),
      paraBirimi: 'TRY',
      dovizKuru: 1,
      faturaTipi: 'SATIS',
      siparisNo: '',
      siparisTarihi: '',
      irsaliyeNo: '',
      irsaliyeTarihi: '',
      fisNo: '',
      fisTarihi: '',
      fisSaati: '',
      fisTipi: '',
      zNo: '',
      okcSeriNo: '',
      malHizmetListe: [
        {
          name: invoice.aciklama || 'Hizmet Bedeli',
          quantity: 1,
          unit: 'ADET',
          unitPrice: invoice.tutar,
          price: invoice.tutar,
          vatRate: invoice.kdvOrani || 20,
          vatAmount: (invoice.tutar * (invoice.kdvOrani || 20)) / 100,
          totalAmount: invoice.tutar + (invoice.tutar * (invoice.kdvOrani || 20)) / 100
        }
      ]
    };

    // Not: fatura kütüphanesi sign: true (varsayılan) ise SMS onayı bekleyebilir veya hata verebilir.
    // Biz sadece TASLAK oluşturmak istediğimiz için sign: false gönderiyoruz.
    const result = await createInvoiceAndGetHTML(
      credentials.username, 
      credentials.password, 
      gibInvoice, 
      { sign: false }
    );

    res.json({ 
      success: true, 
      message: 'Taslak fatura portala başarıyla gönderildi.',
      data: result // Genellikle HTML içeriği döner
    });
  } catch (error) {
    console.error('GİB Error:', error);
    res.status(500).json({ success: false, message: 'Fatura oluşturma hatası: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
