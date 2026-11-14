import express from 'express';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { client } from '../db.js';
import { authMiddleware } from '../auth.js';
import { n } from '../utils/shared.js';

const router = express.Router();

router.get('/api/teklifler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM teklifler WHERE company_id = ? ORDER BY created_at DESC',
      args: [req.user.companyId]
    });
    const teklifler = rs.rows;
    
    // Her teklif için kalemleri de getir
    const data = [];
    for (const t of teklifler) {
      const kalemlerRs = await client.execute({
        sql: 'SELECT * FROM teklif_kalemleri WHERE teklif_id = ?',
        args: [t.id]
      });
      data.push({ ...t, kalemler: kalemlerRs.rows });
    }
    
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/teklifler', authMiddleware, async (req, res) => {
  const { tarih, vade_tarihi, cari_id, musteri_adi, musteri_vkn, musteri_vergi_dairesi, musteri_adres, musteri_eposta, musteri_telefon, notlar, kalemler } = req.body;
  const companyId = req.user.companyId;

  try {
    // 1. Otomatik No Üret: TK-YYYY-XXXX
    const year = new Date().getFullYear();
    const countRs = await client.execute({
      sql: "SELECT COUNT(*) as count FROM teklifler WHERE company_id = ? AND teklif_no LIKE ?",
      args: [companyId, `TK-${year}-%`]
    });
    const nextNum = (Number(countRs.rows[0].count) + 1).toString().padStart(4, '0');
    const teklifNo = `TK-${year}-${nextNum}`;
    
    // 2. Onay Token Üret
    const token = crypto.randomBytes(32).toString('hex');
    const totalTutar = kalemler.reduce((sum, k) => sum + (Number(k.toplam_tutar) || 0), 0);

    const result = await client.execute({
      sql: `INSERT INTO teklifler (teklif_no, tarih, vade_tarihi, cari_id, musteri_adi, musteri_vkn, musteri_vergi_dairesi, musteri_adres, musteri_eposta, musteri_telefon, toplam_tutar, durum, notlar, onay_token, company_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [teklifNo, n(tarih), n(vade_tarihi), n(cari_id), n(musteri_adi), n(musteri_vkn), n(musteri_vergi_dairesi), n(musteri_adres), n(musteri_eposta), n(musteri_telefon), totalTutar, 'Bekliyor', n(notlar), token, companyId]
    });
    
    const teklifId = result.lastInsertRowid;

    // 3. Kalemleri Ekle
    if (kalemler && kalemler.length > 0) {
      const stmts = kalemler.map(k => ({
        sql: `INSERT INTO teklif_kalemleri (teklif_id, urun_id, urun_adi, miktar, birim, birim_fiyat, iskonto_orani, iskonto_tutari, kdv_orani, toplam_tutar)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
           teklifId, n(k.urun_id), n(k.urun_adi), n(k.miktar), n(k.birim) || 'Adet', 
           n(k.birim_fiyat), n(k.iskonto_orani) || 0, n(k.iskonto_tutari) || 0, 
           n(k.kdv_orani), n(k.toplam_tutar)
        ]
      }));
      await client.batch(stmts, "write");
    }

    res.json({ success: true, id: teklifId, teklif_no: teklifNo, token });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/api/teklifler/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { durum, notlar } = req.body;
  try {
    await client.execute({
      sql: 'UPDATE teklifler SET durum = COALESCE(?, durum), notlar = COALESCE(?, notlar) WHERE id = ? AND company_id = ?',
      args: [n(durum), n(notlar), id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/api/teklifler/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM teklifler WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// --- PUBLIC TEKLIF ROUTES ---
router.get('/api/public/teklif/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM teklifler WHERE onay_token = ?',
      args: [token]
    });
    const t = rs.rows[0];
    if (!t) return res.status(404).json({ success: false, message: 'Teklif bulunamadı.' });

    const kalemlerRs = await client.execute({
      sql: 'SELECT * FROM teklif_kalemleri WHERE teklif_id = ?',
      args: [t.id]
    });

    const companyRs = await client.execute({
      sql: 'SELECT id, name, address, tax_no, email FROM companies WHERE id = ?',
      args: [t.company_id]
    });

    res.json({ success: true, teklif: t, kalemler: kalemlerRs.rows, company: companyRs.rows[0] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/public/teklif/:token/approve', async (req, res) => {
  const { token } = req.params;
  try {
    // 1. Teklifi Bul
    const rsT = await client.execute({
      sql: 'SELECT * FROM teklifler WHERE onay_token = ?',
      args: [token]
    });
    const t = rsT.rows[0];
    if (!t) return res.status(404).json({ success: false, message: 'Teklif bulunamadı.' });
    if (t.durum !== 'Bekliyor') return res.status(400).json({ success: false, message: 'Bu teklif zaten işlem görmüş.' });

    // 2. Sipariş No Üret: S-YYYY-XXXX
    const year = new Date().getFullYear();
    const countRs = await client.execute({
      sql: "SELECT COUNT(*) as count FROM siparisler WHERE company_id = ? AND siparis_no LIKE ?",
      args: [t.company_id, `S-${year}-%`]
    });
    const nextNum = (Number(countRs.rows[0].count) + 1).toString().padStart(4, '0');
    const siparisNo = `S-${year}-${nextNum}`;

    // 3. Sipariş Oluştur
    const resS = await client.execute({
      sql: `INSERT INTO siparisler (siparis_no, teklif_id, tarih, cari_id, musteri_adi, toplam_tutar, durum, company_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [siparisNo, t.id, new Date().toISOString().split('T')[0], n(t.cari_id), n(t.musteri_adi), t.toplam_tutar, 'Bekliyor', t.company_id]
    });
    const siparisId = resS.lastInsertRowid;

    // 4. Sipariş Kalemlerini Aktar
    const kalemlerRs = await client.execute({
      sql: 'SELECT * FROM teklif_kalemleri WHERE teklif_id = ?',
      args: [t.id]
    });
    
    const sipStmts = kalemlerRs.rows.map(k => ({
      sql: `INSERT INTO siparis_kalemleri (siparis_id, urun_id, urun_adi, miktar, birim, birim_fiyat, kdv_orani, toplam_tutar)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [siparisId, n(k.urun_id), n(k.urun_adi), n(k.miktar), n(k.birim), n(k.birim_fiyat), n(k.kdv_orani), n(k.toplam_tutar)]
    }));
    await client.batch(sipStmts, "write");

    // 5. Teklif Durumunu Güncelle
    await client.execute({
      sql: "UPDATE teklifler SET durum = 'Onaylandı (Siparişe Dönüştü)' WHERE id = ?",
      args: [t.id]
    });

    res.json({ success: true, siparis_no: siparisNo });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// --- ORDERS (SIPARISLER) ---
router.get('/api/siparisler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM siparisler WHERE company_id = ? ORDER BY created_at DESC',
      args: [req.user.companyId]
    });
    const siparisler = rs.rows;
    const data = [];
    for (const s of siparisler) {
      const kalemlerRs = await client.execute({
        sql: 'SELECT * FROM siparis_kalemleri WHERE siparis_id = ?',
        args: [s.id]
      });
      data.push({ ...s, kalemler: kalemlerRs.rows });
    }
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/api/siparisler/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { durum } = req.body;
  try {
    await client.execute({
      sql: 'UPDATE siparisler SET durum = ? WHERE id = ? AND company_id = ?',
      args: [durum, id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/api/siparisler/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM siparisler WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// --- LUCA HESAP PLANI ENTEGRASYONU ---

router.post('/api/teklifler/:id/send-email', authMiddleware, async (req, res) => {
  const { to, subject, message } = req.body;
  const { id } = req.params;
  
  try {
    // 1. SMTP Ayarlarını Çek
    const configRs = await client.execute({
      sql: "SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN ('smtp_host','smtp_port','smtp_user','smtp_pass', 'smtp_secure')",
      args: [req.user.companyId]
    });
    
    let config = {};
    configRs.rows.forEach(r => { config[r.setting_key] = r.setting_value; });
    
    if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
      return res.status(400).json({ success: false, message: 'SMTP ayarları eksik. Lütfen önce "Ayarlar" sekmesinden e-posta bilgilerinizi tanımlayın.' });
    }

    // 2. Teklif token bilgisini ve şirket bilgisini çek (Gerekirse link olarak konacak, zaten ön yüzden hazır metin dönüyor ama backend de bilebilir)
    const teklifRs = await client.execute({
      sql: 'SELECT onay_token FROM teklifler WHERE id = ? AND company_id = ?',
      args: [id, req.user.companyId]
    });
    
    if (!teklifRs.rows.length) return res.status(404).json({ success: false, message: 'Teklif bulunamadı.' });
    
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: parseInt(config.smtp_port) || 465,
      secure: config.smtp_secure === 'true' || config.smtp_port == '465',
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass
      }
    });

    const mailOptions = {
      from: config.smtp_user,
      to,
      subject,
      text: message, // Sadece metin gönderimi (Veya gelişmiş HTML yapabiliriz)
      html: message.replace(/\\n/g, '<br/>') // Frontend'den gelen alt satırları <br> yaparız
    };

    const info = await transporter.sendMail(mailOptions);
    res.json({ success: true, info });

  } catch (e) {
    console.error("Mail Send Error: ", e);
    res.status(500).json({ success: false, message: e.message || "E-posta gönderilirken teknik bir hata oluştu." });
  }
});


export default router;
