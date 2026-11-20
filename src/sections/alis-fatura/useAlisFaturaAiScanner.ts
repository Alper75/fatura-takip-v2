import { useState, useRef } from 'react';
import { toast } from 'sonner';
import type { Cari } from '@/types';
import {
  INITIAL_FORM,
  compressImageIfNeeded,
  consolidateInvoicesByKdv,
  type FormEntry,
  type LucaAccountOption,
  type ScanProgress,
  type UploadedFile,
} from './alisFaturaHelpers';

interface UseAlisFaturaAiScannerDeps {
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  forms: FormEntry[];
  setForms: React.Dispatch<React.SetStateAction<FormEntry[]>>;
  cariler: Cari[];
  lucaAccounts: LucaAccountOption[];
  varsayilanDepoId: string;
  findRememberedAccountCode: (vkn?: string, unvan?: string, malHizmet?: string) => string;
}

export function useAlisFaturaAiScanner({
  apiFetch,
  forms,
  setForms,
  cariler,
  lucaAccounts,
  varsayilanDepoId,
  findRememberedAccountCode,
}: UseAlisFaturaAiScannerDeps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [aiAddedCount, setAiAddedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = async (files: File[]) => {
    setIsScanning(true);
    try {
      const newFiles: UploadedFile[] = [];
      for (const file of files) {
        // Yüksek çözünürlüklü fotoğrafları otomatik optimize et (Failed to fetch önleyici)
        const processed = await compressImageIfNeeded(file);
        newFiles.push({ 
          base64: processed.base64, 
          mimeType: processed.mimeType, 
          name: file.name,
          status: 'pending' 
        });
      }
      setUploadedFiles(prev => [...prev, ...newFiles]);
      setAiAddedCount(0);
    } catch (err) {
      toast.error('Dosya işlenirken hata oluştu.');
    } finally {
      setIsScanning(false);
    }
  };

  const scanImage = async (filesToProcess?: UploadedFile[]) => {
    const targetFiles = filesToProcess && filesToProcess.length > 0 ? filesToProcess : uploadedFiles;
    if (targetFiles.length === 0) return;

    setIsScanning(true);
    let totalAdded = 0;
    const failedFiles: { name: string; reason: string }[] = [];
    
    let activeProvider = '';
    let apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    let aiModel = 'gemini-3.8-flash';
    let nvidiaApiKey = '';
    let nvidiaModelName = 'stepfun-ai/step-5-preview';
    let openaiApiKey = '';
    let openaiModelName = 'gpt-4o-mini';
    let xaiApiKey = '';
    let xaiModelName = 'grok-2-vision-1212';
    let evrenApiKey = '';
    let evrenModelName = 'dots-ocr';
    
    try {
      const [provRes, keyRes, modelRes, nKeyRes, nModelRes, oKeyRes, oModelRes, xKeyRes, xModelRes, eKeyRes, eModelRes] = await Promise.all([
        apiFetch('/api/settings/ai_provider').catch(() => null),
        apiFetch('/api/settings/gemini_api_key').catch(() => null),
        apiFetch('/api/settings/gemini_model').catch(() => null),
        apiFetch('/api/settings/nvidia_api_key').catch(() => null),
        apiFetch('/api/settings/nvidia_model').catch(() => null),
        apiFetch('/api/settings/openai_api_key').catch(() => null),
        apiFetch('/api/settings/openai_model').catch(() => null),
        apiFetch('/api/settings/xai_api_key').catch(() => null),
        apiFetch('/api/settings/xai_model').catch(() => null),
        apiFetch('/api/settings/evren_api_key').catch(() => null),
        apiFetch('/api/settings/evren_model').catch(() => null),
      ]);

      if (provRes?.success && provRes.value) activeProvider = provRes.value;
      if (keyRes?.success && keyRes.value) apiKey = keyRes.value;
      if (modelRes?.success && modelRes.value) aiModel = modelRes.value;
      if (nKeyRes?.success && nKeyRes.value) nvidiaApiKey = nKeyRes.value;
      if (nModelRes?.success && nModelRes.value) nvidiaModelName = nModelRes.value;
      if (oKeyRes?.success && oKeyRes.value) openaiApiKey = oKeyRes.value;
      if (oModelRes?.success && oModelRes.value) openaiModelName = oModelRes.value;
      if (xKeyRes?.success && xKeyRes.value) xaiApiKey = xKeyRes.value;
      if (xModelRes?.success && xModelRes.value) xaiModelName = xModelRes.value;
      if (eKeyRes?.success && eKeyRes.value) evrenApiKey = eKeyRes.value;
      if (eModelRes?.success && eModelRes.value) evrenModelName = eModelRes.value;
    } catch (keyErr) {
      console.warn('Ayarlar alınamadı:', keyErr);
    }

    if (!activeProvider) {
      if (apiKey) activeProvider = 'gemini';
      else if (openaiApiKey) activeProvider = 'openai';
      else if (nvidiaApiKey) activeProvider = 'nvidia';
      else if (xaiApiKey) activeProvider = 'grok';
      else if (evrenApiKey) activeProvider = 'evren';
      else activeProvider = 'gemini';
    }

    if (activeProvider === 'evren') {
      if (!evrenApiKey) {
        toast.error('EVREN API Key bulunamadı. Lütfen Mutabakat Yönetimi -> Yapay Zeka Ayarları bölümünden tanımlayın.');
        setIsScanning(false);
        return;
      }
    } else if (activeProvider === 'grok' || activeProvider === 'xai') {
      if (!xaiApiKey) {
        toast.error('xAI Grok API Key bulunamadı. Lütfen Mutabakat Yönetimi -> Yapay Zeka Ayarları bölümünden tanımlayın.');
        setIsScanning(false);
        return;
      }
    } else if (activeProvider === 'openai') {
      if (!openaiApiKey) {
        toast.error('OpenAI API Key bulunamadı. Lütfen Mutabakat Yönetimi -> Yapay Zeka Ayarları bölümünden tanımlayın.');
        setIsScanning(false);
        return;
      }
    } else if (activeProvider === 'nvidia') {
      if (!nvidiaApiKey) {
        toast.error('NVIDIA API Key bulunamadı. Lütfen Mutabakat Yönetimi -> Yapay Zeka Ayarları bölümünden tanımlayın.');
        setIsScanning(false);
        return;
      }
    } else {
      if (!apiKey) {
        toast.error('Yapay zeka anahtarı (Gemini API Key) bulunamadı. Lütfen ayarlardan tanımlayın.');
        setIsScanning(false);
        return;
      }
    }

    let safeModelName = aiModel ? aiModel.trim() : 'gemini-3.8-flash';
    if (safeModelName === 'gemini-3.6-flash' || safeModelName === 'gemini-2.0-flash' || safeModelName === 'gemini-1.5-flash-8b') {
      safeModelName = 'gemini-3.8-flash';
    }
    
    const [settingsRes, bankaRes] = await Promise.all([
      apiFetch('/api/settings/luca_kdv_ayarlari').catch(() => null),
      apiFetch('/api/banka-hesaplari').catch(() => null)
    ]);

    let kdvSettings: any = {};
    if (settingsRes?.success && settingsRes.value) {
      try { kdvSettings = JSON.parse(settingsRes.value); } catch(e){}
    }
    const bankaHesaplari: any[] = bankaRes?.success ? bankaRes.data : [];

    const prompt = `Sen Türkiye Cumhuriyeti Tekdüzen Hesap Planı'na, KDV Kanunu'na ve Türk Vergi Mevzuatı'na tam hâkim uzman bir Mali Müşavirsin (SMMM).
Görevin: Ekli görsel/belgedeki fatura ve perakende satış fişlerini bir mali müşavir denetiminde analiz edip sisteme işlenecek muhasebe verilerini çıkarmaktır.

Bu dosyada BİRDEN FAZLA ayrı fiş veya fatura olabilir. Veya TEK BİR fişte/faturada BİRDEN FAZLA FARKLI KDV oranı (Örn: %1, %10, %20) olabilir.
Lütfen bulduğun TÜM fiş/faturaları çıkar ve aşağıdaki JSON DİZİSİ formatında döndür. 

MALİ MÜŞAVİRLİK VE KDV AYRIŞTIRMA KURALLARI:
1. GÜNCEL KDV MEVZUATI VE KDV ORANLARI (ÇOK KRİTİK):
   - Türkiye'de geçerli resmi KDV oranları yalnızca %1, %10 ve %20'dir (istisna/muaf hallerde %0).
   - KESİNLİKLE %18 veya %8 KDV KULLANMA! Temmuz 2023 mevzuat değişikliği ile eski %18 oranı %20, eski %8 oranı ise %10 olmuştur. Eski cihazlar veya yazar kasa yazılımları fiş üzerine '%8' veya '%18' bassa dahi sen bunları güncel oranlara (%8 -> %10, %18 -> %20) dönüştürerek yazmalısın.

2. FİŞLERDE ÇOKLU KDV AYRIŞTIRMA VE HESAPLAMA (EN KRİTİK KURAL):
   Türkiye'deki perakende fişlerinde KDV oranları 2 farklı biçimde yer alır. Her iki durumu da mutlaka analiz etmelisin:

   A) KALEM / SATIR BAZINDA KDV YAZAN FİŞLER (ÇOK YAYGIN - ÖRN: KOÇTAŞ, BAUHAUS, METRO, MİGROS, TEKZEN VB.):
      - Bu fişlerin alt tarafında KDV oranları ayrılmamış olabilir; alt toplamda sadece "TOPKDV *920,85" ve "TOPLAM *6.465,54" gibi tek bir KDV toplamı ve tek bir genel toplam yer alabilir.
      - ANCAK fişin ürün satırlarını incelediğinde HER ÜRÜNÜN YANINDA AÇIKÇA KDV ORANI YAZAR!
        Örnek (Koçtaş veya yapı market fişi):
        * FANTOM MAGIC %20 *2.999,00
        * STILERA AYAKKABILIK %10 *1.899,00
        * X MODEL CAM OTO %20 *179,98
        * Bez Çanta Dikey %10 *19,99
        * MACROMAX Multi SPRE %10 *149,99
        * ÇEK PAS 55 CM %20 *129,90 ... vb.
      - BÖYLE BİR FİŞTE ALTTA DÖKÜM TABLOSU YOK DİYE KESİNLİKLE TÜM FİŞİ TEK BİR ORANA (%20'ye) YIĞMA!
      - Tüm ürün satırlarını yukarıdan aşağıya tek tek incele:
        * Yanında %10 yazan tüm ürünlerin tutarlarını topla -> %10 KDV Grubu Tutarı (Örn: 1.899,00 + 19,99 + 149,99 = 2.068,98 TL).
        * Yanında %20 yazan tüm ürünlerin tutarlarını topla -> %20 KDV Grubu Tutarı (Örn: 2.999,00 + 179,98 + 139,98 + 129,90 + 159,90 + 197,90 + 589,90 = 4.396,56 TL).
        * Varsa %1 yazan ürünlerin tutarlarını topla -> %1 KDV Grubu Tutarı.
      - Her farklı KDV oranı grubu için 1 adet JSON objesi oluştur.

   B) ALTINDA KDV / MATRAH DÖKÜM TABLOSU OLAN FİŞLER (ÖRN: BİM, A101, ŞOK, RESTORAN, BENZİNLİK VB.):
      - Fişin alt kısmında "%10 KDV: xx TL", "%20 KDV: xx TL" veya "KDV %10 MATRAH: ...", "KDV %20 MATRAH: ..." şeklinde bir tablo varsa, bu tablodaki dökümü esas alarak KDV gruplarını ayır.

   C) MATEMATİKSEL SAĞLAMA VE TUTAR KONTROLÜ (ZORUNLU):
      - Fiş için oluşturduğun KDV grubu JSON objelerindeki "tutar" değerlerinin toplamı, fişin üzerindeki GENEL TOPLAM tutarına kuruşu kuruşuna EŞİT OLMALIDIR!
        (Örn: 2.068,98 TL [%10] + 4.396,56 TL [%20] = 6.465,54 TL Genel Toplam).
      - Bir fişte tüm ürünler tek bir KDV oranındaysa sadece 1 adet JSON objesi üret. Ancak fişte hem %10 hem %20 varsa MUTLAKA her KDV oranı için 1'er adet (toplam 2 adet) JSON objesi üret.

   D) KRİTİK UYARI - "TOPKDV" (TOPLAM KDV) TUZAĞI VE %20 HESAPLAMA KURALI (EN YAYGIN HATA):
      - Perakende fişlerinin alt tarafında yazan "TOPKDV", "TOPLAM KDV" veya "T.KDV" tutarı, fişteki TÜM KDV oranlarının (%10 + %20) GENEL TOPLAM KDV'SİDİR!
      - KESİNLİKLE %20 grubunun "tutar"ına veya KDV'sine bu "TOPKDV" tutarını yazma!
      - Fişte %10 dökümü ve hemen altında TOPKDV yer alıyorsa:
        * %10 KDV Grubu Tutarı = Fişteki %10'lu ürünlerin toplam tutarı (KDV dahil).
        * %20 KDV Grubu Tutarı = FİŞ GENEL TOPLAMI - %10 Grubu Tutarı (KDV dahil).
        * Örneğin: Genel Toplam = 300.00 TL, %10 Grubu Dahil Tutarı = 100.00 TL, TOPKDV = 42.42 TL ise:
          -> %20 Grubu Dahil Tutarı MUTLAKA 200.00 TL (300.00 - 100.00) olmalıdır!
          -> %20 Grubu Tutarına KESİNLİKLE 42.42 TL (TOPKDV) yazma!
        * SAĞLAMA: (%10 Tutarı) + (%20 Tutarı) == Fişin Genel Toplamına TAM EŞİT OLMALIDIR.

3. GENEL GİDER - TİCARİ MAL AYRIMI: Şirket içi tüketim, yemek (restoran/lokanta), akaryakıt/yakıt, konaklama/otel, kırtasiye, ofis tüketim, market, temizlik, kargo gibi harcama fişleri KESİNLİKLE 7'li gider hesaplarına (Örn: 770 Genel Yönetim Giderleri) atılmalıdır. 153 Ticari Mallar hesabı SADECE işletmenin satmak amacıyla aldığı ürünler içindir. Fişin niteliğine göre en uygun gider kodunu seç.
4. AKARYAKIT PLAKA KURALI: Eğer bu bir akaryakıt fişi/faturası ise, fiş üzerinde yazan ARAÇ PLAKASINI mutlaka "plate" alanına yaz (Örn: 34ABC123).
5. ÖDEME ŞEKLİ: Fiş/fatura üzerindeki ödeme tipini analiz et. Eğer slip veya fiş üzerinde "**** 1104", "Kredi Kartı", "Banka Kartı" gibi kredi kartı ödemesine dair ibare varsa "odeme_sekli": "KREDI_KARTI" yap ve kartın son 4 hanesini "kredi_karti_son4" alanına yaz (örn: "1104"). Nakit ödenmişse "odeme_sekli": "NAKIT" yap. Açık hesap/vadeli ise "odeme_sekli": "CARI_HESAP" yap.
6. TEVKİFAT, STOPAJ VE ÖİV (ÖZEL İLETİŞİM / KONAKLAMA VERGİSİ): Varsa KDV tevkifat oranını (örn: "2/10", "5/10", "9/10") ve Stopaj oranını tespit et. Eğer faturada/fişte KDV haricinde "Özel İletişim Vergisi (ÖİV)", "Konaklama Vergisi", "ÖTV" veya "Telsiz Kullanım Ücreti" gibi KDV matrahına dahil olmayan ek bir vergi/kesinti varsa tutarını "oiv_tutari" alanına yaz (yoksa "0").

Aşağıdaki LUCA HESAP PLANI listesinden bu faturanın açıklamasına/türüne en uygun "kod"u seçerek "muhasebe_kodu" alanına yaz:
${lucaAccounts
  .filter((a) => /^(15|73|74|76|77|78|25)/.test(String(a.kod || '').trim()))
  .slice(0, 80)
  .map((a) => `${a.kod}: ${a.ad}`)
  .join('\n') || lucaAccounts.slice(0, 60).map((a) => `${a.kod}: ${a.ad}`).join('\n')}

SADECE geçerli bir JSON döndür:
{
  "faturalar": [
    {
      "tedarikciAdi": "firma/satıcı adı",
      "tedarikciVkn": "VKN veya T.C.",
      "faturaNo": "belge no",
      "malHizmetAdi": "ürün özeti veya ... %KDV'li Ürünler",
      "faturaTarihi": "YYYY-MM-DD",
      "genel_toplam": "Fişin en altında yazan Genel Toplam tutarı (Örn: 300.00)",
      "toplam_kdv": "Fişte yazan TOPKDV tutarı (Örn: 42.42)",
      "tutar": "120.50",
      "tutar_tur": "dahil",
      "kdv_orani": "20",
      "kdv_tutari": "Bu grubun kendi KDV tutarı (Örn: 20.08)",
      "tevkifat_orani": "0",
      "stopaj_orani": "0",
      "oiv_tutari": "0",
      "aciklama": "",
      "muhasebe_kodu": "Yukarıdaki listeden seçilen en uygun hesap kodu",
      "plate": "Eğer varsa araç plakası (34ABC123 formatında)",
      "odeme_sekli": "KREDI_KARTI veya NAKIT",
      "kredi_karti_son4": "Eğer kartsa slipteki son 4 hane, yoksa boş bırak"
    }
  ]
}
Eğer hiçbir belge okunamıyorsa şunu döndür: {"hata": "Belge okunamadı"}`;

    for (let i = 0; i < targetFiles.length; i++) {
      const file = targetFiles[i];
      setScanProgress({
        current: i + 1,
        total: targetFiles.length,
        remaining: targetFiles.length - (i + 1),
        percent: Math.round(((i + 1) / targetFiles.length) * 100),
        currentFileName: file.name
      });
      
      setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'scanning' } : f));
      
      try {
        let parsed: any = null;

        if (activeProvider === 'openai' || activeProvider === 'nvidia' || activeProvider === 'grok' || activeProvider === 'xai' || activeProvider === 'evren') {
          // ==================== EVREN / OPENAI / GROK / NVIDIA PROXY ÇAĞRISI ====================
          const proxyRes = await apiFetch('/api/ai/analyze-invoice', {
            method: 'POST',
            body: JSON.stringify({
              fileBase64: file.base64,
              mimeType: file.mimeType,
              prompt: prompt,
              provider: activeProvider,
              evrenApiKey: evrenApiKey,
              evrenModel: evrenModelName,
              openaiApiKey: openaiApiKey,
              openaiModel: openaiModelName,
              xaiApiKey: xaiApiKey,
              xaiModel: xaiModelName,
              nvidiaApiKey: nvidiaApiKey,
              nvidiaModel: nvidiaModelName
            })
          });

          if (!proxyRes?.success || !proxyRes.data) {
            const provName = activeProvider === 'evren' ? 'EVREN (Milli OCR)' : (activeProvider === 'grok' || activeProvider === 'xai') ? 'xAI (Grok)' : (activeProvider === 'openai' ? 'OpenAI (ChatGPT)' : 'NVIDIA NIM');
            throw new Error(proxyRes?.message || `${provName} analizi başarısız oldu.`);
          }

          parsed = proxyRes.data;
        } else {
          // ==================== GOOGLE GEMINI ÇAĞRISI ====================
          // Doğrudan tarayıcıdan Google API çağrılır (Fotoğraflar 1600px'e sıkıştırıldığı için ~300KB boyuttadır).
          const rawBase64 = file.base64.split(',')[1];
          let responseText = '';
          let lastAiError: any = null;

          const candidateModels = Array.from(new Set([
            safeModelName,
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-1.5-pro'
          ].filter(Boolean)));

          for (const model of candidateModels) {
            let modelSucceeded = false;
            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{
                      parts: [
                        { text: prompt },
                        { inline_data: { mime_type: file.mimeType, data: rawBase64 } }
                      ]
                    }],
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
                  })
                });

                const data = await aiResponse.json();
                if (data.error) {
                  const errMsg = data.error.message || '';
                  if (/not found|is not supported|no longer available/i.test(errMsg)) {
                    console.warn(`[${model}] Bu model aktif değil, alternatif modele geçiliyor...`);
                    break;
                  }

                  const isQuota = /quota exceeded|free_tier_requests|limit: 20|429|resource exhausted/i.test(errMsg);
                  const isOverloaded = /high demand|spikes in demand|overloaded|503/i.test(errMsg);

                  if (isQuota) {
                    const retryMatch = errMsg.match(/retry in ([\d\.]+)s/i);
                    const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : 36;
                    console.warn(`[Kota Sınırı] Dakikada 20 fiş sınırı. ${waitSec} saniye bekleniyor...`);
                    
                    for (let s = waitSec; s > 0; s--) {
                      setScanProgress(prev => prev ? { ...prev, isWaitingQuota: true, quotaWaitSeconds: s } : null);
                      await new Promise(r => setTimeout(r, 1000));
                    }
                    setScanProgress(prev => prev ? { ...prev, isWaitingQuota: false, quotaWaitSeconds: 0 } : null);
                    lastAiError = new Error(errMsg);
                    continue;
                  }

                  if (isOverloaded) {
                    console.warn(`[${model}] Model yoğunlukta (Deneme ${attempt}), 3 saniye bekleniyor...`);
                    await new Promise(r => setTimeout(r, 3000));
                    lastAiError = new Error(errMsg);
                    continue;
                  }
                  throw new Error(errMsg || 'API Hatası');
                }

                responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (responseText) {
                  modelSucceeded = true;
                  break;
                }
              } catch (err: any) {
                lastAiError = err;
                const errMsg = err.message || '';
                if (/not found|is not supported|no longer available/i.test(errMsg)) {
                  break;
                }
                const isQuota = /quota exceeded|free_tier_requests|limit: 20|429|resource exhausted/i.test(errMsg);
                const isOverloaded = /high demand|spikes in demand|overloaded|503/i.test(errMsg);

                if (isQuota) {
                  const retryMatch = errMsg.match(/retry in ([\d\.]+)s/i);
                  const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : 36;
                  for (let s = waitSec; s > 0; s--) {
                    setScanProgress(prev => prev ? { ...prev, isWaitingQuota: true, quotaWaitSeconds: s } : null);
                    await new Promise(r => setTimeout(r, 1000));
                  }
                  setScanProgress(prev => prev ? { ...prev, isWaitingQuota: false, quotaWaitSeconds: 0 } : null);
                  continue;
                }

                if (isOverloaded) {
                  console.warn(`[${model}] Yoğunluk nedeniyle sıradaki yedek modele geçiliyor...`);
                  await new Promise(r => setTimeout(r, 1500));
                  break;
                }
                if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
              }
            }
            if (modelSucceeded) break;
          }

          if (!responseText) {
            // İstemci çağrısı ağ kesintisi verirse bir de sunucu proxy'sini dene:
            try {
              const proxyRes = await apiFetch('/api/ai/analyze-invoice', {
                method: 'POST',
                body: JSON.stringify({
                  fileBase64: file.base64,
                  mimeType: file.mimeType,
                  prompt: prompt,
                  provider: 'gemini',
                  geminiApiKey: apiKey,
                  geminiModel: safeModelName
                })
              });
              if (proxyRes?.success && proxyRes.data) {
                parsed = proxyRes.data;
              }
            } catch (pErr) {
              console.warn('[Gemini Proxy Fallback] Sunucu proxy de başarısız:', pErr);
            }

            if (!parsed) {
              throw lastAiError || new Error('Google Gemini modelleri geçici yoğunlukta.');
            }
          } else {
            // Gelişmiş JSON çıkarma ve hata yakalama
            let text = responseText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            try {
              parsed = JSON.parse(text);
            } catch (pe) {
              const firstBrace = text.indexOf('{');
              const lastBrace = text.lastIndexOf('}');
              if (firstBrace !== -1 && lastBrace > firstBrace) {
                const candidate = text.substring(firstBrace, lastBrace + 1);
                try {
                  parsed = JSON.parse(candidate);
                } catch (e2) {
                  try {
                    parsed = JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
                  } catch (e3) {}
                }
              }
              if (!parsed) {
                const firstSquare = text.indexOf('[');
                const lastSquare = text.lastIndexOf(']');
                if (firstSquare !== -1 && lastSquare > firstSquare) {
                  const candidate = text.substring(firstSquare, lastSquare + 1);
                  try {
                    parsed = JSON.parse(candidate);
                  } catch (e4) {
                    try {
                      parsed = JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
                    } catch (e5) {}
                  }
                }
              }
              if (!parsed) {
                const cleanSnippet = text.replace(/\s+/g, ' ').trim();
                if (cleanSnippet.length > 5 && cleanSnippet.length < 250) {
                  parsed = { hata: cleanSnippet };
                } else {
                  parsed = { hata: 'Yapay zeka bu fişi okuyamadı (Yazılar silik veya tutar/tarih net görünmüyor).' };
                }
              }
            }
          }
        }

        if (!parsed) {
          parsed = { hata: 'Belge analiz edilemedi.' };
        }

        // Her dosya işlendikten sonra rate limit'i korumak için kısa bekleme
        await new Promise(r => setTimeout(r, 600));

        if (parsed.hata) {
          // ==================== OKUNAMAYAN FİŞİ KAYBETME, LİSTEYE TASLAK OLARAK EKLE ====================
          failedFiles.push({ name: file.name, reason: parsed.hata });
          setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', errorMessage: parsed.hata } : f));

          const fallbackForm: FormEntry = {
            id: Date.now() + Math.random(),
            tutarTuru: 'dahil',
            aiError: parsed.hata || 'Yapay zekadan boş yanıt alındı.',
            errors: {},
            data: {
              tedarikciAdi: '',
              tedarikciVkn: '',
              faturaNo: '',
              malHizmetAdi: 'Fiş Gideri (Manuel Giriş)',
              faturaTarihi: new Date().toISOString().split('T')[0],
              vadeTarihi: '',
              toplamTutar: '',
              kdvOrani: '20',
              tevkifatOrani: '0',
              stopajOrani: '0',
              aciklama: `[AI Okunamadı: ${file.name}]`,
              depoId: varsayilanDepoId,
              muhasebeKodu: '',
              karsiHesapKodu: kdvSettings.varsayilanKasaKodu || '',
              vehiclePlate: '',
              dosyaBase64: file.base64,
              dosyaAdi: file.name
            }
          };

          setForms(prev => {
            const hasEmptyInitial = prev.length === 1 && !prev[0].data.faturaNo && !prev[0].data.tedarikciAdi && !prev[0].data.dosyaBase64;
            const currentForms = hasEmptyInitial ? [] : [...prev];
            return [...currentForms, fallbackForm];
          });
          setAiAddedCount(prev => prev + 1);
        } else {
          // Başarılı ayrıştırma
          setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'success', errorMessage: undefined } : f));
          const rawList = parsed.faturalar ? parsed.faturalar : (Array.isArray(parsed) ? parsed : [parsed]);
          const fList = consolidateInvoicesByKdv(rawList);
          
          const newForms: FormEntry[] = fList.map((f: any, idx: number) => {
            const fTedarikciAdi = f.tedarikciAdi || f.tedarikci_adi || f.ad || f.isim || f.vendor || f.customer || '';
            const fTedarikciVkn = f.tedarikciVkn || f.tedarikci_vkn || f.tcVkn || f.tc_vkn || f.vkn || f.tckn || '';
            const fFaturaNo = f.faturaNo || f.fatura_no || f.belgeNo || f.belge_no || f.invoiceNo || '';
            const fMalHizmetAdi = f.malHizmetAdi || f.mal_hizmet_adi || f.urun_adi || f.urunAdi || f.aciklama || f.description || 'Fiş Gideri';
            const fFaturaTarihi = f.faturaTarihi || f.fatura_tarihi || f.tarih || f.date || INITIAL_FORM.faturaTarihi;
            const fTutar = f.tutar || f.toplam_tutar || f.toplamTutar || f.amount || f.total || '';
            const fTutarTur = f.tutar_tur || f.tutarTuru || f.tutar_type || 'dahil';
            let fKdvOrani = String(f.kdv_orani || f.kdvOrani || f.kdv || '20').replace(/[^0-9]/g, '') || '20';
            if (fKdvOrani === '8') fKdvOrani = '10';
            if (fKdvOrani === '18') fKdvOrani = '20';
            if (!['1', '10', '20', '0'].includes(fKdvOrani)) fKdvOrani = '20';

            const fTevkifatOrani = f.tevkifat_orani || f.tevkifatOrani || f.tevkifat || '0';
            const fStopajOrani = f.stopaj_orani || f.stopajOrani || f.stopaj || '0';
            const fOivTutari = String(f.oiv_tutari || f.oivTutari || f.ozel_iletisim_vergisi || '0').replace(',', '.');
            const fAciklama = f.aciklama || f.note || f.not || '';
            const fMuhasebeKodu = f.muhasebe_kodu || f.muhasebeKodu || f.account_code || f.accountCode || '';
            const fPlate = f.plate || f.plaka || f.vehicle_plate || f.vehiclePlate || '';
            const fOdemeSekli = f.odeme_sekli || 'NAKIT';
            const fKrediKartiSon4 = f.kredi_karti_son4 || '';

            let matchedCari = (cariler || []).find(c => c && c.vknTckn === fTedarikciVkn && c.vknTckn && c.vknTckn.length > 5);
            if (!matchedCari && fTedarikciAdi) {
              const searchName = fTedarikciAdi.toLowerCase();
              matchedCari = cariler.find(c => c.unvan && c.unvan.toLowerCase().includes(searchName));
            }
            const rawPlate = fPlate ? fPlate.toUpperCase().replace(/\s+/g, '') : '';

            const rememberedCode = findRememberedAccountCode(
              matchedCari ? (matchedCari.vknTckn || '') : fTedarikciVkn,
              matchedCari ? (matchedCari.unvan || '') : fTedarikciAdi,
              fMalHizmetAdi
            );

            let mappedKarsiHesapKodu = '';
            if (fOdemeSekli === 'KREDI_KARTI') {
              let matchedBank = null;
              if (fKrediKartiSon4) {
                matchedBank = bankaHesaplari.find(b => b.kartNo && String(b.kartNo).endsWith(fKrediKartiSon4));
              }
              if (matchedBank && matchedBank.muhasebeKodu) {
                mappedKarsiHesapKodu = matchedBank.muhasebeKodu;
              } else {
                mappedKarsiHesapKodu = kdvSettings.varsayilanKrediKartiKodu || '';
              }
            } else {
              mappedKarsiHesapKodu = kdvSettings.varsayilanKasaKodu || '';
            }

            return {
              id: Date.now() + idx + Math.random(),
              tutarTuru: fTutarTur || 'dahil',
              errors: {},
              data: {
                tedarikciAdi: matchedCari ? (matchedCari.unvan || '') : fTedarikciAdi,
                tedarikciVkn: matchedCari ? (matchedCari.vknTckn || '') : fTedarikciVkn,
                faturaNo: fFaturaNo,
                malHizmetAdi: fMalHizmetAdi,
                faturaTarihi: fFaturaTarihi,
                vadeTarihi: '',
                toplamTutar: fTutar?.toString() || '',
                kdvOrani: fKdvOrani,
                tevkifatOrani: fTevkifatOrani?.toString() || '0',
                stopajOrani: fStopajOrani?.toString() || '0',
                oivTutari: fOivTutari || '0',
                aciklama: fAciklama,
                cariId: matchedCari ? matchedCari.id : undefined,
                depoId: varsayilanDepoId,
                muhasebeKodu: rememberedCode || fMuhasebeKodu,
                karsiHesapKodu: mappedKarsiHesapKodu,
                vehiclePlate: rawPlate,
                dosyaBase64: file.base64,
                dosyaAdi: file.name
              }
            };
          });

          setForms(prev => {
            const hasEmptyInitial = prev.length === 1 && !prev[0].data.faturaNo && !prev[0].data.tedarikciAdi && !prev[0].data.dosyaBase64;
            const currentForms = hasEmptyInitial ? [] : [...prev];
            return [...currentForms, ...newForms];
          });
          
          totalAdded += newForms.length;
          setAiAddedCount(prev => prev + newForms.length);
        }
      } catch (err: any) {
        console.error('File index', i, 'error:', err);
        const errMsg = err?.message || 'Bilinmeyen Hata';
        failedFiles.push({ name: file.name, reason: errMsg });
        setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', errorMessage: errMsg } : f));

        // Hata olsa dahi dosyayı ve görseli kaybetme, listeye ekle
        const fallbackForm: FormEntry = {
          id: Date.now() + Math.random(),
          tutarTuru: 'dahil',
          aiError: errMsg,
          errors: {},
          data: {
            tedarikciAdi: '',
            tedarikciVkn: '',
            faturaNo: '',
            malHizmetAdi: 'Fiş Gideri (Manuel Giriş)',
            faturaTarihi: new Date().toISOString().split('T')[0],
            vadeTarihi: '',
            toplamTutar: '',
            kdvOrani: '20',
            tevkifatOrani: '0',
            stopajOrani: '0',
            aciklama: `[AI Hata: ${file.name}]`,
            depoId: varsayilanDepoId,
            muhasebeKodu: '',
            karsiHesapKodu: kdvSettings.varsayilanKasaKodu || '',
            vehiclePlate: '',
            dosyaBase64: file.base64,
            dosyaAdi: file.name
          }
        };

        setForms(prev => {
          const hasEmptyInitial = prev.length === 1 && !prev[0].data.faturaNo && !prev[0].data.tedarikciAdi && !prev[0].data.dosyaBase64;
          const currentForms = hasEmptyInitial ? [] : [...prev];
          return [...currentForms, fallbackForm];
        });
        setAiAddedCount(prev => prev + 1);
      }
    }

    setScanProgress(null);
    setIsScanning(false);

    if (totalAdded > 0 && failedFiles.length === 0) {
      toast.success(`Yapay zeka tüm dosyaları (${totalAdded} adet fiş) başarıyla analiz etti!`);
    } else if (totalAdded > 0 && failedFiles.length > 0) {
      toast.warning(`${totalAdded} adet fiş okundu. ${failedFiles.length} dosya okunamadı (${failedFiles.map(f => f.name).slice(0, 2).join(', ')}${failedFiles.length > 2 ? '...' : ''}) ancak kaybolmaması için kırmızı çerçeveyle listeye eklendi!`, {
        duration: 9000
      });
    } else if (failedFiles.length > 0) {
      toast.error(`${failedFiles.length} adet dosya okunamadı. Kırmızı çerçeveyle listeye eklendi, lütfen bilgileri görseli açarak doldurunuz.`, {
        duration: 9000
      });
    }
  };

  const retryFailedScans = () => {
    const failed = uploadedFiles.filter(f => f.status === 'error' || forms.some(form => form.data.dosyaAdi === f.name && !!form.aiError));
    if (failed.length === 0) {
      toast.info('Hata veren fiş bulunamadı.');
      return;
    }
    // Hatalı fişlerin eski boş formlarını listeden temizle
    setForms(prev => prev.filter(form => !failed.some(ff => ff.name === form.data.dosyaAdi)));
    // Yeniden tara
    scanImage(failed);
  };

  return {
    isDragging,
    setIsDragging,
    uploadedFiles,
    setUploadedFiles,
    scanProgress,
    setScanProgress,
    isScanning,
    setIsScanning,
    aiAddedCount,
    setAiAddedCount,
    fileInputRef,
    handleFileChange,
    processFiles,
    scanImage,
    retryFailedScans,
  };
}
