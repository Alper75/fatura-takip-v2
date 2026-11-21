import fs from 'fs';
import axios from 'axios';
import { client } from '../db.js';
import { evrenClient } from './evrenClient.js';

let isWorkerRunning = false;
let workerTimer = null;

const AI_INVOICE_PROMPT = `Sen bir Türkiye Mali Müşavir / Muhasebe Uzmanı yapay zeka asistanısın.
Sana yüklenen fiş veya fatura belgesini (PDF veya görsel) oku ve SADECE geçerli JSON formatında yanıt ver.

Kurallar:
- Tarih formatı YYYY-MM-DD olmalıdır (örn: 2026-11-21).
- Tüm tutarlar nokta (.) ondalıklı sayı (number) olmalıdır.
- Çoklu KDV varsa (ör. %1, %10, %20) kdv1, kdv10, kdv20 alanlarına ayrı ayrı yaz, toplamlarını kdvTutari alanına yaz.
- Telekom/Konaklama faturalarında ÖİV veya Konaklama Vergisi varsa oivTutari alanına yaz (yoksa 0).
- KDV matrahını matrah alanına, genel toplamı toplamTutar alanına yaz.
- Fişin ödeme şekline göre odemeSekli alanına 'NAKIT', 'KREDI_KARTI' veya 'CARI_HESAP' yaz.

JSON Şeması:
{
  "faturaNo": "belge veya fiş no",
  "faturaTarihi": "YYYY-MM-DD",
  "cariAdi": "satıcı veya müşteri ünvanı",
  "cariVkn": "10 veya 11 haneli VKN/TCKN",
  "malHizmet": "kısa mal/hizmet açıklaması",
  "matrah": 0,
  "kdvOrani": 20,
  "kdvTutari": 0,
  "kdv1": 0,
  "kdv10": 0,
  "kdv20": 0,
  "oivTutari": 0,
  "toplamTutar": 0,
  "odemeSekli": "CARI_HESAP"
}`;

async function getCompanySettingsMap(companyId) {
  const rs = await client.execute({
    sql: 'SELECT setting_key, setting_value FROM company_settings WHERE company_id = ?',
    args: [companyId]
  });
  const map = {};
  for (const r of rs.rows) {
    map[r.setting_key] = r.setting_value;
  }
  return map;
}

