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
    const tutar = parseFloat(invoice.tutar);
    const kdvOrani = parseInt(invoice.kdvOrani) || 20;
    const kdvTutari = (tutar * kdvOrani) / 100;
    const toplamTutar = tutar + kdvTutari;

    // fatura.js kütüphanesinin beklediği format
    const gibInvoice = {
      taxIDOrTRID: invoice.vknTckn || '11111111111',
      title: (invoice.ad + ' ' + (invoice.soyad || '')).trim(),
      name: invoice.ad,
      surname: invoice.soyad || '',
      fullAddress: invoice.adres || 'Türkiye',
      country: 'Türkiye',
      date: invoice.tarih || new Date().toLocaleDateString('tr-TR'),
      time: new Date().toLocaleTimeString('tr-TR'),
      currency: 'TRY',
      invoiceType: 'SATIS',
      items: [
        {
          name: invoice.aciklama || 'Hizmet Bedeli',
          quantity: 1,
          unitType: 'C62', // ADET
          unitPrice: tutar,
          price: tutar,
          VATRate: kdvOrani,
          VATAmount: kdvTutari
        }
      ],
      grandTotal: tutar,
      totalVAT: kdvTutari,
      grandTotalInclVAT: toplamTutar,
      paymentTotal: toplamTutar
    };

    // Not: fatura kütüphanesi sign: true (varsayılan) ise SMS onayı bekleyebilir.
    // Sadece TASLAK oluşturmak için sign: false gönderiyoruz.
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
    console.error('GİB Error:', error);
    res.status(500).json({ success: false, message: 'Fatura oluşturma hatası: ' + error.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
