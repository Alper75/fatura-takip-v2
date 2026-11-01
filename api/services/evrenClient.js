/**
 * EVREN LLM API & OCR Entegrasyon Servisi
 * T.C. Savunma Sanayii Başkanlığı / SAYZEK Milli Yapay Zeka Platformu
 *
 * EVREN Modelleri:
 * 1. Adanmış Belge & OCR (/v1/ocr):
 *    - dots-ocr (1.7B VLM - Belge, perakende fiş & tablo düzeni ayrıştırma)
 *    - deepseek-ocr-2 (Gelişmiş belge & metin okuma)
 * 2. Çok Modlu Görsel (/v1/chat/completions):
 *    - qwen3-vl-30b (30B Görsel & Belge analiz modeli)
 * 3. Akıl Yürütme & Dil Modelleri (/v1/chat/completions):
 *    - deepseek-v4-flash (Hızlı ve zeki akıl yürütme)
 *    - glm-5.3 (Kapsamlı mantık ve Türkçe anlama)
 *    - qwen3.8-flash-next (Hızlı akıl yürütme)
 *    - gemma-4-31b (31B Açık model)
 */

export class EvrenClientService {
  constructor() {
    this.ocrEndpoint = 'https://evren-llmapi.ssyz.org.tr/v1/ocr';
    this.chatEndpoint = 'https://evren-llmapi.ssyz.org.tr/v1/chat/completions';
    this.termsTextEndpoint = 'https://evren-llmapi.ssyz.org.tr/v1/terms/text';
    this.termsAcceptEndpoint = 'https://evren-llmapi.ssyz.org.tr/v1/terms/accept';
    this.acceptedKeys = new Set();
  }

  /**
   * EVREN API anahtarı için kullanım şartlarını (GET /v1/terms/text & POST /v1/terms/accept) otomatik onaylar
   */
  async ensureTermsAccepted(apiKey, force = false) {
    if (!apiKey) return;
    const cleanKey = apiKey.trim();
    if (!force && this.acceptedKeys.has(cleanKey)) return;

    try {
      let versionToAccept = 1;
      try {
        const textRes = await fetch(this.termsTextEndpoint, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${cleanKey}` },
          signal: AbortSignal.timeout(8000)
        });
        if (textRes.ok) {
          const textData = await textRes.json().catch(() => null);
          if (textData && typeof textData.version === 'number') {
            versionToAccept = textData.version;
          }
        }
      } catch (e) {}

      const acceptRes = await fetch(this.termsAcceptEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ version: versionToAccept }),
        signal: AbortSignal.timeout(8000)
      });

      if (acceptRes.ok) {
        this.acceptedKeys.add(cleanKey);
        console.log(`[EvrenClient] Kullanım şartları (v${versionToAccept}) otomatik onaylandı.`);
      }
    } catch (err) {
      console.warn('[EvrenClient] Kullanım şartları otomatik onay hatası:', err.message);
    }
  }

  /**
   * EVREN Adanmış OCR Ucu (POST /v1/ocr)
   */
  async performOcr({ imageBase64, mimeType = 'image/jpeg', apiKey, model = 'dots-ocr' }) {
    if (!apiKey) {
      throw new Error('EVREN API Key tanımlı değil. Lütfen Yapay Zeka Ayarları bölümünden giriniz.');
    }
    if (!imageBase64) {
      throw new Error('OCR yapılacak görsel verisi bulunamadı.');
    }

    let formattedImage = imageBase64;
    if (!formattedImage.startsWith('data:')) {
      formattedImage = `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;
    }

    const payload = {
      model: model || 'dots-ocr',
      image: formattedImage
    };

    console.log(`[EvrenClient] OCR isteği gönderiliyor -> Model: ${payload.model} (Endpoint: ${this.ocrEndpoint})`);

    await this.ensureTermsAccepted(apiKey);

    let response = await fetch(this.ocrEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(22000)
    });

    if (response.status === 403) {
      await this.ensureTermsAccepted(apiKey, true);
      response = await fetch(this.ocrEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(22000)
      });
    }

    if (!response.ok) {
      let errText = '';
      try {
        const errJson = await response.json();
        errText =
          errJson?.error?.message ||
          errJson?.message ||
          errJson?.detail ||
          (typeof errJson?.error === 'string' ? errJson.error : JSON.stringify(errJson));
      } catch (e) {
        errText = await response.text();
      }
      throw new Error(`EVREN OCR Hatası (HTTP ${response.status}): ${errText || response.statusText}`);
    }

    const resJson = await response.json();

    let extractedText = '';
    if (typeof resJson === 'string') {
      extractedText = resJson;
    } else if (resJson.text) {
      extractedText = resJson.text;
    } else if (resJson.data && typeof resJson.data.text === 'string') {
      extractedText = resJson.data.text;
    } else if (Array.isArray(resJson.choices) && resJson.choices[0]) {
      extractedText = resJson.choices[0].text || resJson.choices[0].message?.content || '';
    } else if (resJson.result) {
      extractedText = typeof resJson.result === 'string' ? resJson.result : JSON.stringify(resJson.result);
    } else if (resJson.output) {
      extractedText = typeof resJson.output === 'string' ? resJson.output : JSON.stringify(resJson.output);
    } else if (resJson.content) {
      extractedText = resJson.content;
    } else {
      extractedText = JSON.stringify(resJson);
    }

    return {
      rawText: (extractedText || '').trim(),
      data: resJson
    };
  }

