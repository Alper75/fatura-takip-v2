import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { Save, X, ShoppingCart, FileText, Sparkles, Loader2, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import type { AlisFaturaFormData } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUrunler, useDepolar } from '../modules/stok/hooks/useStokQuery';
import { UrunForm } from '../modules/stok/components/UrunForm';
import { stokApi } from '../modules/stok/services/stokApi';
import { LucaAccountSelect } from '@/components/LucaAccountSelect';

const KDV_ORANLARI = ['0', '1', '8', '10', '18', '20'];
const TEVKIFAT_ORANLARI = ['0', '2/10', '3/10', '4/10', '5/10', '7/10', '9/10', '10/10'];

const INITIAL_FORM: AlisFaturaFormData = {
  faturaNo: '',
  faturaTarihi: new Date().toISOString().split('T')[0],
  vadeTarihi: '',
  tedarikciAdi: '',
  tedarikciVkn: '',
  malHizmetAdi: '',
  toplamTutar: '',
  kdvOrani: '18',
  tevkifatOrani: '0',
  stopajOrani: '0',
  aciklama: ''
};

type FormEntry = {
  id: number;
  data: AlisFaturaFormData;
  tutarTuru: 'dahil' | 'haric';
  errors: Partial<Record<keyof AlisFaturaFormData, string>>;
};

type UploadedFile = {
  base64: string;
  mimeType: string;
  name: string;
};


