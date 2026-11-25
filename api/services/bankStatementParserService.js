import { createRequire } from 'module';
import * as XLSX from 'xlsx';
import { client } from '../db.js';
import { evrenClient } from './evrenClient.js';

const require = createRequire(import.meta.url);

let cachedPdfParse = undefined;
function getPdfParse() {
  if (cachedPdfParse !== undefined) return cachedPdfParse;
  try {
    // pdf-parse/lib/pdf-parse.js doğrudan yüklenerek ESM altındaki test dosyası okuma hatası önlenir
    cachedPdfParse = require('pdf-parse/lib/pdf-parse.js');
  } catch (err) {
    console.warn('[BankStatementParser] pdf-parse paketi bulunamadı (npm install çalıştırılmamış olabilir), AI/OCR yedeği kullanılacak:', err.message);
    cachedPdfParse = null;
  }
  return cachedPdfParse;
}

const MAX_CHUNK_CHARS = 32000;
const MAX_TOTAL_CHARS = 300000;
const AI_TIMEOUT_MS = 95000;

function decodeTextBuffer(buffer) {
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    return utf8Decoder.decode(buffer);
  } catch {
    // Türk bankalarının CSV/TXT çıktıları sıklıkla Windows-1254 (ISO-8859-9) kodlamalıdır
    try {
      const trDecoder = new TextDecoder('windows-1254');
      return trDecoder.decode(buffer);
    } catch {
      return buffer.toString('utf8');
    }
  }
}

function formatExcelCell(cell) {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date && !isNaN(cell.getTime())) {
    const d = String(cell.getDate()).padStart(2, '0');
    const m = String(cell.getMonth() + 1).padStart(2, '0');
    const y = cell.getFullYear();
    return `${d}.${m}.${y}`;
  }
  if (typeof cell === 'number') {
    if (Number.isInteger(cell)) return String(cell);
    return cell.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(cell).replace(/[\r\n\t]+/g, ' ').trim();
}

function workbookToText(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const parts = [];
  const multiSheet = wb.SheetNames.length > 1;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rows || rows.length === 0) continue;

    const lines = [];
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const cells = row.map(formatExcelCell);
      if (!cells.some((c) => c.length > 0)) continue;
      lines.push(cells.join('\t'));
    }

    if (lines.length > 0) {
      if (multiSheet) {
        parts.push(`--- Sayfa: ${sheetName} ---`);
      }
      parts.push(lines.join('\n'));
    }
  }

  return parts.join('\n');
}

function splitIntoLineChunks(text, maxChars = MAX_CHUNK_CHARS) {
  const capped = text.length > MAX_TOTAL_CHARS ? text.slice(0, MAX_TOTAL_CHARS) : text;
  if (capped.length <= maxChars) return [capped];

  const lines = capped.split(/\r?\n/);
  const headerContext = lines.slice(0, 8).join('\n');
  const chunks = [];
  let current = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (current.length + line.length + 1 > maxChars && current.length > 0) {
      chunks.push(current);
      current = i >= 8 ? `[Üst Başlık Bağlamı]\n${headerContext}\n[Devam Eden Satırlar]\n${line}` : line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current.trim().length > 0) {
    chunks.push(current);
  }
  return chunks;
}

function parseFlexibleNumber(raw) {
  if (typeof raw === 'number') return Math.abs(raw);
  let s = String(raw || '').trim();
  if (!s) return 0;
  s = s.replace(/[^0-9,.-]/g, '');
  if (!s) return 0;

  if (s.includes('.') && s.includes(',')) {
    // Son ayraç hangisiyse ondalık ayracı odur (1.234,56 vs 1,234.56)
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
      // Binlik ayraç olma ihtimali düşüktür ama 2 hane standart kuruştur; 1,250.00 değilse ondalık kabul et
      s = s.replace(',', '.');
    } else {
      s = s.replace(',', '.');
    }
  }

  const num = parseFloat(s);
  return Number.isFinite(num) ? Math.abs(num) : 0;
}

function normalizeIsoDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';

  // YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD.MM.YYYY veya DD/MM/YYYY veya DD-MM-YYYY
  const trMatch = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (trMatch) {
    let [, d, m, y] = trMatch;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return '';
}

function parsePipeDelimitedOutput(rawOutput) {
  if (!rawOutput || typeof rawOutput !== 'string') return [];

  const cleaned = rawOutput
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:csv|text|plain|json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  // Eğer model yine de JSON döndürdüyse destekle
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    try {
      const parsed = JSON.parse(cleaned);
      const arr = Array.isArray(parsed) ? parsed : (parsed.hareketler || parsed.rows || parsed.sonuclar || []);
      if (Array.isArray(arr)) {
        return arr
          .map((item) => {
            const tarih = normalizeIsoDate(item.tarih || item.date);
            const tutar = parseFlexibleNumber(item.tutar ?? item.amount);
            const rawDir = String(item.yon || item.tip || item.type || '').toUpperCase();
            const tip = rawDir.includes('CIK') || rawDir.includes('BORC') || rawDir === 'OUT' ? 'borc' : 'alacak';
            const aciklama = String(item.aciklama || item.description || '').replace(/\s+/g, ' ').trim();
            if (!tarih || !tutar) return null;
            return { tarih, aciklama, tutar, tip };
          })
          .filter(Boolean);
      }
    } catch {
      // Satır bazlı ayrıştırmaya düş
    }
  }

  const rows = [];
  const lines = cleaned.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Başlık satırını atla
    const upper = line.toUpperCase();
    if (
      (upper.startsWith('TARIH|') || upper.startsWith('TARİH|') || upper.startsWith('TARIH;')) &&
      (upper.includes('TUTAR') || upper.includes('ACIKLAMA') || upper.includes('AÇIKLAMA'))
    ) {
      continue;
    }

    const delimiter = line.includes('|') ? '|' : ';';
    const parts = line.split(delimiter).map((p) => p.trim());
    if (parts.length < 4) continue;

    const tarih = normalizeIsoDate(parts[0]);
    if (!tarih) continue;

    const dirRaw = parts[1].toUpperCase();
    const rawAmountStr = parts[2];
    const tutar = parseFlexibleNumber(rawAmountStr);
    if (!tutar || tutar <= 0) continue;

    const aciklama = parts.slice(3).join(' - ').replace(/\s+/g, ' ').trim();

    let tip = 'alacak';
    if (
      dirRaw.includes('CIK') ||
      dirRaw.includes('ÇIK') ||
      dirRaw === 'BORC' ||
      dirRaw === 'BORÇ' ||
      dirRaw === 'OUT' ||
      dirRaw === '-' ||
      String(rawAmountStr).trim().startsWith('-')
    ) {
      tip = 'borc';
    } else {
      tip = 'alacak';
    }

    rows.push({ tarih, aciklama, tutar, tip });
  }

  return rows;
}

