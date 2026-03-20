const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// fatura.js kütüphanesini global olarak yükle (performans için)
const faturaLib = require('fatura');

// Sunucu durum testi
app.get('/api/health', (req, res) => res.json({ status: 'ok', engine: 'fatura-v1' }));

// GİB Portal Test ve Login
app.post('/api/gib/test-login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: 'Eksik bilgi.' });

  try {
    // Gerçek bağlantı testi için fatura.js'in bir metodunu çağırabilirsin
    // Şimdilik sadece parametre kontrolü yapıyoruz
    res.json({ success: true, message: 'Bağlantı parametreleri hazır.', username });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Hata: ' + error.message });
  }
});

// DEBUG: Gelen veriyi görmek için geçici endpoint
app.post('/api/gib/debug-invoice', (req, res) => {
  console.log('=== DEBUG: Gelen Invoice Verisi ===');
  console.log(JSON.stringify(req.body, null, 2));
  res.json({ received: req.body });
});

// Taslak Fatura Oluşturma - DÜZELTİLMİŞ VERSİYON
app.post('/api/gib/create-draft', async (req, res) => {
  const { credentials, invoice } = req.body;

  // DETAYLI VALIDASYON
  if (!credentials || !invoice) {
    return res.status(400).json({
      success: false,
      message: 'Eksik veri: credentials veya invoice gönderilmemiş.'
    });
  }

  if (!credentials.username || !credentials.password) {
    return res.status(400).json({
      success: false,
      message: 'Eksik bilgi: username ve password zorunlu.'
    });
  }

  // ZORUNLU ALAN KONTROLÜ
  const requiredFields = ['tutar', 'vknTckn', 'ad'];
  const missingFields = requiredFields.filter(field => !invoice[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Eksik alanlar: ${missingFields.join(', ')}`
    });
  }

  try {
    // SAYISAL DEĞERLERİN GÜVENLİ HESAPLAMASI
    const tutar = parseFloat(invoice.tutar);
    if (isNaN(tutar) || tutar <= 0) {
      throw new Error(`Geçersiz tutar değeri: ${invoice.tutar}`);
    }

    const kdvOrani = parseInt(invoice.kdvOrani) || 20;
    if (isNaN(kdvOrani) || kdvOrani < 0 || kdvOrani > 35) {
      throw new Error(`Geçersiz KDV oranı: ${invoice.kdvOrani}`);
    }

    const kdvTutari = parseFloat(((tutar * kdvOrani) / 100).toFixed(2));
    const toplamTutar = parseFloat((tutar + kdvTutari).toFixed(2));

    console.log('=== HESAPLAMA SONUÇLARI ===');
    console.log(`Matrah (Tutar): ${tutar} (tip: ${typeof tutar})`);
    console.log(`KDV Oranı: ${kdvOrani}%`);
    console.log(`KDV Tutarı: ${kdvTutari} (tip: ${typeof kdvTutari})`);
    console.log(`Toplam Tutar: ${toplamTutar} (tip: ${typeof toplamTutar})`);

    // SİMÜLASYON MODU (Test için)
    if (credentials.password === 'simule') {
      return res.json({
        success: true,
        message: 'SİMÜLASYON TEST BAŞARILI. Kod düzgün çalışıyor.',
        debug: {
          tutar,
          kdvTutari,
          toplamTutar,
          items: [{
            name: invoice.aciklama || 'Hizmet Bedeli',
            quantity: 1,
            unitPrice: tutar,
            price: tutar,
            VATRate: kdvOrani,
            VATAmount: kdvTutari
          }]
        }
      });
    }

    // Fatura.js kütüphanesinin beklediği formatta veri hazırlama
    // GitHub: https://github.com/ahmetozlu/fatura.js
    const invoiceData = {
      // Zorunlu Temel Alanlar
      date: invoice.faturaTarihi || new Date().toLocaleDateString('tr-TR'),
      time: new Date().toLocaleTimeString('tr-TR'),

      // Alıcı Bilgileri (Kütüphane formatı)
      taxIDOrTRID: String(invoice.vknTckn || '11111111111'),
      taxOffice: String(invoice.vergiDairesi || ''),
      title: String(invoice.unvan || `${invoice.ad} ${invoice.soyad || ''}`.trim() || 'İsimsiz'),
      name: String(invoice.ad || ''),
      surname: String(invoice.soyad || ''),
      fullAddress: String(invoice.adres || 'Türkiye'),

      // Ürün/Hizmet Listesi - KÜTÜPHANE "items" BEKLİYOR!
      items: [
        {
          name: String(invoice.aciklama || 'Hizmet Bedeli'),
          quantity: 1,
          unitPrice: Number(tutar.toFixed(2)),
          price: Number(tutar.toFixed(2)),
          VATRate: Number(kdvOrani),
          VATAmount: Number(kdvTutari.toFixed(2))
        }
      ],

      // Toplamlar - Sayısal değerler ve number tipi zorunlu!
      totalVAT: Number(kdvTutari.toFixed(2)),
      grandTotal: Number(tutar.toFixed(2)),
      grandTotalInclVAT: Number(toplamTutar.toFixed(2)),
      paymentTotal: Number(toplamTutar.toFixed(2))
    };

    // DEBUG: Gönderilecek veriyi logla
    console.log('=== GÖNDERİLEN INVOICE DATA ===');
    console.log(JSON.stringify(invoiceData, null, 2));

    // Tüm değerlerin number olduğunu teyit et
    const numberChecks = [
      { name: 'items[0].unitPrice', value: invoiceData.items[0].unitPrice },
      { name: 'items[0].price', value: invoiceData.items[0].price },
      { name: 'items[0].VATRate', value: invoiceData.items[0].VATRate },
      { name: 'items[0].VATAmount', value: invoiceData.items[0].VATAmount },
      { name: 'totalVAT', value: invoiceData.totalVAT },
      { name: 'grandTotal', value: invoiceData.grandTotal },
      { name: 'grandTotalInclVAT', value: invoiceData.grandTotalInclVAT },
      { name: 'paymentTotal', value: invoiceData.paymentTotal }
    ];

    for (const check of numberChecks) {
      if (typeof check.value !== 'number' || isNaN(check.value)) {
        throw new Error(`Veri tipi hatası: ${check.name} = ${check.value} (tip: ${typeof check.value})`);
      }
    }

    console.log('STEP: fatura.js çağrılıyor...');

    // Kütüphane çağrısı - 4. parametre { sign: boolean } opsiyonel
    const result = await faturaLib.createInvoiceAndGetHTML(
      credentials.username,
      credentials.password,
      invoiceData,
      { sign: true } // veya false - imzalama istemiyorsan false yap
    );

    console.log('STEP: Başarılı yanıt alındı');

    res.json({
      success: true,
      message: 'Taslak fatura portala başarıyla gönderildi.',
      uuid: (result && result.uuid) ? result.uuid : 'OK',
      htmlPreview: result && result.html ? result.html.substring(0, 200) + '...' : null
    });

  } catch (error) {
    console.error('=== SERVER ERROR ===');
    console.error('Hata Mesajı:', error.message);
    console.error('Hata Stack:', error.stack);

    res.status(500).json({
      success: false,
      message: 'GİB Hatası: ' + (error.message || 'Bilinmeyen Hata'),
      detail: error.stack,
      // Geliştirme aşamasında gönderilen veriyi de döndür (güvenlik için prod'da kaldır)
      sentData: process.env.NODE_ENV !== 'production' ? {
        tutar: invoice?.tutar,
        kdvOrani: invoice?.kdvOrani,
        vknTckn: invoice?.vknTckn
      } : undefined
    });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Test endpoint: http://localhost:${PORT}/api/gib/test-login`);
    console.log(`Debug endpoint: POST http://localhost:${PORT}/api/gib/debug-invoice`);
    console.log(`Create draft: POST http://localhost:${PORT}/api/gib/create-draft`);
  });
}

module.exports = app;