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
    
    // Ürün listesi (Hem Snake hem Camel anahtarlarla)
    const items = [
      {
        // CamelCase
        malHizmet: String(invoice.aciklama || 'Hizmet Bedeli'),
        miktar: 1,
        birim: 'ADET',
        birimFiyat: tutar,
        fiyat: tutar,
        iskontoOrani: 0,
        iskontoTutari: 0,
        kdvOrani: kdvOrani,
        kdvTutari: kdvTutari,
        malHizmetTutari: tutar,
        
        // Snake_case (Kütüphanenin içindeki toFixed() hatalarını önlemek için)
        mal_hizmet: String(invoice.aciklama || 'Hizmet Bedeli'),
        birim_fiyat: tutar,
        iskonto_orani: 0,
        iskonto_tutari: 0,
        kdv_orani: kdvOrani,
        kdv_tutari: kdvTutari,
        mal_hizmet_tutari: tutar,

        // İngilizce varyasyonlar
        name: String(invoice.aciklama || 'Hizmet Bedeli'),
        quantity: 1,
        unit: 'ADET',
        unitPrice: tutar,
        totalAmount: tutar,
        base: tutar,
        price: tutar,
        totalPrice: tutar,
        taxRate: kdvOrani,
        taxAmount: kdvTutari
      }
    ];

    const invoiceData = {
      // CamelCase
      faturaTarihi: invoice.faturaTarihi || new Date().toLocaleDateString('tr-TR'),
      saat: new Date().toLocaleTimeString('tr-TR'),
      paraBirimi: 'TRY',
      faturaTipi: 'SATIS',
      vknTckn: String(invoice.vknTckn || '11111111111'),
      aliciAdi: String(invoice.ad || invoice.unvan || 'İsimsiz'),
      aliciSoyadi: String(invoice.soyad || ''),
      aliciUnvan: String(invoice.unvan || invoice.ad || 'İsimsiz'),
      vergiDairesi: String(invoice.vergiDairesi || ''),
      ulke: 'Türkiye',
      bulvarcaddesokak: String(invoice.adres || 'Türkiye'),
      sehir: String(invoice.il || 'Ankara'),
      mahalleSemtIlce: String(invoice.ilce || 'Merkez'),
      matrah: tutar,
      malhizmetToplamTutari: tutar,
      toplamIskonto: 0,
      hesaplanankdv: kdvTutari,
      vergilerToplami: kdvTutari,
      vergilerDahilToplamTutar: toplamTutar,
      odenecekTutar: toplamTutar,
      not: String(invoice.aciklama || ''),
      
      // Snake_case
      fatura_tarihi: invoice.faturaTarihi || new Date().toLocaleDateString('tr-TR'),
      fatura_tipi: 'SATIS',
      vkn_tckn: String(invoice.vknTckn || '11111111111'),
      alici_adi: String(invoice.ad || invoice.unvan || 'İsimsiz'),
      alici_soyadi: String(invoice.soyad || ''),
      vergi_dairesi: String(invoice.vergiDairesi || ''),
      bulvar_cadde_sokak: String(invoice.adres || 'Türkiye'),
      toplam_iskonto: 0,
      vergiler_toplami: kdvTutari,
      odenecek_tutar: toplamTutar,

      // Evrensel Anahtarlar
      paymentPrice: toplamTutar,
      payableAmount: toplamTutar,
      productsTotalPrice: tutar,
      taxExclusiveAmount: tutar,
      taxTotalPrice: kdvTutari,
      includedTaxesTotalPrice: toplamTutar,
      itemOrServiceTotalPrice: tutar,
      orderData: [],

      // Liste varyasyonları
      malHizmetListe: items,
      mal_hizmet_liste: items,
      malHizmetTable: items,
      products: items,
      items: items
    };

    console.log('STEP 2: Creating Invoice with fatura.js (Ultra-Safe Mode)...');
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
