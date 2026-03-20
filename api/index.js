const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Test modu ayarı (GERÇEK FATURA KESMEYECEKSEN true YAP)
const USE_TEST_MODE = true;

/**
 * GIB E-Arşiv API (Direct Axios Implementation)
 * Hiçbir kütüphaneye bağımlı kalmadan doğrudan GİB servisleriyle konuşur.
 */
class GIBEArchiveAPI {
    constructor(testMode = true) {
        this.baseURL = testMode 
            ? 'https://earsivportaltest.efatura.gov.tr/earsiv-services'
            : 'https://earsivportal.efatura.gov.tr/earsiv-services';
        this.token = null;
    }
    
    // Login ve Token alma
    async login(username, password) {
        try {
            console.log(`GİB Login: ${username} (Mod: ${USE_TEST_MODE ? 'TEST' : 'PROD'})`);
            const response = await axios.post(`${this.baseURL}/login`, {
                rmk: username,
                sifre: password
            });
            
            // Not: GİB response yapısına göre token lokasyonunu kontrol edin
            this.token = response.data.token || response.data.data?.token;
            
            if (!this.token) {
                throw new Error('Giriş yapıldı ama token alınamadı. Kullanıcı adı veya şifre hatalı olabilir.');
            }
            
            return this.token;
        } catch (error) {
            const msg = error.response?.data?.mesaj || error.message;
            throw new Error(`Login Hatası: ${msg}`);
        }
    }
    
    // Taslak Fatura Oluşturma
    async createDraftInvoice(invoiceData) {
        if (!this.token) throw new Error('Önce login yapmalısınız');
        
        // GİB'in beklediği ham JSON yapısı
        const payload = {
            belgeTipi: 'EARSIVFATURA',
            faturaNo: '', // GİB atayacak
            uuid: invoiceData.uuid || uuidv4(),
            faturaTarihi: invoiceData.date || new Date().toLocaleDateString('tr-TR'),
            saat: invoiceData.time || new Date().toLocaleTimeString('tr-TR'),
            paraBirimi: 'TRY',
            dovizKuru: 0,
            vknTckn: invoiceData.vknTckn || '11111111111',
            aliciAdi: invoiceData.ad || '',
            aliciSoyadi: invoiceData.soyad || '',
            aliciUnvan: invoiceData.unvan || '',
            adres: invoiceData.adres || 'Türkiye',
            il: invoiceData.il || 'Ankara',
            ilce: invoiceData.ilce || 'Merkez',
            ulke: 'Türkiye',
            
            // Mal Hizmet Listesi
            malHizmetListesi: [{
                malHizmet: invoiceData.aciklama || 'Hizmet Bedeli',
                miktar: 1,
                birimFiyat: invoiceData.tutar,
                tutar: invoiceData.tutar,
                kdvOrani: invoiceData.kdvOrani || 20,
                kdvTutari: Number(((invoiceData.tutar * (invoiceData.kdvOrani || 20)) / 100).toFixed(2)),
                malHizmetTutari: invoiceData.tutar
            }],
            
            // Toplamlar
            toplamTutar: invoiceData.tutar,
            toplamKdv: Number(((invoiceData.tutar * (invoiceData.kdvOrani || 20)) / 100).toFixed(2)),
            genelToplam: Number((invoiceData.tutar + (invoiceData.tutar * (invoiceData.kdvOrani || 20)) / 100).toFixed(2)),
            odenecekTutar: Number((invoiceData.tutar + (invoiceData.tutar * (invoiceData.kdvOrani || 20)) / 100).toFixed(2))
        };
        
        try {
            const response = await axios.post(
                `${this.baseURL}/dispatch`,
                {
                    cmd: 'EARSIV_PORTAL_FATURA_OLUSTUR',
                    data: payload
                },
                { 
                    headers: { 
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    } 
                }
            );
            
            return {
                uuid: payload.uuid,
                result: response.data
            };
        } catch (error) {
            const msg = error.response?.data?.mesaj || error.message;
            throw new Error(`Fatura Oluşturma Hatası: ${msg}`);
        }
    }
    
    // Fatura HTML'ini alma
    async getInvoiceHTML(uuid) {
        if (!this.token) throw new Error('Önce login yapmalısınız');
        
        try {
            const response = await axios.post(
                `${this.baseURL}/dispatch`,
                {
                    cmd: 'EARSIV_PORTAL_FATURA_GETIR',
                    data: { uuid: uuid }
                },
                { 
                    headers: { 
                        'Authorization': `Bearer ${this.token}`
                    } 
                }
            );
            
            return response.data.html || response.data.data?.html || 'HTML alınamadı.';
        } catch (error) {
            return `HTML Hatası: ${error.message}`;
        }
    }
}

// Sunucu durum testi
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  engine: 'axios-native-v1',
  testMode: USE_TEST_MODE
}));

// DEBUG: Gelen veriyi görmek için
app.post('/api/gib/debug-invoice', (req, res) => {
  console.log('=== DEBUG: Gelen Invoice Verisi ===');
  console.log(JSON.stringify(req.body, null, 2));
  res.json({ received: req.body });
});

// Taslak Fatura Oluşturma - NATIVE AXIOS
app.post('/api/gib/create-draft', async (req, res) => {
  const { credentials, invoice } = req.body;

  if (!credentials || !invoice) {
    return res.status(400).json({ success: false, message: 'Eksik veri.' });
  }

  try {
    const api = new GIBEArchiveAPI(USE_TEST_MODE);
    await api.login(credentials.username, credentials.password);
    
    const result = await api.createDraftInvoice(invoice);
    const html = await api.getInvoiceHTML(result.uuid);
    
    res.json({
      success: true,
      uuid: result.uuid,
      html: html,
      message: USE_TEST_MODE 
        ? 'TEST BAŞARILI: Taslak (Sanal) fatura oluşturuldu.' 
        : 'Fatura GİB portala başarıyla (Taslak) olarak gönderildi.'
    });

  } catch (error) {
    console.error('SERVER ERROR (Native):', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'GİB Hatası: ' + error.message,
      detail: error.stack
    });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Test modu: ${USE_TEST_MODE ? 'AÇIK' : 'KAPALI'}`);
  });
}

module.exports = app;