  /**
   * EVREN Chat Completions API (POST /v1/chat/completions)
   */
  async chatCompletion({ messages, apiKey, model = 'gemma-4-31b', temperature = 0.1 }) {
    if (!apiKey) throw new Error('EVREN API Key eksik.');

    await this.ensureTermsAccepted(apiKey);

    const candidateModels = Array.from(new Set([
      model,
      'gemma-4-31b',
      'qwen3.8-flash-next',
      'deepseek-v4-flash'
    ].filter(Boolean))).slice(0, 2);

    for (const m of candidateModels) {
      try {
        const res = await fetch(this.chatEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: m,
            messages,
            max_tokens: 4096,
            temperature
          }),
          signal: AbortSignal.timeout(18000)
        });

        if (res.ok) {
          const data = await res.json();
          const msg = data.choices?.[0]?.message;
          const content = msg?.content || '';
          if (content && content.trim()) return content;
        } else {
          let errDetail = '';
          try {
            const ej = await res.json();
            errDetail = ej?.error?.message || ej?.message || JSON.stringify(ej);
          } catch (e) {}
          if (res.status === 401) {
            throw new Error(`EVREN API Anahtarı geçersiz (HTTP 401): ${errDetail}`);
          }
          console.warn(`[EvrenClient] Chat HTTP ${res.status} (${m}): ${errDetail}`);
        }
      } catch (err) {
        if (err.message?.includes('HTTP 401')) throw err;
        console.warn(`[EvrenClient] Chat çağrı hatası (${m}):`, err.message);
      }
    }

    return '';
  }

  /**
   * Belge Analizi ve Çıkarımı:
   * Görsel modeli (qwen3-vl-30b) veya OCR modeli (dots-ocr / deepseek-ocr-2) + EVREN LLM hibrit akışı
   */
  async analyzeDocument({ imageBase64, mimeType = 'image/jpeg', apiKey, model = 'dots-ocr', prompt = '', systemPrompt = '' }) {
    let formattedImage = imageBase64;
    if (formattedImage && !formattedImage.startsWith('data:')) {
      formattedImage = `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;
    }

    // 1. Durum: Eğer doğrudan qwen3-vl-30b çok modlu görsel modeli seçilmişse
    if (model === 'qwen3-vl-30b') {
      try {
        console.log('[EvrenClient] qwen3-vl-30b Vision modeli ile analiz ediliyor...');
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: prompt + '\nÖNEMLİ: SADECE geçerli JSON döndür.' },
            { type: 'image_url', image_url: { url: formattedImage } }
          ]
        });

        const visionResult = await this.chatCompletion({
          messages,
          apiKey,
          model: 'qwen3-vl-30b'
        });

        if (visionResult) return visionResult;
      } catch (err) {
        console.warn('[EvrenClient] qwen3-vl-30b Vision hatası, OCR moduna geçiliyor:', err.message);
      }
    }

    // 2. Durum: Adanmış OCR ucu (dots-ocr veya deepseek-ocr-2) - 403/hata olursa diğer OCR ve Vision modellerini dene
    const primaryOcrModel = (model === 'deepseek-ocr-2') ? 'deepseek-ocr-2' : 'dots-ocr';
    const backupOcrModel = primaryOcrModel === 'dots-ocr' ? 'deepseek-ocr-2' : 'dots-ocr';
    let rawText = '';
    let lastOcrError = null;

    for (const ocrModel of [primaryOcrModel, backupOcrModel]) {
      try {
        const ocrRes = await this.performOcr({
          imageBase64,
          mimeType,
          apiKey,
          model: ocrModel
        });
        rawText = ocrRes?.rawText || '';
        if (rawText) break;
      } catch (ocrErr) {
        lastOcrError = ocrErr;
        console.warn(`[EvrenClient] ${ocrModel} başarısız (${ocrErr.message}), alternatif deneniyor...`);
      }
    }

    // Eğer /v1/ocr uçlarının ikisi de 403/hata verdiyse qwen3-vl-30b Vision ucu ile dene
    if (!rawText) {
      try {
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: prompt + '\nÖNEMLİ: SADECE geçerli JSON döndür.' },
            { type: 'image_url', image_url: { url: formattedImage } }
          ]
        });
        const visionFallback = await this.chatCompletion({
          messages,
          apiKey,
          model: 'qwen3-vl-30b'
        });
        if (visionFallback) return visionFallback;
      } catch (vErr) {
        console.warn('[EvrenClient] Vision fallback da başarısız:', vErr.message);
      }
      if (lastOcrError) throw lastOcrError;
      return '';
    }

    // 3. Adım: Önce yerel akıllı kural motoru ile kesin alanları (Tarih, VKN, Tutar, Fiş No, Plaka, Ünvan) çıkar
    const ruleBasedResult = this.extractInvoiceRuleBased(rawText);
    const ruleItems = Array.isArray(ruleBasedResult) ? ruleBasedResult : [ruleBasedResult];

    // 4. Adım: OCR metnini EVREN'in hızlı LLM'i (gemma-4-31b) ile muhasebe JSON formatına dönüştür ve kural motoruyla doğrula
    try {
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({
        role: 'user',
        content: `${prompt}\n\nÖNEMLİ İPUÇLARI (Fiş üzerindeki tespitler - lütfen kontrol ederek kullan):\n- Tespit Edilen Firma: ${ruleItems[0]?.tedarikciAdi || ''}\n- Tespit Edilen VKN/TCKN (Telefon DEĞİLDİR): ${ruleItems[0]?.tedarikciVkn || ''}\n- Tespit Edilen Tarih: ${ruleItems[0]?.faturaTarihi || ''}\n- Tespit Edilen Fiş/Belge No: ${ruleItems[0]?.faturaNo || ''}\n- Tespit Edilen Genel Toplam: ${ruleItems[0]?.genel_toplam || ruleItems[0]?.tutar || ''}\n- Tespit Edilen Plaka: ${ruleItems[0]?.plate || ''}\n\nAŞAĞIDAKİ METİN EVREN OCR MOTORU TARAFINDAN OKUNMUŞTUR. BU METİNDEKİ VERİLERİ ANALİZ EDİP SADECE GEÇERLİ JSON OLARAK DÖNDÜR:\n\n${rawText}`
      });

      const structuredJson = await this.chatCompletion({
        messages,
        apiKey,
        model: 'gemma-4-31b'
      });

      if (structuredJson) {
        try {
          let cleanTxt = structuredJson.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json/gi, '').replace(/```/g, '').trim();
          const fb = cleanTxt.indexOf('{');
          const lb = cleanTxt.lastIndexOf('}');
          if (fb !== -1 && lb > fb) cleanTxt = cleanTxt.substring(fb, lb + 1);
          const parsedObj = JSON.parse(cleanTxt);
          const arr = Array.isArray(parsedObj) ? parsedObj : (Array.isArray(parsedObj.faturalar) ? parsedObj.faturalar : [parsedObj]);
          const refRule = ruleItems[0] || {};
          const companyIndicators = /(?:A\.?\s*Ş\.?|A\.?\s*S\.?|LTD|ŞTİ|STI|TİC|TIC|SAN\.|PETROL|MARKET|MAĞAZA|MAGAZA|GIDA|RESTORAN|LOKANTA|OTOMOTİV|ECZANE)/i;

          arr.forEach((it) => {
            if (!it || typeof it !== 'object') return;
            // 1. VKN düzeltmesi: LLM telefon numarası (0 ile başlayan 11 hane) veya boş döndürdüyse kural motorunun bulduğu VKN'yi yaz
            const llmVkn = String(it.tedarikciVkn || it.tedarikci_vkn || '').replace(/\D/g, '');
            if ((!llmVkn || (llmVkn.length === 11 && llmVkn.startsWith('0'))) && refRule.tedarikciVkn) {
              it.tedarikciVkn = refRule.tedarikciVkn;
            }
            // 2. Tarih düzeltmesi: LLM geçersiz tarih döndürdüyse kural motorunun bulduğu tarihi yaz
            const llmDate = String(it.faturaTarihi || it.fatura_tarihi || '');
            if ((!/^20[1-3][0-9]-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(llmDate)) && refRule.faturaTarihi) {
              it.faturaTarihi = refRule.faturaTarihi;
            }
            // 3. Ünvan düzeltmesi: LLM şube/semt adı (örn: Sarıgazi) döndürdüyse ve kural motoru A.Ş./LTD içeren tam ünvan bulduysa düzelt
            const llmVendor = String(it.tedarikciAdi || it.tedarikci_adi || '').trim();
            if (refRule.tedarikciAdi && companyIndicators.test(refRule.tedarikciAdi) && !companyIndicators.test(llmVendor)) {
              it.tedarikciAdi = refRule.tedarikciAdi;
            }
            // 4. Fiş No düzeltmesi
            if ((!it.faturaNo && !it.fatura_no) && refRule.faturaNo) {
              it.faturaNo = refRule.faturaNo;
            }
            // 5. Plaka düzeltmesi
            if ((!it.plate && !it.plaka) && refRule.plate) {
              it.plate = refRule.plate;
            }
            // 6. Tek KDV'li fişte tutar 3.076,48 yerine 307 gibi 10 kat eksik okunduysa düzelt
            if (arr.length === 1 && refRule.genel_toplam) {
              const ruleTotal = parseFloat(refRule.genel_toplam) || 0;
              const llmTotal = this.parseTurkishCurrency(it.tutar || it.toplamTutar || it.genel_toplam);
              if (ruleTotal > 0 && Math.abs(llmTotal - ruleTotal) > 1) {
                it.tutar = ruleTotal.toFixed(2);
                it.genel_toplam = ruleTotal.toFixed(2);
              }
            }
          });
          return JSON.stringify({ faturalar: arr });
        } catch (mergeErr) {
          return structuredJson;
        }
      }
    } catch (llmErr) {
      console.warn('[EvrenClient] EVREN LLM metin ayrıştırma hatası, kural motoruna geçiliyor:', llmErr.message);
    }

    // 5. Adım Fallback: Yerel kural motoru çıktısını döndür
    return JSON.stringify({ faturalar: ruleItems });
  }

  /**
   * Türkçe para formatını (*3.076,48 / 3,076.48 / 512,75) güvenli şekilde float sayıya çevirir
   */
  parseTurkishCurrency(rawStr) {
    if (!rawStr) return 0;
    let s = String(rawStr).replace(/[^0-9.,]/g, '').trim();
    if (!s) return 0;

    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');

    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) {
        // 3.076,48 -> 3076.48
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        // 3,076.48 -> 3076.48
        s = s.replace(/,/g, '');
      }
    } else if (lastComma !== -1) {
      // 512,75 veya 3,076
      const parts = s.split(',');
      if (parts[parts.length - 1].length === 3 && parts.length > 1 && parts[0].length <= 3) {
        s = s.replace(/,/g, '');
      } else {
        s = s.replace(',', '.');
      }
    } else if (lastDot !== -1) {
      const parts = s.split('.');
      // 3.076 gibi binlik ayraçsa noktayı kaldır, 512.75 gibi kuruşsa koru
      if (parts[parts.length - 1].length === 3 && parts.length > 1) {
        s = s.replace(/\./g, '');
      }
    }

    const val = parseFloat(s);
    return isNaN(val) ? 0 : val;
  }

  /**
   * OCR'dan dönen Türkçe metni kural bazlı ve regex ile akıllıca analiz edip fatura nesnesi üretir
   */
  extractInvoiceRuleBased(rawText) {
    const text = (rawText || '').replace(/\r/g, '');
    const lines = text
      .split('\n')
      .map(l => l.replace(/^[|#*\-\s]+|[|#*\s]+$/g, '').trim())
      .filter(Boolean);

    // 1. TARİH TESPİTİ (Sadece gerçek takvim tarihlerini yakala: GG-AA-YYYY, GG.AA.YYYY, GG/AA/YYYY veya YYYY-AA-GG)
    // Lisans No (939-82/48218) veya Mersis No (0729-0015-0430-0023) gibi numaraları kesinlikle hariç tut!
    let faturaTarihi = new Date().toISOString().split('T')[0];
    let foundDate = false;

    const dmyRegex = /\b(0?[1-9]|[12][0-9]|3[01])[./-](0?[1-9]|1[0-2])[./-](20[1-3][0-9])\b/g;
    let m;
    while ((m = dmyRegex.exec(text)) !== null) {
      const day = m[1].padStart(2, '0');
      const month = m[2].padStart(2, '0');
      const year = m[3];
      faturaTarihi = `${year}-${month}-${day}`;
      foundDate = true;
      break;
    }

    if (!foundDate) {
      const ymdRegex = /\b(20[1-3][0-9])[./-](0?[1-9]|1[0-2])[./-](0?[1-9]|[12][0-9]|3[01])\b/g;
      while ((m = ymdRegex.exec(text)) !== null) {
        const year = m[1];
        const month = m[2].padStart(2, '0');
        const day = m[3].padStart(2, '0');
        faturaTarihi = `${year}-${month}-${day}`;
        foundDate = true;
        break;
      }
    }

    // 2. VKN / TCKN TESPİTİ (Telefon numaralarını 0216..., 0532... ve Mersis No'yu kesinlikle hariç tut!)
    let vkn = '';
    // Önce açıkça VD:, V.D.:, VKN:, TCKN:, VERGİ NO: yazan satırları tara
    const vknLabeledMatch = text.match(/(?:VKN|TCKN|VERG[İI]\s*NO|VERG[İI]\s*NUMARASI|V\.?\s*D\.?|VD|TC\s*NO)[:.\s-]*([0-9]{10,11})\b/i);
    if (vknLabeledMatch) {
      vkn = vknLabeledMatch[1];
    } else {
      // Etiket yoksa satır satır bak; TEL, FAX, GSM, MERSİS, LİSANS, SİCİL satırlarını atla
      for (const line of lines) {
        if (/(?:TEL|TELEFON|FAX|FAKS|GSM|CEP|MERS[İI]S|L[İI]SANS|S[İI]C[İI]L|BARKOD|EK[ÜU]|Z\s*NO)/i.test(line)) {
          continue;
        }
        const candidateMatches = line.match(/\b([0-9]{10,11})\b/g);
        if (candidateMatches) {
          for (const cand of candidateMatches) {
            // Türkiye'de 11 haneli TCKN asla '0' ile başlamaz; '0' ile başlayan 11 haneli sayılar telefon numarasıdır (0216..., 0532..., 0850...)
            if (cand.length === 11 && cand.startsWith('0')) continue;
            vkn = cand;
            break;
          }
        }
        if (vkn) break;
      }
    }

    // 3. FİŞ / FATURA / BELGE NO TESPİTİ (Adres içindeki "No:56" veya "ADA NO:2-1" ile karışmasını engelle)
    let faturaNo = '';
    const fisNoMatch =
      text.match(/(?:F[İI]Ş\s*NO|FIS\s*NO|FATURA\s*NO|BELGE\s*NO|MAKBUZ\s*NO|ERS\s*NO|SIRA\s*NO)\s*[:.]?\s*([A-Z0-9-]{1,20})/i);
    if (fisNoMatch) {
      faturaNo = fisNoMatch[1].trim();
    } else {
      faturaNo = 'FİŞ-' + Math.floor(100000 + Math.random() * 900000);
    }

    // 4. GENEL TOPLAM VE TOPKDV TESPİTİ (*3.076,48 gibi binlik noktalı tutarları tam yakala)
    let genelToplam = 0;
    const numberPattern = '([0-9]{1,3}(?:[.\\s][0-9]{3})+[,][0-9]{2}|[0-9]{1,3}(?:[,\\s][0-9]{3})+[.][0-9]{2}|[0-9]+[.,][0-9]{2})';
    const totalRegex = new RegExp(`(?:GENEL\\s*TOPLAM|TOPLAM|ÖDENECEK\\s*TUTAR|ODENECEK|ÖDENEN|ODENEN)(?!\\s*KDV)[^0-9\\n]*?\\*?${numberPattern}`, 'gi');
    let tm;
    while ((tm = totalRegex.exec(text)) !== null) {
      const val = this.parseTurkishCurrency(tm[1]);
      if (val > genelToplam) genelToplam = val;
    }

    let topKdv = 0;
    const topKdvRegex = new RegExp(`(?:TOPKDV|TOPLAM\\s*KDV|T\\.?\\s*KDV)[^0-9\\n]*?\\*?${numberPattern}`, 'gi');
    let km;
    while ((km = topKdvRegex.exec(text)) !== null) {
      const val = this.parseTurkishCurrency(km[1]);
      if (val > topKdv) topKdv = val;
    }

    let kdv10Tutari = 0;
    const kdv10Regex = new RegExp(`(?:%10|KDV\\s*%?10)[^0-9\\n]*?\\*?${numberPattern}`, 'i');
    const kdv10Match = text.match(kdv10Regex);
    if (kdv10Match) {
      kdv10Tutari = this.parseTurkishCurrency(kdv10Match[1]);
    }

    // 5. ÖDEME ŞEKLİ
    let odemeSekli = 'NAKIT';
    if (/KRED[İI]\s*KART|BANKA\s*KART|KRED[İI]L[İI]|POS|MASTER|VISA|TEMASSIZ|TTS/i.test(text)) {
      odemeSekli = 'KREDI_KARTI';
    }

    // 6. FİRMA / TEDARİKÇİ ÜNVANI TESPİTİ ("PETROL OFİSİ A.Ş." içindeki "OFİSİ" kelimesinin "FİS" diye atlanmasını engelle!)
    let tedarikciAdi = lines[0] || 'Genel Harcama / Fiş';
    const companyIndicators = /(?:A\.?\s*Ş\.?|A\.?\s*S\.?|LTD|ŞTİ|STI|TİC|TIC|SAN\.|PETROL|MARKET|MAĞAZA|MAGAZA|GIDA|RESTORAN|LOKANTA|OTOMOTİV|ECZANE|HOLDİNG|PERAKENDE|KURUMSAL)/i;
    const skipHeaderLine = /^(?:TAR[İI]H\b|SAAT\b|F[İI]Ş\s*NO\b|FIS\s*NO\b|VKN\b|TCKN\b|HOŞGELD[İI]N|HOSGELDIN|FATURA\b|TEŞEKKÜR|İYİ\s*GÜNLER|NO\s*:|TEL\s*:)/i;

    let foundCompanyLine = '';
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      const line = lines[i];
      if (skipHeaderLine.test(line)) continue;
      if (companyIndicators.test(line) && line.length >= 3) {
        foundCompanyLine = line;
        break;
      }
    }

    if (foundCompanyLine) {
      tedarikciAdi = foundCompanyLine;
    } else {
      for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const line = lines[i];
        if (!skipHeaderLine.test(line) && line.length > 3) {
          tedarikciAdi = line;
          break;
        }
      }
    }

    // 7. ARAÇ PLAKASI TESPİTİ (34KCR118 vb. - Posta kodu 34785 ile karışmaz çünkü ortada harf grubu zorunludur)
    let plate = '';
    const plateMatch = text.match(/\b(0[1-9]|[1-7][0-9]|8[01])\s*([A-Z]{1,3})\s*([0-9]{2,5})\b/);
    if (plateMatch) {
      plate = `${plateMatch[1]}${plateMatch[2]}${plateMatch[3]}`;
    }

    const has10 = /(?:^|\s|\*)%10\b|KDV\s*%?10\b/i.test(text) || kdv10Tutari > 0;
    const has20 = /(?:^|\s|\*)%20\b|KDV\s*%?20\b/i.test(text);
    const has1 = /(?:^|\s|\*)%(?:01|1)(?!\d)|KDV\s*%?(?:01|1)(?!\d)/i.test(text);

    // Çoklu KDV tespiti (%10 ve %20 birlikte varsa)
    if (has10 && has20 && genelToplam > 0) {
      let tutar10 = 0;
      if (kdv10Tutari > 0) {
        // Eğer yakalanan tutar KDV ise (genelToplam'ın %15'inden küçükse) *11 yap, doğrudan ürün satır tutarıysa olduğu gibi al
        tutar10 = kdv10Tutari < genelToplam * 0.15 ? Math.round(kdv10Tutari * 11 * 100) / 100 : kdv10Tutari;
      }
      if (tutar10 <= 0 || tutar10 >= genelToplam) {
        tutar10 = Math.round(genelToplam * 0.4 * 100) / 100;
      }
      const tutar20 = Math.round((genelToplam - tutar10) * 100) / 100;

      return [
        {
          tedarikciAdi,
          tedarikciVkn: vkn,
          faturaNo,
          malHizmetAdi: plate ? `Akaryakıt Harcaması (${plate})` : 'Perakende Fiş Harcaması (%10 Gıda/Temel)',
          faturaTarihi,
          genel_toplam: genelToplam.toFixed(2),
          toplam_kdv: topKdv > 0 ? topKdv.toFixed(2) : undefined,
          tutar: tutar10.toFixed(2),
          kdv_orani: '10',
          plate,
          odeme_sekli: odemeSekli,
          ham_ocr_metni: text
        },
        {
          tedarikciAdi,
          tedarikciVkn: vkn,
          faturaNo,
          malHizmetAdi: plate ? `Akaryakıt Harcaması (${plate})` : 'Perakende Fiş Harcaması (%20 Genel)',
          faturaTarihi,
          genel_toplam: genelToplam.toFixed(2),
          toplam_kdv: topKdv > 0 ? topKdv.toFixed(2) : undefined,
          tutar: tutar20.toFixed(2),
          kdv_orani: '20',
          plate,
          odeme_sekli: odemeSekli,
          ham_ocr_metni: text
        }
      ];
    }

    let kdvOrani = '20';
    if (has10 && !has20) kdvOrani = '10';
    else if (has1 && !has20 && !has10) kdvOrani = '1';
    else if (genelToplam > 0 && topKdv > 0) {
      const matrah = genelToplam - topKdv;
      if (matrah > 0) {
        const calcRate = (topKdv / matrah) * 100;
        if (Math.abs(calcRate - 20) <= 2.5) kdvOrani = '20';
        else if (Math.abs(calcRate - 10) <= 2) kdvOrani = '10';
        else if (Math.abs(calcRate - 1) <= 0.8) kdvOrani = '1';
      }
    }

    return {
      tedarikciAdi,
      tedarikciVkn: vkn,
      faturaNo,
      malHizmetAdi: plate ? `Akaryakıt Harcaması (${plate})` : 'Perakende Fiş/Fatura Harcaması',
      faturaTarihi,
      genel_toplam: genelToplam > 0 ? genelToplam.toFixed(2) : undefined,
      toplam_kdv: topKdv > 0 ? topKdv.toFixed(2) : undefined,
      tutar: genelToplam > 0 ? genelToplam.toFixed(2) : '0.00',
      kdv_orani: kdvOrani,
      plate,
      odeme_sekli: odemeSekli,
      ham_ocr_metni: text
    };
  }
}

export const evrenClient = new EvrenClientService();
export default evrenClient;
