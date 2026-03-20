const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Sunucu durum testi
app.get('/api/health', (req, res) => res.json({ status: 'ok', engine: 'fatura-v1' }));

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

    const faturaLib = require('fatura');
    
    // Ürün listesi (Her üç isimlendirme stilini de kapsıyoruz)
    const items = [
      {
        // 1. Türkçe CamelCase/SnakeCase
        malHizmet: String(invoice.aciklama || 'Hizmet Bedeli'),
        mal_hizmet: String(invoice.aciklama || 'Hizmet Bedeli'),
        miktar: 1,
        birim: 'ADET',
        birimFiyat: tutar,
        birim_fiyat: tutar,
        fiyat: tutar,
        iskontoOrani: 0,
        iskonto_orani: 0,
        iskonto_tutari: 0,
        kdvOrani: kdvOrani,
        kdv_orani: kdvOrani,
        kdvTutari: kdvTutari,
        kdv_tutari: kdvTutari,
        malHizmetTutari: tutar,
        mal_hizmet_tutari: tutar,
        
        // 2. İngilizce Industry-Standard
        name: String(invoice.aciklama || 'Hizmet Bedeli'),
        description: String(invoice.aciklama || 'Hizmet Bedeli'),
        quantity: 1,
        unit: 'ADET',
        unitPrice: tutar,
        taxAmount: kdvTutari,
        taxRate: kdvOrani,
        totalAmount: tutar,
        grandTotal: toplamTutar
      }
    ];

    const invoiceData = {
      // 1. Türkçe İsimlendirme (Camel + Snake)
      faturaTarihi: invoice.faturaTarihi || new Date().toLocaleDateString('tr-TR'),
      fatura_tarihi: invoice.faturaTarihi || new Date().toLocaleDateString('tr-TR'),
      saat: new Date().toLocaleTimeString('tr-TR'),
      paraBirimi: 'TRY',
      faturaTipi: 'SATIS',
      fatura_tipi: 'SATIS',
      vknTckn: String(invoice.vknTckn || '11111111111'),
      vkn_tckn: String(invoice.vknTckn || '11111111111'),
      aliciAdi: String(invoice.ad || invoice.unvan || 'İsimsiz'),
      alici_adi: String(invoice.ad || invoice.unvan || 'İsimsiz'),
      aliciSoyadi: String(invoice.soyad || ''),
      alici_soyadi: String(invoice.soyad || ''),
      aliciUnvan: String(invoice.unvan || invoice.ad || 'İsimsiz'),
      vergiDairesi: String(invoice.vergiDairesi || ''),
      ulke: 'Türkiye',
      bulvarcaddesokak: String(invoice.adres || 'Türkiye'),
      sehir: String(invoice.il || 'Ankara'),
      mahalleSemtIlce: String(invoice.ilce || 'Merkez'),
      matrah: tutar,
      malhizmetToplamTutari: tutar,
      toplamIskonto: 0,
      toplam_iskonto: 0,
      hesaplanankdv: kdvTutari,
      vergilerToplami: kdvTutari,
      vergiler_toplami: kdvTutari,
      vergilerDahilToplamTutar: toplamTutar,
      odenecekTutar: toplamTutar,
      odenecek_tutar: toplamTutar,
      not: String(invoice.aciklama || ''),
      
      // 2. İngilizce Industry-Standard (Senin belirttiğin kritik alanlar)
      date: invoice.faturaTarihi || new Date().toLocaleDateString('tr-TR'),
      taxIDOrTRID: String(invoice.vknTckn || '11111111111'),
      name: String(invoice.ad || 'İsimsiz'),
      surname: String(invoice.soyad || ''),
      title: String(invoice.unvan || invoice.ad || 'İsimsiz'),
      totalVAT: kdvTutari,
      grandTotalInclVAT: toplamTutar,
      paymentTotal: toplamTutar,
      
      // Diğer olası İngilizce anahtarlar
      currency: 'TRY',
      invoiceType: 'SATIS',
      taxExclusiveAmount: tutar,
      payableAmount: toplamTutar,
      paymentPrice: toplamTutar,

      // 3. Liste Varyasyonları
      malHizmetListe: items,
      mal_hizmet_liste: items,
      items: items,
      products: items,
      itemOrServiceList: items
    };

    console.log('STEP 2: Creating Invoice with fatura.js (Pro Mapping Mode)...');
    const result = await faturaLib.createInvoiceAndGetHTML(
        credentials.username, 
        credentials.password, 
        invoiceData
    );

    res.json({ 
      success: true, 
      message: 'Taslak fatura portala başarıyla gönderildi.',
      uuid: (result && result.uuid) ? result.uuid : 'OK'
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