// Yüksek çözünürlüklü telefon fotoğraflarını optimize eden yardımcı fonksiyon
const compressImageIfNeeded = async (file: File): Promise<{ base64: string; mimeType: string }> => {
  if (file.type === 'application/pdf') {
    const b64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { base64: b64, mimeType: file.type };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedB64 = canvas.toDataURL('image/jpeg', 0.85);
          resolve({ base64: compressedB64, mimeType: 'image/jpeg' });
        } else {
          resolve({ base64: event.target?.result as string, mimeType: file.type });
        }
      };
      img.onerror = () => {
        resolve({ base64: event.target?.result as string, mimeType: file.type });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export function AlisFaturaDrawer() {
  const { isAlisDrawerOpen, closeAlisDrawer, addAlisFatura, updateAlisFatura, cariler, alisInitialData, lucaAccounts, isIsletmeDefteri, companies, user, apiFetch } = useApp();
  const activeCompany = companies.find(c => c.id === (user?.companyId || 1));
  const hasCommercialVehicle = activeCompany?.vehicles?.some(v => v.type === 'commercial');
  const { data: urunler } = useUrunler();
  const { data: depolar } = useDepolar();

  const [forms, setForms] = useState<FormEntry[]>([]);
  const [isUrunFormOpen, setIsUrunFormOpen] = useState(false);
  const [kurallar, setKurallar] = useState<any[]>([]);

  // Kuralları Çek
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/yapay-zeka-kurallari', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success) setKurallar(data.kurallar.filter((k: any) => k.kural_tipi === 'fatura'));
      })
      .catch(console.error);
  }, []);

  // Initialize with one form if open and empty
  useEffect(() => {
    if (isAlisDrawerOpen && forms.length === 0) {
      if (alisInitialData) {
        let aiKodu = alisInitialData.muhasebeKodu;
        if (!aiKodu && kurallar.length > 0) {
           const text = `${alisInitialData.tedarikciAdi || ''} ${alisInitialData.malHizmetAdi || ''}`.toLowerCase();
           for (const rule of kurallar) {
             if (text.includes(rule.anahtar_kelime.toLowerCase())) {
               aiKodu = rule.muhasebe_kodu;
               break;
             }
           }
        }
        setForms([{ id: Date.now(), data: { ...INITIAL_FORM, ...alisInitialData, muhasebeKodu: aiKodu }, tutarTuru: 'dahil', errors: {} }]);
      } else {
        setForms([{ id: Date.now(), data: INITIAL_FORM, tutarTuru: 'dahil', errors: {} }]);
      }
    }
  }, [isAlisDrawerOpen, alisInitialData, kurallar]);

  const varsayilanDepoId = depolar?.find(d => d.varsayilan)?.id || depolar?.[0]?.id || '';

  // AI States
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [scanProgress, setScanProgress] = useState<{ 
    current: number; 
    total: number; 
    remaining: number; 
    percent: number; 
    currentFileName?: string;
    isWaitingQuota?: boolean;
    quotaWaitSeconds?: number;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [aiAddedCount, setAiAddedCount] = useState(0);

  // Dayanıklılık / Arka Planda Taslak Saklama & Kayıt İlerlemesi
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number; remaining: number; percent: number; currentInvoice: string } | null>(null);
  const [hasPendingDraft, setHasPendingDraft] = useState(false);

  // Çekmece açıldığında taslak var mı kontrol et
  useEffect(() => {
    if (isAlisDrawerOpen) {
      try {
        const raw = localStorage.getItem('alis_fatura_draft_forms_v2');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setHasPendingDraft(true);
          }
        }
      } catch (e) {}
    }
  }, [isAlisDrawerOpen]);

  // Forms değiştikçe otomatik taslak kaydı
  useEffect(() => {
    if (!isAlisDrawerOpen || isSaving) return;
    const isMeaningful = forms.length > 1 || (forms.length === 1 && (forms[0]?.data?.faturaNo || forms[0]?.data?.tedarikciAdi || forms[0]?.data?.toplamTutar || forms[0]?.data?.malHizmetAdi));
    if (isMeaningful) {
      try {
        const lightweightForms = forms.map(f => ({
          ...f,
          data: {
            ...f.data,
            dosyaBase64: undefined
          }
        }));
        localStorage.setItem('alis_fatura_draft_forms_v2', JSON.stringify(lightweightForms));
      } catch (e) {}
    }
  }, [forms, isAlisDrawerOpen, isSaving]);

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem('alis_fatura_draft_forms_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setForms(parsed);
          setHasPendingDraft(false);
          toast.success(`${parsed.length} adet taslak fiş geri yüklendi!`);
        }
      }
    } catch (e) {
      toast.error('Taslak yüklenirken hata oluştu.');
    }
  };

  const clearDraft = () => {
    localStorage.removeItem('alis_fatura_draft_forms_v2');
    setHasPendingDraft(false);
    toast.info('Taslak temizlendi.');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getHesaplanan = (f: FormEntry) => {
    const kdvOrani = parseFloat(f.data.kdvOrani) / 100;
    const stopajOrani = parseFloat(f.data.stopajOrani || '0') / 100;
    const girilenTutar = parseFloat(f.data.toplamTutar);

    let tevkifatCarpani = 0;
    if (f.data.tevkifatOrani && f.data.tevkifatOrani !== '0' && f.data.tevkifatOrani.includes('/')) {
      const [pay, payda] = f.data.tevkifatOrani.split('/').map(Number);
      tevkifatCarpani = payda > 0 ? (pay / payda) : 0;
    }

    if (!isNaN(kdvOrani) && !isNaN(girilenTutar) && girilenTutar > 0) {
      let matrah = 0;

      if (f.tutarTuru === 'dahil') {
        const carpan = 1 + kdvOrani - stopajOrani - (kdvOrani * tevkifatCarpani);
        matrah = carpan > 0 ? girilenTutar / carpan : 0;
      } else {
        matrah = girilenTutar;
      }

      const kdvTutari = matrah * kdvOrani;
      const stopajTutari = matrah * stopajOrani;
      const tevkifatTutari = kdvTutari * tevkifatCarpani;
      const netOdenecek = matrah + kdvTutari - stopajTutari - tevkifatTutari;

      return {
        matrah: Math.round(matrah * 100) / 100,
        kdvTutari: Math.round(kdvTutari * 100) / 100,
        stopajTutari: Math.round(stopajTutari * 100) / 100,
        tevkifatTutari: Math.round(tevkifatTutari * 100) / 100,
        toplamNet: Math.round(netOdenecek * 100) / 100,
      };
    }
    return { matrah: 0, kdvTutari: 0, stopajTutari: 0, tevkifatTutari: 0, toplamNet: 0 };
  };

  const updateForm = (id: number, field: keyof AlisFaturaFormData | 'tutarTuru', value: string) => {
    setForms(prev => prev.map(f => {
      if (f.id === id) {
        if (field === 'tutarTuru') return { ...f, tutarTuru: value as 'dahil' | 'haric' };

        const newErrors = { ...f.errors };
        delete newErrors[field as keyof AlisFaturaFormData];

        const newData = { ...f.data, [field]: value };
        
        // Akıllı Öğrenme: Açıklama veya Satıcı değiştiğinde kural tetikle
        if ((field === 'malHizmetAdi' || field === 'tedarikciAdi') && !newData.muhasebeKodu && kurallar.length > 0) {
           const text = `${newData.tedarikciAdi || ''} ${newData.malHizmetAdi || ''}`.toLowerCase();
           for (const rule of kurallar) {
             if (text.includes(rule.anahtar_kelime.toLowerCase())) {
               newData.muhasebeKodu = rule.muhasebe_kodu;
               toast.success(`Kural eşleşti: ${rule.muhasebe_kodu} atandı!`);
               break;
             }
           }
        }

        return { ...f, data: newData, errors: newErrors };
      }
      return f;
    }));
  };

  const addNewForm = () => {
    setForms(prev => [...prev, { id: Date.now(), data: { ...INITIAL_FORM, faturaTarihi: prev[0]?.data.faturaTarihi || INITIAL_FORM.faturaTarihi }, tutarTuru: 'dahil', errors: {} }]);
  };

  const removeForm = (id: number) => {
    setForms(prev => prev.filter(f => f.id !== id));
  };

  const validateAll = (): boolean => {
    let isValid = true;
    setForms(prev => prev.map(f => {
      const e: Partial<Record<keyof AlisFaturaFormData, string>> = {};
      const d = f.data;
      if (!String(d.faturaNo || '').trim()) e.faturaNo = 'Zorunlu';
      if (!d.faturaTarihi) e.faturaTarihi = 'Zorunlu';
      if (!String(d.tedarikciAdi || '').trim()) e.tedarikciAdi = 'Zorunlu';
      if (!String(d.tedarikciVkn || '').trim()) e.tedarikciVkn = 'Zorunlu';
      if (!String(d.malHizmetAdi || '').trim()) e.malHizmetAdi = 'Zorunlu';
      if (!d.toplamTutar || parseFloat(d.toplamTutar) <= 0) e.toplamTutar = 'Geçersiz';

      if (Object.keys(e).length > 0) isValid = false;
      return { ...f, errors: e };
    }));
    return isValid;
  };

  const handleClose = () => {
    setForms([{ id: Date.now(), data: INITIAL_FORM, tutarTuru: 'dahil', errors: {} }]);
    setUploadedFiles([]);
    setScanProgress(null);
    setAiAddedCount(0);
    setIsScanning(false);
    closeAlisDrawer();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (forms.length === 0) {
      toast.error('Lütfen en az bir belge ekleyin.');
      return;
    }

    if (!validateAll()) {
      toast.error('Lütfen formdaki eksik alanları doldurun.');
      return;
    }

    setIsSaving(true);
    const totalToSave = forms.length;
    let savedCount = 0;
    const initialFormsList = [...forms];

    try {
      for (let i = 0; i < initialFormsList.length; i++) {
        const f = initialFormsList[i];
        const hes = getHesaplanan(f);

        setSaveProgress({
          current: savedCount + 1,
          total: totalToSave,
          remaining: totalToSave - savedCount,
          percent: Math.round(((savedCount + 1) / totalToSave) * 100),
          currentInvoice: f.data.tedarikciAdi || f.data.faturaNo || `Belge #${i + 1}`
        });

        // Gider Kısıtlaması Mantığı (70/30)
        let finalData = { ...f.data };
        const isFuel = /akaryakıt|yakıt|benzin|motorin/i.test(f.data.malHizmetAdi);
        const isOtherVehicleExpense = /bakım|onarım|otopark|yıkama/i.test(f.data.malHizmetAdi);
        
        let applySplit = false;
        
        if (f.data.vehiclePlate) {
          const matchedVehicle = activeCompany?.vehicles?.find(v => v.plate.replace(/\s+/g, '') === f.data.vehiclePlate?.replace(/\s+/g, ''));
          if (matchedVehicle && matchedVehicle.type === 'passenger') {
            applySplit = true;
          }
        } else if (isFuel || isOtherVehicleExpense) {
          if (!hasCommercialVehicle) {
            applySplit = true;
          }
        }

        if (applySplit) {
          const matrah = hes.matrah;
          const kdv = hes.kdvTutari;
          const giderPayi = Math.round(matrah * 0.7 * 100) / 100;
          const kkegPayi = Math.round(matrah * 0.3 * 100) / 100;
          const kdvGiderPayi = Math.round(kdv * 0.7 * 100) / 100;
          const kdvKkegPayi = Math.round(kdv * 0.3 * 100) / 100;

          finalData.aciklama = (finalData.aciklama || '') + ` [%70 Gider: ${giderPayi + kdvGiderPayi} TL, %30 KKEG: ${kkegPayi + kdvKkegPayi} TL]`;
        }

        const isEditMode = !!(f.data as any).id;
        const invoicePayload = {
          ...finalData,
          toplamTutar: f.data.toplamTutar,
          toplamTutarNet: hes.toplamNet,
          tutarTuru: f.tutarTuru,
          matrah: hes.matrah,
          kdvTutari: hes.kdvTutari,
          tevkifatTutari: hes.tevkifatTutari,
          stopajTutari: hes.stopajTutari,
          muhasebeKodu: f.data.muhasebeKodu,
          dosyaBase64: f.data.dosyaBase64 || '',
          dosyaAdi: f.data.dosyaAdi || ''
        } as any;

        if (isEditMode) {
          await updateAlisFatura((f.data as any).id, invoicePayload);
        } else {
          const invoiceId = await addAlisFatura(invoicePayload);

          if (f.data.urunId) {
            await stokApi.addHareket({
              urunId: f.data.urunId,
              depoId: f.data.depoId || varsayilanDepoId,
              tip: 'GIRIS',
              miktar: 1, 
              birimFiyat: hes.matrah,
              tutar: hes.matrah,
              tarih: f.data.faturaTarihi,
              referansNo: `Alış Faturası: ${f.data.faturaNo}`,
              aciklama: `${f.data.tedarikciAdi} firmasından alım.`,
              bagliFaturaId: invoiceId
            });
          }
        }

        // Başarıyla kaydedilen fişi listeden ve taslaktan anında çıkar:
        savedCount++;
        setForms(prev => {
          const nextForms = prev.filter(item => item.id !== f.id);
          if (nextForms.length > 0) {
            try { localStorage.setItem('alis_fatura_draft_forms_v2', JSON.stringify(nextForms)); } catch (e) {}
          } else {
            localStorage.removeItem('alis_fatura_draft_forms_v2');
          }
          return nextForms;
        });
      }

      localStorage.removeItem('alis_fatura_draft_forms_v2');
      toast.success(`${savedCount} adet alış faturası başarıyla sisteme kaydedildi.`);
      handleClose();
    } catch (error: any) {
      console.error('Kayıt hatası:', error);
      toast.error(`İşlem sırasında hata: ${error.message || 'Bilinmeyen hata'}. Başarıyla aktarılan: ${savedCount} adet. Kalan ${totalToSave - savedCount} adet fiş arka planda korundu, tekrar deneyebilirsiniz.`);
    } finally {
      setIsSaving(false);
      setSaveProgress(null);
    }
  };

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
        newFiles.push({ base64: processed.base64, mimeType: processed.mimeType, name: file.name });
      }
      setUploadedFiles(prev => [...prev, ...newFiles]);
      setAiAddedCount(0);
    } catch (err) {
      toast.error('Dosya işlenirken hata oluştu.');
    } finally {
      setIsScanning(false);
    }
  };
  const scanImage = async () => {
    if (uploadedFiles.length === 0) return;

    setIsScanning(true);
    let totalAdded = 0;
    
    let activeProvider = 'gemini';
    let apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    let aiModel = 'gemini-3.8-flash';
    let nvidiaApiKey = '';
    let nvidiaModelName = 'meta/llama-3.2-11b-vision-instruct';
    
    try {
      const [provRes, keyRes, modelRes, nKeyRes, nModelRes] = await Promise.all([
        apiFetch('/api/settings/ai_provider').catch(() => null),
        apiFetch('/api/settings/gemini_api_key').catch(() => null),
        apiFetch('/api/settings/gemini_model').catch(() => null),
        apiFetch('/api/settings/nvidia_api_key').catch(() => null),
        apiFetch('/api/settings/nvidia_model').catch(() => null),
      ]);

      if (provRes?.success && provRes.value) activeProvider = provRes.value;
      if (keyRes?.success && keyRes.value) apiKey = keyRes.value;
      if (modelRes?.success && modelRes.value) aiModel = modelRes.value;
      if (nKeyRes?.success && nKeyRes.value) nvidiaApiKey = nKeyRes.value;
      if (nModelRes?.success && nModelRes.value) nvidiaModelName = nModelRes.value;
    } catch (keyErr) {
      console.warn('Ayarlar alınamadı:', keyErr);
    }

    if (activeProvider === 'nvidia') {
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
    if (safeModelName === 'gemini-3.6-flash' || safeModelName === 'gemini-2.0-flash' || safeModelName.includes('2.0') || safeModelName.includes('3.6') || safeModelName.includes('8b')) {
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

    const prompt = `Bu dosyada BİRDEN FAZLA ayrı fiş veya fatura olabilir. Veya TEK BİR fişte/faturada BİRDEN FAZLA FARKLI KDV oranı (Örn: %1, %10, %20) olabilir.
Lütfen bulduğun TÜM fiş/faturaları çıkar ve aşağıdaki JSON DİZİSİ formatında döndür. 

ÖNEMLİ KURAL: Eğer tek bir fişte/faturada birden fazla KDV oranı varsa (Örn: bazı ürünler %1, bazıları %20), LÜTFEN her bir KDV oranının toplam tutarını (kdv dahil) ayrı birer JSON objesi (ayrı bir fatura kaydı) olarak diziye ekle! Fatura no, tarih ve satıcı adı aynı kalsın, sadece tutar, malHizmetAdi ("... %20 KDV'li Ürünler" vb.) ve kdv_orani farklı olsun.
ÖNEMLİ KURAL 2: Eğer bu bir akaryakıt fişi/faturası ise, fatura üzerinde yazan ARAÇ PLAKASINI mutlaka "plate" alanına yaz.
ÖNEMLİ KURAL 3: Yemek (Restoran/Lokanta), akaryakıt, konaklama, kırtasiye, ofis tüketim, market gibi şirket içi genel harcama fişleri KESİNLİKLE 7'li gider hesaplarına (Örn: 770 Genel Yönetim Giderleri) atılmalıdır. 153 Ticari Mallar hesabı SADECE satmak amacıyla alınan ürünler için kullanılır. Fişin türüne dikkat ederek en uygun hesabı seç.
ÖNEMLİ KURAL 4: Fiş/fatura üzerindeki ödeme tipini analiz et. Eğer slip veya fiş üzerinde "**** 1104", "Kredi Kartı", "Banka Kartı" gibi kredi kartı ödemesine dair bir ibare varsa "odeme_sekli": "KREDI_KARTI" yap ve kartın son 4 hanesini "kredi_karti_son4" alanına yaz (örn: "1104"). Eğer nakit ödenmişse veya belli değilse "odeme_sekli": "NAKIT" yap.

Aşağıdaki LUCA HESAP PLANI listesinden bu faturanın açıklamasına/türüne en uygun "kod"u seçerek "muhasebe_kodu" alanına yaz:
${lucaAccounts.map(a => `${a.kod}: ${a.ad}`).join('\n')}

SADECE JSON döndür:
{
  "faturalar": [
    {
      "tedarikciAdi": "firma/satıcı adı",
      "tedarikciVkn": "VKN veya T.C.",
      "faturaNo": "belge no",
      "malHizmetAdi": "ürün özeti veya ... %KDV'li Ürünler",
      "faturaTarihi": "YYYY-MM-DD",
      "tutar": "120.50",
      "tutar_tur": "dahil",
      "kdv_orani": "18",
      "tevkifat_orani": "0",
      "stopaj_orani": "0",
      "aciklama": "",
      "muhasebe_kodu": "Yukarıdaki listeden seçilen en uygun hesap kodu",
      "plate": "Eğer varsa araç plakası (34ABC123 formatında)",
      "odeme_sekli": "KREDI_KARTI veya NAKIT",
      "kredi_karti_son4": "Eğer kartsa slipteki son 4 hane, yoksa boş bırak"
    }
  ]
}
Eğer hiçbir belge okunamıyorsa şunu döndür: {"hata": "Belge okunamadı"}`;

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      setScanProgress({
        current: i + 1,
        total: uploadedFiles.length,
        remaining: uploadedFiles.length - (i + 1),
        percent: Math.round(((i + 1) / uploadedFiles.length) * 100),
        currentFileName: file.name
      });
      
      try {
        let parsed: any = null;

        if (activeProvider === 'nvidia') {
          // ==================== NVIDIA BUILD (NIM) ÇAĞRISI ====================
          // Tarayıcıdan doğrudan integrate.api.nvidia.com çağrıları CORS nedeniyle engellenir (Failed to fetch).
          // Bu nedenle istek Node.js Express proxy uç noktasına (/api/ai/analyze-invoice) yönlendirilir.
          const proxyRes = await apiFetch('/api/ai/analyze-invoice', {
            method: 'POST',
            body: JSON.stringify({
              fileBase64: file.base64,
              mimeType: file.mimeType,
              prompt: prompt,
              provider: 'nvidia',
              nvidiaApiKey: nvidiaApiKey,
              nvidiaModel: nvidiaModelName
            })
          });

          if (!proxyRes?.success || !proxyRes.data) {
            throw new Error(proxyRes?.message || 'NVIDIA NIM analizi başarısız oldu.');
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
            'gemini-3.8-flash',
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
                    generationConfig: { responseMimeType: "application/json" }
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
            const clean = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
            try {
              parsed = JSON.parse(clean);
            } catch (pe) {
              const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
              if (match) parsed = JSON.parse(match[0]);
              else throw new Error('Yapay zeka yanıtı okunamadı.');
            }
          }
        }

        if (!parsed) {
          throw new Error('Belge analiz edilemedi.');
        }

        // Her dosya işlendikten sonra rate limit'i korumak için kısa bekleme
        await new Promise(r => setTimeout(r, 800));

        if (parsed.hata) {
          toast.error(`${file.name} okunamadı: ${parsed.hata}`);
        } else {
          const fList = parsed.faturalar ? parsed.faturalar : (Array.isArray(parsed) ? parsed : [parsed]);
          
          const newForms: FormEntry[] = fList.map((f: any, idx: number) => {
            const fTedarikciAdi = f.tedarikciAdi || f.tedarikci_adi || f.ad || f.isim || f.vendor || f.customer || '';
            const fTedarikciVkn = f.tedarikciVkn || f.tedarikci_vkn || f.tcVkn || f.tc_vkn || f.vkn || f.tckn || '';
            const fFaturaNo = f.faturaNo || f.fatura_no || f.belgeNo || f.belge_no || f.invoiceNo || '';
            const fMalHizmetAdi = f.malHizmetAdi || f.mal_hizmet_adi || f.urun_adi || f.urunAdi || f.aciklama || f.description || 'Fiş Gideri';
            const fFaturaTarihi = f.faturaTarihi || f.fatura_tarihi || f.tarih || f.date || INITIAL_FORM.faturaTarihi;
            const fTutar = f.tutar || f.toplam_tutar || f.toplamTutar || f.amount || f.total || '';
            const fTutarTur = f.tutar_tur || f.tutarTuru || f.tutar_type || 'dahil';
            const fKdvOrani = f.kdv_orani || f.kdvOrani || f.kdv || '18';
            const fTevkifatOrani = f.tevkifat_orani || f.tevkifatOrani || f.tevkifat || '0';
            const fStopajOrani = f.stopaj_orani || f.stopajOrani || f.stopaj || '0';
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
                kdvOrani: fKdvOrani ? fKdvOrani.toString() : '18',
                tevkifatOrani: fTevkifatOrani?.toString() || '0',
                stopajOrani: fStopajOrani?.toString() || '0',
                aciklama: fAciklama,
                cariId: matchedCari ? matchedCari.id : undefined,
                depoId: varsayilanDepoId,
                muhasebeKodu: fMuhasebeKodu,
                karsiHesapKodu: mappedKarsiHesapKodu,
                vehiclePlate: rawPlate,
                dosyaBase64: file.base64,
                dosyaAdi: file.name
              }
            };
          });

          setForms(prev => {
            const hasEmptyInitial = prev.length === 1 && !prev[0].data.faturaNo && !prev[0].data.tedarikciAdi;
            const currentForms = hasEmptyInitial ? [] : [...prev];
            return [...currentForms, ...newForms];
          });
          
          totalAdded += newForms.length;
          setAiAddedCount(prev => prev + newForms.length);
        }
      } catch (err: any) {
        console.error('File index', i, 'error:', err);
        toast.error(`${file.name} okunamadı: ${err.message || 'Bilinmeyen Hata'}`);
      }
    }

    setScanProgress(null);
    setIsScanning(false);
    if (totalAdded > 0) toast.success(`AI tarafından toplam ${totalAdded} adet sonuç PDF/Resimlerden çıkarıldı!`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
  };

  const handleVknChange = (formId: number, val: string) => {
    updateForm(formId, 'tedarikciVkn', val);
    
    if (val.length >= 10) {
      const matched = (cariler || []).find(c => c && c.vknTckn === val && c.tip !== 'musteri');
      if (matched) {
        setForms(prev => prev.map(f => {
          if (f.id === formId) {
            return {
              ...f,
              data: {
                ...f.data,
                cariId: matched.id,
                tedarikciAdi: matched.unvan || ''
              },
              errors: {}
            };
          }
          return f;
        }));
        toast.success(`${matched.unvan} otomatik eşleşti!`, { id: `match-${formId}` });
      }
    }
  };

  return (
    <Sheet open={isAlisDrawerOpen} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" side="right">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Yeni Alış Faturası Girişi
          </SheetTitle>
          <SheetDescription>
            PDF dosyalarını veya resimleri yükleyerek yapay zekanın tüm bilgileri çekmesini ve belgeyi kaydetmesini sağlayabilirsiniz.
          </SheetDescription>
        </SheetHeader>

        {/* Kurtarılmış Taslak Bildirimi */}
        {hasPendingDraft && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mt-4 flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900">Arka Planda Kayıtlı Taslak Bulundu!</h4>
                <p className="text-xs text-amber-700">Önceki oturumdan kalan fişler tarayıcınızda güvenle saklandı.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={loadDraft} className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm">
                Taslağı Yükle
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={clearDraft} className="text-amber-800 hover:bg-amber-100">
                Temizle
              </Button>
            </div>
          </div>
        )}

        {/* Yapay Zeka Tarama İlerleme Çubuğu */}
        {isScanning && scanProgress && (
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 mt-4 space-y-2 shadow-sm animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                Dosyalar Taranıyor ({scanProgress.current} / {scanProgress.total})
              </span>
              <span className="bg-indigo-200/80 px-2 py-0.5 rounded text-indigo-900 font-bold">
                %{scanProgress.percent}
              </span>
            </div>
            <Progress value={scanProgress.percent} className="h-2.5 bg-indigo-100" />
            
            {scanProgress.isWaitingQuota && (
              <div className="bg-amber-100 border border-amber-300 rounded-lg p-2.5 text-xs text-amber-900 flex items-center justify-between animate-pulse">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
                  Google dakikalık kota sınırı (Dakikada 20 fiş). Otomatik bekleniyor...
                </span>
                <span className="font-mono font-bold bg-amber-200 px-2.5 py-1 rounded text-amber-900 text-xs">
                  {scanProgress.quotaWaitSeconds} sn
                </span>
              </div>
            )}

            <div className="flex justify-between items-center text-[11px] text-indigo-700">
              <span className="truncate max-w-[260px] font-medium">{scanProgress.currentFileName || 'Belge işleniyor...'}</span>
              <span>Kalan: <b>{scanProgress.remaining} dosya</b></span>
            </div>
          </div>
        )}

        {/* Sisteme Kaydetme / Aktarım İlerleme Çubuğu */}
        {isSaving && saveProgress && (
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mt-4 space-y-2 shadow-sm animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                Sisteme Aktarılıyor ({saveProgress.current} / {saveProgress.total})
              </span>
              <span className="bg-emerald-200/80 px-2 py-0.5 rounded text-emerald-900 font-bold">
                %{saveProgress.percent} Aktarıldı
              </span>
            </div>
            <Progress value={saveProgress.percent} className="h-2.5 bg-emerald-100" />
            <div className="flex justify-between items-center text-[11px] text-emerald-700">
              <span className="truncate max-w-[260px] font-medium">{saveProgress.currentInvoice}</span>
              <span>Kalan: <b>{saveProgress.remaining} fiş</b></span>
            </div>
          </div>
        )}

        <div className="py-6 space-y-6">
          <div className="space-y-3">
            {uploadedFiles.length === 0 ? (
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors relative",
                  isDragging ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.length > 0) processFiles(Array.from(e.dataTransfer.files));
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" multiple onChange={handleFileChange} />
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6 text-slate-500" />
                </div>
                <h4 className="font-semibold text-slate-900">PDF veya Resim (Fatura/Fiş) Yükleyin</h4>
                <p className="text-sm text-slate-500 mt-1">Gelişmiş AI modeli birden fazla PDF ve resmi anında okur!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="relative border rounded-lg overflow-hidden bg-slate-50 group aspect-square flex items-center justify-center">
                      {file.mimeType === 'application/pdf' ? (
                        <div className="flex flex-col items-center justify-center p-2 text-center">
                          <FileText className="w-8 h-8 text-red-400 mb-1" />
                          <p className="text-xs font-medium text-slate-600 truncate w-full px-2">{file.name}</p>
                        </div>
                      ) : (
                        <img src={file.base64} alt={file.name} className="w-full h-full object-cover" />
                      )}
                      
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button type="button" size="icon" variant="destructive" className="h-6 w-6 rounded-full shadow-sm" onClick={(e) => {
                          e.stopPropagation();
                          setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
                        }}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Add more button */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-slate-50 transition-colors aspect-square"
                  >
                    <Plus className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs text-slate-500 font-medium">Dosya Ekle</span>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" multiple onChange={handleFileChange} />
                  </div>
                </div>

                {aiAddedCount === 0 && (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      onClick={scanImage}
                      disabled={isScanning}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg font-semibold rounded-full px-8 py-6 text-lg"
                    >
                      {isScanning ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                          {scanProgress ? `Diziliyor (${scanProgress.current}/${scanProgress.total})...` : 'Analiz Ediliyor...'}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-3" />
                          Tümünü Analiz Et ({uploadedFiles.length} Dosya)
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {aiAddedCount > 0 && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div className="text-sm text-emerald-900">
                  <span className="font-semibold text-base block mb-1">Tarama tamamlandı!</span> 
                  Yüklediğiniz dosyalardan toplam <b>{aiAddedCount} adet</b> fiş/fatura çıkarıldı.
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Çoklu Belge Durum ve İlerleme Özeti */}
            {forms.length > 1 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center">
                    {forms.length}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">Hazır Fişler / Faturalar</h5>
                    <p className="text-[11px] text-slate-500">Kayıt sırasında her fiş tek tek işlenir, yarıda kalma riski yoktur.</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                    {forms.length} Belge Bekliyor
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-8">
              {forms.map((form, index) => {
                const hes = getHesaplanan(form);
                const isMultiple = forms.length > 1;

                return (
                  <div key={form.id} className="bg-white border rounded-xl p-4 shadow-sm relative group">
                    {isMultiple && (
                      <div className="absolute top-2 right-2">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeForm(form.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    <h3 className="text-sm font-bold text-slate-400 mb-4 pb-2 border-b uppercase">
                      Satır #{index + 1}
                    </h3>

                    <div className={cn("grid gap-4 mb-4", !isIsletmeDefteri ? "grid-cols-2" : "grid-cols-1")}>
                      <div>
                        <Label className="text-xs font-medium text-emerald-600 mb-1 block">Kayıtlı Tedarikçi Seç (Cari)</Label>
                        <Select
                          value={String(form.data.cariId ?? 'yok')}
                          onValueChange={(val) => {
                            if (val === 'yok') {
                              setForms(prev => prev.map(fp => fp.id === form.id ? { ...fp, data: { ...fp.data, cariId: undefined } } : fp));
                              return;
                            }
                            const c = (cariler || []).find(x => String(x.id ?? '') === val);
                            if (c) {
                              setForms(prev => prev.map(fp => {
                                if (fp.id === form.id) {
                                  return {
                                    ...fp,
                                    data: {
                                      ...fp.data,
                                      cariId: c.id,
                                      tedarikciAdi: c.unvan,
                                      tedarikciVkn: c.vknTckn
                                    },
                                    errors: {}
                                  };
                                }
                                return fp;
                              }));
                            }
                          }}
                        >
                          <SelectTrigger className="w-full h-9 bg-emerald-50/30 border-emerald-100">
                            <SelectValue placeholder="Tedarikçilerinizden seçin..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yok" className="text-slate-500 font-medium">-- Serbest Devam Et --</SelectItem>
                            {(cariler || []).filter(c => c && c.tip !== 'musteri' && c.id !== undefined && c.id !== null && String(c.id).trim() !== '').map((c, idx) => (
                               <SelectItem key={c.id !== undefined && c.id !== null ? String(c.id) : `cari-${idx}`} value={String(c.id ?? '')}>
                                 {String(c.unvan ?? 'Bilinmiyor')} ({String(c.vknTckn ?? '')})
                               </SelectItem>
                             ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {!isIsletmeDefteri && (
                        <div>
                          <Label className="text-xs font-medium text-amber-600 mb-1 block">Ödeme / Karşı Hesap (Fişler İçin)</Label>
                          <LucaAccountSelect
                            value={form.data.karsiHesapKodu || ''}
                            onChange={(val) => updateForm(form.id, 'karsiHesapKodu', val)}
                            placeholder="Kasa / Banka hesabı seçin..."
                            className="h-9 bg-amber-50/30 border-amber-100"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Belge/Fatura No <span className="text-red-500">*</span></Label>
                        <Input value={form.data.faturaNo} onChange={(e) => updateForm(form.id, 'faturaNo', e.target.value)} className={form.errors.faturaNo ? 'border-red-500 h-9' : 'h-9'} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Fatura Tarihi <span className="text-red-500">*</span></Label>
                        <Input type="date" value={form.data.faturaTarihi} onChange={(e) => updateForm(form.id, 'faturaTarihi', e.target.value)} className={form.errors.faturaTarihi ? 'border-red-500 h-9' : 'h-9'} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Vade Tarihi</Label>
                        <Input type="date" value={form.data.vadeTarihi || ''} onChange={(e) => updateForm(form.id, 'vadeTarihi', e.target.value)} className="h-9" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Firma / Tedarikçi<span className="text-red-500">*</span></Label>
                        <Input value={form.data.tedarikciAdi} onChange={(e) => updateForm(form.id, 'tedarikciAdi', e.target.value)} className={form.errors.tedarikciAdi ? 'border-red-500 h-9' : 'h-9'} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">VKN / T.C.<span className="text-red-500">*</span></Label>
                        <Input value={form.data.tedarikciVkn} onChange={(e) => handleVknChange(form.id, e.target.value)} className={form.errors.tedarikciVkn ? 'border-red-500 h-9' : 'h-9'} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-blue-600 mb-1 flex items-center justify-between">
                          Stok Kartı Bağla (Opsiyonel)
                          <Button 
                            type="button" 
                            variant="link" 
                            className="h-auto p-0 text-[10px] font-bold h-4" 
                            onClick={() => setIsUrunFormOpen(true)}
                          >
                            + Yeni Stok Kartı
                          </Button>
                        </Label>
                        <Select
                          value={form.data.urunId || 'yok'}
                          onValueChange={(val) => {
                            const selectedUrun = urunler?.find(u => u.id === val);
                            updateForm(form.id, 'urunId', val === 'yok' ? '' : val);
                            if (selectedUrun) {
                               updateForm(form.id, 'malHizmetAdi', selectedUrun.urunAdi || 'İsimsiz Ürün');
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 border-blue-100 bg-blue-50/20">
                            <SelectValue placeholder="Stok seçiniz..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yok">Bağlama Yapma</SelectItem>
                            {(!urunler || urunler.length === 0) ? (
                              <SelectItem value="none" disabled className="text-slate-400 italic">Sistemde hiç stok kartınız yok (+ Yeni ekleyin)</SelectItem>
                            ) : urunler.map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.urunAdi || 'İsimsiz'} ({u.stokKodu})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                         <Label className="text-xs font-medium text-slate-500">Hedef Depo</Label>
                         <Select
                          value={form.data.depoId || varsayilanDepoId}
                          onValueChange={(val) => updateForm(form.id, 'depoId', val)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Depo seçiniz..." />
                          </SelectTrigger>
                          <SelectContent>
                            {depolar?.map(d => (
                              <SelectItem key={d.id} value={d.id}>{d.ad}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <Label className="text-xs font-medium text-slate-500">Hizmet/Ürün Açıklaması<span className="text-red-500">*</span></Label>
                      <Input value={form.data.malHizmetAdi} onChange={(e) => updateForm(form.id, 'malHizmetAdi', e.target.value)} className={form.errors.malHizmetAdi ? 'border-red-500 h-9' : 'h-9'} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Belge Notu / Genel Açıklama</Label>
                        <Input value={form.data.aciklama} onChange={(e) => updateForm(form.id, 'aciklama', e.target.value)} placeholder="Örn: Proje bazlı alım" className="h-9" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-indigo-600">Araç Plakası (Gider Kısıtı İçin)</Label>
                        <Select
                          value={form.data.vehiclePlate || 'yok'}
                          onValueChange={(val) => updateForm(form.id, 'vehiclePlate', val === 'yok' ? '' : val)}
                        >
                          <SelectTrigger className="h-9 border-indigo-100 bg-indigo-50/20">
                            <SelectValue placeholder="Plaka seçiniz..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yok">Araçsız / Diğer</SelectItem>
                            {activeCompany?.vehicles?.map(v => (
                              <SelectItem key={v.id} value={v.plate}>{v.plate} ({v.type === 'passenger' ? 'Binek' : 'Ticari'})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Luca Muhasebe Kodu Seçimi */}
                    <div className="space-y-2 mb-4">
                      <Label className="text-xs font-semibold text-indigo-700 block">🔍 Luca Muhasebe Kodu</Label>
                      <LucaAccountSelect 
                        value={form.data.muhasebeKodu || ''} 
                        onChange={(val) => updateForm(form.id, 'muhasebeKodu', val)}
                        placeholder="Ana hesap kodu seçin (örn: 153.01.001)..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Tutar Değeri <span className="text-red-500">*</span></Label>
                        <Input type="number" min="0" step="0.01" value={form.data.toplamTutar} onChange={(e) => updateForm(form.id, 'toplamTutar', e.target.value)} className={form.errors.toplamTutar ? 'border-red-500 h-9' : 'h-9'} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Girdiğiniz Tutar Neyin Tutarı?</Label>
                        <div className="flex bg-slate-100 p-1 rounded-md">
                          <button type="button" onClick={() => updateForm(form.id, 'tutarTuru', 'dahil')} className={cn("flex-1 text-xs font-medium py-1.5 rounded transition-all", form.tutarTuru === 'dahil' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>Net Ödenecek (KDV Dahil)</button>
                          <button type="button" onClick={() => updateForm(form.id, 'tutarTuru', 'haric')} className={cn("flex-1 text-xs font-medium py-1.5 rounded transition-all", form.tutarTuru === 'haric' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>Brüt Matrah (KDV Hariç)</button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="space-y-2 border-r pr-2">
                        <Label className="text-xs font-medium text-slate-500">KDV Oranı</Label>
                        <div className="flex flex-wrap gap-1">
                          {KDV_ORANLARI.map((oran) => (
                            <button key={oran} type="button" onClick={() => updateForm(form.id, 'kdvOrani', oran)} className={cn("px-2 py-1 rounded text-xs transition-all border", form.data.kdvOrani === oran ? "bg-primary border-primary text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300")}>
                              %{oran}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2 border-r px-2">
                        <Label className="text-xs font-medium text-slate-500">KDV Tevkifatı (Kesinti)</Label>
                        <div className="flex flex-wrap gap-1">
                          {TEVKIFAT_ORANLARI.map((oran) => (
                            <button key={oran} type="button" onClick={() => updateForm(form.id, 'tevkifatOrani', oran)} className={cn("px-1.5 py-1 rounded text-[10px] transition-all border", form.data.tevkifatOrani === oran ? "bg-amber-500 border-amber-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300")}>
                              {oran === '0' ? 'Yok' : oran}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2 pl-2">
                        <Label className="text-xs font-medium text-slate-500">Stopaj Oranı</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Input type="number" min="0" max="100" value={form.data.stopajOrani} onChange={(e) => updateForm(form.id, 'stopajOrani', e.target.value)} className="h-8 w-16" />
                          <span className="text-xs text-slate-400">%</span>
                        </div>
                      </div>
                    </div>

                    {(hes.matrah > 0 || hes.kdvTutari > 0) && (
                      <div className="bg-slate-50 rounded p-3 text-xs flex flex-wrap gap-4 border items-center">
                        <div className="text-slate-500">Brüt Matrah: <strong className="text-slate-900">{formatCurrency(hes.matrah)}</strong></div>
                        <div className="text-slate-500">Top. KDV: <strong className="text-slate-900">{formatCurrency(hes.kdvTutari)}</strong></div>
                        {hes.tevkifatTutari > 0 && <div className="text-amber-600">Devreden Tevkifat: <strong>-{formatCurrency(hes.tevkifatTutari)}</strong></div>}
                        {hes.stopajTutari > 0 && <div className="text-red-500">Stopaj Kesintisi: <strong>-{formatCurrency(hes.stopajTutari)}</strong></div>}

                        <div className="ml-auto text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded">
                          Net Ödenen: {formatCurrency(hes.toplamNet)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button type="button" variant="outline" onClick={addNewForm} className="border-dashed border-2 w-full h-12 text-slate-500 border-slate-300 bg-slate-50 hover:bg-slate-100 hover:text-primary transition-all">
              <Plus className="w-4 h-4 mr-2" /> Yeni Satır / Belge Ekle
            </Button>

            <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white pb-6 mt-6 z-10">
              <Button type="button" variant="outline" className="flex-1 h-12" onClick={handleClose}>İptal</Button>
              <Button type="submit" disabled={isSaving || isScanning} className={cn("flex-1 h-12 shadow-sm font-semibold transition-all", aiAddedCount > 0 ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-primary hover:bg-primary/90 text-primary-foreground")}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Aktarılıyor ({saveProgress ? `${saveProgress.current}/${saveProgress.total}` : '...'})
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    {forms.length > 1 ? `Tümünü Kaydet ve Sisteme Aktar (${forms.length} Fiş)` : 'Kaydet ve Ekle'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
        <UrunForm 
          isOpen={isUrunFormOpen} 
          onClose={() => setIsUrunFormOpen(false)} 
        />
      </SheetContent>
    </Sheet>
  );
}
