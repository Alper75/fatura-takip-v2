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
 * V8: İki Aşamalı (Smart Follower) Giriş Mekanizması
 */
class GIBEArchiveAPI {
    constructor(testMode = true) {
        this.baseURL = testMode 
            ? 'https://earsivportaltest.efatura.gov.tr/earsiv-services'
            : 'https://earsivportal.efatura.gov.tr/earsiv-services';
        this.token = null;
    }
    
    // Login ve Token alma (İki Aşamalı Akıllı Akış)
    async login(username, password) {
        let rawGibResponse = null;
        try {
            console.log(`=== GİB LOGIN ADIM 1 (${USE_TEST_MODE ? 'TEST' : 'CANLI'}) ===`);
            
            // ADIM 1: Standart Giriş Denemesi
            const params1 = new URLSearchParams();
            params1.append('assosUser', username);
            params1.append('assosPass', password);
            params1.append('genelislem', 'login');

            let response = await axios.post(`${this.baseURL}/assos-login`, params1, {
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': `${this.baseURL}/login.jsp`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            
            rawGibResponse = response.data;
            console.log('GİB ADIM 1 YANIT:', JSON.stringify(rawGibResponse));

            // ADIM 2: Eğer GİB seçim ekranı (prompt) döndürdüyse onay veriyoruz
            if (typeof rawGibResponse === 'string' && rawGibResponse.includes('assoscmd=login|logout')) {
                console.log('=== GİB LOGIN ADIM 2 (Seçim Onaylanıyor) ===');
                const params2 = new URLSearchParams();
                params2.append('assosUser', username);
                params2.append('assosPass', password);
                params2.append('assoscmd', 'login'); // İşte burada onay veriyoruz
                params2.append('genelislem', 'login');

                response = await axios.post(`${this.baseURL}/assos-login`, params2, {
                    headers: { 
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Referer': `${this.baseURL}/login.jsp`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                rawGibResponse = response.data;
                console.log('GİB ADIM 2 YANIT:', JSON.stringify(rawGibResponse));
            }

            // Token Ayıklama
            this.token = response.data.token || response.data.data?.token;
            
            if (!this.token) {
                const gibMsg = (response.data.messages && response.data.messages[0]?.text) || 
                               response.data.mesaj || 
                               JSON.stringify(response.data);
                throw new Error(`${gibMsg}`);
            }
            
            console.log('GİRİŞ BAŞARILI ✅');
            return this.token;
        } catch (error) {
            const detail = rawGibResponse ? ` | GİB Yanıtı: ${JSON.stringify(rawGibResponse)}` : '';
            throw new Error(`${error.message}${detail}`);
        }
    }
    
    // Taslak Fatura Oluşturma
    async createDraftInvoice(invoiceData) {
        if (!this.token) throw new Error('Oturum açılmamış.');
        
        const payload = {
            belgeTipi: 'EARSIVFATURA',
            faturaNo: '',
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
                        'Authorization': `Bearer ${this.token}`,
                        'Referer': `${this.baseURL}/index.jsp`
                    } 
                }
            );
            return { uuid: payload.uuid, result: response.data };
        } catch (error) {
            throw new Error(`Fatura Hatası: ${error.message}`);
        }
    }
    
    // Fatura HTML'ini alma
    async getInvoiceHTML(uuid) {
        if (!this.token) throw new Error('Oturum açılmamış.');
        try {
            const response = await axios.post(
                `${this.baseURL}/dispatch`,
                new URLSearchParams({
                    cmd: 'EARSIV_PORTAL_FATURA_GETIR',
                    token: this.token,
                    data: JSON.stringify({ uuid: uuid })
                }),
                { 
                    headers: { 
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Referer': `${this.baseURL}/index.jsp`
                    } 
                }
            );
            return response.data.html || response.data.data?.html || 'HTML önizleme alınamadı.';
        } catch (error) {
            return `Önizleme Hatası: ${error.message}`;
        }
    }
}

// Sağlık kontrolü
app.get('/api/health', (req, res) => res.json({ status: 'ok', testMode: USE_TEST_MODE }));

// Taslak Fatura Oluşturma
app.post('/api/gib/create-draft', async (req, res) => {
  const { credentials, invoice } = req.body;
  if (!credentials || !invoice) return res.status(400).json({ success: false, message: 'Eksik veri.' });

  try {
    const api = new GIBEArchiveAPI(USE_TEST_MODE);
    await api.login(credentials.username, credentials.password);
    
    const result = await api.createDraftInvoice(invoice);
    const html = await api.getInvoiceHTML(result.uuid);
    
    res.json({ success: true, uuid: result.uuid, html: html });
  } catch (error) {
    console.error('SERVER ERROR:', error.message);
    res.status(500).json({ success: false, message: 'GİB Hatası: ' + error.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;