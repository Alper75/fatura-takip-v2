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
    console.warn(
      '[BankStatementParser] pdf-parse paketi bulunamadı, AI/OCR yedeği kullanılacak:',
      err.message
    );
    cachedPdfParse = null;
  }
  return cachedPdfParse;
}

// EVREN / OpenAI / Gemini modellerinin zaman aşımına veya çıktı kesilmesine uğramaması için küçük parçalar
const MAX_CHUNK_CHARS = 9500;
const MAX_TOTAL_CHARS = 250000;
const AI_TIMEOUT_MS = 75000;

function decodeTextBuffer(buffer) {
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    return utf8Decoder.decode(buffer);
  } catch {
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

export function parseFlexibleNumber(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.abs(raw) : 0;
  let s = String(raw || '').trim();
  if (!s) return 0;
  // Para birimi veya B/A eklerini temizle, rakam ve ayraçları tut
  s = s.replace(/[^0-9,.-]/g, '');
  if (!s) return 0;

  const dotCount = (s.match(/\./g) || []).length;
  const commaCount = (s.match(/,/g) || []).length;

  if (dotCount > 0 && commaCount > 0) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // Türkçe format: 12.345,67
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // İngilizce format: 12,345.67
      s = s.replace(/,/g, '');
    }
  } else if (commaCount > 0) {
    if (commaCount > 1) {
      // 1,234,567 -> binlik virgül
      s = s.replace(/,/g, '');
    } else {
      // Tek virgül -> kuruş ayracı (1234,56)
      s = s.replace(',', '.');
    }
  } else if (dotCount > 1) {
    // 1.234.567 -> binlik nokta
    s = s.replace(/\./g, '');
  }

  const num = parseFloat(s);
  return Number.isFinite(num) ? Math.abs(num) : 0;
}

export function normalizeIsoDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';

  // YYYY-MM-DD veya YYYY.MM.DD veya YYYY/MM/DD
  const isoMatch = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // DD.MM.YYYY veya DD/MM/YYYY veya DD-MM-YYYY
  const trMatch = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (trMatch) {
    let [, d, m, y] = trMatch;
    if (y.length === 2) y = `20${y}`;
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  return '';
}

function classifyDirectionToken(token) {
  const u = String(token || '')
    .trim()
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/Ç/g, 'C')
    .replace(/Ğ/g, 'G')
    .replace(/Ö/g, 'O')
    .replace(/Ş/g, 'S')
    .replace(/Ü/g, 'U');

  if (
    u === 'CIKIS' ||
    u === 'BORC' ||
    u === 'GIDEN' ||
    u === 'ODEME' ||
    u === 'OUT' ||
    u === 'DEBIT' ||
    u === 'B' ||
    u === '(B)' ||
    u === '-'
  ) {
    return 'borc';
  }
  if (
    u === 'GIRIS' ||
    u === 'ALACAK' ||
    u === 'GELEN' ||
    u === 'TAHSILAT' ||
    u === 'IN' ||
    u === 'CREDIT' ||
    u === 'A' ||
    u === '(A)' ||
    u === '+'
  ) {
    return 'alacak';
  }
  return null;
}

function isAmountLikeToken(token) {
  const t = String(token || '').trim();
  if (!t) return false;
  // Tarih veya IBAN veya VKN ile karışmaması için kontrol
  if (/^TR\d{10,}/i.test(t.replace(/\s+/g, ''))) return false;
  if (normalizeIsoDate(t) && /^\d{1,4}[./-]\d{1,2}[./-]\d{2,4}/.test(t)) return false;
  // Sadece rakam, nokta, virgül, +/-, TL/TRY/USD/EUR/(B)/(A) içeriyorsa tutardır
  const stripped = t
    .replace(/\b(TL|TRY|TRL|USD|EUR|GBP|BORC|BORÇ|ALACAK)\b/gi, '')
    .replace(/\([BAba]\)/g, '')
    .trim();
  if (!/^[+-]?\d[\d.,]*$/.test(stripped)) return false;
  // 10-11 haneli saf tam sayı VKN/TCKN veya dekont no olabilir; ekstrede ondalık genelde vardır veya makul tutardır
  if (/^\d{10,}$/.test(stripped)) return false;
  return parseFlexibleNumber(stripped) > 0;
}