const STATEMENT_SYSTEM_PROMPT = `Sen Türkiye'deki tüm bankaların (Ziraat, Vakıfbank, Halkbank, İş Bankası, Garanti BBVA, Yapı Kredi, Akbank, QNB, Denizbank, Kuveyt Türk, Türkiye Finans, Albaraka, Enpara, TEB vb.) PDF ve Excel hesap ekstrelerini hatasız okuyan uzman bir Mali Müşavir veri ayrıştırma motorusun.

GÖREVİN:
Verilen banka ekstresi içeriğindeki TÜM gerçek hesap hareketlerini tek tek çıkarıp aşağıdaki DÜZ METİN formatında döndürmektir.

ÇIKTI FORMATI (HER SATIR 4 SÜTUN, DİKEY ÇİZGİ "|" İLE AYRILMIŞ):
YYYY-MM-DD|YON|TUTAR|ACIKLAMA

KESİN KURALLAR:
1. YALNIZCA veri satırlarını yaz. Açıklama, selamlama, başlık satırı, özet veya \`\`\` kod bloğu YAZMA.
2. YYYY-MM-DD: İşlem tarihi (ör. 2026-03-15). Saat varsa at, sadece tarihi yaz.
3. YON: Sadece "GIRIS" veya "CIKIS" yaz:
   - "GIRIS": Banka hesabımıza para girişi (gelen EFT/FAST/havale, müşteri tahsilatı, POS üye işyeri geçişi, nakit yatırma, + tutar, bakiyeyi artıran işlem).
   - "CIKIS": Banka hesabımızdan para çıkışı (giden EFT/FAST/havale, tedarikçi ödemesi, komisyon/BSMV/masraf, vergi/SGK/maaş/fatura ödemesi, kredi/kart ödemesi, para çekme, - tutar, bakiyeyi azaltan işlem).
   - İPUCU: Ekstrede "Bakiye" sütunu varsa bir önceki satıra göre bakiyenin artıp azaldığını kontrol ederek GIRIS/CIKIS yönünü %100 doğrula.
4. TUTAR: İşlem tutarını pozitif ondalık sayı olarak nokta ile yaz (ör. 1234.56). Binlik ayracı ve para birimi sembolü (TL, ₺, USD) KOYMA. Bakiye sütununu DEĞİL, işlem tutarını yaz!
5. ACIKLAMA: Dekont/işlem açıklamasını, gönderen/alıcı adını, varsa VKN/TCKN veya IBAN bilgisini kısaltmadan tek satırda koru (içinde "|" geçiyorsa "-" yap).
6. Sayfa üst/alt bilgilerini, "Devreden Bakiye", "Dönem Sonu Bakiyesi", "Toplam Borç/Alacak" özet satırlarını hareket olarak EKLEME.
7. Hiçbir gerçek hareketi atlama veya özetleme.`;

