import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { Plus, Trash2, FileText, CheckCircle2, Save, X, Banknote, Sparkles, Loader2 } from 'lucide-react';
import { LucaAccountSelect } from '@/components/LucaAccountSelect';
import type { SatisFaturaFormData } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUrunler } from '@/modules/stok/hooks/useStokQuery';

const KDV_ORANLARI = ['0', '1', '8', '10', '18', '20'];
const TEVKIFAT_ORANLARI = ['0', '2/10', '3/10', '4/10', '5/10', '7/10', '9/10', '10/10'];

const INITIAL_FORM: SatisFaturaFormData = {
  tcVkn: '',
  ad: '',
  soyad: '',
  adres: '',
  kdvOrani: '20',
  alinanUcret: '',
  faturaTarihi: new Date().toISOString().split('T')[0],
  vadeTarihi: '',
  tevkifatOrani: '0',
  tevkifatKodu: '',
  stopajOrani: '0',
  stopajKodu: '',
  aciklama: ''
};

type StokKalemi = {
  id: string;
  urunId: string;
  miktar: number;
  birimFiyat: number;
  urunAdi?: string;
};

type FormEntry = {
  id: number;
  data: SatisFaturaFormData;
  tutarTuru: 'dahil' | 'haric';
  errors: Partial<Record<keyof SatisFaturaFormData, string>>;
  stokKalemleri: StokKalemi[];
};

type UploadedFile = {
  base64: string;
  mimeType: string;
  name: string;
};

