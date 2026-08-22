import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
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

export function AlisFaturaDrawer() {
  const { isAlisDrawerOpen, closeAlisDrawer, addAlisFatura, cariler, alisInitialData, lucaAccounts, companies, user, apiFetch } = useApp();
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
  const [scanProgress, setScanProgress] = useState<{ current: number, total: number } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [aiAddedCount, setAiAddedCount] = useState(0);

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

    if (validateAll()) {
      try {
        for (const f of forms) {
          const hes = getHesaplanan(f);
          
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
            } else {
              // Ticari araç var, kullanıcıya sormak lazım ama loop içinde confirm zor.
              // Şimdilik plaka yoksa ve ticari araç varsa split yapma (veya uyarı ver)
              const userConfirm = confirm(`${f.data.tedarikciAdi} faturası bir araç gideri gibi görünüyor. Binek araç gider kısıtlaması (%70/%30) uygulansın mı?`);
              if (userConfirm) applySplit = true;
            }
          }

          if (applySplit) {
            const matrah = hes.matrah;
            const kdv = hes.kdvTutari;
            const giderPayi = Math.round(matrah * 0.7 * 100) / 100;
            const kkegPayi = Math.round(matrah * 0.3 * 100) / 100;
            const kdvGiderPayi = Math.round(kdv * 0.7 * 100) / 100;
            const kdvKkegPayi = Math.round(kdv * 0.3 * 100) / 100;

            // Faturayı kaydet ama açıklmaya not düş
            finalData.aciklama = (finalData.aciklama || '') + ` [%70 Gider: ${giderPayi + kdvGiderPayi} TL, %30 KKEG: ${kkegPayi + kdvKkegPayi} TL]`;
            toast.info(`${f.data.faturaNo} nolu faturaya %70/%30 gider kısıtı uygulandı.`);
          }

          const invoiceId = await addAlisFatura({
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
          } as any);

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
        toast.success(`${forms.length} adet alış faturası kaydedildi.`);
        handleClose();
      } catch (error: any) {
        toast.error('Kayıt sırasında bir hata oluştu: ' + error.message);
      }
    } else {
      toast.error('Lütfen formdaki eksik alanları doldurun.');
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
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        newFiles.push({ base64: b64, mimeType: file.type, name: file.name });
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
    
    let apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    let aiModel = 'gemini-2.5-flash';
    
    try {
      const keyRes = await apiFetch('/api/settings/gemini_api_key');
      if (keyRes && keyRes.value) {
        apiKey = keyRes.value;
      }
      const modelRes = await apiFetch('/api/settings/gemini_model');
      if (modelRes && modelRes.value) {
        aiModel = modelRes.value;
      }
    } catch (keyErr) {
      console.warn('Ayarlardan Gemini API anahtarı alınamadı, yerel değişken kullanılacak:', keyErr);
    }

    if (!apiKey) {
      toast.error('Yapay zeka anahtarı (Gemini API Key) bulunamadı. Lütfen ayarlardan tanımlayın.');
      setIsScanning(false);
      return;
    }

    const safeModelName = aiModel ? aiModel.trim() : 'gemini-2.5-flash';
    
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
      setScanProgress({ current: i + 1, total: uploadedFiles.length });
      
      try {
        const rawBase64 = file.base64.split(',')[1];
        const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${safeModelName}:generateContent?key=${apiKey}`, {
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
        if (data.error) throw new Error(data.error.message || 'API Hatası');

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log(`Gemini raw response text for file ${i}:`, text);
        
        const clean = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);

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

                    <div className="grid grid-cols-2 gap-4 mb-4">
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
                      <div>
                        <Label className="text-xs font-medium text-amber-600 mb-1 block">Ödeme / Karşı Hesap (Fişler İçin)</Label>
                        <LucaAccountSelect
                          value={form.data.karsiHesapKodu || ''}
                          onChange={(val) => updateForm(form.id, 'karsiHesapKodu', val)}
                          placeholder="Kasa / Banka hesabı seçin..."
                          className="h-9 bg-amber-50/30 border-amber-100"
                        />
                      </div>
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
              <Button type="submit" className={cn("flex-1 h-12", aiAddedCount > 0 && "bg-indigo-600 hover:bg-indigo-700 text-white")}>
                <Save className="w-5 h-5 mr-2" /> Kaydet ve Ekle ({forms.length})
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