async function getCompanyAiCredentials(companyId, overrides = {}) {
  const keys = [
    'ai_provider',
    'openai_api_key',
    'openai_model',
    'xai_api_key',
    'xai_model',
    'nvidia_api_key',
    'nvidia_model',
    'gemini_api_key',
    'gemini_model',
    'evren_api_key',
    'evren_model',
  ];

  const placeholders = keys.map(() => '?').join(',');
  const rs = await client
    .execute({
      sql: `SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN (${placeholders})`,
      args: [companyId, ...keys],
    })
    .catch(() => ({ rows: [] }));

  const map = {};
  for (const row of rs.rows || []) {
    map[row.setting_key] = row.setting_value || '';
  }

  let geminiApiKey = (overrides.geminiApiKey || map.gemini_api_key || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
  if (geminiApiKey.includes('AIzaSyDOAnAKwOlBR4uWpEn8IYvZcHGx3XCI1UY')) {
    geminiApiKey = '';
  }

  const creds = {
    activeProvider: (overrides.provider || map.ai_provider || '').trim(),
    openaiApiKey: (overrides.openaiApiKey || map.openai_api_key || process.env.OPENAI_API_KEY || '').trim(),
    openaiModel: (overrides.openaiModel || map.openai_model || 'gpt-4o-mini').trim(),
    xaiApiKey: (overrides.xaiApiKey || map.xai_api_key || process.env.XAI_API_KEY || '').trim(),
    xaiModel: (overrides.xaiModel || map.xai_model || 'grok-2-vision-1212').trim(),
    nvidiaApiKey: (overrides.nvidiaApiKey || map.nvidia_api_key || process.env.NVIDIA_API_KEY || '').trim(),
    nvidiaModel: (overrides.nvidiaModel || map.nvidia_model || 'stepfun-ai/step-5-preview').trim(),
    geminiApiKey,
    geminiModel: (overrides.geminiModel || map.gemini_model || 'gemini-2.5-flash').trim(),
    evrenApiKey: (overrides.evrenApiKey || map.evren_api_key || process.env.EVREN_API_KEY || '').trim(),
    evrenModel: (overrides.evrenModel || map.evren_model || 'gemma-4-31b').trim(),
  };

  const hasProviderKey = (p) => {
    if (p === 'openai') return !!creds.openaiApiKey;
    if (p === 'gemini') return !!creds.geminiApiKey;
    if (p === 'evren') return !!creds.evrenApiKey;
    if (p === 'grok' || p === 'xai') return !!creds.xaiApiKey;
    if (p === 'nvidia') return !!creds.nvidiaApiKey;
    return false;
  };

  if (!hasProviderKey(creds.activeProvider)) {
    if (creds.geminiApiKey) creds.activeProvider = 'gemini';
    else if (creds.openaiApiKey) creds.activeProvider = 'openai';
    else if (creds.evrenApiKey) creds.activeProvider = 'evren';
    else if (creds.xaiApiKey) creds.activeProvider = 'grok';
    else if (creds.nvidiaApiKey) creds.activeProvider = 'nvidia';
  }

  return creds;
}

async function callTextLlmChunk(chunkText, creds) {
  const userMessage = `Aşağıdaki banka ekstresi içeriğindeki tüm hareketleri YYYY-MM-DD|YON|TUTAR|ACIKLAMA formatında çıkar:\n\n---\n${chunkText}\n---`;

  if (creds.activeProvider === 'gemini' && creds.geminiApiKey) {
    let model = creds.geminiModel || 'gemini-2.5-flash';
    if (model === 'gemini-3.8-flash' || model === 'gemini-3.6-flash') model = 'gemini-2.5-flash';
    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${creds.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: STATEMENT_SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: {
            maxOutputTokens: 16384,
            temperature: 0.1,
          },
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      }
    );
    const gData = await gRes.json();
    if (gData.error) {
      throw new Error(`Gemini (${model}): ${gData.error.message}`);
    }
    return gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (creds.activeProvider === 'openai' && creds.openaiApiKey) {
    const oRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: creds.openaiModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: STATEMENT_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 16384,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    const oData = await oRes.json();
    if (!oRes.ok) {
      throw new Error(oData.error?.message || `OpenAI HTTP ${oRes.status}`);
    }
    return oData.choices?.[0]?.message?.content || '';
  }

  if (creds.activeProvider === 'evren' && creds.evrenApiKey) {
    const textModel = creds.evrenModel && creds.evrenModel !== 'dots-ocr' ? creds.evrenModel : 'gemma-4-31b';
    return await evrenClient.chatCompletion({
      messages: [
        { role: 'system', content: STATEMENT_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      apiKey: creds.evrenApiKey,
      model: textModel,
      temperature: 0.1,
    });
  }

  if ((creds.activeProvider === 'grok' || creds.activeProvider === 'xai') && creds.xaiApiKey) {
    const xRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.xaiApiKey}`,
      },
      body: JSON.stringify({
        model: creds.xaiModel || 'grok-2-vision-1212',
        messages: [
          { role: 'system', content: STATEMENT_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 8192,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    const xData = await xRes.json();
    if (!xRes.ok) {
      throw new Error(xData.error?.message || `Grok HTTP ${xRes.status}`);
    }
    return xData.choices?.[0]?.message?.content || '';
  }

  if (creds.activeProvider === 'nvidia' && creds.nvidiaApiKey) {
    const nvRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.nvidiaApiKey}`,
      },
      body: JSON.stringify({
        model: creds.nvidiaModel || 'meta/llama-3.2-11b-vision-instruct',
        messages: [
          { role: 'system', content: STATEMENT_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 8192,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    const nvData = await nvRes.json();
    if (!nvRes.ok) {
      throw new Error(nvData.error?.message || nvData.message || `NVIDIA HTTP ${nvRes.status}`);
    }
    return nvData.choices?.[0]?.message?.content || '';
  }

  throw new Error('Aktif bir yapay zeka API anahtarı bulunamadı. Lütfen Ayarlar bölümünden API anahtarınızı tanımlayın.');
}

async function parseScannedPdfWithVision(rawBase64, creds) {
  // 1. Gemini doğrudan çok sayfalı PDF okuyabilir
  if (creds.geminiApiKey) {
    let model = creds.geminiModel || 'gemini-2.5-flash';
    if (model === 'gemini-3.8-flash' || model === 'gemini-3.6-flash') model = 'gemini-2.5-flash';
    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${creds.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: STATEMENT_SYSTEM_PROMPT }] },
          contents: [
            {
              parts: [
                { text: 'Bu PDF banka ekstresindeki tüm hareketleri YYYY-MM-DD|YON|TUTAR|ACIKLAMA formatında çıkar.' },
                { inline_data: { mime_type: 'application/pdf', data: rawBase64 } },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 16384,
            temperature: 0.1,
          },
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      }
    );
    const gData = await gRes.json();
    if (gData.error) {
      throw new Error(`Gemini PDF OCR (${model}): ${gData.error.message}`);
    }
    const out = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parsePipeDelimitedOutput(out);
  }

  // 2. EVREN OCR yedek akışı
  if (creds.evrenApiKey) {
    const ocrText = await evrenClient.performOcr({
      imageBase64: rawBase64,
      mimeType: 'application/pdf',
      apiKey: creds.evrenApiKey,
      model: 'dots-ocr',
    });
    if (ocrText && String(ocrText).trim().length > 20) {
      const llmOut = await callTextLlmChunk(String(ocrText), creds);
      return parsePipeDelimitedOutput(llmOut);
    }
  }

  throw new Error(
    'Yüklenen PDF taranmış bir görüntü (seçilebilir metin içermiyor). Taranmış PDF ekstreleri okumak için Gemini veya EVREN API anahtarı tanımlı olmalıdır.'
  );
}

export async function parseBankStatementFile({ companyId, fileBase64, fileName = '', mimeType = '', overrides = {} }) {
  if (!fileBase64) {
    throw new Error('Dosya verisi bulunamadı.');
  }

  const creds = await getCompanyAiCredentials(companyId, overrides);
  if (
    !creds.geminiApiKey &&
    !creds.openaiApiKey &&
    !creds.evrenApiKey &&
    !creds.xaiApiKey &&
    !creds.nvidiaApiKey
  ) {
    throw new Error('Yapay zeka API anahtarı bulunamadı. Lütfen Ayarlar sayfasından bir AI anahtarı tanımlayın.');
  }

  const rawBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
  const buffer = Buffer.from(rawBase64, 'base64');
  const lowerName = (fileName || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();

  const isPdf = lowerMime === 'application/pdf' || lowerName.endsWith('.pdf');
  const isExcel =
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerMime.includes('spreadsheet') ||
    lowerMime.includes('excel');

  let extractedText = '';
  let pageCount = 1;

  if (isPdf) {
    let pdfData = null;
    try {
      const pdfParseFn = getPdfParse();
      if (pdfParseFn) {
        pdfData = await pdfParseFn(buffer);
        extractedText = (pdfData?.text || '').trim();
        pageCount = pdfData?.numpages || 1;
      }
    } catch (pdfErr) {
      console.warn('[BankStatementParser] pdf-parse uyarısı, OCR yedeğine geçiliyor:', pdfErr.message);
      extractedText = '';
    }

    const nonSpaceLen = extractedText.replace(/\s+/g, '').length;
    if (nonSpaceLen < 40) {
      const visionRows = await parseScannedPdfWithVision(rawBase64, creds);
      return {
        rows: visionRows,
        pageCount,
        method: 'vision-ocr',
        provider: creds.geminiApiKey ? 'gemini' : 'evren',
      };
    }
  } else if (isExcel) {
    extractedText = workbookToText(buffer);
  } else {
    extractedText = decodeTextBuffer(buffer);
  }

  if (!extractedText || extractedText.replace(/\s+/g, '').length < 10) {
    throw new Error('Dosya içerisinden okunabilir metin çıkarılamadı.');
  }

  const chunks = splitIntoLineChunks(extractedText, MAX_CHUNK_CHARS);
  const allRows = [];

  for (const chunk of chunks) {
    const rawOut = await callTextLlmChunk(chunk, creds);
    const parsedChunkRows = parsePipeDelimitedOutput(rawOut);
    allRows.push(...parsedChunkRows);
  }

  return {
    rows: allRows,
    pageCount,
    chunksProcessed: chunks.length,
    method: isPdf ? 'pdf-text' : isExcel ? 'excel-ai' : 'text-ai',
    provider: creds.activeProvider,
  };
}
