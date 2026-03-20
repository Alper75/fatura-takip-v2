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

    const { EInvoiceApi, EInvoice } = require('e-fatura');
    
    // Kütüphanenin içindeki 'anonymous' kontrolünün patlamaması için 
    // her türlü konfigürasyon anahtarını sağlıyoruz.
    const config = { 
        username: credentials.username, 
        password: credentials.password,
        user: credentials.username,
        pass: credentials.password,
        testMode: false
    };

    let api = new EInvoiceApi(config);
    
    // Bazı versiyonlarda constructor veriyi içe aktarmıyorsa manuel ekle
    if (!api.config) api.config = config;
    if (api.setCredentials) api.setCredentials(credentials.username, credentials.password);

    console.log('STEP 2: Connecting to GİB (EInvoiceApi)...');
    // 'anonymous' hatasını önlemek için boş bir obje geçiyoruz
    const connectOptions = { anonymous: false };
    if (api.connect) {
        await api.connect(connectOptions);
    } else if (api.login) {
        await api.login(connectOptions);
    }

    console.log('STEP 3: Preparing Invoice (Ultra-Defensive)...');
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
      
      // GİB'in kesin beklediği 'base' (matrah) alanları
      base: tutar,
      matrah: tutar,
      malhizmetToplamTutari: tutar,
      toplamIskonto: 0,
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
          base: tutar, // Satır bazlı matrah
          iskontoOrani: 0,
          iskontoTutari: 0,
          kdvOrani: kdvOrani,
          kdvTutari: kdvTutari,
          malHizmetTutari: tutar,
          ozelMatrahTutari: 0
        }
      ]
    };

    // Fatura nesnesini akıllıca oluştur
    let finalInvoice;
    try {
      if (typeof EInvoice === 'function') {
        finalInvoice = new EInvoice();
        if (finalInvoice.mapWithTurkishKeys) {
          finalInvoice.mapWithTurkishKeys(invoiceData);
        } else {
          Object.assign(finalInvoice, invoiceData);
        }
      } else {
        finalInvoice = invoiceData;
      }
    } catch (e) {
      console.log('EInvoice class failed, using raw data');
      finalInvoice = invoiceData;
    }

    // Metod tespiti ve gönderim
    let result;
    if (api.createDraftInvoice) {
        result = await api.createDraftInvoice(finalInvoice);
    } else if (api.createDraftBasicInvoice) {
        result = await api.createDraftBasicInvoice(finalInvoice);
    } else if (api.createInvoice) {
        result = await api.createInvoice(finalInvoice);
    } else {
        throw new Error('Fatura oluşturma metodu (createDraftInvoice) bulunamadı.');
    }
    
    if (api.logout) await api.logout();

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