async function callAiForFile(settings, base64Data, mimeType) {
  let provider = settings.ai_provider || '';
  const gKey = settings.gemini_api_key || '';
  const gModel = settings.gemini_model || 'gemini-2.5-flash';
  const oKey = settings.openai_api_key || '';
  const oModel = settings.openai_model || 'gpt-4o-mini';
  const nKey = settings.nvidia_api_key || '';
  const nModel = settings.nvidia_model || 'stepfun-ai/step-5-preview';
  const xKey = settings.xai_api_key || '';
  const xModel = settings.xai_model || 'grok-2-vision-1212';
  const eKey = settings.evren_api_key || '';
  const eModel = settings.evren_model || 'dots-ocr';

  if (!provider) {
    if (gKey) provider = 'gemini';
    else if (oKey) provider = 'openai';
    else if (nKey) provider = 'nvidia';
    else if (xKey) provider = 'grok';
    else if (eKey) provider = 'evren';
  }

  if (!provider) {
    throw new Error('Bu firma için AI sağlayıcı veya API anahtarı tanımlanmamış.');
  }

  let rawText = '';

  if (provider === 'evren') {
    if (!eKey) throw new Error('Evren API Key eksik.');
    const res = await evrenClient.analyzeDocument({
      imageBase64: base64Data,
      mimeType: mimeType || 'image/jpeg',
      apiKey: eKey,
      model: eModel || 'dots-ocr',
      prompt: AI_INVOICE_PROMPT,
    });
    if (!res) throw new Error('Evren AI yanıt döndüremedi.');
    rawText = typeof res === 'string' ? res : JSON.stringify(res);
  } else if (provider === 'gemini') {
    if (!gKey) throw new Error('Gemini API Key eksik.');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${gKey}`;
    const r = await axios.post(url, {
      contents: [{
        parts: [
          { text: AI_INVOICE_PROMPT },
          { inlineData: { mimeType, data: base64Data } }
        ]
      }],
      generationConfig: { temperature: 0.1 }
    }, { timeout: 60000 });
    rawText = r.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else if (provider === 'openai') {
    if (!oKey) throw new Error('OpenAI API Key eksik.');
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: oModel,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: AI_INVOICE_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
        ]
      }]
    }, { headers: { Authorization: `Bearer ${oKey}` }, timeout: 60000 });
    rawText = r.data?.choices?.[0]?.message?.content || '';
  } else if (provider === 'grok' || provider === 'xai') {
    if (!xKey) throw new Error('xAI Grok API Key eksik.');
    const r = await axios.post('https://api.x.ai/v1/chat/completions', {
      model: xModel,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: AI_INVOICE_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
        ]
      }]
    }, { headers: { Authorization: `Bearer ${xKey}` }, timeout: 60000 });
    rawText = r.data?.choices?.[0]?.message?.content || '';
  } else if (provider === 'nvidia') {
    if (!nKey) throw new Error('NVIDIA API Key eksik.');
    const r = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', {
      model: nModel,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: AI_INVOICE_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
        ]
      }]
    }, { headers: { Authorization: `Bearer ${nKey}` }, timeout: 60000 });
    rawText = r.data?.choices?.[0]?.message?.content || '';
  }

  const cleaned = String(rawText).replace(/```json|```/gi, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI geçerli JSON döndüremedi.');
  return JSON.parse(jsonMatch[0]);
}

function buildDefaultMahsupSatirlari(yon, data, muhasebeKodu, karsiKod) {
  const matrah = Number(data.matrah) || 0;
  const kdv1 = Number(data.kdv1) || 0;
  const kdv10 = Number(data.kdv10) || 0;
  const kdv20 = Number(data.kdv20) || 0;
  const kdvTutari = Number(data.kdvTutari) || (kdv1 + kdv10 + kdv20);
  const oiv = Number(data.oivTutari) || 0;
  const toplam = Number(data.toplamTutar) || (matrah + kdvTutari + oiv);
  const aciklama = `${data.faturaNo || ''} ${data.cariAdi || ''}`.trim();

  const rows = [];
  let madde = 1;

  if (yon === 'ALIS') {
    if (matrah > 0) {
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: muhasebeKodu || '770.01', ad: 'Mal / Hizmet Gideri', borc: matrah, alacak: 0, aciklama });
    }
    if (kdv1 > 0) rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: '191.01', ad: 'İndirilecek KDV %1', borc: kdv1, alacak: 0, aciklama });
    if (kdv10 > 0) rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: '191.10', ad: 'İndirilecek KDV %10', borc: kdv10, alacak: 0, aciklama });
    if (kdv20 > 0) rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: '191.20', ad: 'İndirilecek KDV %20', borc: kdv20, alacak: 0, aciklama });
    if (kdv1 === 0 && kdv10 === 0 && kdv20 === 0 && kdvTutari > 0) {
      const kdvKod = data.kdvOrani === 1 ? '191.01' : data.kdvOrani === 10 ? '191.10' : '191.20';
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: kdvKod, ad: `İndirilecek KDV %${data.kdvOrani || 20}`, borc: kdvTutari, alacak: 0, aciklama });
    }
    if (oiv > 0) {
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: '689.01', ad: 'ÖİV / Konaklama KKEG', borc: oiv, alacak: 0, aciklama });
    }
    if (toplam > 0) {
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: karsiKod || (data.odemeSekli === 'NAKIT' ? '100.01' : '320.01'), ad: 'Satıcılar / Kasa', borc: 0, alacak: toplam, aciklama });
    }
  } else {
    if (toplam > 0) {
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: karsiKod || (data.odemeSekli === 'NAKIT' ? '100.01' : '120.01'), ad: 'Alıcılar / Kasa', borc: toplam, alacak: 0, aciklama });
    }
    if (matrah > 0) {
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: muhasebeKodu || '600.01', ad: 'Yurt İçi Satışlar', borc: 0, alacak: matrah, aciklama });
    }
    if (kdvTutari > 0) {
      const kdvKod = data.kdvOrani === 1 ? '391.01' : data.kdvOrani === 10 ? '391.10' : '391.20';
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: kdvKod, ad: `Hesaplanan KDV %${data.kdvOrani || 20}`, borc: 0, alacak: kdvTutari, aciklama });
    }
  }
  return rows;
}

export async function processNextEvrakQueue() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    while (true) {
      const nextRs = await client.execute(
        "SELECT * FROM evrak_havuzu WHERE durum = 'bekliyor' ORDER BY created_at ASC LIMIT 1"
      );
      if (!nextRs.rows || nextRs.rows.length === 0) break;

      const row = nextRs.rows[0];
      await client.execute({
        sql: "UPDATE evrak_havuzu SET durum = 'isleniyor', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [row.id]
      });

      try {
        if (!row.dosya_yolu || !fs.existsSync(row.dosya_yolu)) {
          throw new Error('Evrak dosyası diskte bulunamadı.');
        }

        const fileBuffer = fs.readFileSync(row.dosya_yolu);
        const base64Data = fileBuffer.toString('base64');
        const settings = await getCompanySettingsMap(row.company_id);

        const aiData = await callAiForFile(settings, base64Data, row.mime_type || 'image/jpeg');

        const toplamTutar = Number(aiData.toplamTutar) || 0;
        const kdvTutari = Number(aiData.kdvTutari) || (Number(aiData.kdv1 || 0) + Number(aiData.kdv10 || 0) + Number(aiData.kdv20 || 0));
        const oivTutari = Number(aiData.oivTutari) || 0;
        const matrah = Number(aiData.matrah) || Math.max(0, Math.round((toplamTutar - kdvTutari - oivTutari) * 100) / 100);
        const kdvOrani = Number(aiData.kdvOrani) || 20;

        // Geçmiş alış/satış kayıtlarından muhasebe kodu tahmini
        let guessedCode = row.yon === 'ALIS' ? '770.01' : '600.01';
        if (aiData.cariVkn) {
          const pastRs = await client.execute({
            sql: row.yon === 'ALIS'
              ? "SELECT muhasebe_kodu FROM alis_faturalari WHERE company_id = ? AND tedarikci_vkn = ? AND muhasebe_kodu IS NOT NULL AND muhasebe_kodu != '' ORDER BY id DESC LIMIT 1"
              : "SELECT muhasebe_kodu FROM satis_faturalari WHERE company_id = ? AND tc_vkn = ? AND muhasebe_kodu IS NOT NULL AND muhasebe_kodu != '' ORDER BY id DESC LIMIT 1",
            args: [row.company_id, String(aiData.cariVkn).trim()]
          });
          if (pastRs.rows?.[0]?.muhasebe_kodu) guessedCode = pastRs.rows[0].muhasebe_kodu;
        }

        const karsiKod = row.yon === 'ALIS'
          ? (aiData.odemeSekli === 'NAKIT' ? '100.01' : '320.01')
          : (aiData.odemeSekli === 'NAKIT' ? '100.01' : '120.01');

        const mahsupSatirlari = buildDefaultMahsupSatirlari(
          row.yon,
          { ...aiData, matrah, kdvTutari, oivTutari, toplamTutar, kdvOrani },
          guessedCode,
          karsiKod
        );

        await client.execute({
          sql: `UPDATE evrak_havuzu SET
                  durum = 'hazir',
                  hata_mesaji = NULL,
                  fatura_no = ?,
                  fatura_tarihi = ?,
                  cari_adi = ?,
                  cari_vkn = ?,
                  mal_hizmet = ?,
                  matrah = ?,
                  kdv_orani = ?,
                  kdv_tutari = ?,
                  kdv1 = ?,
                  kdv10 = ?,
                  kdv20 = ?,
                  oiv_tutari = ?,
                  toplam_tutar = ?,
                  muhasebe_kodu = ?,
                  karsi_hesap_kodu = ?,
                  odeme_sekli = ?,
                  mahsup_satirlari = ?,
                  ai_raw_json = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
          args: [
            aiData.faturaNo || '',
            aiData.faturaTarihi || new Date().toISOString().split('T')[0],
            aiData.cariAdi || '',
            aiData.cariVkn || '',
            aiData.malHizmet || '',
            matrah,
            kdvOrani,
            kdvTutari,
            Number(aiData.kdv1) || 0,
            Number(aiData.kdv10) || 0,
            Number(aiData.kdv20) || 0,
            oivTutari,
            toplamTutar,
            guessedCode,
            karsiKod,
            aiData.odemeSekli || 'CARI_HESAP',
            JSON.stringify(mahsupSatirlari),
            JSON.stringify(aiData),
            row.id
          ]
        });
      } catch (err) {
        await client.execute({
          sql: "UPDATE evrak_havuzu SET durum = 'hata', hata_mesaji = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          args: [err?.message || 'AI analiz hatası', row.id]
        });
      }

      // Kota sınırı için kısa bekleme
      await new Promise((r) => setTimeout(r, 1500));
    }
  } catch (err) {
    console.error('[EvrakAiWorker] Kuyruk hatası:', err.message);
  } finally {
    isWorkerRunning = false;
  }
}

export function triggerEvrakWorker() {
  setTimeout(() => {
    processNextEvrakQueue().catch(() => {});
  }, 150);
}

export function startEvrakWorker() {
  if (workerTimer) return;
  // Yarım kalmış 'isleniyor' kayıtlarını 'bekliyor' yap
  client.execute("UPDATE evrak_havuzu SET durum = 'bekliyor' WHERE durum = 'isleniyor'").catch(() => {});
  workerTimer = setInterval(() => {
    processNextEvrakQueue().catch(() => {});
  }, 15000);
  triggerEvrakWorker();
}
