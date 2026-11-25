import express from 'express';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { client } from '../db.js';
import { authMiddleware, permissionMiddleware } from '../auth.js';
import { telegramBotService } from '../services/telegramBot.js';
import { evrenClient } from '../services/evrenClient.js';
import { parseBankStatementFile } from '../services/bankStatementParserService.js';
import { upload, uploadsDir, n } from '../utils/shared.js';

const router = express.Router();

router.get('/api/telegram/status', authMiddleware, async (req, res) => {
  try {
    const status = telegramBotService.getStatus();
    res.json({ success: true, ...status });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/api/telegram/settings', authMiddleware, async (req, res) => {
  try {
    const keys = ['telegram_bot_token', 'telegram_bot_enabled', 'telegram_allowed_chat_ids', 'telegram_target_mode'];
    const placeholders = keys.map(() => '?').join(',');
    const rs = await client.execute({
      sql: `SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN (${placeholders})`,
      args: [req.user.companyId, ...keys]
    });
    const settings = {
      telegram_bot_token: '',
      telegram_bot_enabled: 'false',
      telegram_allowed_chat_ids: '',
      telegram_target_mode: 'alis_faturasi'
    };
    rs.rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/api/telegram/settings', authMiddleware, async (req, res) => {
  try {
    const { token, enabled, allowedChatIds, targetMode } = req.body;
    const settings = {
      telegram_bot_token: token || '',
      telegram_bot_enabled: enabled ? 'true' : 'false',
      telegram_allowed_chat_ids: Array.isArray(allowedChatIds) ? allowedChatIds.join(',') : (allowedChatIds || ''),
      telegram_target_mode: targetMode || 'alis_faturasi'
    };

    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        await client.execute({
          sql: `INSERT INTO company_settings (company_id, setting_key, setting_value) VALUES (?, ?, ?)
                ON CONFLICT(company_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
          args: [req.user.companyId, key, value]
        });
      }
    }

    if (enabled && token) {
      const allowedArr = settings.telegram_allowed_chat_ids ? settings.telegram_allowed_chat_ids.split(',').map(s => s.trim()).filter(Boolean) : [];
      await telegramBotService.start(req.user.companyId, token, {
        allowedChatIds: allowedArr,
        targetMode: settings.telegram_target_mode
      });
    } else if (!enabled && telegramBotService.isRunning) {
      await telegramBotService.stop();
    }

    res.json({ success: true, message: 'Telegram ayarları güncellendi.' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/api/telegram/test', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token gereklidir.' });
    const botInfo = await telegramBotService.testToken(token);
    res.json({ success: true, botInfo });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

router.post('/api/telegram/toggle', authMiddleware, async (req, res) => {
  try {
    const { action } = req.body; // 'start' | 'stop'
    if (action === 'stop') {
      await telegramBotService.stop();
      await client.execute({
        sql: `INSERT INTO company_settings (company_id, setting_key, setting_value) VALUES (?, 'telegram_bot_enabled', 'false')
              ON CONFLICT(company_id, setting_key) DO UPDATE SET setting_value = 'false'`,
        args: [req.user.companyId]
      });
      return res.json({ success: true, message: 'Bot durduruldu.' });
    } else {
      const rs = await client.execute({
        sql: `SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN ('telegram_bot_token', 'telegram_allowed_chat_ids', 'telegram_target_mode')`,
        args: [req.user.companyId]
      });
      const map = {};
      rs.rows.forEach(r => { map[r.setting_key] = r.setting_value; });
      if (!map.telegram_bot_token) {
        return res.status(400).json({ success: false, message: 'Lütfen önce Telegram Bot Token kaydedin.' });
      }
      const allowedArr = map.telegram_allowed_chat_ids ? map.telegram_allowed_chat_ids.split(',').map(s => s.trim()).filter(Boolean) : [];
      await telegramBotService.start(req.user.companyId, map.telegram_bot_token, {
        allowedChatIds: allowedArr,
        targetMode: map.telegram_target_mode || 'alis_faturasi'
      });
      await client.execute({
        sql: `INSERT INTO company_settings (company_id, setting_key, setting_value) VALUES (?, 'telegram_bot_enabled', 'true')
              ON CONFLICT(company_id, setting_key) DO UPDATE SET setting_value = 'true'`,
        args: [req.user.companyId]
      });
      return res.json({ success: true, message: 'Bot başlatıldı.', botInfo: telegramBotService.botInfo });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// --- OTOMATIK FATURA TARAMA & SENKRONIZASYON (GIB / ELOGO / UYUMSOFT) ---
// ==========================================

router.get('/api/luca/hesap-plani', authMiddleware, async (req, res) => {
  console.log(`[Backend] Luca hesap planı isteği alındı. User: ${req.user.tc}`);
  try {
    const rs = await client.execute({
      sql: 'SELECT kod, ad, tur FROM luca_hesap_plani WHERE company_id = ? ORDER BY kod ASC',
      args: [req.user.companyId]
    });
    console.log(`[Backend] Bulunan hesap sayısı: ${rs.rows.length}`);
    res.json({ success: true, data: rs.rows || [] });
  } catch (e) { 
    console.error('[Backend] Luca Get Error:', e);
    res.status(500).json({ success: false, message: 'Veritabanı hatası: ' + e.message }); 
  }
});

router.post('/api/luca/hesap-plani/sync', authMiddleware, async (req, res) => {
  const { accounts } = req.body; // [{kod, ad, tur}, ...]
  if (!accounts || !Array.isArray(accounts)) return res.status(400).json({ success: false, message: 'Geçersiz veri formatı.' });

  try {
    // Mükerrer kayıtları temizle
    const uniqueMap = new Map();
    accounts.forEach(a => {
      const kod = (a.kod || '').trim();
      const ad = (a.ad || '').trim();
      if (kod && ad) {
        uniqueMap.set(kod, { kod, ad, tur: a.tur || '' });
      }
    });
    
    const uniqueAccounts = Array.from(uniqueMap.values());
    
    // Önce eski kayıtları sil, sonra yenilerini ekle (Tam Senkronizasyon)
    const statements = [
      {
        sql: 'DELETE FROM luca_hesap_plani WHERE company_id = ?',
        args: [req.user.companyId]
      },
      ...uniqueAccounts.map(a => ({
        sql: 'INSERT INTO luca_hesap_plani (company_id, kod, ad, tur) VALUES (?, ?, ?, ?)',
        args: [req.user.companyId, a.kod, a.ad, a.tur]
      }))
    ];

    await client.batch(statements, "write");
    console.log(`[Backend] Başarılı: ${uniqueAccounts.length} hesap Luca'dan senkronize edildi (Önceki kayıtlar silindi).`);
    res.json({ success: true, count: uniqueAccounts.length });
  } catch (e) {
    console.error('Luca Sync Error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// --- GENEL AYARLAR (Şirket Bazlı İzole) ---
router.get('/api/settings/:key', authMiddleware, async (req, res, next) => {
  if (req.params.key === 'smtp') return next(); // Skip 'smtp' to hit the specific route below if needed
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    const rs = await client.execute({
      sql: 'SELECT setting_value FROM company_settings WHERE company_id = ? AND setting_key = ? LIMIT 1',
      args: [req.user.companyId, req.params.key]
    });
    const val = rs.rows.length > 0 ? rs.rows[0].setting_value : null;

    res.json({ success: true, value: val });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});


// ============================================================
// --- AI ANALYZE PROXY (OPENAI, NVIDIA NIM & GEMINI CORS FIX) ---
// ============================================================
router.post(['/api/ai/analyze-invoice', '/api/ai/analyze-text'], authMiddleware, async (req, res) => {
  const { 
    fileBase64, 
    mimeType, 
    prompt, 
    provider: requestedProvider,
    evrenApiKey: bodyEvrenKey,
    evrenModel: bodyEvrenModel,
    openaiApiKey: bodyOpenaiKey,
    openaiModel: bodyOpenaiModel,
    xaiApiKey: bodyXaiKey,
    xaiModel: bodyXaiModel,
    nvidiaApiKey: bodyNvidiaKey,
    nvidiaModel: bodyNvidiaModel,
    geminiApiKey: bodyGeminiKey,
    geminiModel: bodyGeminiModel
  } = req.body;
  
  if (!fileBase64 && !prompt) {
    return res.status(400).json({ success: false, message: 'Analiz edilecek görsel veya metin/prompt verisi bulunamadı.' });
  }

  try {
    const getCompanySetting = async (key) => {
      const rs = await client.execute({
        sql: 'SELECT setting_value FROM company_settings WHERE company_id = ? AND setting_key = ? LIMIT 1',
        args: [req.user.companyId, key]
      }).catch(() => ({ rows: [] }));
      return rs.rows?.[0]?.setting_value || '';
    };

    const [provVal, oKeyVal, oModelVal, xKeyVal, xModelVal, nKeyVal, nModelVal, gKeyVal, gModelVal, eKeyVal, eModelVal] = await Promise.all([
      getCompanySetting('ai_provider'),
      getCompanySetting('openai_api_key'),
      getCompanySetting('openai_model'),
      getCompanySetting('xai_api_key'),
      getCompanySetting('xai_model'),
      getCompanySetting('nvidia_api_key'),
      getCompanySetting('nvidia_model'),
      getCompanySetting('gemini_api_key'),
      getCompanySetting('gemini_model'),
      getCompanySetting('evren_api_key'),
      getCompanySetting('evren_model'),
    ]);

    let activeProvider = requestedProvider || provVal || 'openai';
    const openaiApiKey = bodyOpenaiKey || oKeyVal || process.env.OPENAI_API_KEY || '';
    const openaiModel = bodyOpenaiModel || oModelVal || 'gpt-4o-mini';
    const xaiApiKey = bodyXaiKey || xKeyVal || process.env.XAI_API_KEY || '';
    const xaiModel = bodyXaiModel || xModelVal || 'grok-2-vision-1212';
    const nvidiaApiKey = bodyNvidiaKey || nKeyVal || process.env.NVIDIA_API_KEY || '';
    const nvidiaModel = bodyNvidiaModel || nModelVal || 'stepfun-ai/step-5-preview';
    const geminiApiKey = bodyGeminiKey || gKeyVal || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    const geminiModel = bodyGeminiModel || gModelVal || 'gemini-2.5-flash';
    const evrenApiKey = bodyEvrenKey || eKeyVal || process.env.EVREN_API_KEY || '';
    const evrenModel = bodyEvrenModel || eModelVal || 'dots-ocr';

    // Provider fallback
    if (activeProvider === 'evren' && !evrenApiKey) {
      if (openaiApiKey) activeProvider = 'openai';
      else if (xaiApiKey) activeProvider = 'grok';
      else if (geminiApiKey) activeProvider = 'gemini';
      else if (nvidiaApiKey) activeProvider = 'nvidia';
    } else if ((activeProvider === 'grok' || activeProvider === 'xai') && !xaiApiKey) {
      if (openaiApiKey) activeProvider = 'openai';
      else if (evrenApiKey) activeProvider = 'evren';
      else if (geminiApiKey) activeProvider = 'gemini';
      else if (nvidiaApiKey) activeProvider = 'nvidia';
    } else if (activeProvider === 'openai' && !openaiApiKey) {
      if (evrenApiKey) activeProvider = 'evren';
      else if (xaiApiKey) activeProvider = 'grok';
      else if (geminiApiKey) activeProvider = 'gemini';
      else if (nvidiaApiKey) activeProvider = 'nvidia';
    } else if (activeProvider === 'nvidia' && !nvidiaApiKey) {
      if (evrenApiKey) activeProvider = 'evren';
      else if (xaiApiKey) activeProvider = 'grok';
      else if (openaiApiKey) activeProvider = 'openai';
      else if (geminiApiKey) activeProvider = 'gemini';
    } else if (activeProvider === 'gemini' && !geminiApiKey) {
      if (evrenApiKey) activeProvider = 'evren';
      else if (xaiApiKey) activeProvider = 'grok';
      else if (openaiApiKey) activeProvider = 'openai';
      else if (nvidiaApiKey) activeProvider = 'nvidia';
    }

    let responseText = '';
    let usedProvider = activeProvider;

    const MALI_MUSAVIR_SYSTEM_PROMPT = `Sen Türkiye Cumhuriyeti Tekdüzen Hesap Planı'na, Türk Vergi Mevzuatı'na, KDV Kanunu'na ve mesleki muhasebe standartlarına üst düzeyde hâkim, son derece titiz, kıdemli ve uzman bir Serbest Muhasebeci Mali Müşavirsin (SMMM).

Temel Muhasebe İlkelerin ve Davranış Kuralların:
1. Çift Taraflı Kayıt ve Borç-Alacak Dengesi: Her muhasebe kaydında ve fişinde toplam borç tutarı ile toplam alacak tutarı kuruşu kuruşuna eşit olmalıdır. Dengesiz veya şüpheli işlem üretme.
2. Fatura ve Harcama Kayıtları:
   - KDV Gruplama Kuralı: Bir fiş veya faturadaki aynı KDV oranına sahip kalemler KESİNLİKLE ayrı ayrı satırlara bölünmemeli, aynı KDV oranındaki tüm tutarlar toplanarak tek bir kayıt olarak muhasebeleştirilmelidir. Farklı kayıt yalnızca fişte farklı KDV oranları (%1, %10, %20) varsa her oran grubu için 1 adet oluşturulmalıdır.
   - KRİTİK UYARI - "TOPKDV" (TOPLAM KDV) TUZAĞI: Perakende fişlerinin alt tarafındaki 'TOPKDV' veya 'TOPLAM KDV' tutarı, fişteki TÜM KDV oranlarının (%10 + %20) toplamıdır. KESİNLİKLE %20 grubunun tutarına veya KDV'sine bu TOPKDV tutarını yazma! Fişte %10 dökümü ve TOPKDV varsa; %20 grubu dahil tutarı = Genel Toplam - %10 Grubu Dahil Tutarı'dır! Sağlama: (%10 Dahil Tutarı) + (%20 Dahil Tutarı) == Fişin Genel Toplamına kuruşu kuruşuna eşit olmalıdır.
   - Şirket içi genel giderler, yemek (restoran/lokanta), akaryakıt, kırtasiye, konaklama, temizlik, ofis malzemesi vb. harcamalar KESİNLİKLE 7'li gider hesaplarına (770 Genel Yönetim Giderleri, 760 Pazarlama Satış Dağıtım, 740 Hizmet Üretim Maliyeti vb.) kaydedilir.
   - 150 İlk Madde ve Malzeme ile 153 Ticari Mallar hesapları SADECE satılmak amacıyla veya doğrudan üretimde kullanılmak üzere alınan ticari emtialar için kullanılır.
   - Alış faturalarında 191 İndirilecek KDV, satış faturalarında 391 Hesaplanan KDV kullanılır. Tevkifat (%2/10, %5/10, %9/10 vb.) ve Stopaj (%20, %10 vb.) oranları mevzuata uygun şekilde tespit edilmelidir.
   - Ödeme şekli (Kredi Kartı / Kasa 100 / Satıcı Cari Hesabı 320 / Müşteri Cari Hesabı 120) belge üzerindeki ibarelere göre doğru belirlenmelidir.
3. Banka Hareketleri Analizi ve Muhasebeleştirme:
   - Banka hareketleri 102 Bankalar hesabı merkezinde çalışır.
   - Müşteriden Tahsilat (Giriş/Alacak): Borç 102 Bankalar, Alacak 120 Alıcılar.
   - Tedarikçiye/Satıcıya Ödeme (Çıkış/Borç): Borç 320 Satıcılar, Alacak 102 Bankalar.
   - Banka Masrafı / POS Komisyonu / Hesap İşletim / EFT-Havale Ücreti / BSMV: Borç 770/780 İlgili Gider/Finansman Hesabı, Varsa Borç 191 İndirilecek KDV, Alacak 102 Bankalar.
   - Maaş/Avans Ödemeleri: Borç 335 Personele Borçlar, Alacak 102 Bankalar.
   - Vergi, Harç ve SGK Prim Ödemeleri: Borç 360 Ödenecek Vergi ve Fonlar / 361 Ödenecek Sosyal Güvenlik Kesintileri, Alacak 102 Bankalar.
   - Kredi Kartı / POS Tahsilatı: 108 Diğer Hazır Değerler / POS Hesabı.
4. Hesap Planı Uyumu:
   - Kullanıcının hesap planı (Luca Hesap Planı) sağlandığında, genel geçer ezbere kodlar vermek yerine işletmenin kendi hesap planındaki en uygun alt hesap kodunu (örn: 770.01.001, 102.01.002 vb.) seç.
   - Belirsiz veya yetersiz açıklamalarda mantıklı tahmin yap, gerekirse en uygun ana hesap grubunu öner.`;

    let lastProviderError = '';

    const runGrok = async () => {
      if (!xaiApiKey) return null;
      const imageUrl = fileBase64 ? (fileBase64.startsWith('data:') ? fileBase64 : `data:${mimeType || 'image/jpeg'};base64,${fileBase64}`) : null;
      const userContent = imageUrl 
        ? [
            { type: 'text', text: prompt + '\nÖNEMLİ: SADECE geçerli bir JSON formatında döndür. Açıklama metni veya ```json markdown bloğu ekleme.' },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        : prompt + '\nÖNEMLİ: SADECE geçerli bir JSON formatında döndür. Açıklama metni veya ```json markdown bloğu ekleme.';

      const candidateModels = Array.from(new Set([
        xaiModel,
        'grok-2-vision-1212'
      ].filter(Boolean))).slice(0, 2);

      for (const m of candidateModels) {
        try {
          const xRes = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${xaiApiKey}`
            },
            body: JSON.stringify({
              model: m,
              messages: [
                { role: 'system', content: MALI_MUSAVIR_SYSTEM_PROMPT },
                { role: 'user', content: userContent }
              ],
              max_tokens: 4096,
              temperature: 0.1
            }),
            signal: AbortSignal.timeout(22000)
          });
          const xData = await xRes.json();
          if (!xRes.ok) {
            const errMsg = xData.error?.message || `xAI/Grok HTTP ${xRes.status}`;
            lastProviderError = `Grok (${m}): ${errMsg}`;
            console.warn(`[Grok AI] ${m} hatası:`, errMsg);
            if (xRes.status === 401 || xRes.status === 403 || xRes.status === 429) break;
            continue;
          }
          const choice = xData.choices?.[0];
          let txt = choice?.message?.content || '';
          if (!txt && choice?.message?.reasoning_content) txt = choice.message.reasoning_content;
          if (txt) return txt;
        } catch (err) {
          lastProviderError = `Grok (${m}): ${err.message}`;
          console.warn(`[Grok AI] ${m} çağrısında hata:`, err.message);
        }
      }
      return null;
    };

    const runNvidia = async () => {
      if (!nvidiaApiKey) return null;
      const imageUrl = fileBase64 ? (fileBase64.startsWith('data:') ? fileBase64 : `data:${mimeType || 'image/jpeg'};base64,${fileBase64}`) : null;
      const userContent = imageUrl 
        ? [
            { type: 'text', text: prompt + '\nÖNEMLİ: SADECE geçerli bir JSON objesi döndür. Başka hiçbir açıklama yazma.' },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        : prompt + '\nÖNEMLİ: SADECE geçerli bir JSON objesi döndür. Başka hiçbir açıklama yazma.';
      
      const callTarget = async (m) => {
        const nvRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${nvidiaApiKey}`
          },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: 'system', content: MALI_MUSAVIR_SYSTEM_PROMPT },
              { role: 'user', content: userContent }
            ],
            max_tokens: 4096,
            temperature: 0.1
          }),
          signal: AbortSignal.timeout(22000)
        });
        const nvData = await nvRes.json();
        if (!nvRes.ok) {
          const errMsg = nvData.message || nvData.detail || nvData.error?.message || `NVIDIA HTTP ${nvRes.status}`;
          const err = new Error(errMsg);
          err.status = nvRes.status;
          throw err;
        }
        const choice = nvData.choices?.[0];
        let txt = choice?.message?.content || '';
        if (!txt && choice?.message?.reasoning_content) txt = choice.message.reasoning_content;
        return txt;
      };

      const candidateModels = Array.from(new Set([
        nvidiaModel,
        'meta/llama-3.2-11b-vision-instruct'
      ].filter(m => m && !m.includes('nemotron-parse') && !m.includes('phi-3-vision') && !m.includes('kimi-k3') && !m.includes('qwen2.5-vl-72b-instruct')))).slice(0, 2);

      for (const m of candidateModels) {
        try {
          const res = await callTarget(m);
          if (res) return res;
        } catch (err) {
          lastProviderError = `NVIDIA (${m}): ${err.message}`;
          console.warn(`[NVIDIA AI] ${m} çağrısında hata:`, err.message);
          if (err.status === 401 || err.status === 403 || err.status === 429) break;
        }
      }
      return null;
    };

    const runGemini = async () => {
      if (!geminiApiKey) return null;
      const parts = [{ text: prompt }];
      if (fileBase64) {
        const rawB64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
        parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: rawB64 } });
      }

      let safeModel = geminiModel;
      if (safeModel === 'gemini-3.8-flash' || safeModel === 'gemini-3.6-flash') safeModel = 'gemini-2.5-flash';
      const candidateModels = Array.from(new Set([
        safeModel,
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash'
      ].filter(Boolean))).slice(0, 2);

      for (const model of candidateModels) {
        try {
          const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: MALI_MUSAVIR_SYSTEM_PROMPT }]
              },
              contents: [{ parts }],
              generationConfig: { 
                responseMimeType: "application/json",
                maxOutputTokens: 4096,
                temperature: 0.1
              },
              safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
              ]
            }),
            signal: AbortSignal.timeout(22000)
          });

          const gData = await gRes.json();
          if (gData.error) {
            lastProviderError = `Gemini (${model}): ${gData.error.message}`;
            console.warn(`[Gemini AI] ${model} hatası:`, gData.error.message);
            if (gData.error.message?.includes('leaked') || gData.error.code === 400 || gData.error.code === 403 || gData.error.code === 429) {
              break;
            }
            continue;
          }

          const candidate = gData.candidates?.[0];
          const txt = candidate?.content?.parts?.[0]?.text || '';
          if (txt) return txt;
          if (candidate?.finishReason === 'SAFETY') {
            return JSON.stringify({ hata: 'Güvenlik filtresi (SAFETY) nedeniyle yapay zeka bu fişi okuyamadı.' });
          }
        } catch (fetchErr) {
          lastProviderError = `Gemini (${model}): ${fetchErr.message}`;
          console.warn(`[Gemini AI] ${model} fetch hatası:`, fetchErr.message);
        }
      }
      return null;
    };

    const runOpenAI = async () => {
      if (!openaiApiKey) return null;
      const imageUrl = fileBase64 ? (fileBase64.startsWith('data:') ? fileBase64 : `data:${mimeType || 'image/jpeg'};base64,${fileBase64}`) : null;
      const userContent = imageUrl 
        ? [
            { type: 'text', text: prompt + '\nÖNEMLİ: SADECE geçerli bir JSON formatında döndür. Açıklama metni veya ```json markdown bloğu ekleme.' },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        : prompt + '\nÖNEMLİ: SADECE geçerli bir JSON formatında döndür. Açıklama metni veya ```json markdown bloğu ekleme.';

      const candidateModels = Array.from(new Set([
        openaiModel,
        'gpt-4o-mini'
      ].filter(Boolean))).slice(0, 2);

      for (const m of candidateModels) {
        try {
          const oRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
              model: m,
              messages: [
                { role: 'system', content: MALI_MUSAVIR_SYSTEM_PROMPT },
                { role: 'user', content: userContent }
              ],
              max_tokens: 4096,
              temperature: 0.1
            }),
            signal: AbortSignal.timeout(22000)
          });
          const oData = await oRes.json();
          if (!oRes.ok) {
            const errMsg = oData.error?.message || `OpenAI HTTP ${oRes.status}`;
            lastProviderError = `OpenAI (${m}): ${errMsg}`;
            console.warn(`[OpenAI AI] ${m} hatası:`, errMsg);
            if (oRes.status === 401 || oRes.status === 403 || oRes.status === 429) break;
            continue;
          }
          const choice = oData.choices?.[0];
          let txt = choice?.message?.content || '';
          if (!txt && choice?.message?.reasoning_content) txt = choice.message.reasoning_content;
          if (txt) return txt;
        } catch (err) {
          lastProviderError = `OpenAI (${m}): ${err.message}`;
          console.warn(`[OpenAI AI] ${m} çağrısında hata:`, err.message);
        }
      }
      return null;
    };

    const runEvren = async () => {
      if (!evrenApiKey) return null;
      try {
        console.log(`[AI Proxy][EVREN] Analiz çağrılıyor... Model: ${evrenModel || 'dots-ocr'}`);
        const result = await evrenClient.analyzeDocument({
          imageBase64: fileBase64,
          mimeType: mimeType || 'image/jpeg',
          apiKey: evrenApiKey,
          model: evrenModel || 'dots-ocr',
          prompt: prompt,
          systemPrompt: MALI_MUSAVIR_SYSTEM_PROMPT
        });

        if (result) return result;
      } catch (err) {
        lastProviderError = `EVREN (${evrenModel || 'dots-ocr'}): ${err.message}`;
        console.warn('[AI Proxy][EVREN] Hata:', err.message);
      }
      return null;
    };

    // Sadece seçili sağlayıcıyı çalıştır (Zincirleme 5 sağlayıcı denemesi 60sn Nginx 504 Timeout hatasına yol açtığı için kaldırıldı)
    if (activeProvider === 'evren') {
      responseText = await runEvren();
    } else if (activeProvider === 'grok' || activeProvider === 'xai') {
      responseText = await runGrok();
    } else if (activeProvider === 'openai') {
      responseText = await runOpenAI();
    } else if (activeProvider === 'nvidia') {
      responseText = await runNvidia();
    } else {
      responseText = await runGemini();
    }

    if (!responseText) {
      if (!openaiApiKey && !nvidiaApiKey && !geminiApiKey && !evrenApiKey && !xaiApiKey) {
        return res.status(400).json({ success: false, message: 'Yapay zeka anahtarı bulunamadı. Lütfen Ayarlar sayfasından API anahtarınızı tanımlayın.' });
      }
      return res.status(500).json({
        success: false,
        message: lastProviderError || `Seçili yapay zeka sağlayıcısından (${activeProvider}) yanıt alınamadı. Lütfen API anahtarınızı veya model seçiminizi kontrol edin.`
      });
    }

    // Gelişmiş JSON Ayrıştırma ve Hata Ayıklama
    const extractJson = (raw) => {
      if (!raw || typeof raw !== 'string') return { hata: 'Yapay zekadan boş yanıt alındı.' };
      
      // 1. Düşünme bloklarını (<think>...</think>) temizle
      let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      // 2. Markdown kod bloklarını temizle
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      // 3. Doğrudan parse dene
      try {
        return JSON.parse(text);
      } catch (e1) {
        // 4. En dıştaki { ... } veya [ ... ] bloğunu bul
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          const candidate = text.substring(firstBrace, lastBrace + 1);
          try {
            return JSON.parse(candidate);
          } catch (e2) {
            // Trailing virgülleri düzelt (örn: { "a": 1, })
            try {
              const fixed = candidate.replace(/,\s*([}\]])/g, '$1');
              return JSON.parse(fixed);
            } catch (e3) {}
          }
        }

        const firstSquare = text.indexOf('[');
        const lastSquare = text.lastIndexOf(']');
        if (firstSquare !== -1 && lastSquare > firstSquare) {
          const candidate = text.substring(firstSquare, lastSquare + 1);
          try {
            return JSON.parse(candidate);
          } catch (e4) {
            try {
              const fixed = candidate.replace(/,\s*([}\]])/g, '$1');
              return JSON.parse(fixed);
            } catch (e5) {}
          }
        }

        // 5. Eğer model JSON yerine açıklayıcı bir metin döndürdüyse (örn. "Fiş çok silik okunamadı"):
        const cleanSnippet = text.replace(/\s+/g, ' ').trim();
        if (cleanSnippet.length > 5 && cleanSnippet.length < 250) {
          return { hata: cleanSnippet };
        }

        return { hata: 'Yapay zeka bu veriyi okuyamadı.' };
      }
    };

    const parsed = extractJson(responseText);
    res.json({ success: true, data: parsed, provider: usedProvider });
  } catch (err) {
    console.error('AI Analyze Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Yapay zeka analizi sırasında hata oluştu.' });
  }
});