export function SatisFaturaDrawer() {
  const { isSatisDrawerOpen, closeSatisDrawer, addSatisFatura, updateSatisFatura, cariler, satisInitialData, lucaAccounts } = useApp();
  const { data: urunler } = useUrunler();

  useEffect(() => {
    if (isSatisDrawerOpen && satisInitialData) {
      let mergedData = { ...INITIAL_FORM, ...satisInitialData };
      
      // cariId varsa ama VKN/Ad eksikse, cariler listesinden çek
      if (mergedData.cariId && cariler) {
        const cari = cariler.find(c => String(c.id) === String(mergedData.cariId));
        if (cari) {
          if (!mergedData.tcVkn) mergedData.tcVkn = cari.vknTckn || '';
          if (!mergedData.ad) mergedData.ad = cari.unvan || '';
          if (!mergedData.adres) mergedData.adres = cari.adres || '';
        }
      }
      
      // Stok kalemlerini hazırla
      let initialStokKalemleri: StokKalemi[] = [];
      const initData = satisInitialData as any;
      if (initData.stokKalemleri && initData.stokKalemleri.length > 0) {
        initialStokKalemleri = initData.stokKalemleri.map((sk: any) => ({
          id: sk.id || ('sk' + Date.now() + Math.random().toString(36).slice(2)),
          urunId: sk.urunId || sk.urun_id || '',
          miktar: sk.miktar || 1,
          birimFiyat: sk.birimFiyat || sk.birim_fiyat || 0,
          urunAdi: sk.urunAdi || sk.urun_adi || '',
        }));
      } else if (mergedData.urunId && mergedData.urunId !== 'yok') {
        // Tek ürün varsa stok kalemine dönüştür
        const urun = urunler?.find(u => u.id === mergedData.urunId);
        initialStokKalemleri = [{
          id: 'sk' + Date.now(),
          urunId: mergedData.urunId,
          miktar: 1,
          birimFiyat: urun?.birimFiyat || 0,
          urunAdi: urun?.urunAdi || '',
        }];
      }
      
      setForms([{
        id: Date.now(),
        data: mergedData,
        tutarTuru: 'dahil',
        errors: {},
        stokKalemleri: initialStokKalemleri,
      }]);
    }
  }, [isSatisDrawerOpen, satisInitialData, cariler]);

  const [forms, setForms] = useState<FormEntry[]>([
    { id: Date.now(), data: INITIAL_FORM, tutarTuru: 'dahil', errors: {}, stokKalemleri: [] }
  ]);

  // AI States
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [aiAddedCount, setAiAddedCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getHesaplanan = (f: FormEntry) => {
    const kdvOrani = parseFloat(f.data.kdvOrani) / 100;
    const stopajOrani = parseFloat(f.data.stopajOrani || '0') / 100;
    const girilenTutar = parseFloat(f.data.alinanUcret);

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

  const updateForm = (id: number, field: keyof SatisFaturaFormData | 'tutarTuru', value: string) => {
    setForms(prev => prev.map(f => {
      if (f.id === id) {
        if (field === 'tutarTuru') return { ...f, tutarTuru: value as 'dahil' | 'haric' };

        const newErrors = { ...f.errors };
        delete newErrors[field as keyof SatisFaturaFormData];

        return { ...f, data: { ...f.data, [field]: value }, errors: newErrors };
      }
      return f;
    }));
  };

  const addNewForm = () => {
    setForms(prev => [...prev, { id: Date.now(), data: { ...INITIAL_FORM, faturaTarihi: prev[0]?.data.faturaTarihi || INITIAL_FORM.faturaTarihi }, tutarTuru: 'dahil', errors: {}, stokKalemleri: [] }]);
  };

  const removeForm = (id: number) => {
    setForms(prev => prev.filter(f => f.id !== id));
  };

  const validateAll = (): boolean => {
    let isValid = true;
    setForms(prev => prev.map(f => {
      const e: Partial<Record<keyof SatisFaturaFormData, string>> = {};
      const d = f.data;
      if (!String(d.tcVkn || '').trim()) e.tcVkn = 'Zorunlu';
      if (!d.faturaTarihi) e.faturaTarihi = 'Zorunlu';
      if (!String(d.ad || '').trim()) e.ad = 'Zorunlu';
      if (!String(d.adres || '').trim()) e.adres = 'Zorunlu';
      const amountVal = parseFloat(d.alinanUcret);
      if (!d.alinanUcret || isNaN(amountVal) || amountVal <= 0) e.alinanUcret = 'Geçersiz';

      if (Object.keys(e).length > 0) isValid = false;
      return { ...f, errors: e };
    }));
    return isValid;
  };

  const handleClose = () => {
    setForms([{ id: Date.now(), data: INITIAL_FORM, tutarTuru: 'dahil', errors: {}, stokKalemleri: [] }]);
    setUploadedFile(null);
    setAiAddedCount(0);
    setIsScanning(false);
    closeSatisDrawer();
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
          const dataToSave = {
            ...f.data,
            alinanUcret: f.tutarTuru === 'dahil' ? parseFloat(f.data.alinanUcret).toString() : hes.toplamNet.toString(),
            dosyaBase64: uploadedFile?.base64,
            dosyaAdi: uploadedFile?.name,
            // Çoklu stok kalemleri
            stokKalemleri: f.stokKalemleri.filter(sk => sk.urunId && sk.urunId !== 'yok'),
          };

          if ((f.data as any).id) {
            await updateSatisFatura((f.data as any).id, dataToSave);
          } else {
            await addSatisFatura(dataToSave);
          }
        }
        toast.success(`${forms.length} adet satış faturası ${forms.some(f => (f.data as any).id) ? 'güncellendi' : 'kaydedildi'}`);
        handleClose();
      } catch (error: any) {
        toast.error('Kayıt sırasında bir hata oluştu: ' + error.message);
      }
    } else {
      toast.error('Lütfen formdaki eksik alanları doldurun.');
    }
  };

  // --- IMAGES & AI ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const b64 = e.target?.result as string;
      setUploadedFile({ base64: b64, mimeType: file.type, name: file.name });
      setAiAddedCount(0);
    };
    reader.readAsDataURL(file);
  };

  const scanImage = async () => {
    if (!uploadedFile) return;

    setIsScanning(true);
    const rawBase64 = uploadedFile.base64.split(',')[1];

    const prompt = `Bu dosyada BİRDEN FAZLA ayrı SATIŞ faturası veya fişi olabilir. Lütfen bulduğun TÜM belgeleri çıkar.
Eğer AYNI belgenin içinde KDV oranları parçalanmışsa faturayı kendi içinde farklı oranlara göre böl.
Ayrıca belgede Stopaj (Kesinti) veya KDV Tevkifatı varsa bu oranları da tespit et.

ÖNEMLİ: Aşağıdaki LUCA HESAP PLANI listesinden bu faturanın açıklamasına/türüne en uygun "kod"u seçerek "muhasebe_kodu" alanına yaz:
${lucaAccounts.map(a => `${a.kod}: ${a.ad}`).join('\n')}

SADECE JSON döndür:
{
  "faturalar": [
    {
      "ad": "Müşteri adı veya Firma Ünvanının ilk kısmı",
      "soyad": "Firma ise '-' bırakılabilir, şahıs ise soyadı",
      "tcVkn": "bulunabilirse VKN veya T.C. (yoksa boş bırak)",
      "adres": "müşteri adresi",
      "faturaTarihi": "YYYY-MM-DD formatında tarih",
      "tutar": "toplam rakam (noktalı/virgüllü olmadan genel sayı formatı, örn: 120.50)",
      "tutar_tur": "dahil",
      "kdv_orani": "kdv yüzdesi (0, 1, 8, 10, 18, 20 gibi değerler. Bulamazsan 20)",
      "tevkifat_orani": "kdv tevkifat oranı (varsa '2/10', '9/10' gibi kesirli format, yoksa '0')",
      "stopaj_orani": "stopaj kesinti yüzdesi (varsa 20, 10 gibi sadece sayı, yoksa '0')",
      "aciklama": "varsa fatura üzerindeki not veya açıklama",
      "muhasebe_kodu": "Yukarıdaki listeden seçilen en uygun hesap kodu"
    }
  ]
}
Eğer hiçbir belge okunamıyorsa şunu döndür: {"hata": "Belge okunamadı"}`;

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: uploadedFile.mimeType, data: rawBase64 } }
            ]
          }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || 'API Hatası');

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      if (parsed.hata) {
        toast.error('Belge okunamadı: ' + parsed.hata);
      } else {
        const fList = parsed.faturalar || [parsed];
        const newForms: FormEntry[] = fList.map((f: any, idx: number) => {
          // 1. VKN/TCKN ile eşleşen cari bul
          let matchedCari = (cariler || []).find(c => c && c.vknTckn === f.tcVkn && c.vknTckn && c.vknTckn.length > 5);
          
          // 2. VKN yoksa isimden (fuzzy match benzeri) ara
          if (!matchedCari && f.ad) {
            const searchName = f.ad.toLowerCase();
            matchedCari = cariler.find(c => c.unvan && c.unvan.toLowerCase().includes(searchName));
          }

          return {
            id: Date.now() + idx,
            tutarTuru: f.tutar_tur || 'dahil',
            errors: {},
            data: {
              ad: matchedCari ? (matchedCari.unvan || '') : (f.ad || ''),
              soyad: matchedCari ? '-' : (f.soyad || '-'),
              tcVkn: matchedCari ? (matchedCari.vknTckn || '') : (f.tcVkn || ''),
              adres: matchedCari ? (matchedCari.adres || 'Adres Bulunamadı') : (f.adres || 'Adres Bulunamadı'),
              faturaTarihi: f.faturaTarihi || INITIAL_FORM.faturaTarihi,
              vadeTarihi: '',
              alinanUcret: f.tutar?.toString() || '',
              kdvOrani: f.kdv_orani ? f.kdv_orani.toString() : '20',
              tevkifatOrani: f.tevkifat_orani?.toString() || '0',
              stopajOrani: f.stopaj_orani?.toString() || '0',
              aciklama: f.aciklama || '',
              cariId: matchedCari ? matchedCari.id : undefined,
              muhasebeKodu: f.muhasebe_kodu || ''
            }
          };
        });
        setForms(newForms);
        setAiAddedCount(newForms.length);
        toast.success(`AI tarafından ${newForms.length} adet satış belgesi çıkarıldı!`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('AI analizi başarısız oldu.');
    } finally {
      setIsScanning(false);
    }
  };

  const formatCurrency = (val: number) => {
    const safeVal = isNaN(val) || val === null || val === undefined ? 0 : val;
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(safeVal);
  };

  const handleVknChange = (formId: number, val: string) => {
    // Normal update
    updateForm(formId, 'tcVkn', val);
    
    // Check match if length >= 10
    if (val.length >= 10) {
      const matched = cariler.find(c => c.vknTckn === val && c.tip !== 'tedarikci');
      if (matched) {
        setForms(prev => prev.map(f => {
          if (f.id === formId) {
            return {
              ...f,
              data: {
                ...f.data,
                cariId: matched.id,
                ad: matched.unvan || '',
                soyad: '-',
                adres: matched.adres || f.data.adres || ''
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
    <Sheet open={isSatisDrawerOpen} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" side="right">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Banknote className="w-5 h-5 text-primary" />
            Yeni Satış Faturası Girişi
          </SheetTitle>
          <SheetDescription>
            Satış faturalarınızı (PDF/Resim) toplu yükleyebilir, manuel satır ekleyebilir ve Tevkifat/Stopaj oranlarını belirleyebilirsiniz.
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* AI UPLOAD ZONE */}
          <div className="space-y-3">
            {!uploadedFile ? (
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
                  if (e.dataTransfer.files?.[0]) processImageFile(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6 text-slate-500" />
                </div>
                <h4 className="font-semibold text-slate-900">PDF veya Resim (Fatura/Fiş) Yükleyin</h4>
                <p className="text-sm text-slate-500 mt-1">Sürükleyip bırakarak toplu belge okumayı başlatın</p>
              </div>
            ) : (
              <div className="relative border rounded-xl overflow-hidden bg-slate-50 group">
                {uploadedFile.mimeType === 'application/pdf' ? (
                  <div className="w-full h-48 flex flex-col items-center justify-center bg-slate-100/50">
                    <FileText className="w-16 h-16 text-red-400 mb-2" />
                    <p className="font-medium text-slate-600 truncate px-8">{uploadedFile.name}</p>
                  </div>
                ) : (
                  <img src={uploadedFile.base64} alt="Belge" className="w-full h-48 object-contain bg-slate-100/50" />
                )}

                <div className="absolute top-2 right-2 flex gap-2">
                  <Button type="button" size="icon" variant="destructive" className="h-8 w-8 rounded-full shadow-sm" onClick={() => { setUploadedFile(null); setAiAddedCount(0); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {aiAddedCount === 0 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                    <Button
                      type="button"
                      onClick={scanImage}
                      disabled={isScanning}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg font-semibold rounded-full px-6"
                    >
                      {isScanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      AI ile Analiz Et
                    </Button>
                  </div>
                )}
              </div>
            )}

            {aiAddedCount > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 mt-0.5" />
                <div className="text-sm text-indigo-900">
                  <span className="font-semibold">Tarama tamamlandı!</span> Belgeden <b>{aiAddedCount} adet</b> sonuç çıkarıldı.
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
                      Satış Belgesi #{index + 1}
                    </h3>

                    <div className="mb-4">
                      <Label className="text-xs font-medium text-indigo-600 mb-1 block">Kayıtlı Cari Seç (Otomatik Doldur)</Label>
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
                                    ad: c.unvan,
                                    soyad: '-',
                                    tcVkn: c.vknTckn,
                                    adres: c.adres || fp.data.adres
                                  },
                                  errors: {}
                                };
                              }
                              return fp;
                            }));
                          }
                        }}
                      >
                        <SelectTrigger className="w-full h-9 bg-indigo-50/30 border-indigo-100">
                          <SelectValue placeholder="Müşterilerinizden seçin..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yok" className="text-slate-500 font-medium">-- Serbest Devam Et --</SelectItem>
                          {(cariler || []).filter(c => c && c.tip !== 'tedarikci').map((c, idx) => (
                             <SelectItem key={c.id !== undefined && c.id !== null ? String(c.id) : `cari-${idx}`} value={String(c.id ?? '')}>
                               {String(c.unvan ?? 'Bilinmiyor')} ({String(c.vknTckn ?? '')})
                             </SelectItem>
                           ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Müşteri Adı / Ünvan İlk Kısım<span className="text-red-500">*</span></Label>
                        <Input value={form.data.ad} onChange={(e) => updateForm(form.id, 'ad', e.target.value)} className={form.errors.ad ? 'border-red-500 h-9' : 'h-9'} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Soyadı (Firma ise - bırakın)</Label>
                        <Input value={form.data.soyad} onChange={(e) => updateForm(form.id, 'soyad', e.target.value)} className={form.errors.soyad ? 'border-red-500 h-9' : 'h-9'} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">VKN / T.C. <span className="text-red-500">*</span></Label>
                        <Input value={form.data.tcVkn} onChange={(e) => handleVknChange(form.id, e.target.value)} className={form.errors.tcVkn ? 'border-red-500 h-9' : 'h-9'} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Belge / Fatura No <span className="text-slate-400 text-[10px]">(Opsiyonel)</span></Label>
                        <Input value={form.data.faturaNo || ''} onChange={(e) => updateForm(form.id, 'faturaNo', e.target.value)} className="h-9" placeholder="Örn: ABC20230001" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Fatura Tarihi <span className="text-red-500">*</span></Label>
                        <Input type="date" value={form.data.faturaTarihi} onChange={(e) => updateForm(form.id, 'faturaTarihi', e.target.value)} className={form.errors.faturaTarihi ? 'border-red-500 h-9' : 'h-9'} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Adres <span className="text-red-500">*</span></Label>
                        <Textarea value={form.data.adres} onChange={(e) => updateForm(form.id, 'adres', e.target.value)} className={cn("min-h-[50px] resize-none", form.errors.adres && 'border-red-500')} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Vade Tarihi (Opsiyonel)</Label>
                        <Input type="date" value={form.data.vadeTarihi || ''} onChange={(e) => updateForm(form.id, 'vadeTarihi', e.target.value)} className="h-9" />
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <Label className="text-xs font-medium text-slate-500">Fatura Açıklaması / Not</Label>
                      <Input value={form.data.aciklama} onChange={(e) => updateForm(form.id, 'aciklama', e.target.value)} placeholder="Örn: 2024 Mart ayı hakediş bedeli" className="h-9" />
                    </div>

                    {/* Luca Muhasebe Kodu Seçimi */}
                    <div className="space-y-2 mb-4">
                      <Label className="text-xs font-semibold text-indigo-700">🔍 Luca Muhasebe Kodu</Label>
                      <LucaAccountSelect 
                        value={form.data.muhasebeKodu || ''} 
                        onChange={(val) => updateForm(form.id, 'muhasebeKodu', val)}
                        placeholder="Ana hesap kodu seçin (örn: 600.01.001)..."
                      />
                    </div>

                    {/* Stoktan Ürün Seçimi - Çoklu Kalem */}
                    <div className="mb-4 p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-emerald-700">📦 Stok Kalemleri (Opsiyonel)</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                          onClick={() => {
                            setForms(prev => prev.map(fp => fp.id === form.id ? {
                              ...fp,
                              stokKalemleri: [...fp.stokKalemleri, { id: 'sk' + Date.now(), urunId: '', miktar: 1, birimFiyat: 0 }]
                            } : fp));
                          }}
                        >
                          <Plus className="w-3 h-3" /> Stok Kalemi Ekle
                        </Button>
                      </div>

                      {form.stokKalemleri.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic">Henüz stok kalemi eklenmedi. Yukarıdaki butona tıklayarak ürün ekleyebilirsiniz.</p>
                      ) : (
                        <div className="space-y-2">
                          {form.stokKalemleri.map((sk) => (
                            <div key={sk.id} className="flex items-center gap-2 bg-white rounded-md border border-emerald-100 p-2">
                              <div className="flex-1">
                                <Select
                                  value={sk.urunId || 'yok'}
                                  onValueChange={(val) => {
                                    const selectedUrun = urunler?.find(u => u.id === val);
                                    setForms(prev => prev.map(fp => fp.id === form.id ? {
                                      ...fp,
                                      stokKalemleri: fp.stokKalemleri.map(s => s.id === sk.id ? {
                                        ...s,
                                        urunId: val === 'yok' ? '' : val,
                                        birimFiyat: selectedUrun?.birimFiyat || s.birimFiyat,
                                        urunAdi: selectedUrun?.urunAdi || '',
                                      } : s)
                                    } : fp));
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-white">
                                    <SelectValue placeholder="Ürün seçin..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="yok">-- Seçin --</SelectItem>
                                    {urunler?.map(u => (
                                      <SelectItem key={u.id} value={u.id}>
                                        {u.urunAdi || 'İsimsiz'} ({u.stokKodu})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="w-20">
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={sk.miktar}
                                  onChange={(e) => {
                                    setForms(prev => prev.map(fp => fp.id === form.id ? {
                                      ...fp,
                                      stokKalemleri: fp.stokKalemleri.map(s => s.id === sk.id ? { ...s, miktar: parseFloat(e.target.value) || 0 } : s)
                                    } : fp));
                                  }}
                                  className="h-8 text-xs"
                                  placeholder="Miktar"
                                />
                              </div>
                              <div className="w-24">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={sk.birimFiyat || ''}
                                  onChange={(e) => {
                                    setForms(prev => prev.map(fp => fp.id === form.id ? {
                                      ...fp,
                                      stokKalemleri: fp.stokKalemleri.map(s => s.id === sk.id ? { ...s, birimFiyat: parseFloat(e.target.value) || 0 } : s)
                                    } : fp));
                                  }}
                                  className="h-8 text-xs"
                                  placeholder="B.Fiyat"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  setForms(prev => prev.map(fp => fp.id === form.id ? {
                                    ...fp,
                                    stokKalemleri: fp.stokKalemleri.filter(s => s.id !== sk.id)
                                  } : fp));
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                          <div className="text-[10px] text-emerald-600 mt-1">
                            ✅ {form.stokKalemleri.filter(sk => sk.urunId).length} stok kalemi bağlandı. Fatura kaydedilince stok hareketine otomatik işlenecektir.
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Tutar Değeri <span className="text-red-500">*</span></Label>
                        <Input type="number" min="0" step="0.01" value={form.data.alinanUcret} onChange={(e) => updateForm(form.id, 'alinanUcret', e.target.value)} className={form.errors.alinanUcret ? 'border-red-500 h-9' : 'h-9'} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Tutar Türü</Label>
                        <div className="flex bg-slate-100 p-1 rounded-md">
                          <button type="button" onClick={() => updateForm(form.id, 'tutarTuru', 'dahil')} className={cn("flex-1 text-xs font-medium py-1.5 rounded transition-all", form.tutarTuru === 'dahil' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>Net (KDV Dahil)</button>
                          <button type="button" onClick={() => updateForm(form.id, 'tutarTuru', 'haric')} className={cn("flex-1 text-xs font-medium py-1.5 rounded transition-all", form.tutarTuru === 'haric' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>Brüt Matrah</button>
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

                    {/* Tevkifat Kodu ve Stopaj Kodu — Luca aktarımı için */}
                    {((form.data.tevkifatOrani && form.data.tevkifatOrani !== '0') || (form.data.stopajOrani && form.data.stopajOrani !== '0')) && (
                      <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-amber-50/60 border border-amber-100 rounded-lg">
                        <p className="col-span-2 text-[10px] font-bold text-amber-700 uppercase tracking-wider">🔗 Luca Aktarım Kodları</p>
                        {form.data.tevkifatOrani && form.data.tevkifatOrani !== '0' && (
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-slate-600">Tevkifat Kodu <span className="text-slate-400 font-normal">(XML'den — örn: 616)</span></Label>
                            <Input
                              value={form.data.tevkifatKodu || ''}
                              onChange={(e) => updateForm(form.id, 'tevkifatKodu', e.target.value)}
                              placeholder="Örn: 616"
                              className="h-8 font-mono"
                            />
                          </div>
                        )}
                        {form.data.stopajOrani && form.data.stopajOrani !== '0' && (
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-slate-600">Stopaj Kodu <span className="text-slate-400 font-normal">(SMM için: 022)</span></Label>
                            <LucaAccountSelect
                              value={form.data.stopajKodu || ''}
                              onChange={(val) => updateForm(form.id, 'stopajKodu', val)}
                              placeholder="Kodu seçin..."
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {(hes.matrah > 0 || hes.kdvTutari > 0) && (
                      <div className="bg-slate-50 rounded p-3 text-xs flex flex-wrap gap-4 border items-center">
                        <div className="text-slate-500">Brüt Matrah: <strong className="text-slate-900">{formatCurrency(hes.matrah)}</strong></div>
                        <div className="text-slate-500">Top. KDV: <strong className="text-slate-900">{formatCurrency(hes.kdvTutari)}</strong></div>
                        {hes.tevkifatTutari > 0 && <div className="text-amber-600">Karşı Tevkifat: <strong>-{formatCurrency(hes.tevkifatTutari)}</strong></div>}
                        {hes.stopajTutari > 0 && <div className="text-red-500">Karşı Stopaj: <strong>-{formatCurrency(hes.stopajTutari)}</strong></div>}

                        <div className="ml-auto text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded">
                          Net Alınacak: {formatCurrency(hes.toplamNet)}
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
                <Save className="w-5 h-5 mr-2" /> {forms.length === 1 && (forms[0].data as any).id ? 'Değişiklikleri Kaydet' : `Kaydet ve Ekle (${forms.length})`}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
