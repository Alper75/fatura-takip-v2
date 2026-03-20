const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const EInvoice = require('e-fatura').default;

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Test modu ayarı (GERÇEK FATURA KESMEYECEKSEN true YAP)
const USE_TEST_MODE = true;

// Sunucu durum testi
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  engine: 'e-fatura-v2',
  testMode: USE_TEST_MODE
}));

// GİB Portal Test ve Login
app.post('/api/gib/test-login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Eksik bilgi.' });
  }

  try {
    // Test modunda login testi
    EInvoice.setTestMode(true);
    await EInvoice.login(username, password);
    const userInfo = await EInvoice.getUserInformation();

    res.json({
      success: true,
      message: 'Giriş başarılı.',
      userInfo: {
        title: userInfo.title,
        name: userInfo.name
      }
    });
  } catch (error) {
    console.error('Login hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Giriş başarısız: ' + error.message
    });
  }
});

// DEBUG: Gelen veriyi görmek için
app.post('/api/gib/debug-invoice', (req, res) => {
  console.log('=== DEBUG: Gelen Invoice Verisi ===');
  console.log(JSON.stringify(req.body, null, 2));
  res.json({ received: req.body });
});

// Taslak Fatura Oluşturma - e-fatura paketi ile
app.post('/api/gib/create-draft', async (req, res) => {
  const { credentials, invoice } = req.body;

  // Validasyon
  if (!credentials?.username || !credentials?.password) {
    return res.status(400).json({
      success: false,
      message: 'Eksik bilgi: username ve password zorunlu.'
    });
  }

  if (!invoice?.tutar || !invoice?.vknTckn) {
    return res.status(400).json({
      success: false,
      message: 'Eksik alanlar: tutar ve vknTckn zorunlu.'
    });
  }

  try {
    // Test modu ayarı
    EInvoice.setTestMode(USE_TEST_MODE);

    // Giriş yap
    console.log('GİB portalına giriş yapılıyor...');
    await EInvoice.login(credentials.username, credentials.password);

    // Sayısal hesaplamalar
    const tutar = parseFloat(invoice.tutar);
    const kdvOrani = parseInt(invoice.kdvOrani) || 20;
    const kdvTutari = parseFloat(((tutar * kdvOrani) / 100).toFixed(2));
    const toplamTutar = parseFloat((tutar + kdvTutari).toFixed(2));

    console.log('Hesaplamalar:', { tutar, kdvOrani, kdvTutari, toplamTutar });

    // Fatura verisi hazırlama (e-fatura paketi formatı)
    const invoiceData = {
      // Alıcı bilgileri
      taxIDOrTRID: String(invoice.vknTckn).trim(),
      title: String(invoice.unvan || `${invoice.ad || ''} ${invoice.soyad || ''}`.trim() || 'İsimsiz'),
      name: String(invoice.ad || ''),
      surname: String(invoice.soyad || ''),
      fullAddress: String(invoice.adres || 'Türkiye'),
      taxOffice: String(invoice.vergiDairesi || ''),

      // Fatura kalemleri
      items: [
        {
          name: String(invoice.aciklama || 'Hizmet Bedeli'),
          quantity: 1,
          unitPrice: tutar,
          price: tutar,
          VATRate: kdvOrani,
          VATAmount: kdvTutari
        }
      ],

      // Toplamlar
      totalVAT: kdvTutari,
      grandTotal: tutar,
      grandTotalInclVAT: toplamTutar,
      paymentTotal: toplamTutar,

      // Opsiyonel alanlar
      date: invoice.faturaTarihi || new Date().toLocaleDateString('tr-TR'),
      time: new Date().toLocaleTimeString('tr-TR'),
      currency: 'TRY'
    };

    console.log('Fatura oluşturuluyor...', invoiceData);

    // Fatura oluştur ve HTML al
    const result = await EInvoice.createInvoiceAndGetHTML(invoiceData);

    // Fatura detaylarını al (UUID için)
    const invoices = await EInvoice.getAllInvoices();
    const createdInvoice = invoices[0]; // En son oluşturulan

    console.log('Fatura başarıyla oluşturuldu');

    res.json({
      success: true,
      message: USE_TEST_MODE ? 'TEST: Fatura oluşturuldu (Gerçek GİB\'e gönderilmedi)' : 'Fatura GİB\'e gönderildi.',
      uuid: createdInvoice?.uuid || 'TEST-MODE',
      htmlPreview: result?.substring(0, 300) + '...' || null,
      testMode: USE_TEST_MODE
    });

  } catch (error) {
    console.error('=== FATURA HATASI ===');
    console.error('Mesaj:', error.message);
    console.error('Tip:', error.constructor.name);

    // e-fatura paketi özel hata tipleri
    if (error.name === 'EInvoiceApiError') {
      console.error('API Hata Kodu:', error.errorCode);
    }

    res.status(500).json({
      success: false,
      message: 'Fatura Hatası: ' + error.message,
      errorType: error.constructor.name,
      detail: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// Yeni endpoint: Fatura listesi alma
app.get('/api/gib/invoices', async (req, res) => {
  const { username, password } = req.query;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username ve password gerekli' });
  }

  try {
    EInvoice.setTestMode(true);
    await EInvoice.login(username, password);
    const invoices = await EInvoice.getAllInvoices();

    res.json({ success: true, invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Test modu: ${USE_TEST_MODE ? 'AÇIK' : 'KAPALI'}`);
    console.log(`ÖNEMLI: Gerçek fatura kesmek için USE_TEST_MODE = false yapın`);
  });
}

module.exports = app;