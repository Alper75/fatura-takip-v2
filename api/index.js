const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Test modu ayarı (GERÇEK FATURA KESİLECEĞİ İÇİN false YAPILDI)
const USE_TEST_MODE = false;

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
    
    // Login ve Token alma (Assos Login Yöntemi)
    async login(username, password) {
        try {
            console.log(`GİB Login Denemesi: ${username} (Mod: ${USE_TEST_MODE ? 'TEST' : 'PROD'})`);
            
            // GİB Portal genellikle assos-login ve URLSearchParams bekler
            const params = new URLSearchParams();
            params.append('assosUser', username);
            params.append('assosPass', password);
            params.append('userid', username);
            params.append('password', password);
            params.append('serviceName', 'Assos1');

            const response = await axios.post(`${this.baseURL}/assos-login`, params, {
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': `${this.baseURL}/login.jsp`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            
            // Token genellikle response.data.token içinde döner
            this.token = response.data.token || response.data.data?.token;
            
            if (!this.token) {
                // Eğer token hala yoksa hata fırlat
                if (response.data.mesaj) throw new Error(response.data.mesaj);
                throw new Error('Giriş yapıldı ama token alınamadı. Lütfen kullanıcı adı ve şifreyi kontrol edin.');
            }
            
            console.log('Token Başarıyla Alındı.');
            return this.token;
        } catch (error) {
            const msg = error.response?.data?.mesaj || error.message;
            console.error('Login Detaylı Hata:', error.response?.data || error.message);
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
            
            malHizmetListesi: [{
                malHizmet: invoiceData.aciklama || 'Hizmet Bedeli',
                miktar: 1,
                birimFiyat: invoiceData.tutar,
                tutar: invoiceData.tutar,
                kdvOrani: invoiceData.kdvOrani || 20,
                kdvTutari: Number(((invoiceData.tutar * (invoiceData.kdvOrani || 20)) / 100).toFixed(2)),
                malHizmetTutari: invoiceData.tutar
            }],
            
            toplamTutar: invoiceData.tutar,
            toplamKdv: Number(((invoiceData.tutar * (invoiceData.kdvOrani || 20)) / 100).toFixed(2)),
            genelToplam: Number((invoiceData.tutar + (invoiceData.tutar * (invoiceData.kdvOrani || 20)) / 100).toFixed(2)),
            odenecekTutar: Number((invoiceData.tutar + (invoiceData.tutar * (invoiceData.kdvOrani || 20)) / 100).toFixed(2))
        };
        
        try {
            // dispatch üzerinden komut gönderme (Çoğu kütüphanenin kullandığı stabil yöntem)
            const response = await axios.post(
                `${this.baseURL}/dispatch`,
                new URLSearchParams({
                    cmd: 'EARSIV_PORTAL_FATURA_OLUSTUR',
                    token: this.token,
                    data: JSON.stringify(payload)
                }),
                { 
                    headers: { 
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Bearer ${this.token}`
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
                new URLSearchParams({
                    cmd: 'EARSIV_PORTAL_FATURA_GETIR',
                    token: this.token,
                    data: JSON.stringify({ uuid: uuid })
                }),
                { 
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' } 
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
  engine: 'axios-native-v2',
  testMode: USE_TEST_MODE
}));

// Taslak Fatura Oluşturma - NATIVE AXIOS (V2)
app.post('/api/gib/create-draft', async (req, res) => {
  const { credentials, invoice } = req.body;

  if (!credentials || !invoice) {
    return res.status(400).json({ success: false, message: 'Eksik veri.' });
  }

  try {
    const api = new GIBEArchiveAPI(USE_TEST_MODE);
    await api.login(credentials.username, credentials.password);
    
    console.log('Fatura oluşturuluyor...');
    const result = await api.createDraftInvoice(invoice);
    const html = await api.getInvoiceHTML(result.uuid);
    
    res.json({
      success: true,
      uuid: result.uuid,
      html: html,
      message: USE_TEST_MODE 
        ? 'TEST BAŞARILI: Taslak fatura oluşturuldu.' 
        : 'Fatura GİB portala başarıyla (Taslak) olarak gönderildi.'
    });

  } catch (error) {
    console.error('GİB NATIVE ERROR:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'GİB Hatası: ' + error.message
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