router.post('/api/ai/parse-bank-statement', authMiddleware, async (req, res) => {
  try {
    const {
      fileBase64,
      fileName,
      mimeType,
      provider,
      evrenApiKey,
      evrenModel,
      openaiApiKey,
      openaiModel,
      xaiApiKey,
      xaiModel,
      nvidiaApiKey,
      nvidiaModel,
      geminiApiKey,
      geminiModel,
    } = req.body || {};

    const result = await parseBankStatementFile({
      companyId: req.user.companyId,
      fileBase64,
      fileName,
      mimeType,
      overrides: {
        provider,
        evrenApiKey,
        evrenModel,
        openaiApiKey,
        openaiModel,
        xaiApiKey,
        xaiModel,
        nvidiaApiKey,
        nvidiaModel,
        geminiApiKey,
        geminiModel,
      },
    });

    res.json({
      success: true,
      rows: result.rows,
      pageCount: result.pageCount,
      method: result.method,
      provider: result.provider,
    });
  } catch (err) {
    console.error('[ParseBankStatement] Hata:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Banka ekstresi ayrıştırılırken hata oluştu.',
    });
  }
});

router.post('/api/settings/:key', authMiddleware, async (req, res, next) => {
  if (req.params.key === 'smtp') return next();
  try {
    const val = req.body.value !== undefined && req.body.value !== null ? String(req.body.value) : '';
    await client.execute({
      sql: 'INSERT INTO company_settings (company_id, setting_key, setting_value) VALUES (?, ?, ?) ON CONFLICT(company_id, setting_key) DO UPDATE SET setting_value=excluded.setting_value',
      args: [req.user.companyId, req.params.key, val]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// --- SMTP AYARLARI & MAIL GÖNDERİMİ ---
router.get('/api/settings/smtp', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT setting_key, setting_value FROM company_settings WHERE company_id = ?',
      args: [req.user.companyId]
    });
    
    let settings = {};
    rs.rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json({ success: true, settings });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/settings/smtp', authMiddleware, async (req, res) => {
  const settings = req.body; // { smtp_host: '...', smtp_user: '...' } vb.
  try {
    const stmts = Object.keys(settings).map(key => ({
      sql: 'INSERT INTO company_settings (company_id, setting_key, setting_value) VALUES (?, ?, ?) ON CONFLICT(company_id, setting_key) DO UPDATE SET setting_value=excluded.setting_value',
      args: [req.user.companyId, key, settings[key]]
    }));
    if (stmts.length > 0) {
      await client.batch(stmts, "write");
    }
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ success: false, message: e.message }); }
});


