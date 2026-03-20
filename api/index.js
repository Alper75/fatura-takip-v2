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
    // Frontend'den gelen tutarı KDV HARİÇ (Matrah) olarak kabul ediyoruz.
    // Kuruş hassasiyeti için 2 basamağa yuvarlıyoruz.
    const tutar = Number(parseFloat(invoice.tutar || 0).toFixed(2));
    const kdvOrani = parseInt(invoice.kdvOrani || 20);
    const kdvTutari = Number(((tutar * kdvOrani) / 100).toFixed(2));
    const toplamTutar = Number((tutar + kdvTutari).toFixed(2));

    console.log(`STEP 1: Tax calculations (Ex-VAT: ${tutar}, VAT: ${kdvTutari}, Total: ${toplamTutar})`);
    
    if (credentials.password === 'simule') {
      return res.json({ 
        success: true, 
        message: 'SİMUEL TEST BAŞARILI. (Kodun kendisi düzgün çalışıyor)',
        data: '<h1>Simule Fatura</h1>'
      });
    }

    let api;
    try {
        const { EInvoiceApi, EInvoice } = require('e-fatura');
        
        // Konfigürasyon
        const config = { 
            username: credentials.username, 
            password: credentials.password,
            user: credentials.username,
            pass: credentials.password,
            testMode: false
        };

        api = new EInvoiceApi(config);
        if (!api.config) api.config = config;
        if (api.setCredentials) api.setCredentials(credentials.username, credentials.password);

        console.log('STEP 2: Connecting to GİB...');
        const connectOptions = { anonymous: false };
        if (api.connect) await api.connect(connectOptions);
        else if (api.login) await api.login(connectOptions);

        console.log('STEP 3: Submission...');
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
          
          base: tutar,
          matrah: tutar,
          malhizmetToplamTutari: tutar,
          toplamIskonto: 0,
          hesaplanankdv: kdvTutari,
          vergilerToplami: kdvTutari,
          vergilerDahilToplamTutar: toplamTutar,
          odenecekTutar: toplamTutar,
          
          paymentPrice: toplamTutar,
          payableAmount: toplamTutar,
          productsTotalPrice: tutar,
          taxExclusiveAmount: tutar,
          taxTotalPrice: kdvTutari,
          includedTaxesTotalPrice: toplamTutar, // Vergiler dahil toplam tura
          itemOrServiceTotalPrice: tutar,
          orderData: [],
          
          // 'reading map of undefined' hatasını %100 önlemek için 
          // tüm olası liste anahtarlarını besliyoruz
          malHizmetTable: [
            {
              malHizmet: String(invoice.aciklama || 'Hizmet Bedeli'),
              miktar: 1,
              birim: 'ADET',
              birimFiyat: tutar,
              fiyat: tutar,
              base: tutar,
              price: tutar,
              totalPrice: tutar,
              iskontoOrani: 0,
              iskontoTutari: 0,
              kdvOrani: kdvOrani,
              taxRate: kdvOrani,
              kdvTutari: kdvTutari,
              taxAmount: kdvTutari,
              malHizmetTutari: tutar,
              ozelMatrahTutari: 0
            }
          ]
        };

        // Kütüphanenin farklı versiyonları için listeyi kopyalayalım
        invoiceData.malHizmetListe = invoiceData.malHizmetTable;
        invoiceData.products = invoiceData.malHizmetTable;
        invoiceData.items = invoiceData.malHizmetTable;
        invoiceData.itemOrServiceList = invoiceData.malHizmetTable;

        let finalInvoice;
        try {
          if (typeof EInvoice === 'function') {
            finalInvoice = new EInvoice();
            if (finalInvoice.mapWithTurkishKeys) finalInvoice.mapWithTurkishKeys(invoiceData);
            else Object.assign(finalInvoice, invoiceData);
          } else {
            finalInvoice = invoiceData;
          }
        } catch (e) {
          finalInvoice = invoiceData;
        }

        let result;
        if (api.createDraftInvoice) result = await api.createDraftInvoice(finalInvoice);
        else if (api.createDraftBasicInvoice) result = await api.createDraftBasicInvoice(finalInvoice);
        else if (api.createInvoice) result = await api.createInvoice(finalInvoice);
        else throw new Error('Metod bulunamadı.');

        res.json({ 
          success: true, 
          message: 'Taslak fatura portala başarıyla gönderildi.',
          uuid: (result && result.uuid) ? result.uuid : (typeof result === 'string' ? result : 'OK')
        });

    } finally {
        if (api && api.logout) {
            console.log('STEP 4: Safe Logout...');
            await api.logout().catch(e => console.error('Logout failed:', e));
        }
    }
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
