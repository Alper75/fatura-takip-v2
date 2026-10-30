/**
 * EVREN LLM API & OCR Entegrasyon Servisi
 * T.C. Savunma Sanayii Başkanlığı / SAYZEK Milli Yapay Zeka Platformu
 * Endpoint: https://evren-llmapi.ssyz.org.tr/v1/ocr
 * Modeller: dots-ocr, deepseek-ocr-2
 */

export class EvrenClientService {
  constructor() {
    this.ocrEndpoint = 'https://evren-llmapi.ssyz.org.tr/v1/ocr';
    this.chatEndpoint = 'https://evren-llmapi.ssyz.org.tr/v1/chat/completions';
  }

  /**
   * EVREN Adanmış OCR Ucu (POST /v1/ocr)
   * @param {Object} params
   * @param {string} params.imageBase64 - Görselin saf veya data: uri Base64 verisi
   * @param {string} [params.mimeType='image/jpeg']
   * @param {string} params.apiKey - EVREN API anahtarı
   * @param {string} [params.model='dots-ocr'] - 'dots-ocr' veya 'deepseek-ocr-2'
   * @returns {Promise<{ rawText: string, data: any }>}
   */
  async performOcr({ imageBase64, mimeType = 'image/jpeg', apiKey, model = 'dots-ocr' }) {
    if (!apiKey) {
      throw new Error('EVREN API Key tanımlı değil. Lütfen Yapay Zeka Ayarları bölümünden giriniz.');
    }
    if (!imageBase64) {
      throw new Error('OCR yapılacak görsel verisi bulunamadı.');
    }

    // data:image/... formatını garantile
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
    console.log('[EvrenClient] OCR yanıtı alındı:', typeof resJson === 'object' ? Object.keys(resJson) : typeof resJson);

    // Çeşitli OCR çıktı formatlarını normalize et
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
   * EVREN Chat Completions API (Metin analizi / JSON çıkarma)
   */
  async chatCompletion({ messages, apiKey, model = 'qwen-2.5-72b-instruct', temperature = 0.1 }) {
    if (!apiKey) throw new Error('EVREN API Key eksik.');

    const res = await fetch(this.chatEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'qwen-2.5-72b-instruct',
        messages,
        temperature
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`EVREN Chat Hatası (HTTP ${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * OCR'dan dönen Türkçe metni kural bazlı ve regex ile akıllıca analiz edip fatura nesnesi üretir (Zero-cost fallback)
   */
  extractInvoiceRuleBased(rawText) {
    const text = rawText || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. Tarih tespiti: GG.AA.YYYY veya YYYY-AA-GG
    let faturaTarihi = new Date().toISOString().split('T')[0];
    const dateMatch = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/) || text.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (dateMatch) {
      if (dateMatch[3] && dateMatch[3].length === 4) {
        faturaTarihi = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
      } else if (dateMatch[1] && dateMatch[1].length === 4) {
        faturaTarihi = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }
    }

    // 2. VKN / TCKN tespiti (10 veya 11 haneli)
    let vkn = '';
    const vknMatch = text.match(/(?:VKN|TCKN|VERGİ\s*NO|VERGI\s*NO|TC\s*NO)[:\s]*([0-9]{10,11})/i) || text.match(/\b([0-9]{10,11})\b/);
    if (vknMatch) vkn = vknMatch[1];

    // 3. Fatura / Fiş No tespiti
    let faturaNo = '';
    const fisNoMatch = text.match(/(?:FİŞ\s*NO|FIS\s*NO|FATURA\s*NO|BELGE\s*NO|NO)[:\s]*([A-Z0-9-]{3,16})/i);
    if (fisNoMatch) {
      faturaNo = fisNoMatch[1];
    } else {
      faturaNo = 'FİŞ-' + Math.floor(100000 + Math.random() * 900000);
    }

    // 4. Genel Toplam tespiti
    let genelToplam = 0;
    const totalMatch = text.match(/(?:TOPLAM|GENEL\s*TOPLAM|TUTAR|ÖDENEN|ODENEN)[*:\s]*TL?[:\s]*([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/i) ||
                       text.match(/(?:TOPLAM|GENEL\s*TOPLAM)[*:\s]*([0-9]+[.,][0-9]{2})/i);
    if (totalMatch) {
      const cleanNum = totalMatch[1].replace(/\./g, '').replace(',', '.');
      genelToplam = parseFloat(cleanNum) || 0;
    }

    // 5. KDV tespiti
    let kdvOrani = '20';
    if (text.includes('%10') || text.includes('KDV %10') || text.includes('KDV: %10')) kdvOrani = '10';
    if (text.includes('%1') || text.includes('KDV %1')) kdvOrani = '1';

    // 6. Ödeme Şekli (Kredi Kartı / Nakit)
    let odemeSekli = 'NAKIT';
    if (/KRED[İI]\s*KART|BANKA\s*KART|POS|MASTER|VISA|TEMASSIZ/i.test(text)) {
      odemeSekli = 'KREDI_KARTI';
    }

    // 7. Firma / Tedarikçi Adı
    let tedarikciAdi = lines[0] || 'Genel Harcama / Fiş';
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i];
      if (!/TARIH|SAAT|FİS|FIS|VKN|TCKN|HOSGELDIN|FATURA/i.test(line) && line.length > 3) {
        tedarikciAdi = line;
        break;
      }
    }

    // 8. Plaka (Akaryakıt)
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
