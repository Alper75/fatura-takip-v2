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

    const response = await fetch(this.ocrEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errText = '';
      try {
        const errJson = await response.json();
        errText = errJson.message || errJson.error || JSON.stringify(errJson);
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
  async chatCompletion({ messages, apiKey, model = 'deepseek-v4-flash', temperature = 0.1 }) {
    if (!apiKey) throw new Error('EVREN API Key eksik.');

    const candidateModels = Array.from(new Set([
      model,
      'deepseek-v4-flash',
      'glm-5.3',
      'qwen3.8-flash-next',
      'auto'
    ].filter(Boolean)));

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
            temperature
          })
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content || '';
          if (content) return content;
        } else {
          console.warn(`[EvrenClient] Chat HTTP ${res.status} (${m})`);
        }
      } catch (err) {
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

    // 2. Durum: Adanmış OCR ucu (dots-ocr veya deepseek-ocr-2)
    const ocrModel = (model === 'deepseek-ocr-2') ? 'deepseek-ocr-2' : 'dots-ocr';
    const ocrRes = await this.performOcr({
      imageBase64,
      mimeType,
      apiKey,
      model: ocrModel
    });

    const rawText = ocrRes?.rawText || '';
    if (!rawText) return '';

    // 3. Adım: OCR metnini EVREN'in kendi milli LLM'i (deepseek-v4-flash veya glm-5.3) ile muhasebe JSON formatına dönüştür
    try {
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({
        role: 'user',
        content: `${prompt}\n\nAŞAĞIDAKİ METİN EVREN OCR MOTORU (${ocrModel}) TARAFINDAN OKUNMUŞTUR. BU METİNDEKİ VERİLERİ ANALİZ EDİP SADECE GEÇERLİ JSON OLARAK DÖNDÜR:\n\n${rawText}`
      });

      const structuredJson = await this.chatCompletion({
        messages,
        apiKey,
        model: 'deepseek-v4-flash'
      });

      if (structuredJson) return structuredJson;
    } catch (llmErr) {
      console.warn('[EvrenClient] EVREN LLM metin ayrıştırma hatası, kural motoruna geçiliyor:', llmErr.message);
    }

    // 4. Adım Fallback: Yerel regex kural motoru
    const parsed = this.extractInvoiceRuleBased(rawText);
    return JSON.stringify({ faturalar: [parsed] });
  }

  /**
   * OCR'dan dönen Türkçe metni kural bazlı ve regex ile akıllıca analiz edip fatura nesnesi üretir
   */
  extractInvoiceRuleBased(rawText) {
    const text = rawText || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let faturaTarihi = new Date().toISOString().split('T')[0];
    const dateMatch = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/) || text.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (dateMatch) {
      if (dateMatch[3] && dateMatch[3].length === 4) {
        faturaTarihi = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
      } else if (dateMatch[1] && dateMatch[1].length === 4) {
        faturaTarihi = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }
    }

    let vkn = '';
    const vknMatch = text.match(/(?:VKN|TCKN|VERGİ\s*NO|VERGI\s*NO|TC\s*NO)[:\s]*([0-9]{10,11})/i) || text.match(/\b([0-9]{10,11})\b/);
    if (vknMatch) vkn = vknMatch[1];

    let faturaNo = '';
    const fisNoMatch = text.match(/(?:FİŞ\s*NO|FIS\s*NO|FATURA\s*NO|BELGE\s*NO|NO)[:\s]*([A-Z0-9-]{3,16})/i);
    if (fisNoMatch) {
      faturaNo = fisNoMatch[1];
    } else {
      faturaNo = 'FİŞ-' + Math.floor(100000 + Math.random() * 900000);
    }

    let genelToplam = 0;
    const totalMatch = text.match(/(?:TOPLAM|GENEL\s*TOPLAM|TUTAR|ÖDENEN|ODENEN)[*:\s]*TL?[:\s]*([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/i) ||
                       text.match(/(?:TOPLAM|GENEL\s*TOPLAM)[*:\s]*([0-9]+[.,][0-9]{2})/i);
    if (totalMatch) {
      const cleanNum = totalMatch[1].replace(/\./g, '').replace(',', '.');
      genelToplam = parseFloat(cleanNum) || 0;
    }

    let kdvOrani = '20';
    if (text.includes('%10') || text.includes('KDV %10') || text.includes('KDV: %10')) kdvOrani = '10';
    if (text.includes('%1') || text.includes('KDV %1')) kdvOrani = '1';

    let odemeSekli = 'NAKIT';
    if (/KRED[İI]\s*KART|BANKA\s*KART|POS|MASTER|VISA|TEMASSIZ/i.test(text)) {
      odemeSekli = 'KREDI_KARTI';
    }

    let tedarikciAdi = lines[0] || 'Genel Harcama / Fiş';
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i];
      if (!/TARIH|SAAT|FİS|FIS|VKN|TCKN|HOSGELDIN|FATURA/i.test(line) && line.length > 3) {
        tedarikciAdi = line;
        break;
      }
    }

    let plate = '';
    const plateMatch = text.match(/\b([0-8][0-9]\s*[A-Z]{1,3}\s*[0-9]{2,4})\b/);
    if (plateMatch) plate = plateMatch[1].replace(/\s+/g, '');

    return {
      tedarikciAdi,
      tedarikciVkn: vkn,
      faturaNo,
      malHizmetAdi: plate ? `Akaryakıt Harcaması (${plate})` : 'Perakende Fiş/Fatura Harcaması',
      faturaTarihi,
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
