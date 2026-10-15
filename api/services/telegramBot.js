import { client } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { saveBase64File } from './fileStorage.js';

/**
 * Telegram Bot Service
 * Fiş & Fatura fotoğraflarını Telegram üzerinden alıp
 * yapay zeka (Gemini / NVIDIA NIM) ile işleyerek muhasebe sistemine aktarır.
 */
class TelegramBotService {
  constructor() {
    this.isRunning = false;
    this.botInfo = null;
    this.token = null;
    this.companyId = null;
    this.allowedChatIds = [];
    this.targetMode = 'alis_faturasi'; // 'alis_faturasi' | 'personel_masraf'
    this.logs = [];
    this.lastError = null;
    this.abortController = null;
    this.pollingPromise = null;
    this.queue = [];
    this.isProcessingQueue = false;
  }

  addLog(type, message) {
    const entry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      type, // 'info' | 'success' | 'warn' | 'error'
      message
    };
    this.logs.unshift(entry);
    if (this.logs.length > 50) this.logs.pop();
    console.log(`[TelegramBot][${type.toUpperCase()}] ${message}`);
  }

  async testToken(token) {
    if (!token) throw new Error('Token boş olamaz.');
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.description || 'Telegram token geçersiz.');
    }
    return data.result;
  }

  async sendMessage(chatId, text, extra = {}) {
    if (!this.token) return;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          ...extra
        })
      });
      return await res.json();
    } catch (e) {
      console.error('[TelegramBot] Mesaj gönderme hatası:', e.message);
    }
  }

  async broadcast(text, extra = {}) {
    if (!this.token) return;
    const targets = Array.isArray(this.allowedChatIds) && this.allowedChatIds.length > 0 ? this.allowedChatIds : [];
    for (const chatId of targets) {
      await this.sendMessage(chatId, text, extra).catch(e => console.warn('[TelegramBot] Broadcast failed for', chatId, e.message));
    }
  }

  async editMessageText(chatId, messageId, text, extra = {}) {
    if (!this.token) return;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: 'Markdown',
          ...extra
        })
      });
      return await res.json();
    } catch (e) {
      console.error('[TelegramBot] Mesaj düzenleme hatası:', e.message);
    }
  }

  async setMessageReaction(chatId, messageId, emoji = '👍') {
    if (!this.token || !messageId) return;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/setMessageReaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reaction: [{ type: 'emoji', emoji }]
        })
      });
      return await res.json();
    } catch (e) {
      console.warn('[TelegramBot] Reaction eklenemedi:', e.message);
    }
  }

  async getFileBuffer(fileId) {
    // 1. File path al
    const res = await fetch(`https://api.telegram.org/bot${this.token}/getFile?file_id=${fileId}`);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Telegram dosya bilgisi alınamadı (HTTP ${res.status}): ${errText}`);
    }
    const data = await res.json();
    if (!data.ok || !data.result?.file_path) {
      throw new Error(data.description || 'Dosya bilgisi alınamadı.');
    }

    const filePath = data.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${this.token}/${filePath}`;

    // 2. İndir
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) throw new Error('Dosya indirilemedi: ' + fileRes.statusText);

    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = filePath.endsWith('.png') ? 'image/png' : filePath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';

    return { buffer, mimeType, filePath };
  }

  async start(companyId, token, options = {}) {
    if (this.isRunning) {
      await this.stop();
    }

    this.token = token.trim();
    this.companyId = companyId;
    this.allowedChatIds = options.allowedChatIds || [];
    this.targetMode = options.targetMode || 'alis_faturasi';
    this.lastError = null;

    try {
      const info = await this.testToken(this.token);
      this.botInfo = info;
      this.isRunning = true;
      this.abortController = new AbortController();
      this.addLog('success', `Bot başlatıldı: @${info.username} (${info.first_name})`);

      // Polling döngüsünü arka planda başlat
      this.pollingPromise = this._pollLoop();
      return { success: true, botInfo: this.botInfo };
    } catch (err) {
      this.isRunning = false;
      this.lastError = err.message;
      this.addLog('error', `Bot başlatılamadı: ${err.message}`);
      throw err;
    }
  }

  async stop() {
    if (!this.isRunning) return { success: true, message: 'Bot zaten çalışmıyor.' };
    this.isRunning = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.addLog('info', 'Bot durduruldu.');
    return { success: true };
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      botInfo: this.botInfo,
      targetMode: this.targetMode,
      allowedChatIds: this.allowedChatIds,
      lastError: this.lastError,
      logs: this.logs.slice(0, 30)
    };
  }

  async _pollLoop() {
    let offset = 0;
    while (this.isRunning) {
      try {
        const signal = this.abortController?.signal;
        const res = await fetch(`https://api.telegram.org/bot${this.token}/getUpdates?offset=${offset}&timeout=25`, {
          signal
        });

        if (!res.ok) {
          throw new Error(`Telegram API HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!data.ok) {
          throw new Error(data.description || 'Updates alınamadı');
        }

        const updates = data.result || [];
        for (const update of updates) {
          offset = update.update_id + 1;
          await this._handleUpdate(update).catch(err => {
            console.error('[TelegramBot] Update işleme hatası:', err);
          });
        }
      } catch (err) {
        if (!this.isRunning) break;
        if (err.name === 'AbortError') break;
        console.warn('[TelegramBot] Polling döngüsü hatası:', err.message);
        this.addLog('warn', `Bağlantı kesildi, 3 sn sonra tekrar deneniyor: ${err.message}`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  async _handleUpdate(update) {
    const message = update.message;
    if (!message) return;

    const chatId = message.chat?.id;
    const fromUser = message.from?.username ? `@${message.from.username}` : (message.from?.first_name || 'Bilinmeyen');
    const text = message.text?.trim() || message.caption?.trim() || '';

    // Yetki kontrolü (Eğer allowedChatIds tanımlı ise)
    if (this.allowedChatIds && this.allowedChatIds.length > 0) {
      const strChatId = String(chatId);
      const isAllowed = this.allowedChatIds.some(id => String(id).trim() === strChatId);
      if (!isAllowed) {
        this.addLog('warn', `Yetkisiz erişim denemesi: Chat ID ${chatId} (${fromUser})`);
        await this.sendMessage(chatId, `⛔ *Yetkisiz Erişim*\n\nBu bot şirket içi kullanım içindir.\nChat ID'niz: \`${chatId}\`\nLütfen yöneticinizden bu ID'yi yetkili listesine eklemesini isteyin.`);
        return;
      }
    }

    // Komutlar
    if (text.startsWith('/start')) {
      const welcomeMsg = 
`👋 *Merhaba ${fromUser}!*

Ben *Fatura Takip v2* Akıllı Fiş ve Fatura Asistanıyım. 🧾⚡

📸 *Nasıl Kullanılır?*
1. Harcama fişinizin veya faturanızın fotoğrafını doğrudan bana gönderin.
2. Yapay zeka saniyeler içinde fişi okuyup;
   • Firma Adı
   • Fiş Tarihi & No
   • Tutar & KDV oranını
   ayrıştırarak muhasebe sisteminize otomatik kaydeder!

⚙️ *Bilgileriniz:*
• Chat ID: \`${chatId}\`
• Durum: *Aktif & Dinleniyor*`;
      await this.sendMessage(chatId, welcomeMsg);
      return;
    }

    if (text.startsWith('/chatid')) {
      await this.sendMessage(chatId, `🆔 Sizin Chat ID'niz: \`${chatId}\``);
      return;
    }

    if (text.startsWith('/durum')) {
      try {
        const countRs = await client.execute({
          sql: "SELECT COUNT(*) as cnt, COALESCE(SUM(toplam_tutar), 0) as total FROM alis_faturalari WHERE company_id = ? AND odeme_dekontu_adi = 'telegram_bot'",
          args: [this.companyId]
        });
        const cnt = countRs.rows[0]?.cnt || 0;
        const total = parseFloat(countRs.rows[0]?.total || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
        await this.sendMessage(chatId, `📊 *Telegram Bot İstatistikleri*\n\n🤖 Bot ile kaydedilen fişler:\n• Toplam Adet: *${cnt}* adet\n• Toplam Tutar: *${total} ₺*`);
      } catch (e) {
        await this.sendMessage(chatId, `📊 Bot aktif ve hazır durumdadır.`);
      }
      return;
    }

    // Fotoğraf veya Görsel Belge Kontrolü
    const hasPhoto = message.photo && message.photo.length > 0;
    const hasDoc = message.document && (message.document.mime_type?.startsWith('image/') || message.document.mime_type === 'application/pdf');

    if (!hasPhoto && !hasDoc) {
      if (text && !text.startsWith('/')) {
        await this.sendMessage(chatId, `💡 *İpucu:* Lütfen okutmak istediğiniz fiş veya faturanın *fotoğrafını* gönderin.`, { reply_to_message_id: message.message_id });
      }
      return;
    }

    // En yüksek çözünürlüklü fotoğrafı veya belgeyi al
    let fileId;
    if (hasPhoto) {
      fileId = message.photo[message.photo.length - 1].file_id;
    } else {
      fileId = message.document.file_id;
    }

    const task = {
      chatId,
      messageId: message.message_id,
      fileId,
      fromUser
    };

    this.queue.push(task);
    const queuePos = this.queue.length;

    this.addLog('info', `Yeni fiş kuyruğa eklendi: Chat ${chatId} (${fromUser}), Kuyruk boyutu: ${queuePos}`);

    // Eğer arka planda işlem yapılıyorsa veya sırada başka fişler varsa kullanıcıyı bilgilendir
    if (this.isProcessingQueue || queuePos > 1) {
      await this.sendMessage(
        chatId, 
        `📥 *Fiş işlem sırasına alındı!* (Kuyruktaki Sıranız: #${queuePos})`, 
        { reply_to_message_id: message.message_id }
      );
    }

    // Kuyruk çalışmıyorsa başlat
    this._processQueue();
  }

  async _processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.queue.length > 0) {
      const currentTask = this.queue.shift();
      try {
        await this._processReceiptTask(currentTask);
      } catch (err) {
        console.error('[TelegramBot] Kuyruk işleme hatası:', err);
      }
    }

    this.isProcessingQueue = false;
  }

  async _processReceiptTask({ chatId, messageId, fileId, fromUser }) {
    // Bekleme bildirimi gönder (doğrudan o fotoğrafa yanıt olarak)
    const waitMsg = await this.sendMessage(
      chatId, 
      `⏳ *Fiş görseli inceleniyor...* Yapay zeka taranıyor, lütfen bekleyin.`,
      { reply_to_message_id: messageId }
    );
    const waitMsgId = waitMsg?.result?.message_id;

    try {
      const { buffer, mimeType } = await this.getFileBuffer(fileId);
      const base64Data = buffer.toString('base64');

      // AI ile Analiz Et
      const aiResult = await this._analyzeReceiptWithAI(base64Data, mimeType);

      if (aiResult.hata || !aiResult.faturalar || aiResult.faturalar.length === 0) {
        const errMsg = aiResult.hata || 'Görselden fatura veya fiş bilgisi okunamadı. Lütfen fişin düzgün, net ve ışıklı bir ortamda çekildiğinden emin olun.';
        this.addLog('warn', `Fiş okunamadı: ${errMsg}`);
        
        // Hatalı/okunamayan görsele 👎 işareti koy
        await this.setMessageReaction(chatId, messageId, '👎');

        if (waitMsgId) {
          await this.editMessageText(chatId, waitMsgId, `⚠️ *Fiş Okunamadı!*\n\n${errMsg}\n\nLütfen tekrar deneyiniz.`);
        } else {
          await this.sendMessage(chatId, `⚠️ *Fiş Okunamadı!*\n\n${errMsg}`, { reply_to_message_id: messageId });
        }
        return;
      }

      // Başarılı: Fişleri Veritabanına Kaydet
      const savedList = [];
      for (const item of aiResult.faturalar) {
        const saved = await this._saveInvoiceToDatabase(item, base64Data, fromUser);
        savedList.push(saved);
      }

      // 🎯 GÖRSELE İŞARET KOY: Telegram'da kullanıcı fotoğrafının üzerine 👍 tepkisi ekle!
      await this.setMessageReaction(chatId, messageId, '👍');

      // Telegram kullanıcıya güzel bir özet dön (o fotoğrafa bağlı olarak)
      const first = savedList[0];
      const countNote = savedList.length > 1 ? `\n📑 *Toplam Kalem:* ${savedList.length} adet fatura/KDV kalemi çıkarıldı.` : '';
      const summaryText = 
`✅ *Fiş Başarıyla Sisteme Kaydedildi!* 🧾

🏢 *Satıcı / Firma:* ${first.tedarikciAdi || 'Bilinmiyor'}
🧾 *Belge / Fiş No:* \`${first.faturaNo || 'YOK'}\`
📅 *Tarih:* ${first.faturaTarihi || new Date().toISOString().split('T')[0]}
💰 *Toplam Tutar:* *${parseFloat(first.toplamTutar || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺*
📊 *KDV Oranı:* %${first.kdvOrani || 0} (${parseFloat(first.kdvTutari || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺)
🏷️ *Gider Türü:* ${first.malHizmetAdi || 'Genel Harcama'}${countNote}
${first.plate ? `🚗 *Plaka:* \`${first.plate}\`\n` : ''}${first.odemeSekli ? `💳 *Ödeme:* ${first.odemeSekli}\n` : ''}
📂 *Durum:* Alış Faturaları modülüne eklendi.`;

      this.addLog('success', `Fiş kaydedildi: ${first.tedarikciAdi} - ${first.toplamTutar} TL (${fromUser})`);

      if (waitMsgId) {
        await this.editMessageText(chatId, waitMsgId, summaryText);
      } else {
        await this.sendMessage(chatId, summaryText, { reply_to_message_id: messageId });
      }

    } catch (err) {
      console.error('[TelegramBot] Evrak işleme hatası:', err);
      this.addLog('error', `Evrak işlenirken hata: ${err.message}`);
      await this.setMessageReaction(chatId, messageId, '👎');
      if (waitMsgId) {
        await this.editMessageText(chatId, waitMsgId, `❌ *İşlem Hatası:*\n${err.message}`);
      } else {
        await this.sendMessage(chatId, `❌ *İşlem Hatası:*\n${err.message}`, { reply_to_message_id: messageId });
      }
    }
  }

  async _analyzeReceiptWithAI(base64Data, mimeType) {
    const compId = this.companyId || 1;
    // Mutabakat Yönetimi veya Şirket AI ayarlarını veritabanından al
    const [provRs, nKeyRs, nModelRs, gKeyRs, gModelRs] = await Promise.all([
      client.execute({ sql: 'SELECT setting_value FROM company_settings WHERE (company_id = ? OR company_id = 1) AND setting_key = ? ORDER BY company_id DESC LIMIT 1', args: [compId, 'ai_provider'] }).catch(() => ({ rows: [] })),
      client.execute({ sql: 'SELECT setting_value FROM company_settings WHERE (company_id = ? OR company_id = 1) AND setting_key = ? ORDER BY company_id DESC LIMIT 1', args: [compId, 'nvidia_api_key'] }).catch(() => ({ rows: [] })),
      client.execute({ sql: 'SELECT setting_value FROM company_settings WHERE (company_id = ? OR company_id = 1) AND setting_key = ? ORDER BY company_id DESC LIMIT 1', args: [compId, 'nvidia_model'] }).catch(() => ({ rows: [] })),
      client.execute({ sql: 'SELECT setting_value FROM company_settings WHERE (company_id = ? OR company_id = 1) AND setting_key = ? ORDER BY company_id DESC LIMIT 1', args: [compId, 'gemini_api_key'] }).catch(() => ({ rows: [] })),
      client.execute({ sql: 'SELECT setting_value FROM company_settings WHERE (company_id = ? OR company_id = 1) AND setting_key = ? ORDER BY company_id DESC LIMIT 1', args: [compId, 'gemini_model'] }).catch(() => ({ rows: [] })),
    ]);

    const activeProvider = provRs.rows?.[0]?.setting_value || 'gemini';
    const nvidiaApiKey = nKeyRs.rows?.[0]?.setting_value || process.env.NVIDIA_API_KEY || '';
    const nvidiaModel = nModelRs.rows?.[0]?.setting_value || 'meta/llama-3.2-11b-vision-instruct';
    const geminiApiKey = gKeyRs.rows?.[0]?.setting_value || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    const geminiModel = gModelRs.rows?.[0]?.setting_value || 'gemini-3.8-flash';

    console.log(`[TelegramBot][AI] Aktif Sağlayıcı: ${activeProvider.toUpperCase()} | Model: ${activeProvider === 'nvidia' ? nvidiaModel : geminiModel}`);

    const prompt = `Sen uzman bir muhasebe fiş ve fatura okuma asistanısın. Görseldeki fiş veya faturayı analiz et ve SADECE aşağıdaki JSON formatında çıktı ver.
KURAL: Eğer birden fazla KDV oranı varsa, her bir KDV oranını ayrı bir obje olarak diziye ekle.
KURAL: Akaryakıt fişi ise plakayı 'plate' alanına yaz. Kredi kartı ile ödenmişse 'odeme_sekli': 'KREDI_KARTI' yap.

Format:
{
  "faturalar": [
    {
      "tedarikciAdi": "firma adı",
      "tedarikciVkn": "VKN veya TCKN",
      "faturaNo": "fiş/belge no",
      "malHizmetAdi": "harcama açıklaması (market, akaryakıt vb.)",
      "faturaTarihi": "YYYY-MM-DD",
      "tutar": "150.00",
      "kdv_orani": "20",
      "plate": "",
      "odeme_sekli": "NAKIT veya KREDI_KARTI"
    }
  ]
}
Eğer belge okunamıyorsa: {"hata": "Belge okunamadı"}`;

    let responseText = '';

    if (activeProvider === 'nvidia' && nvidiaApiKey) {
      const imageUrl = `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;
      
      const callNvidia = async (targetModel) => {
        try {
          const nvRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${nvidiaApiKey}`
            },
            body: JSON.stringify({
              model: targetModel,
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: imageUrl } }
                ]
              }],
              max_tokens: 4096,
              temperature: 0.1
            })
          });

          if (!nvRes.ok) {
            const errBody = await nvRes.text().catch(() => '');
            console.warn(`[TelegramBot][NVIDIA] ${targetModel} HTTP ${nvRes.status}:`, errBody);
            return '';
          }

          const nvData = await nvRes.json();
          const choice = nvData.choices?.[0];
          return choice?.message?.content || choice?.message?.reasoning_content || '';
        } catch (e) {
          console.warn(`[TelegramBot][NVIDIA] ${targetModel} çağrı hatası:`, e.message);
          return '';
        }
      };

      // 1. Kullanıcının seçtiği NVIDIA modelini dene
      const safeNvidiaModel = nvidiaModel && nvidiaModel !== 'qwen/qwen2.5-vl-72b-instruct' 
        ? nvidiaModel 
        : 'meta/llama-3.2-11b-vision-instruct';

      responseText = await callNvidia(safeNvidiaModel);

      // 2. Eğer ilk model boş döndüyse veya hata verdiyse güvenilir Meta Llama 3.2 Vision'ı dene
      if (!responseText && safeNvidiaModel !== 'meta/llama-3.2-11b-vision-instruct') {
        console.warn(`[TelegramBot][NVIDIA] ${safeNvidiaModel} başarısız oldu, meta/llama-3.2-11b-vision-instruct deneniyor...`);
        responseText = await callNvidia('meta/llama-3.2-11b-vision-instruct');
      }
    }
    
    // Eğer NVIDIA yanıt vermezse veya sağlayıcı Gemini ise Gemini ile çalış
    if (!responseText && geminiApiKey) {
      try {
        const safeGeminiModel = geminiModel && geminiModel.startsWith('gemini') ? geminiModel : 'gemini-2.5-flash';
        const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${safeGeminiModel}:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64Data } }
              ]
            }],
            generationConfig: {
              responseMimeType: 'application/json',
              maxOutputTokens: 2048,
              temperature: 0.1
            }
          })
        });

        if (gRes.ok) {
          const gData = await gRes.json();
          responseText = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else {
          const gErr = await gRes.text().catch(() => '');
          console.warn(`[TelegramBot][Gemini] HTTP ${gRes.status}:`, gErr);
        }
      } catch (gCatchErr) {
        console.warn('[TelegramBot][Gemini] İstek hatası:', gCatchErr.message);
      }
    }

    if (!responseText) {
      throw new Error('Sistemde tanımlı aktif bir Yapay Zeka (Gemini veya NVIDIA) API anahtarı bulunamadı veya model yanıt vermedi.');
    }

    // JSON Temizle ve Güvenli Parse Et
    if (!responseText || typeof responseText !== 'string') {
      throw new Error('Yapay zeka boş yanıt döndürdü.');
    }

    let clean = responseText
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .trim();

    // 1. Doğrudan parse etmeyi dene
    try {
      const parsed = JSON.parse(clean);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed)) return { faturalar: parsed };
        return parsed;
      }
    } catch (e) {}

    // 2. "faturalar" anahtarını içeren en uygun bloğu bul
    const faturalarIdx = clean.indexOf('"faturalar"');
    if (faturalarIdx !== -1) {
      const start = clean.lastIndexOf('{', faturalarIdx);
      const end = clean.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          const parsed = JSON.parse(clean.substring(start, end + 1));
          if (parsed && typeof parsed === 'object') return parsed;
        } catch (err) {}
      }
    }

    // 3. "hata" anahtarını içeren bloğu dene
    const hataIdx = clean.indexOf('"hata"');
    if (hataIdx !== -1) {
      const start = clean.lastIndexOf('{', hataIdx);
      const end = clean.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(clean.substring(start, end + 1));
        } catch (err) {}
      }
    }

    // 4. İlk { ile son } arasındaki en geniş bloğu dene
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = clean.substring(firstBrace, lastBrace + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (err) {
        try {
          const fixed = candidate.replace(/,\s*([}\]])/g, '$1');
          const parsed = JSON.parse(fixed);
          if (parsed && typeof parsed === 'object') return parsed;
        } catch (err2) {}
      }
    }

    // 5. İlk [ ile son ] arasındaki dizi bloğunu dene
    const firstSquare = clean.indexOf('[');
    const lastSquare = clean.lastIndexOf(']');
    if (firstSquare !== -1 && lastSquare > firstSquare) {
      const candidate = clean.substring(firstSquare, lastSquare + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed)) return { faturalar: parsed };
      } catch (err) {
        try {
          const fixed = candidate.replace(/,\s*([}\]])/g, '$1');
          const parsed = JSON.parse(fixed);
          if (Array.isArray(parsed)) return { faturalar: parsed };
        } catch (err2) {}
      }
    }

    console.error('[TelegramBot][AI Parse Error] Ham yanıt:', responseText);
    throw new Error('Yapay zeka yanıtı geçerli JSON formatında değil.');
  }

  async _saveInvoiceToDatabase(item, base64Data, senderInfo) {
    const compId = this.companyId || 1;
    const tutar = parseFloat(String(item.tutar || '0').replace(',', '.')) || 0;
    const kdvOrani = parseFloat(String(item.kdv_orani || '20')) || 0;
    const matrah = Math.round((tutar / (1 + kdvOrani / 100)) * 100) / 100;
    const kdvTutari = Math.round((tutar - matrah) * 100) / 100;
    const faturaId = 'a_tg_' + Date.now().toString() + Math.random().toString(36).substr(2, 4);
    const faturaTarihi = item.faturaTarihi || new Date().toISOString().split('T')[0];
    const faturaNo = item.faturaNo || 'TG-' + Date.now().toString().slice(-6);

    let kdv1 = 0, kdv10 = 0, kdv20 = 0;
    if (kdvOrani === 1) kdv1 = kdvTutari;
    else if (kdvOrani === 10) kdv10 = kdvTutari;
    else kdv20 = kdvTutari;

    // Alış faturası olarak ekle
    await client.execute({
      sql: `INSERT INTO alis_faturalari (
        id, fatura_no, fatura_tarihi, tedarikci_adi, tedarikci_vkn, mal_hizmet_adi,
        toplam_tutar, kdv_orani, kdv_tutari, matrah, tevkifat_orani, tevkifat_tutari,
        stopaj_orani, stopaj_tutari, muhasebe_kodu, karsi_hesap_kodu, pdf_dosya, pdf_dosya_adi,
        odeme_tarihi, odeme_durumu, odeme_dekontu, odeme_dekontu_adi, cari_id, vade_tarihi,
        aciklama, olusturma_tarihi, company_id, urun_id, depo_id, vehicle_plate, kdv1, kdv10, kdv20, oiv_tutari
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        faturaId,
        faturaNo,
        faturaTarihi,
        item.tedarikciAdi || 'Telegram Fiş Harcaması',
        item.tedarikciVkn || '',
        item.malHizmetAdi || 'Fiş / Harcama',
        tutar,
        kdvOrani,
        kdvTutari,
        matrah,
        '0', 0,
        '0', 0,
        '770', '100', // Varsayılan genel gider hesabı
        saveBase64File(`data:image/jpeg;base64,${base64Data}`, `telegram_fis_${faturaNo}.jpg`, 'fisler'),
        `telegram_fis_${faturaNo}.jpg`,
        faturaTarihi,
        item.odeme_sekli === 'KREDI_KARTI' ? 'odendi' : 'bekliyor',
        null,
        'telegram_bot',
        null,
        null,
        `Telegram (${senderInfo}) üzerinden otomatik aktarıldı. ${item.plate ? `Plaka: ${item.plate}` : ''}`,
        new Date().toISOString().split('T')[0],
        compId,
        null, null,
        item.plate || null,
        kdv1, kdv10, kdv20, 0
      ]
    });

    return {
      faturaId,
      faturaNo,
      faturaTarihi,
      tedarikciAdi: item.tedarikciAdi,
      toplamTutar: tutar,
      kdvOrani,
      kdvTutari,
      malHizmetAdi: item.malHizmetAdi,
      plate: item.plate,
      odemeSekli: item.odeme_sekli
    };
  }
}

export const telegramBotService = new TelegramBotService();