router.get('/api/company/folders', authMiddleware, async (req, res) => {
  const { parentId } = req.query;
  try {
    let sql = 'SELECT * FROM company_folders WHERE company_id = ?';
    let args = [req.user.companyId || 1];
    
    if (parentId && parentId !== 'null' && parentId !== 'undefined') {
      sql += ' AND parent_id = ?';
      args.push(parentId);
    } else {
      sql += ' AND parent_id IS NULL';
    }
    
    sql += ' ORDER BY name ASC';
    const rs = await client.execute({ sql, args });
    res.json({ success: true, data: rs.rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Create Folder
router.post('/api/company/folders', authMiddleware, async (req, res) => {
  const { name, parentId } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Klasör adı zorunludur' });
  
  try {
    const rs = await client.execute({
      sql: 'INSERT INTO company_folders (company_id, parent_id, name) VALUES (?, ?, ?)',
      args: [req.user.companyId || 1, parentId || null, name || 'Adsız Klasör']
    });
    res.json({ success: true, id: rs.lastInsertRowid.toString() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Delete Folder
router.delete('/api/company/folders/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM company_folders WHERE id = ? AND company_id = ?',
      args: [req.params.id || null, req.user.companyId || 1]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Get Files
router.get('/api/company/files', authMiddleware, async (req, res) => {
  const { folderId } = req.query;
  try {
    let sql = 'SELECT id, company_id, folder_id, name, size, type, created_at FROM company_files WHERE company_id = ?';
    let args = [req.user.companyId || 1];
    
    if (folderId && folderId !== 'null' && folderId !== 'undefined') {
      sql += ' AND folder_id = ?';
      args.push(folderId);
    } else {
      sql += ' AND folder_id IS NULL';
    }
    
    sql += ' ORDER BY name ASC';
    const rs = await client.execute({ sql, args });
    res.json({ success: true, data: rs.rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Create File (Base64)
router.post('/api/company/files', authMiddleware, async (req, res) => {
  const { name, size, type, file_data, folderId } = req.body;
  if (!name || !file_data) return res.status(400).json({ success: false, message: 'Dosya adı ve içeriği zorunludur' });
  
  try {
    const rs = await client.execute({
      sql: 'INSERT INTO company_files (company_id, folder_id, name, size, type, file_data) VALUES (?, ?, ?, ?, ?, ?)',
      args: [req.user.companyId || 1, folderId || null, name || 'Adsız Dosya', size || 0, type || 'application/octet-stream', file_data]
    });
    res.json({ success: true, id: rs.lastInsertRowid.toString() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Delete File
router.delete('/api/company/files/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM company_files WHERE id = ? AND company_id = ?',
      args: [req.params.id || null, req.user.companyId || 1]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Download File (Get Base64)
router.get('/api/company/files/download/:id', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT file_data, name, type FROM company_files WHERE id = ? AND company_id = ?',
      args: [req.params.id || null, req.user.companyId || 1]
    });
    
    if (rs.rows.length === 0) return res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
    
    res.json({ 
      success: true, 
      file_data: rs.rows[0].file_data,
      name: rs.rows[0].name,
      type: rs.rows[0].type
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/api/download/:filename', (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(uploadsDir, fileName);
  if (fs.existsSync(filePath)) {
    res.download(filePath, fileName);
  } else {
    res.status(404).json({ success: false, message: 'Dosya bulunamadı.' });
  }
});

// --- VERCEL CRON: OTOMATİK FATURA SENKRONİZASYONU ---

router.get('/api/yapay-zeka-kurallari', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM yapay_zeka_kurallari WHERE company_id = ? ORDER BY olusturma_tarihi DESC',
      args: [req.user.companyId]
    });
    res.json({ success: true, kurallar: rs.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/api/yapay-zeka-kurallari', authMiddleware, async (req, res) => {
  try {
    const { kural_tipi, kural_adi, anahtar_kelime, muhasebe_kodu, upsert } = req.body;
    
    const checkResult = await client.execute({
      sql: 'SELECT id, muhasebe_kodu FROM yapay_zeka_kurallari WHERE company_id = ? AND kural_tipi = ? AND LOWER(anahtar_kelime) = LOWER(?)',
      args: [req.user.companyId, n(kural_tipi), n(anahtar_kelime)]
    });

    if (checkResult.rows && checkResult.rows.length > 0) {
      const existing = checkResult.rows[0];
      if (upsert && muhasebe_kodu && existing.muhasebe_kodu !== muhasebe_kodu) {
        await client.execute({
          sql: 'UPDATE yapay_zeka_kurallari SET muhasebe_kodu = ?, kural_adi = COALESCE(?, kural_adi) WHERE id = ? AND company_id = ?',
          args: [n(muhasebe_kodu), n(kural_adi), existing.id, req.user.companyId]
        });
        return res.json({ success: true, message: 'Tedarikçi muhasebe kuralı güncellendi.', id: existing.id, updated: true });
      }
      return res.json({ success: true, message: 'Bu anahtar kelime için zaten bir kural var, atlandı.', id: existing.id, skipped: true });
    }

    const id = uuidv4();
    await client.execute({
      sql: 'INSERT INTO yapay_zeka_kurallari (id, company_id, kural_tipi, kural_adi, anahtar_kelime, muhasebe_kodu) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, req.user.companyId, n(kural_tipi), n(kural_adi) || n(anahtar_kelime), n(anahtar_kelime), n(muhasebe_kodu)]
    });
    res.json({ success: true, message: 'Kural eklendi', id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/api/yapay-zeka-kurallari/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM yapay_zeka_kurallari WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true, message: 'Kural silindi' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// YAPAY ZEKA ÖĞRENME ENDPOINTI
router.post('/api/ai/learn', authMiddleware, async (req, res) => {
  try {
    const { muavinBase64, muavinFileName, faturalarBase64, faturalarFileName, kuralTipi } = req.body;
    
    // AI API Keys
    const rsSettings = await client.execute({
      sql: "SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN ('gemini_api_key', 'gemini_model')",
      args: [req.user.companyId]
    });
    
    let apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);
    let aiModel = 'gemini-2.5-flash'; // Better for large context
    
    rsSettings.rows.forEach(r => {
      if (r.setting_key === 'gemini_api_key') apiKey = r.setting_value || apiKey;
      if (r.setting_key === 'gemini_model' && r.setting_value) aiModel = r.setting_value;
    });

    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Yapay zeka anahtarı (Gemini API Key) bulunamadı. Lütfen ayarlardan tanımlayın.' });
    }

    const decodePayload = (b64) => {
      if (!b64) return 'Veri Yok';
      try {
        if (b64.startsWith('data:application/json;base64,')) {
          return Buffer.from(b64.split(',')[1], 'base64').toString('utf8');
        }
        return Buffer.from(b64, 'base64').toString('utf8');
      } catch (e) {
        return b64.substring(0, 5000) + '... (Decode Hatası)';
      }
    };

    const muavinText = decodePayload(muavinBase64).substring(0, 500000);
    const faturalarText = decodePayload(faturalarBase64).substring(0, 500000);

    // Here we construct a prompt and attach the data
    const kuralOzelTalimat = kuralTipi === 'fatura' 
      ? "ÖNEMLİ: Şuan FATURA/FİŞ kuralları oluşturuyorsun. Lütfen muavin defterdeki banka para transferlerini (EFT, Havale, 102 banka hesapları) KURAL OLARAK ÖNERME. Onun yerine satıcı firma ünvanlarına, masraf kalemlerine ve alış/satış faturalarına odaklan."
      : "ÖNEMLİ: Şuan BANKA kuralları oluşturuyorsun. Lütfen sadece banka hesap özetindeki veya muavindeki banka hareketleri, POS işlemleri, komisyonlar ve para transferleri için kurallar oluştur.";

    const prompt = `Sen kıdemli bir mali müşavir ve yapay zeka veri analistisin. Sana bir firmanın geçmiş dönem "Muavin Defter" dökümü ve dış veri kaynağını (Fatura Listesi veya Banka Ekstresi) vereceğim.
Amacın, geçmiş işlemlere bakarak deterministik muhasebe kodu atama kuralları çıkarmaktır.

Verilen kural tipi: ${kuralTipi} (fatura veya banka)
${kuralOzelTalimat}

ÇIKTI FORMATI:
Sadece ve sadece JSON dizisi döndür. Başka hiçbir açıklama, yorum veya kod bloğu işareti (\`\`\`) yazma.
Örnek Çıktı:
[
  { "anahtar_kelime": "YEMEKSEPETİ", "muhasebe_kodu": "770.01.001", "kural_adi": "Yemek Giderleri" },
  { "anahtar_kelime": "GARANTİ EFT", "muhasebe_kodu": "102.01", "kural_adi": "Banka Hareketi" }
]

KURALLAR:
1. Kurallar mantıklı ve spesifik olmalıdır. "A.Ş." veya "LTD" gibi çok genel kelimeler kullanma. Daha belirleyici firma veya işlem adları seç.
2. Eşleşme bulduğun tüm anlamlı işlemleri kural olarak ekle. Sınır yok! Ne kadar çok doğru kural çıkarırsan o kadar iyi.

VERİLER:
Muavin Verisi:
${muavinText}

Dış Veri:
${faturalarText}
`;

    const safeModelName = aiModel.trim();
    
    const geminiRes = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${safeModelName}:generateContent?key=${apiKey.trim()}`, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 }
    });

    const aiText = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const jsonMatch = aiText.match(/\[[\s\S]*\]/);
    let rules = [];
    if (jsonMatch) {
      try {
        rules = JSON.parse(jsonMatch[0]);
      } catch(e) {}
    }

    res.json({ success: true, rules });

  } catch (error) {
    console.error("AI Learn Error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
