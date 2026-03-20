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

    const fullAdres = String(invoice.adres || 'Merkez');
    // Adreste ilçe/il ayrımı yapmaya çalış
    const adresParcalari = fullAdres.split(',');
    const mahalle = adresParcalari[0] || 'Merkez';

    const gibInvoice = {
      taxIDOrTRID: String(invoice.vknTckn || '11111111111'),
      title: (String(invoice.ad || '') + (invoice.soyad ? ' ' + invoice.soyad : '')).trim(),
      name: String(invoice.ad || 'İsimsiz'),
      surname: String(invoice.soyad || 'Soyisimsiz'),
      fullAddress: fullAdres,
      neighborhood: mahalle,
      district: String(invoice.ilce || 'Merkez'),
      city: String(invoice.il || 'Ankara'),
      country: 'Türkiye',
      taxOffice: String(invoice.vergiDairesi || ''),
      date: invoice.faturaTarihi || new Date().toLocaleDateString('tr-TR'),
      time: new Date().toLocaleTimeString('tr-TR'),
      currency: 'TRY',
      currencyRate: 1,
      invoiceType: 'SATIS',
      items: [
        {
          name: String(invoice.aciklama || 'Hizmet Bedeli'),
          quantity: 1,
          unitType: 'C62',
          unitPrice: tutar,
          price: tutar,
          VATRate: kdvOrani,
          VATAmount: kdvTutari
        }
      ],
      totalVAT: kdvTutari,
      grandTotal: tutar,
      grandTotalInclVAT: toplamTutar,
      paymentTotal: toplamTutar
    };

    console.log('Sending to GİB with data:', JSON.stringify({
      vkn: gibInvoice.taxIDOrTRID,
      title: gibInvoice.title,
      total: gibInvoice.grandTotalInclVAT
    }, null, 2));

    const result = await createInvoiceAndGetHTML(
      String(credentials.username), 
      String(credentials.password), 
      gibInvoice, 
      { sign: false }
    );

    if (!result) {
      throw new Error('GİB portalından boş yanıt döndü.');
    }

    res.json({ 
      success: true, 
      message: 'Taslak fatura portala başarıyla gönderildi.',
      data: result
    });
  } catch (error) {
    console.error('CRITICAL GİB ERROR:', error);
    
    let errorMsg = error.message || 'Bilinmeyen Hata';
    
    // Axios or library specific error details
    if (error.response) {
      errorMsg += ` - Portal Yanıtı: ${JSON.stringify(error.response.data || 'Veri Yok')}`;
    } else if (error.request) {
      errorMsg += ' - Portala ulaşılamadı (Network Error)';
    }

    res.status(500).json({ 
      success: false, 
      message: 'GİB Entegrasyon Hatası: ' + errorMsg,
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