function mapJsonArrayToRows(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const tarih = normalizeIsoDate(item.tarih || item.islemTarihi || item.date || item.TARIH);
      const rawAmount = item.tutar ?? item.islemTutari ?? item.amount ?? item.borc ?? item.alacak ?? item.TUTAR;
      const tutar = parseFlexibleNumber(rawAmount);
      const rawDir = String(item.yon || item.tip || item.tur || item.type || item.YON || '').trim();
      let tip = classifyDirectionToken(rawDir);
      if (!tip) {
        if (String(rawAmount || '').trim().startsWith('-') || (item.borc && parseFlexibleNumber(item.borc) > 0)) {
          tip = 'borc';
        } else {
          tip = 'alacak';
        }
      }
      const aciklama = String(item.aciklama || item.islemAciklamasi || item.description || item.ACIKLAMA || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!tarih || !tutar) return null;
      return { tarih, aciklama, tutar, tip };
    })
    .filter(Boolean);
}

export function parsePipeDelimitedOutput(rawOutput) {
  if (!rawOutput || typeof rawOutput !== 'string') return [];

  const cleaned = rawOutput
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:csv|tsv|text|plain|json|markdown)?/gi, '')
    .replace(/```/g, '')
    .trim();

  if (!cleaned) return [];

  // 1. Doğrudan veya metin içine gömülü JSON kontrolü
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (cleaned.startsWith('{') || cleaned.startsWith('[') || (firstBracket !== -1 && lastBracket > firstBracket && !cleaned.includes('|'))) {
    const candidates = [cleaned];
    if (firstBrace !== -1 && lastBrace > firstBrace) candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
    if (firstBracket !== -1 && lastBracket > firstBracket) candidates.push(cleaned.slice(firstBracket, lastBracket + 1));

    for (const cand of candidates) {
      try {
        const parsed = JSON.parse(cand.replace(/,\s*([}\]])/g, '$1'));
        const arr = Array.isArray(parsed)
          ? parsed
          : parsed.hareketler || parsed.rows || parsed.sonuclar || parsed.islemler || parsed.transactions || [];
        const jsonRows = mapJsonArrayToRows(arr);
        if (jsonRows.length > 0) return jsonRows;
      } catch {
        // Satır bazlı ayrıştırmaya devam et
      }
    }
  }

  // 2. Satır bazlı (|, ; veya TAB ayraçlı, Markdown tablo uyumlu) esnek ayrıştırma
  const rows = [];
  const lines = cleaned.split(/\r?\n/);

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Markdown tablo ayraç satırlarını (|---|---|) atla
    if (/^[|\s:-]+$/.test(line)) continue;

    // Baştaki liste numarasını ("1. ", "- ") ve kenardaki Markdown "|" karakterlerini temizle
    line = line.replace(/^\d+[.)]\s+/, '').replace(/^[-*•]\s+/, '');
    line = line.replace(/^\|+\s*/, '').replace(/\s*\|+$/, '').trim();
    if (!line) continue;

    const delimiter = line.includes('|') ? '|' : line.includes('\t') ? '\t' : line.includes(';') ? ';' : null;
    if (!delimiter) continue;

    const parts = line
      .split(delimiter)
      .map((p) => p.trim().replace(/^"|"$/g, ''))
      .filter((p, idx, arr) => !(p === '' && (idx === 0 || idx === arr.length - 1)));

    if (parts.length < 3) continue;

    // Başlık satırını atla
    const joinedUpper = parts.join(' ').toUpperCase();
    if (
      (joinedUpper.includes('TARIH') || joinedUpper.includes('TARİH') || joinedUpper.includes('YYYY-MM-DD')) &&
      (joinedUpper.includes('TUTAR') || joinedUpper.includes('ACIKLAMA') || joinedUpper.includes('AÇIKLAMA')) &&
      !normalizeIsoDate(parts[0])
    ) {
      continue;
    }

    // Sütun sırası değişse bile Tarih, Yön, Tutar ve Açıklama sütunlarını akıllıca bul
    let dateIdx = -1;
    let tarih = '';
    for (let i = 0; i < Math.min(parts.length, 3); i++) {
      const d = normalizeIsoDate(parts[i]);
      if (d) {
        dateIdx = i;
        tarih = d;
        break;
      }
    }
    if (dateIdx === -1 || !tarih) continue;

    let dirIdx = -1;
    let tip = null;
    for (let i = 0; i < parts.length; i++) {
      if (i === dateIdx) continue;
      const detected = classifyDirectionToken(parts[i]);
      if (detected) {
        dirIdx = i;
        tip = detected;
        break;
      }
    }

    let amountIdx = -1;
    let rawAmountStr = '';
    for (let i = 0; i < parts.length; i++) {
      if (i === dateIdx || i === dirIdx) continue;
      if (isAmountLikeToken(parts[i])) {
        amountIdx = i;
        rawAmountStr = parts[i];
        break;
      }
    }

    if (amountIdx === -1) continue;
    const tutar = parseFlexibleNumber(rawAmountStr);
    if (!tutar || tutar <= 0) continue;

    // Eğer yön ayrı sütunda gelmediyse tutar işaretinden veya (B)/(A) ekinden çıkar
    if (!tip) {
      const trimmedAmt = rawAmountStr.trim();
      if (trimmedAmt.startsWith('-') || /\(B\)|\bBOR[CÇ]\b/i.test(trimmedAmt)) {
        tip = 'borc';
      } else {
        tip = 'alacak';
      }
    }

    const descParts = parts.filter((_, idx) => idx !== dateIdx && idx !== dirIdx && idx !== amountIdx);
    const aciklama = descParts.join(' - ').replace(/\s+/g, ' ').trim() || 'Banka Hareketi';

    rows.push({ tarih, aciklama, tutar, tip });
  }

  return rows;
}

/**
 * PDF/Metin içeriğinde en azından anlamlı tarih + rakam örüntüsü olup olmadığını kontrol eder.
 * Bazı banka PDF'lerinde özel font (CMap) nedeniyle pdf-parse bozuk karakterler döndürebilir.
 */
function hasReadableStatementText(text) {
  if (!text) return false;
  const nonSpace = text.replace(/\s+/g, '');
  if (nonSpace.length < 40) return false;
  // En az 1 tarih (GG.AA.YYYY / GG/AA/YYYY / YYYY-AA-GG) içermeli
  const hasDate = /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/.test(text);
  // Alfanümerik karakter oranı makul olmalı (bozuk CMap gliflerini yakalamak için)
  const readableChars = (nonSpace.match(/[0-9A-Za-zÇĞİÖŞÜçğıöşü.,:/+-]/g) || []).length;
  const ratio = readableChars / nonSpace.length;
  return hasDate && ratio > 0.45;
}

const STATEMENT_SYSTEM_PROMPT = `Sen Türkiye'deki tüm bankaların (Ziraat, Vakıfbank, Halkbank, İş Bankası, Garanti BBVA, Yapı Kredi, Akbank, QNB, Denizbank, Kuveyt Türk, Türkiye Finans, Albaraka, Enpara, TEB vb.) PDF ve Excel hesap ekstrelerini hatasız okuyan uzman bir Mali Müşavir veri ayrıştırma motorusun.

GÖREVİN:
Verilen banka ekstresi içeriğindeki TÜM gerçek hesap hareketlerini tek tek çıkarıp aşağıdaki DÜZ METİN formatında döndürmektir.

ÇIKTI FORMATI (HER SATIR TAM 4 SÜTUN, DİKEY ÇİZGİ "|" İLE AYRILMIŞ):
YYYY-MM-DD|YON|TUTAR|ACIKLAMA

ÖRNEK ÇIKTI:
2026-03-12|CIKIS|1450.75|FAST ODEME - ABC TEDARIK LTD STI
2026-03-14|GIRIS|25000.00|GELEN HAVALE - XYZ MUSTERI A.S.
2026-03-14|CIKIS|12.50|EFT ISLEM UCRETI VE BSMV

KESİN KURALLAR:
1. YALNIZCA veri satırlarını yaz. Başta/sonda "|" koyma, açıklama, başlık satırı veya \`\`\` kod bloğu YAZMA.
2. YYYY-MM-DD: İşlem tarihi (ör. 2026-03-15). Saat varsa at, sadece tarihi yaz.
3. YON: Sadece "GIRIS" veya "CIKIS" yaz:
   - "GIRIS": Hesaba para girişi (gelen EFT/FAST/havale, tahsilat, POS geçişi, para yatırma, + tutar, Alacak/A, bakiyeyi artıran işlem).
   - "CIKIS": Hesaptan para çıkışı (giden EFT/FAST/havale, ödeme, komisyon/BSMV/masraf, vergi/SGK/maaş/fatura/kart ödemesi, para çekme, - tutar, Borç/B, bakiyeyi azaltan işlem).
   - İPUCU: Ekstrede "Bakiye" sütunu varsa bir önceki satıra göre bakiyenin artıp azaldığını kontrol ederek GIRIS/CIKIS yönünü %100 doğrula.
4. TUTAR: İşlem tutarını pozitif sayı olarak NOKTA ondalık ayracıyla yaz (ör. 1234.56 veya 25000.00). Binlik ayracı ve TL/₺/USD sembolü KOYMA. Bakiye sütununu DEĞİL, işlem tutarını yaz!
5. ACIKLAMA: İşlem açıklamasını, karşı taraf unvanını, varsa VKN/TCKN veya IBAN bilgisini tek satırda koru (içinde "|" geçiyorsa "-" yap).
6. "Devreden Bakiye", "Dönem Sonu Bakiyesi", "Toplam Borç/Alacak" özet satırlarını EKLEME.`;

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

  let geminiApiKey = (
    overrides.geminiApiKey ||
    map.gemini_api_key ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ''
  ).trim();
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

async function callSingleProviderText(provider, userMessage, creds) {
  if (provider === 'gemini' && creds.geminiApiKey) {
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

  if (provider === 'openai' && creds.openaiApiKey) {
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

  if (provider === 'evren' && creds.evrenApiKey) {
    // evrenClient.chatCompletion içindeki 18sn timeout ve sessiz boş dönüş (return '') yerine
    // ekstre analizine uygun 65sn timeout ve çoklu model denemesiyle doğrudan çağırıyoruz
    await evrenClient.ensureTermsAccepted(creds.evrenApiKey);
    const preferred =
      creds.evrenModel && !creds.evrenModel.includes('ocr') ? creds.evrenModel : 'gemma-4-31b';
    const candidateModels = Array.from(
      new Set([preferred, 'gemma-4-31b', 'deepseek-v4-flash', 'qwen3.8-flash-next'].filter(Boolean))
    );

    let lastEvrenErr = '';
    for (const m of candidateModels) {
      try {
        const evRes = await fetch(evrenClient.chatEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${creds.evrenApiKey.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: 'system', content: STATEMENT_SYSTEM_PROMPT },
              { role: 'user', content: userMessage },
            ],
            max_tokens: 8192,
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(65000),
        });

        const evData = await evRes.json().catch(() => ({}));
        if (!evRes.ok) {
          const msg = evData?.error?.message || evData?.message || `HTTP ${evRes.status}`;
          lastEvrenErr = `EVREN (${m}): ${msg}`;
          if (evRes.status === 401) throw new Error(lastEvrenErr);
          continue;
        }

        const choiceMsg = evData?.choices?.[0]?.message;
        const content = (choiceMsg?.content || choiceMsg?.reasoning_content || '').trim();
        if (content) return content;
        lastEvrenErr = `EVREN (${m}) boş yanıt döndürdü.`;
      } catch (err) {
        lastEvrenErr = `EVREN (${m}): ${err.message}`;
        if (err.message?.includes('401')) throw err;
      }
    }
    throw new Error(lastEvrenErr || 'EVREN servisinden yanıt alınamadı.');
  }

  if ((provider === 'grok' || provider === 'xai') && creds.xaiApiKey) {
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
    return xData.choices?.[0]?.message?.content || xData.choices?.[0]?.message?.reasoning_content || '';
  }

  if (provider === 'nvidia' && creds.nvidiaApiKey) {
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
    return nvData.choices?.[0]?.message?.content || nvData.choices?.[0]?.message?.reasoning_content || '';
  }

  return '';
}

async function callTextLlmChunk(chunkText, creds) {
  const userMessage = `Aşağıdaki banka ekstresi içeriğindeki tüm hareketleri YYYY-MM-DD|YON|TUTAR|ACIKLAMA formatında çıkar:\n\n---\n${chunkText}\n---`;

  // Önce aktif sağlayıcıyı dene; hata verirse tanımlı diğer anahtarlara yedekle
  const orderedProviders = Array.from(
    new Set([
      creds.activeProvider,
      creds.geminiApiKey ? 'gemini' : null,
      creds.openaiApiKey ? 'openai' : null,
      creds.evrenApiKey ? 'evren' : null,
      creds.xaiApiKey ? 'grok' : null,
      creds.nvidiaApiKey ? 'nvidia' : null,
    ].filter(Boolean))
  );

  let lastErr = null;
  for (const p of orderedProviders) {
    try {
      const out = await callSingleProviderText(p, userMessage, creds);
      if (out && out.trim()) return out;
    } catch (err) {
      lastErr = err;
      console.warn(`[BankStatementParser] ${p} sağlayıcısı başarısız, yedek deneniyor:`, err.message);
    }
  }

  if (lastErr) throw lastErr;
  throw new Error('Yapay zeka sağlayıcısından ekstre yanıtı alınamadı.');
}

async function parseScannedPdfWithVision(rawBase64, creds) {
  let lastVisionErr = '';

  // 1. Gemini doğrudan çok sayfalı PDF okuyabilir
  if (creds.geminiApiKey) {
    try {
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
        lastVisionErr = `Gemini PDF (${model}): ${gData.error.message}`;
      } else {
        const out = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const rows = parsePipeDelimitedOutput(out);
        if (rows.length > 0) return rows;
      }
    } catch (err) {
      lastVisionErr = `Gemini PDF: ${err.message}`;
    }
  }

  // 2. EVREN OCR yedek akışı (performOcr { rawText, data } objesi döndürür!)
  if (creds.evrenApiKey) {
    for (const ocrModel of ['dots-ocr', 'deepseek-ocr-2']) {
      try {
        const ocrRes = await evrenClient.performOcr({
          imageBase64: rawBase64,
          mimeType: 'application/pdf',
          apiKey: creds.evrenApiKey,
          model: ocrModel,
        });
        const ocrText = (ocrRes?.rawText || '').trim();
        if (ocrText.length > 20) {
          const chunks = splitIntoLineChunks(ocrText, MAX_CHUNK_CHARS);
          const rows = [];
          for (const ch of chunks) {
            const llmOut = await callTextLlmChunk(ch, creds);
            rows.push(...parsePipeDelimitedOutput(llmOut));
          }
          if (rows.length > 0) return rows;
        }
      } catch (ocrErr) {
        lastVisionErr = `EVREN OCR (${ocrModel}): ${ocrErr.message}`;
        console.warn('[BankStatementParser]', lastVisionErr);
      }
    }
  }

  throw new Error(
    lastVisionErr ||
      'Bu PDF taranmış görüntü veya özel şifreli font içeriyor. Taranmış PDF ekstreleri okumak için geçerli bir Gemini veya EVREN API anahtarı tanımlı olmalıdır.'
  );
}

