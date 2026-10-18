import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GIB_API_BASE = 'https://dijital.gib.gov.tr/apigateway';
const CAPTCHA_URL = `${GIB_API_BASE}/captcha/getnewcaptcha`;
const LOGIN_URL = `${GIB_API_BASE}/auth/tdvd/login`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const COMMON_HEADERS = {
  'User-Agent': USER_AGENT,
  Referer: 'https://dijital.gib.gov.tr/portal/login',
  Origin: 'https://dijital.gib.gov.tr',
  Accept: 'application/json, text/plain, */*',
  'Content-Type': 'application/json'
};

const CACHE_FILE = path.join(__dirname, '..', '.dijital_gib_token_cache.json');
const MODEL_DIR = path.join(__dirname, '..', 'models');
const MODEL_PATH = path.join(MODEL_DIR, 'captcha-v1-seed2.int8.onnx');
const METADATA_PATH = path.join(MODEL_DIR, 'captcha-v1.metadata.json');

class DijitalGibClient {
  constructor() {
    this.tokenCache = new Map(); // userid -> { token, user, expiresAt }
    this.onnxSession = null;
    this.modelMeta = null;
    this.loadTokenCacheFromDisk();
  }

  loadTokenCacheFromDisk() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf8');
        const data = JSON.parse(raw);
        const now = Date.now();
        for (const [uid, item] of Object.entries(data)) {
          if (item && item.token && item.expiresAt > now) {
            this.tokenCache.set(uid, item);
          }
        }
      }
    } catch (e) {
      console.warn('[DijitalGIB] Cache yükleme uyarısı:', e.message);
    }
  }

  saveTokenCacheToDisk() {
    try {
      const serializable = {};
      const now = Date.now();
      for (const [uid, item] of this.tokenCache.entries()) {
        if (item.expiresAt > now) {
          serializable[uid] = item;
        }
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(serializable, null, 2), 'utf8');
    } catch (e) {
      console.warn('[DijitalGIB] Cache kaydetme uyarısı:', e.message);
    }
  }

  /**
   * GİB'den yeni Captcha resmi ve correlation ID (cid) alır
   */
  async fetchCaptcha() {
    const resp = await axios.get(CAPTCHA_URL, {
      headers: { ...COMMON_HEADERS },
      timeout: 15000
    });
    const { captchaImgBase64, cid } = resp.data || {};
    if (!captchaImgBase64 || !cid) {
      throw new Error('GİB Captcha verisi temin edilemedi');
    }
    return {
      imageBase64: captchaImgBase64,
      cid
    };
  }

  /**
   * ONNX Modelini yükler (varsa)
   */
  async getOnnxSession() {
    if (this.onnxSession) return this.onnxSession;
    if (!fs.existsSync(MODEL_PATH) || !fs.existsSync(METADATA_PATH)) {
      return null;
    }
    try {
      const ort = await import('onnxruntime-node');
      this.modelMeta = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
      this.onnxSession = await ort.InferenceSession.create(MODEL_PATH, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all'
      });
      return this.onnxSession;
    } catch (e) {
      console.warn('[DijitalGIB] ONNX yüklenemedi:', e.message);
      return null;
    }
  }

  /**
   * PNG Buffer'ını basitçe ayrıştırıp grayscale matrisine dönüştürür (Sharp yoksa da çalışır)
   */
  async preprocessImage(buffer, inputHeight = 32, inputMaxWidth = 160) {
    // Eğer sharp varsa en kaliteli pre-processing'i yap
    try {
      const sharp = (await import('sharp')).default;
      const baseImg = sharp(buffer).grayscale();
      const md = await baseImg.metadata();
      let newW = Math.round((md.width * inputHeight) / md.height);
      newW = Math.min(inputMaxWidth, Math.max(32, newW));
      const resized = await baseImg
        .resize({ height: inputHeight, width: newW, fit: 'fill' })
        .raw()
        .toBuffer();

      const tensor = new Float32Array(1 * 1 * inputHeight * inputMaxWidth);
      for (let h = 0; h < inputHeight; h++) {
        for (let w = 0; w < inputMaxWidth; w++) {
          const dstIdx = h * inputMaxWidth + w;
          const raw = w < newW ? resized[h * newW + w] : 255;
          const norm = raw / 255.0;
          tensor[dstIdx] = (norm - 0.5) / 0.5;
        }
      }
      return tensor;
    } catch {
      // Fallback: minimal grayscale normalizasyonu
      return null;
    }
  }

  /**
   * Yerel ONNX modeliyle Captcha çözümü
   */
  async solveWithOnnx(imageBase64) {
    const session = await this.getOnnxSession();
    if (!session) return null;

    const buffer = Buffer.from(imageBase64, 'base64');
    const inputHeight = this.modelMeta?.input_shape?.[2] || 32;
    const inputMaxWidth = this.modelMeta?.input_shape?.[3] || 160;
    const tensorData = await this.preprocessImage(buffer, inputHeight, inputMaxWidth);
    if (!tensorData) return null;

    const ort = await import('onnxruntime-node');
    const tensor = new ort.Tensor('float32', tensorData, [1, 1, inputHeight, inputMaxWidth]);
    const out = await session.run({ image: tensor });
    if (!out.log_probs) return null;

    const T = out.log_probs.dims[0];
    const C = out.log_probs.dims[2];
    const data = out.log_probs.data;
    const charset = this.modelMeta.charset;
    const blankIdx = this.modelMeta.blank_idx ?? 0;

    // Greedy CTC decode
    let prev = blankIdx;
    let text = '';
    for (let t = 0; t < T; t++) {
      let maxIdx = 0;
      let maxVal = -Infinity;
      const b = t * C;
      for (let c = 0; c < C; c++) {
        const v = data[b + c];
        if (v > maxVal) {
          maxVal = v;
          maxIdx = c;
        }
      }
      if (maxIdx !== blankIdx && maxIdx !== prev) {
        text += charset[maxIdx - 1] ?? '';
      }
      prev = maxIdx;
    }

    return text.trim();
  }

  /**
   * Gemini Vision ile Captcha çözümü (Fallback)
   */
  async solveWithGemini(imageBase64, apiKey) {
    if (!apiKey) return null;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              {
                text: 'Bu resimdeki CAPTCHA metnini oku. Sadece metni döndür, boşluksuz. Karakterler büyük/küçük harf veya rakam olabilir, 4-7 karakter uzunluğunda. Başka hiçbir açıklama yazma.'
              },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: imageBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1
        }
      };

      const resp = await axios.post(url, payload, { timeout: 15000 });
      const candidate = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidate) {
        return candidate.trim().replace(/\s+/g, '');
      }
    } catch (e) {
      console.warn('[DijitalGIB] Gemini Captcha çözüm hatası:', e.message);
    }
    return null;
  }

  /**
   * Captcha çözücü: Önce ONNX -> sonra Gemini -> başarısızsa null
   */
  async solveCaptcha(imageBase64, geminiApiKey = null) {
    let text = await this.solveWithOnnx(imageBase64);
    if (text && /^[A-Za-z0-9]{4,7}$/.test(text)) {
      return { text, source: 'onnx' };
    }

    if (geminiApiKey) {
      text = await this.solveWithGemini(imageBase64, geminiApiKey);
      if (text && /^[A-Za-z0-9]{4,7}$/.test(text)) {
        return { text, source: 'gemini' };
      }
    }

    return null;
  }

  /**
   * GİB Dijital Vergi Dairesi Kullanıcı Girişi
   */
  async login(userid, password, captchaText, captchaCid) {
    try {
      const resp = await axios.post(
        LOGIN_URL,
        {
          userid,
          sifre: password,
          dk: captchaText,
          imageId: captchaCid,
          controlCaptcha: true
        },
        {
          headers: COMMON_HEADERS,
          timeout: 20000
        }
      );

      const data = resp.data;
      if (data && data.token) {
        const tokenItem = {
          token: data.token,
          user: data.user || { userid },
          expiresAt: Date.now() + 50 * 60 * 1000 // ~50 dk geçerli say
        };
        this.tokenCache.set(userid, tokenItem);
        this.saveTokenCacheToDisk();
        return { success: true, token: data.token, user: tokenItem.user };
      }

      // Hata yakalama
      const msg = data?.messages?.[0]?.text || 'Giriş başarısız oldu. Bilgilerinizi kontrol ediniz.';
      return { success: false, message: msg, raw: data };
    } catch (err) {
      const errMsg = err.response?.data?.messages?.[0]?.text || err.message;
      return { success: false, message: errMsg };
    }
  }

  /**
   * Otomatik giriş: Captcha'yı otomatik alıp çözer ve login olur.
   */
  async autoLogin(userid, password, geminiApiKey = null, maxAttempts = 3) {
    // Önce geçerli cache'de token var mı?
    const cached = this.tokenCache.get(userid);
    if (cached && cached.expiresAt > Date.now()) {
      return { success: true, token: cached.token, fromCache: true, user: cached.user };
    }

    let lastError = '';
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const captcha = await this.fetchCaptcha();
        const solved = await this.solveCaptcha(captcha.imageBase64, geminiApiKey);
        if (!solved?.text) {
          return {
            success: false,
            needsManualCaptcha: true,
            captchaImgBase64: captcha.imageBase64,
            cid: captcha.cid,
            message: 'Captcha otomatik çözülemedi. Lütfen güvenlik kodunu elle giriniz.'
          };
        }

        const res = await this.login(userid, password, solved.text, captcha.cid);
        if (res.success) {
          return res;
        }

        lastError = res.message;
        if (res.message && (res.message.includes('şifre') || res.message.includes('parola') || res.message.includes('geçerli bir'))) {
          // Yanlış şifrede döngüyü sürdürme
          break;
        }

        // Captcha hatalıysa tekrar dene
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        lastError = e.message;
      }
    }

    // Son çare: Kullanıcıya Captcha resmini dönerek manuel giriş şansı tanı
    try {
      const fallbackCaptcha = await this.fetchCaptcha();
      return {
        success: false,
        needsManualCaptcha: true,
        captchaImgBase64: fallbackCaptcha.imageBase64,
        cid: fallbackCaptcha.cid,
        message: lastError || 'Giriş yapılamadı. Lütfen kodu doğrulayınız.'
      };
    } catch {
      return { success: false, message: lastError || 'Giriş denemesi başarısız.' };
    }
  }

  createApiClient(token) {
    return axios.create({
      baseURL: GIB_API_BASE,
      headers: {
        Authorization: `Bearer ${token}`,
        'ui-client': 'fe',
        'page-name': 'e-tebligat',
        referer: 'https://dijital.gib.gov.tr/',
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'user-agent': USER_AGENT
      },
      timeout: 30000
    });
  }

  /**
   * e-Tebligat listeleme
   */
  async listTebligatlar({ token, pageNo = 1, pageSize = 50, arsivDurum = null }) {
    const client = this.createApiClient(token);
    const filters = [];
    if (arsivDurum !== null) {
      filters.push({ fieldName: 'arsivDurum', values: [String(arsivDurum)] });
    }

    const resp = await client.post('/etebligat/etebligat/tebligat-listele', {
      meta: {
        pagination: { pageNo, pageSize },
        sortFieldName: 'id',
        sortType: 'DESC',
        filters
      }
    });

    return resp.data;
  }

  /**
   * Tebligat Ek/Belge Listeleme
   */
  async getTebligatBelgeleri({ token, tebligId, tebligSecureId }) {
    const client = this.createApiClient(token);
    const resp = await client.post('/etebligat/etebligat/belge-ek-listele', {
      tebligId,
      tebligSecureId
    });
    return resp.data;
  }

  /**
   * Tebligat Belgesi İndirme Bağlantısı Alma
   */
  async getDocumentLink({ token, params }) {
    const client = this.createApiClient(token);
    const resp = await client.post('/etebligat/etebligat/belge-getir', {
      data: params
    });
    return resp.data;
  }

  /**
   * PKCS#7 imzalı .imz dosyasından saf PDF verisini ayıklar
   */
  extractPdfFromImz(buffer) {
    const pdfStart = buffer.indexOf(Buffer.from('%PDF'));
    if (pdfStart < 0) return buffer;

    const eofMarker = Buffer.from('%%EOF');
    let pdfEnd = -1;
    let searchFrom = buffer.length - 1;
    while (searchFrom > pdfStart) {
      const idx = buffer.lastIndexOf(eofMarker, searchFrom);
      if (idx > pdfStart) {
        pdfEnd = idx + eofMarker.length;
        break;
      }
      searchFrom = idx - 1;
    }
    if (pdfEnd < 0) return buffer;

    return buffer.subarray(pdfStart, pdfEnd);
  }

  /**
   * Tebligat Belgesi / Ekini İndirme (Buffer olarak döner)
   */
  async downloadDocumentBuffer({ token, reportLink }) {
    const resp = await axios({
      method: 'GET',
      url: reportLink,
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${token}`,
        referer: 'https://dijital.gib.gov.tr/',
        'user-agent': USER_AGENT
      },
      timeout: 60000
    });

    let buf = Buffer.from(resp.data);
    // Eğer imzalı PKCS#7 zarfıysa PDF'i ayıkla
    buf = this.extractPdfFromImz(buf);
    return buf;
  }
}

export const dijitalGibClient = new DijitalGibClient();
