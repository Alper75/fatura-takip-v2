import express from 'express';
import axios from 'axios';
import xlsx from 'xlsx';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { client } from '../db.js';
import { authMiddleware } from '../auth.js';
import { upload, uploadsDir, n } from '../utils/shared.js';

const router = express.Router();

router.get('/api/mutabakatlar', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: `
        SELECT m.*, c.unvan as cariUnvan, c.vkn_tckn as cariVkn, c.eposta as cariEposta, c.telefon as cariTelefon, c.muhasebe_kodu as cariMuhasebeKodu
        FROM mutabakatlar m
        LEFT JOIN cariler c ON m.cari_id = c.id
        WHERE m.company_id = ?
        ORDER BY m.olusturma_tarihi DESC
      `,
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/api/mutabakatlar/test-smtp', authMiddleware, async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, company_name, test_to } = req.body || {};
    const rsSettings = await client.execute({
      sql: 'SELECT * FROM company_settings WHERE company_id = ?',
      args: [req.user.companyId]
    });
    const config = {};
    rsSettings.rows.forEach(r => { config[r.setting_key] = r.setting_value; });

    const host = smtp_host || config.smtp_host;
    const port = parseInt(smtp_port || config.smtp_port) || 465;
    const user = smtp_user || config.smtp_user;
    const pass = smtp_pass || config.smtp_pass;
    const secure = smtp_secure !== undefined ? (smtp_secure === true || smtp_secure === 'true') : (config.smtp_secure === 'true' || String(port) === '465');
    const recipient = test_to || user;

    if (!host || !user || !pass) {
      return res.status(400).json({ success: false, message: 'Lütfen SMTP Sunucu (Host), E-Posta ve Şifre alanlarını doldurun.' });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });

    await transporter.verify();
    await transporter.sendMail({
      from: `"${company_name || config.company_name || 'Mutabakat Servisi'}" <${user}>`,
      to: recipient,
      subject: `${company_name || config.company_name || 'Şirket'} - E-Mutabakat SMTP Test Maili`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #334155; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #4f46e5; margin-top: 0;">✅ E-Posta Bağlantısı Başarılı!</h2>
          <p>Mutabakat e-posta (SMTP) ayarlarınız başarıyla doğrulandı. Artık müşterilerinize ve tedarikçilerinize doğrudan sistem üzerinden mutabakat mektubu gönderebilirsiniz.</p>
          <p style="font-size: 12px; color: #64748b;">Gönderen: ${user} (${host}:${port})</p>
        </div>
      `
    });

    res.json({ success: true, message: `Test e-postası başarıyla ${recipient} adresine gönderildi.` });
  } catch (e) {
    res.status(500).json({ success: false, message: 'SMTP bağlantı hatası: ' + e.message });
  }
});

router.post('/api/mutabakatlar/:id/update-contact', authMiddleware, async (req, res) => {
  try {
    const { eposta, telefon } = req.body || {};
    const rs = await client.execute({
      sql: 'SELECT cari_id FROM mutabakatlar WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    if (rs.rows.length === 0) return res.status(404).json({ success: false, message: 'Mutabakat bulunamadı.' });
    const cariId = rs.rows[0].cari_id;
    if (cariId) {
      await client.execute({
        sql: 'UPDATE cariler SET eposta = COALESCE(?, eposta), telefon = COALESCE(?, telefon) WHERE id = ? AND company_id = ?',
        args: [eposta !== undefined ? eposta : null, telefon !== undefined ? telefon : null, cariId, req.user.companyId]
      });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.delete('/api/mutabakatlar/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM mutabakatlar WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/api/mutabakatlar/bulk-delete', authMiddleware, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ success: false, message: 'Geçersiz ID listesi.' });
  try {
    const placeholders = ids.map(() => '?').join(',');
    await client.execute({
      sql: `DELETE FROM mutabakatlar WHERE id IN (${placeholders}) AND company_id = ?`,
      args: [...ids, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/api/mutabakatlar/:id/send-mail', authMiddleware, async (req, res) => {
  try {
    const { toEmail } = req.body || {};
    const rs = await client.execute({
      sql: 'SELECT m.*, c.unvan, c.eposta, c.vkn_tckn FROM mutabakatlar m JOIN cariler c ON m.cari_id = c.id WHERE m.id = ? AND m.company_id = ?',
      args: [req.params.id, req.user.companyId]
    });

    if (rs.rows.length === 0) return res.status(404).json({ success: false, message: 'Bulunamadı.' });
    const mutabakat = rs.rows[0];
    const targetEmail = (toEmail || mutabakat.eposta || '').trim();

    if (!targetEmail) {
      return res.status(400).json({ success: false, message: 'Alıcı e-posta adresi tanımlı değil. Lütfen cariye e-posta ekleyin.' });
    }

    if (toEmail && toEmail.trim() !== mutabakat.eposta && mutabakat.cari_id) {
      await client.execute({
        sql: 'UPDATE cariler SET eposta = ? WHERE id = ? AND company_id = ?',
        args: [toEmail.trim(), mutabakat.cari_id, req.user.companyId]
      });
    }

    const rsSettings = await client.execute({
      sql: 'SELECT * FROM company_settings WHERE company_id = ?',
      args: [req.user.companyId]
    });
    const config = {};
    rsSettings.rows.forEach(r => { config[r.setting_key] = r.setting_value; });

    if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
      return res.status(400).json({
        success: false,
        message: 'SMTP e-posta ayarları henüz yapılmamış. Ayarlar sekmesinden SMTP bilgilerinizi kaydedebilir veya Mail Uygulaması / WhatsApp ile gönderebilirsiniz.'
      });
    }

    const port = parseInt(config.smtp_port) || 465;
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port,
      secure: config.smtp_secure === 'true' || String(port) === '465',
      auth: { user: config.smtp_user, pass: config.smtp_pass }
    });

    const publicUrl = `${req.get('origin') || 'http://localhost:5173'}/?mutabakat=${mutabakat.token}`;
    const bakiyeFormatted = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Math.abs(Number(mutabakat.bakiye) || 0));
    const bakiyeYonu = Number(mutabakat.bakiye) >= 0 ? 'BORÇLU (Alacağımız)' : 'ALACAKLI (Borcumuz)';

    await transporter.sendMail({
      from: `"${config.company_name || 'Mutabakat Servisi'}" <${config.smtp_user}>`,
      to: targetEmail,
      subject: `${config.company_name || 'Şirket'} - Cari & BA/BS Mutabakat Formu (${mutabakat.donem})`,
      html: `
        <div style="font-family: sans-serif; padding: 24px; color: #334155; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #4f46e5; margin-top: 0;">Cari Hesap & BA/BS Mutabakat Talebi</h2>
          <p>Sayın <b>${mutabakat.unvan}</b> ${mutabakat.vkn_tckn ? `(VKN: ${mutabakat.vkn_tckn})` : ''},</p>
          <p>Şirketimiz kayıtlarına göre <b>${mutabakat.donem}</b> dönemi itibarıyla cari hesap bakiyemiz ve detaylarımız aşağıda bilgilerinize sunulmuştur:</p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 10px; border: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="margin: 6px 0;"><b>Dönem:</b> ${mutabakat.donem}</p>
            <p style="margin: 6px 0;"><b>Toplam Borç:</b> ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(mutabakat.borc) || 0)}</p>
            <p style="margin: 6px 0;"><b>Toplam Alacak:</b> ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(mutabakat.alacak) || 0)}</p>
            <p style="margin: 8px 0; font-size: 16px; color: #0f172a;"><b>Net Bakiye:</b> ${bakiyeFormatted} (${bakiyeYonu})</p>
            ${mutabakat.aciklama ? `<p style="margin: 6px 0; font-size: 13px; color: #475569;"><b>Detay / BA-BS Bilgisi:</b> ${mutabakat.aciklama}</p>` : ''}
          </div>
          <p>Mutabakat işlemini tek tıkla <b>Onaylamak (Mutabıkız)</b> veya <b>Reddetmek (Mutabık Değiliz)</b> için lütfen aşağıdaki butona tıklayınız:</p>
          <a href="${publicUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px;">Mutabakatı Görüntüle ve Yanıtla</a>
          <p style="margin-top: 28px; font-size: 12px; color: #64748b;">Bu e-posta ${config.company_name || 'Şirketimiz'} tarafından e-Mutabakat sistemi üzerinden gönderilmiştir.</p>
        </div>
      `
    });

    await client.execute({
      sql: 'UPDATE mutabakatlar SET gonderim_tarihi = CURRENT_TIMESTAMP WHERE id = ?',
      args: [mutabakat.id]
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/api/mutabakatlar/bulk', authMiddleware, async (req, res) => {
  const { mutabakatlar, bizeAitMuavinBase64, allowWithoutEmail } = req.body;
  if (!mutabakatlar || !Array.isArray(mutabakatlar)) {
    return res.status(400).json({ success: false, message: 'Veri geçersiz.' });
  }

  try {
    // Ensure new columns exist (safe migration on first access)
    try {
      const colInfo = await client.execute('PRAGMA table_info(mutabakatlar)');
      const cols = colInfo.rows.map(r => r.name);
      if (!cols.includes('karsi_muavin_data')) await client.execute('ALTER TABLE mutabakatlar ADD COLUMN karsi_muavin_data TEXT');
      if (!cols.includes('karsi_muavin_filename')) await client.execute('ALTER TABLE mutabakatlar ADD COLUMN karsi_muavin_filename TEXT');
      if (!cols.includes('kullanici_muavin_data')) await client.execute('ALTER TABLE mutabakatlar ADD COLUMN kullanici_muavin_data TEXT');
    } catch (_) { /* already exist */ }

    // Store admin muavin as base64 in DB (survives Vercel restarts)
    let muavinData = null;
    if (bizeAitMuavinBase64) {
      muavinData = bizeAitMuavinBase64;
    }

    const created = [];
    let notFoundCount = 0;
    let noEmailCount = 0;

    for (const row of mutabakatlar) {
      let rsCari;
      if (row.cariId) {
        rsCari = await client.execute({
          sql: 'SELECT id, unvan, eposta, telefon FROM cariler WHERE id = ? AND company_id = ?',
          args: [row.cariId, req.user.companyId]
        });
      } else {
        rsCari = await client.execute({
          sql: 'SELECT id, unvan, eposta, telefon FROM cariler WHERE (muhasebe_kodu = ? OR vkn_tckn = ? OR vkn_tckn = ?) AND company_id = ?',
          args: [row.muhasebeKodu || '', row.muhasebeKodu || '', row.vknTckn || '', req.user.companyId]
        });
      }

      if (rsCari.rows.length > 0) {
        const cari = rsCari.rows[0];
        const finalEmail = (row.eposta !== undefined ? row.eposta : cari.eposta) || '';
        const finalPhone = (row.telefon !== undefined ? row.telefon : cari.telefon) || '';

        if ((row.eposta && row.eposta !== cari.eposta) || (row.telefon && row.telefon !== cari.telefon)) {
          await client.execute({
            sql: 'UPDATE cariler SET eposta = COALESCE(?, eposta), telefon = COALESCE(?, telefon) WHERE id = ? AND company_id = ?',
            args: [row.eposta || null, row.telefon || null, cari.id, req.user.companyId]
          });
        }

        if (!finalEmail && !allowWithoutEmail) {
          noEmailCount++;
          continue;
        }
        if (!finalEmail) {
          noEmailCount++;
        }

        const token = crypto.randomBytes(32).toString('hex');
        const id = 'm' + Date.now() + Math.random().toString(36).substr(2, 5);

        await client.execute({
          sql: `INSERT INTO mutabakatlar (id, company_id, cari_id, donem, tip, borc, alacak, bakiye, token, aciklama, kullanici_muavin_data, durum) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [id, req.user.companyId, cari.id, row.donem, row.tip || 'CARI', row.borc || 0, row.alacak || 0, row.bakiye || 0, token, row.aciklama || '', muavinData, 'Bekliyor']
        });

        created.push({ id, unvan: cari.unvan, eposta: finalEmail, telefon: finalPhone, token });
      } else {
        notFoundCount++;
      }
    }

    res.json({ 
      success: true, 
      created,
      notFoundCount,
      noEmailCount,
      totalRows: mutabakatlar.length
    });
  } catch (e) {
    console.error("Bulk Mutabakat error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Mutabakat Public View
router.get('/api/public/mutabakat/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const rs = await client.execute({
      sql: `SELECT m.*, c.unvan, co.name as company_name, co.tax_no as company_vkn, co.address as company_address
            FROM mutabakatlar m 
            JOIN cariler c ON m.cari_id = c.id 
            JOIN companies co ON m.company_id = co.id
            WHERE m.token = ?`,
      args: [token]
    });
    if (rs.rows.length === 0) return res.status(404).json({ success: false, message: 'Mutabakat bulunamadı veya link geçersiz.' });
    res.json({ success: true, data: rs.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/api/public/mutabakat/:token/respond', async (req, res) => {
  const { token } = req.params;
  const { durum, aciklama, muavinBase64, muavinFileName } = req.body;

  try {
    // Ensure new columns exist (safe migration on first access)
    try {
      const colInfo = await client.execute('PRAGMA table_info(mutabakatlar)');
      const cols = colInfo.rows.map(r => r.name);
      if (!cols.includes('karsi_muavin_data')) await client.execute('ALTER TABLE mutabakatlar ADD COLUMN karsi_muavin_data TEXT');
      if (!cols.includes('karsi_muavin_filename')) await client.execute('ALTER TABLE mutabakatlar ADD COLUMN karsi_muavin_filename TEXT');
      if (!cols.includes('kullanici_muavin_data')) await client.execute('ALTER TABLE mutabakatlar ADD COLUMN kullanici_muavin_data TEXT');
    } catch (_) { /* already exist */ }

    // Store file as base64 in DB (survives Vercel restarts)
    let muavinData = null;
    let muavinName = null;
    if (muavinBase64) {
      muavinData = muavinBase64; // keep full data URI including header
      muavinName = muavinFileName || `karsi_muavin_${Date.now()}.xlsx`;
    }

    await client.execute({
      sql: `UPDATE mutabakatlar 
            SET durum = ?, aciklama = ?, 
                karsi_muavin_data = COALESCE(?, karsi_muavin_data),
                karsi_muavin_filename = COALESCE(?, karsi_muavin_filename),
                yanit_tarihi = CURRENT_TIMESTAMP 
            WHERE token = ?`,
      args: [durum, aciklama || '', muavinData, muavinName, token]
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/api/mutabakatlar/analyze/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM mutabakatlar WHERE id = ? AND company_id = ?',
      args: [id, req.user.companyId]
    });
    if (rs.rows.length === 0) return res.status(404).json({ success: false, message: 'Mutabakat bulunamadı.' });
    const mutabakat = rs.rows[0];

    // Check if at least the customer muavin is available (in DB or on disk)
    const hasKarsiMuavin = mutabakat.karsi_muavin_data || (mutabakat.karsi_muavin_path && fs.existsSync(path.join(uploadsDir, mutabakat.karsi_muavin_path)));
    const hasBizMuavin = mutabakat.kullanici_muavin_data || (mutabakat.kullanici_muavin_path && fs.existsSync(path.join(uploadsDir, mutabakat.kullanici_muavin_path)));

    if (!hasKarsiMuavin || !hasBizMuavin) {
      return res.status(400).json({ success: false, message: 'Karşılaştırma için her iki muavin dosyası da mevcut olmalıdır. Lütfen karşı tarafın bir dosya yüklediğinden emin olun.' });
    }

    // 1. Gemini Key & Model Çek
    const rsSettings = await client.execute({
      sql: "SELECT setting_key, setting_value FROM company_settings WHERE (company_id = ? OR company_id = 1) AND setting_key IN ('gemini_api_key', 'gemini_model') ORDER BY (CASE WHEN company_id = ? THEN 0 ELSE 1 END)",
      args: [req.user.companyId, req.user.companyId]
    });
    
    let apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);
    let aiModel = 'gemini-2.5-flash'; // default model
    
    rsSettings.rows.forEach(r => {
      if (r.setting_key === 'gemini_api_key' && r.setting_value) apiKey = r.setting_value;
      if (r.setting_key === 'gemini_model' && r.setting_value) aiModel = r.setting_value;
    });

    if (!apiKey) {
      const anyKeyRs = await client.execute({
        sql: "SELECT setting_value FROM company_settings WHERE setting_key = 'gemini_api_key' AND setting_value IS NOT NULL AND setting_value != '' ORDER BY id DESC LIMIT 1"
      }).catch(() => ({ rows: [] }));
      if (anyKeyRs.rows.length > 0) apiKey = anyKeyRs.rows[0].setting_value;
    }
    
    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Yapay zeka anahtarı (Gemini API Key) bulunamadı. Lütfen ayarlardan tanımlayın.' });
    }

    // 2. Dosyaları Oku ve Parse Et (DB base64 öncelikli, fallback to disk)
    const readXlsxRows = (base64Data, filePath) => {
      if (base64Data) {
        const pureBase64 = base64Data.replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(pureBase64, 'base64');
        const wb = xlsx.read(buffer, { type: 'buffer' });
        return xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      } else if (filePath && fs.existsSync(filePath)) {
        const wb = xlsx.readFile(filePath);
        return xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      }
      return [];
    };

    const bizRows = readXlsxRows(mutabakat.kullanici_muavin_data, path.join(uploadsDir, mutabakat.kullanici_muavin_path || ''));
    const karsiRows = readXlsxRows(mutabakat.karsi_muavin_data, path.join(uploadsDir, mutabakat.karsi_muavin_path || ''));

    // 3. AI Analiz Promptu
    const prompt = `
      Sana iki farklı firmadan gelen cari hesap "muavin" (hesap dökümü) satırlarını gönderiyorum. 
      Senin görevin bu iki tabloyu karşılaştırıp uyuşmazlıkları (farklılıkları) bulmaktır. 
      Aşağıdaki durumları tolere etmelisin ve eşleşmiş saymalısın:
      - Tarih formatı farklılıkları (Örn: 01.12 vs 2024-12-01).
      - Açıklama farklılıkları (Örn: "Fatura 123" vs "123 No'lu Satış Faturası").
      - Evrak numarasındaki sıfır eksikleri (Örn: "0001" vs "1").
      - Bir ayın sonundaki işlemin diğer ayın başında gözükmesi (Aralık sonundaki faturanın Ocak'ta işlenmesi).

      Tablo 1 (Bizim Kayıtlar): ${JSON.stringify(bizRows.slice(0, 150))} 
      Tablo 2 (Müşterinin Kayıtları): ${JSON.stringify(karsiRows.slice(0, 150))}

      Lütfen sonucu şu formatta JSON olarak dön:
      {
        "uyusmazliklar": [
          {"tarih": "...", "aciklama": "...", "tutar": "...", "sebep": "Bizde var müşteride yok / Tutar farklı / Müşteride var bizde yok"}
        ],
        "ozet": "Genel bir değerlendirme..."
      }
      Sadece JSON objesini döndür, başka açıklama yapma.
    `;

    // 4. Gemini API Çağrısı
    const safeModelName = aiModel ? aiModel.trim() : 'gemini-2.5-flash';
    const safeApiKey = apiKey ? apiKey.trim() : '';
    
    const geminiRes = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${safeModelName}:generateContent?key=${safeApiKey}`, {
      contents: [{ parts: [{ text: prompt }] }]
    }, { timeout: 30000 });

    const aiText = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    const aiResult = jsonMatch ? jsonMatch[0] : aiText;

    // 5. Sonucu Kaydet
    await client.execute({
      sql: 'UPDATE mutabakatlar SET ai_analiz_sonucu = ? WHERE id = ?',
      args: [aiResult, id]
    });

    res.json({ success: true, analysis: JSON.parse(aiResult) });
  } catch (e) {
    console.error("AI Analysis Error:", e.response?.data || e.message);
    const apiError = e.response?.data?.error?.message;
    res.status(500).json({ success: false, message: apiError ? `Gemini API Hatası: ${apiError}` : e.message });
  }
});

// ID-based download: reads from DB first, fallback to disk
router.get('/api/mutabakatlar/:id/download-muavin', authMiddleware, async (req, res) => {
  try {
    // Ensure new columns exist (safe migration on first access)
    try {
      const colInfo = await client.execute('PRAGMA table_info(mutabakatlar)');
      const cols = colInfo.rows.map(r => r.name);
      if (!cols.includes('karsi_muavin_data')) {
        await client.execute('ALTER TABLE mutabakatlar ADD COLUMN karsi_muavin_data TEXT');
      }
      if (!cols.includes('karsi_muavin_filename')) {
        await client.execute('ALTER TABLE mutabakatlar ADD COLUMN karsi_muavin_filename TEXT');
      }
      if (!cols.includes('kullanici_muavin_data')) {
        await client.execute('ALTER TABLE mutabakatlar ADD COLUMN kullanici_muavin_data TEXT');
      }
    } catch (_) { /* columns already exist */ }

    const rs = await client.execute({
      sql: 'SELECT id, karsi_muavin_data, karsi_muavin_filename, karsi_muavin_path FROM mutabakatlar WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    if (rs.rows.length === 0) return res.status(404).json({ success: false, message: 'Mutabakat bulunamadı.' });
    const m = rs.rows[0];

    if (m.karsi_muavin_data) {
      // Serve from DB
      const pureBase64 = String(m.karsi_muavin_data).replace(/^data:.*?;base64,/, '');
      const buffer = Buffer.from(pureBase64, 'base64');
      const fileName = m.karsi_muavin_filename || 'muavin.xlsx';
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    } else if (m.karsi_muavin_path) {
      // Legacy: serve from disk
      const filePath = path.join(uploadsDir, String(m.karsi_muavin_path));
      if (fs.existsSync(filePath)) return res.download(filePath, String(m.karsi_muavin_path));
    }
    res.status(404).json({ success: false, message: 'Muavin dosyası bulunamadı. Müşteri bu mutabakat için bir dosya yüklememiş olabilir.' });
  } catch (e) {
    console.error('download-muavin error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// ŞİRKET DOSYALARI (COMPANY FILES)
// ==========================================

// Get Folders

export default router;
