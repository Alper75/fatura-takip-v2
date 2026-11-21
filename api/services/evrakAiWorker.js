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

async function callAiForFile(settings, base64Data, mimeType, lucaLeafAccounts = []) {
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

  const lucaHint = lucaLeafAccounts.length > 0
    ? `\n\nŞirketin Luca Alt Hesap Planı (uygunsa "muhasebeKodu" alanına bu listeden en spesifik ALT hesabı yaz):\n` +
      lucaLeafAccounts
        .filter((a) => /^(15|73|74|76|77|78|25|60)/.test(String(a.kod || '').trim()))
        .slice(0, 100)
        .map((a) => `${a.kod}: ${a.ad}`)
        .join('\n')
    : '';
  const fullPrompt = AI_INVOICE_PROMPT + lucaHint;

  let rawText = '';

  if (provider === 'evren') {
    if (!eKey) throw new Error('Evren API Key eksik.');
    const res = await evrenClient.analyzeDocument({
      imageBase64: base64Data,
      mimeType: mimeType || 'image/jpeg',
      apiKey: eKey,
      model: eModel || 'dots-ocr',
      prompt: fullPrompt,
    });
    if (!res) throw new Error('Evren AI yanıt döndüremedi.');
    rawText = typeof res === 'string' ? res : JSON.stringify(res);
  } else if (provider === 'gemini') {
    if (!gKey) throw new Error('Gemini API Key eksik.');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${gKey}`;
    const r = await axios.post(url, {
      contents: [{
        parts: [
          { text: fullPrompt },
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
          { type: 'text', text: fullPrompt },
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
          { type: 'text', text: fullPrompt },
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
          { type: 'text', text: fullPrompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
        ]
      }]
    }, { headers: { Authorization: `Bearer ${nKey}` }, timeout: 60000 });
    rawText = r.data?.choices?.[0]?.message?.content || '';
  }

  const cleaned = String(rawText).replace(/```json|```/gi, '').trim();
  const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
  if (!jsonMatch) throw new Error('AI geçerli JSON döndüremedi.');
  return normalizeAiPayload(JSON.parse(jsonMatch[0]));
}

function toNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v === undefined || v === null || v === '') return 0;
  const s = String(v).replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeAiPayload(raw) {
  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (Array.isArray(raw?.faturalar)) list = raw.faturalar;
  else if (raw && typeof raw === 'object') list = [raw];

  if (list.length === 0) return {};

  const first = list[0];
  let kdv1 = 0;
  let kdv10 = 0;
  let kdv20 = 0;
  let kdvTutari = 0;
  let toplamTutar = 0;
  let matrah = 0;
  let oivTutari = 0;
  let bestOran = toNum(first.kdvOrani ?? first.kdv_orani) || 20;

  if (list.length === 1) {
    kdv1 = toNum(first.kdv1);
    kdv10 = toNum(first.kdv10);
    kdv20 = toNum(first.kdv20);
    kdvTutari = toNum(first.kdvTutari ?? first.toplam_kdv ?? first.kdv) || (kdv1 + kdv10 + kdv20);
    oivTutari = toNum(first.oivTutari ?? first.oiv_tutari);
    toplamTutar = toNum(first.toplamTutar ?? first.genel_toplam ?? first.tutar);
    matrah = toNum(first.matrah);
  } else {
    let maxKdvAmt = -1;
    for (const item of list) {
      const oran = toNum(item.kdvOrani ?? item.kdv_orani) || 20;
      const t = toNum(item.toplamTutar ?? item.genel_toplam ?? item.tutar);
      const k = toNum(item.kdvTutari ?? item.toplam_kdv ?? item.kdv);
      const o = toNum(item.oivTutari ?? item.oiv_tutari);
      const m = toNum(item.matrah) || (t > 0 ? Math.max(0, t - k - o) : 0);

      toplamTutar += t;
      kdvTutari += k;
      matrah += m;
      oivTutari += o;
      if (oran === 1) kdv1 += k;
      else if (oran === 8 || oran === 10) kdv10 += k;
      else if (oran === 18 || oran === 20) kdv20 += k;

      if (k > maxKdvAmt) {
        maxKdvAmt = k;
        bestOran = oran;
      }
    }
  }

  return {
    faturaNo: first.faturaNo || first.fatura_no || '',
    faturaTarihi: first.faturaTarihi || first.fatura_tarihi || '',
    cariAdi: first.cariAdi || first.tedarikciAdi || first.unvan || '',
    cariVkn: first.cariVkn || first.tedarikciVkn || first.vkn || '',
    malHizmet: first.malHizmet || first.malHizmetAdi || first.aciklama || '',
    muhasebeKodu: first.muhasebeKodu || first.muhasebe_kodu || '',
    matrah: Math.round(matrah * 100) / 100,
    kdvOrani: bestOran,
    kdvTutari: Math.round(kdvTutari * 100) / 100,
    kdv1: Math.round(kdv1 * 100) / 100,
    kdv10: Math.round(kdv10 * 100) / 100,
    kdv20: Math.round(kdv20 * 100) / 100,
    oivTutari: Math.round(oivTutari * 100) / 100,
    toplamTutar: Math.round(toplamTutar * 100) / 100,
    odemeSekli: first.odemeSekli || first.odeme_sekli || 'CARI_HESAP',
  };
}

function getLeafAccounts(allAccounts) {
  const codes = allAccounts.map((a) => String(a.kod || '').trim()).filter(Boolean);
  return allAccounts.filter((a) => {
    const k = String(a.kod || '').trim();
    if (!k) return false;
    // Alt hesabı olan üst hesapları ele (ör. 770 veya 770.01'in altında 770.01.001 varsa 770.01 üst hesaptır)
    return !codes.some((other) => other !== k && (other.startsWith(k + '.') || other.startsWith(k + ' ') || other.startsWith(k + '-')));
  });
}

function findBestAccountByKeywords(leafAccounts, prefixes, text) {
  const cleanText = String(text || '').toLowerCase();
  const candidates = leafAccounts.filter((a) => prefixes.some((p) => String(a.kod || '').startsWith(p)));
  if (candidates.length === 0) return null;

  if (cleanText) {
    const tokens = cleanText.split(/[\s,.\-_/()]+/).filter((t) => t.length >= 3);
    let bestAcc = null;
    let bestScore = 0;
    for (const acc of candidates) {
      const adLower = String(acc.ad || '').toLowerCase();
      let score = 0;
      for (const tok of tokens) {
        if (adLower.includes(tok)) score += tok.length;
      }
      if (score > bestScore) {
        bestScore = score;
        bestAcc = acc;
      }
    }
    if (bestAcc && bestScore >= 3) return bestAcc.kod;
  }
  return null;
}

function buildDefaultMahsupSatirlari(yon, data, muhasebeKodu, karsiKod, lucaKdv = {}, accountMap = new Map()) {
  const matrah = Number(data.matrah) || 0;
  const kdv1 = Number(data.kdv1) || 0;
  const kdv10 = Number(data.kdv10) || 0;
  const kdv20 = Number(data.kdv20) || 0;
  const kdvTutari = Number(data.kdvTutari) || (kdv1 + kdv10 + kdv20);
  const oiv = Number(data.oivTutari) || 0;
  const toplam = Number(data.toplamTutar) || (matrah + kdvTutari + oiv);
  const aciklama = `${data.faturaNo || ''} ${data.cariAdi || ''}`.trim();

  const accName = (kod, fallback) => accountMap.get(String(kod || '').trim()) || fallback;
  const alisKdvKod = (oran) => lucaKdv?.alis?.[String(oran)] || (oran === 1 ? '191.01' : oran === 10 ? '191.10' : '191.20');
  const satisKdvKod = (oran) => lucaKdv?.satis?.[String(oran)] || (oran === 1 ? '391.01' : oran === 10 ? '391.10' : '391.20');

  const rows = [];
  let madde = 1;

  if (yon === 'ALIS') {
    if (matrah > 0) {
      const mKod = muhasebeKodu || lucaKdv?.alis_matrah?.[String(data.kdvOrani || 20)] || lucaKdv?.varsayilanAlisKodu || '770.01';
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: mKod, ad: accName(mKod, 'Mal / Hizmet Gideri'), borc: matrah, alacak: 0, aciklama });
    }
    if (kdv1 > 0) {
      const k1 = alisKdvKod(1);
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: k1, ad: accName(k1, 'İndirilecek KDV %1'), borc: kdv1, alacak: 0, aciklama });
    }
    if (kdv10 > 0) {
      const k10 = alisKdvKod(10);
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: k10, ad: accName(k10, 'İndirilecek KDV %10'), borc: kdv10, alacak: 0, aciklama });
    }
    if (kdv20 > 0) {
      const k20 = alisKdvKod(20);
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: k20, ad: accName(k20, 'İndirilecek KDV %20'), borc: kdv20, alacak: 0, aciklama });
    }
    if (kdv1 === 0 && kdv10 === 0 && kdv20 === 0 && kdvTutari > 0) {
      const oranNum = Number(data.kdvOrani) || 20;
      const normOran = oranNum === 8 ? 10 : oranNum === 18 ? 20 : oranNum;
      const kKod = alisKdvKod(normOran);
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: kKod, ad: accName(kKod, `İndirilecek KDV %${normOran}`), borc: kdvTutari, alacak: 0, aciklama });
    }
    if (oiv > 0) {
      const oivKod = lucaKdv?.oivKodu || '689.01';
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: oivKod, ad: accName(oivKod, 'ÖİV / Konaklama KKEG'), borc: oiv, alacak: 0, aciklama });
    }
    if (toplam > 0) {
      const cKod = karsiKod || (data.odemeSekli === 'NAKIT' ? '100.01' : '320.01');
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: cKod, ad: accName(cKod, 'Satıcılar / Kasa'), borc: 0, alacak: toplam, aciklama });
    }
  } else {
    if (toplam > 0) {
      const cKod = karsiKod || (data.odemeSekli === 'NAKIT' ? '100.01' : '120.01');
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: cKod, ad: accName(cKod, 'Alıcılar / Kasa'), borc: toplam, alacak: 0, aciklama });
    }
    if (matrah > 0) {
      const mKod = muhasebeKodu || lucaKdv?.satis_matrah?.[String(data.kdvOrani || 20)] || lucaKdv?.varsayilanSatisKodu || '600.01';
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: mKod, ad: accName(mKod, 'Yurt İçi Satışlar'), borc: 0, alacak: matrah, aciklama });
    }
    if (kdvTutari > 0) {
      const oranNum = Number(data.kdvOrani) || 20;
      const normOran = oranNum === 8 ? 10 : oranNum === 18 ? 20 : oranNum;
      const kKod = satisKdvKod(normOran);
      rows.push({ id: `m_${madde}`, maddeNo: madde++, kod: kKod, ad: accName(kKod, `Hesaplanan KDV %${normOran}`), borc: 0, alacak: kdvTutari, aciklama });
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

        let lucaKdv = {};
        if (settings.luca_kdv_ayarlari) {
          try { lucaKdv = JSON.parse(settings.luca_kdv_ayarlari); } catch {}
        }

        const lucaRs = await client.execute({
          sql: 'SELECT kod, ad FROM luca_hesap_plani WHERE company_id = ? ORDER BY kod ASC',
          args: [row.company_id]
        });
        const allLucaAccounts = lucaRs.rows || [];
        const leafLucaAccounts = getLeafAccounts(allLucaAccounts);
        const accountMap = new Map(allLucaAccounts.map((a) => [String(a.kod || '').trim(), String(a.ad || '').trim()]));

        const aiData = await callAiForFile(settings, base64Data, row.mime_type || 'image/jpeg', leafLucaAccounts);

        const toplamTutar = Number(aiData.toplamTutar) || 0;
        const kdvTutari = Number(aiData.kdvTutari) || (Number(aiData.kdv1 || 0) + Number(aiData.kdv10 || 0) + Number(aiData.kdv20 || 0));
        const oivTutari = Number(aiData.oivTutari) || 0;
        const matrah = Number(aiData.matrah) || Math.max(0, Math.round((toplamTutar - kdvTutari - oivTutari) * 100) / 100);
        const kdvOrani = Number(aiData.kdvOrani) || 20;

        // 1. Önce yapay_zeka_kurallari tablosundan kural kontrolü
        let guessedCode = '';
        const textForMatch = `${aiData.cariAdi || ''} ${aiData.malHizmet || ''}`.toLowerCase();
        const rulesRs = await client.execute({
          sql: 'SELECT anahtar_kelime, muhasebe_kodu FROM yapay_zeka_kurallari WHERE company_id = ?',
          args: [row.company_id]
        }).catch(() => ({ rows: [] }));
        for (const r of rulesRs.rows || []) {
          if (r.anahtar_kelime && textForMatch.includes(String(r.anahtar_kelime).toLowerCase())) {
            guessedCode = r.muhasebe_kodu;
            break;
          }
        }

        // 2. Geçmiş faturalardan VKN eşleşmesi
        if (!guessedCode && aiData.cariVkn) {
          const pastRs = await client.execute({
            sql: row.yon === 'ALIS'
              ? "SELECT muhasebe_kodu FROM alis_faturalari WHERE company_id = ? AND tedarikci_vkn = ? AND muhasebe_kodu IS NOT NULL AND muhasebe_kodu != '' ORDER BY id DESC LIMIT 1"
              : "SELECT muhasebe_kodu FROM satis_faturalari WHERE company_id = ? AND tc_vkn = ? AND muhasebe_kodu IS NOT NULL AND muhasebe_kodu != '' ORDER BY id DESC LIMIT 1",
            args: [row.company_id, String(aiData.cariVkn).trim()]
          });
          if (pastRs.rows?.[0]?.muhasebe_kodu) guessedCode = pastRs.rows[0].muhasebe_kodu;
        }

        // 3. AI'ın döndürdüğü yaprak hesap kodu veya Luca Hesap Planı'ndan kelime bazlı alt hesap bulma
        if (!guessedCode && aiData.muhasebeKodu && leafLucaAccounts.some((a) => a.kod === aiData.muhasebeKodu)) {
          guessedCode = aiData.muhasebeKodu;
        }
        if (!guessedCode) {
          const prefixes = row.yon === 'ALIS' ? ['770', '740', '730', '760', '153', '150'] : ['600', '602'];
          guessedCode = findBestAccountByKeywords(leafLucaAccounts, prefixes, textForMatch) || '';
        }
        if (!guessedCode) {
          const kdvStr = String(kdvOrani === 8 ? 10 : kdvOrani === 18 ? 20 : kdvOrani);
          guessedCode = row.yon === 'ALIS'
            ? (lucaKdv?.alis_matrah?.[kdvStr] || lucaKdv?.varsayilanAlisKodu || leafLucaAccounts.find((a) => String(a.kod).startsWith('770'))?.kod || '770.01')
            : (lucaKdv?.satis_matrah?.[kdvStr] || lucaKdv?.varsayilanSatisKodu || leafLucaAccounts.find((a) => String(a.kod).startsWith('600'))?.kod || '600.01');
        }

        // Karşı hesap (320 / 120 / 100 alt hesabı)
        let karsiKod = '';
        if (aiData.odemeSekli === 'NAKIT') {
          karsiKod = leafLucaAccounts.find((a) => String(a.kod).startsWith('100'))?.kod || '100.01';
        } else {
          const cPrefixes = row.yon === 'ALIS' ? ['320'] : ['120'];
          karsiKod = findBestAccountByKeywords(leafLucaAccounts, cPrefixes, aiData.cariAdi)
            || leafLucaAccounts.find((a) => String(a.kod).startsWith(cPrefixes[0]))?.kod
            || (row.yon === 'ALIS' ? '320.01' : '120.01');
        }

        const mahsupSatirlari = buildDefaultMahsupSatirlari(
          row.yon,
          { ...aiData, matrah, kdvTutari, oivTutari, toplamTutar, kdvOrani },
          guessedCode,
          karsiKod,
          lucaKdv,
          accountMap
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
