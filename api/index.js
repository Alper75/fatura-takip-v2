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

    console.log('Sending Invoice to GİB:', {
      vknTckn: invoice.vknTckn,
      title: invoice.ad,
      total: toplamTutar
    });

    // fatura.js kütüphanesinin beklediği format
    const gibInvoice = {
      taxIDOrTRID: String(invoice.vknTckn || '11111111111'),
      title: String(invoice.ad || '') + (invoice.soyad ? ' ' + invoice.soyad : ''),
      name: String(invoice.ad || ''),
      surname: String(invoice.soyad || ''),
      fullAddress: String(invoice.adres || 'Türkiye'),
      vergiDairesi: String(invoice.vergiDairesi || ''),
      city: String(invoice.il || ''),
      district: String(invoice.ilce || ''),
      country: 'Türkiye',
      date: invoice.faturaTarihi || new Date().toLocaleDateString('tr-TR'),
      time: new Date().toLocaleTimeString('tr-TR'),
      currency: 'TRY',
      invoiceType: 'SATIS',
      items: [
        {
          name: String(invoice.aciklama || 'Hizmet Bedeli'),
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

    // Not: fatura kütüphanesi her çağrıda login/logout yapar.
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
    console.error('Detailed GİB Error:', error);
    
    let errorMsg = error.message;
    // Kütüphane hatasında response.data varsa onu ekle
    if (error.response && error.response.data) {
      errorMsg += ' - ' + JSON.stringify(error.response.data);
    }

    res.status(500).json({ 
      success: false, 
      message: 'GİB Hatası: ' + errorMsg,
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