export async function parseBankStatementFile({
  companyId,
  fileBase64,
  fileName = '',
  mimeType = '',
  overrides = {},
}) {
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
    try {
      const pdfParseFn = getPdfParse();
      if (pdfParseFn) {
        const pdfData = await pdfParseFn(buffer);
        extractedText = (pdfData?.text || '').trim();
        pageCount = pdfData?.numpages || 1;
        console.log(
          `[BankStatementParser] PDF metni çıkarıldı (${fileName}): ${extractedText.length} karakter, ${pageCount} sayfa`
        );
      }
    } catch (pdfErr) {
      console.warn('[BankStatementParser] pdf-parse uyarısı, OCR yedeğine geçiliyor:', pdfErr.message);
      extractedText = '';
    }

    // Seçilebilir metin yoksa veya özel CMap font nedeniyle okunaksızsa doğrudan görsel/OCR akışına geç
    if (!hasReadableStatementText(extractedText)) {
      console.log('[BankStatementParser] PDF içinde okunabilir metin/tarih yok, görsel/OCR akışına geçiliyor...');
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
  let rawSample = '';

  for (const chunk of chunks) {
    const rawOut = await callTextLlmChunk(chunk, creds);
    if (!rawSample && rawOut) rawSample = rawOut.slice(0, 300);
    const parsedChunkRows = parsePipeDelimitedOutput(rawOut);
    allRows.push(...parsedChunkRows);
  }

  // Eğer PDF metninden (ör. sadece üstbilgi/altbilgi çıktıysa) 0 satır döndüyse görsel/OCR yedeğini de dene
  if (isPdf && allRows.length === 0 && (creds.geminiApiKey || creds.evrenApiKey)) {
    try {
      console.log('[BankStatementParser] Metin analizinden 0 satır döndü, PDF görsel/OCR yedeği deneniyor...');
      const fallbackRows = await parseScannedPdfWithVision(rawBase64, creds);
      if (fallbackRows.length > 0) {
        return {
          rows: fallbackRows,
          pageCount,
          method: 'vision-ocr-fallback',
          provider: creds.geminiApiKey ? 'gemini' : 'evren',
        };
      }
    } catch (fbErr) {
      console.warn('[BankStatementParser] PDF görsel yedeği uyarısı:', fbErr.message);
    }
  }

  if (allRows.length === 0) {
    console.warn(
      `[BankStatementParser] 0 hareket ayrıştırıldı. Sağlayıcı: ${creds.activeProvider}, Metin: ${extractedText.length} krk, AI Örnek: ${rawSample}`
    );
  }

  return {
    rows: allRows,
    pageCount,
    chunksProcessed: chunks.length,
    method: isPdf ? 'pdf-text' : isExcel ? 'excel-ai' : 'text-ai',
    provider: creds.activeProvider,
  };
}
