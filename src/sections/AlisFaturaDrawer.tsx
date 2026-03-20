import { useState, useRef } from 'react';
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
  const { isAlisDrawerOpen, closeAlisDrawer, addAlisFatura, cariler } = useApp();

  const [forms, setForms] = useState<FormEntry[]>([
    { id: Date.now(), data: INITIAL_FORM, tutarTuru: 'dahil', errors: {} }
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
    const girilenTutar = parseFloat(f.data.toplamTutar);

    let tevkifatCarpani = 0;
    if (f.data.tevkifatOrani && f.data.tevkifatOrani !== '0' && f.data.tevkifatOrani.includes('/')) {
      const [pay, payda] = f.data.tevkifatOrani.split('/').map(Number);
      tevkifatCarpani = payda > 0 ? (pay / payda) : 0;
    }

    if (!isNaN(kdvOrani) && !isNaN(girilenTutar) && girilenTutar > 0) {
      let matrah = 0;

      if (f.tutarTuru === 'dahil') {
        // Tutar = Net Ödenecek kabul ediyoruz
        const carpan = 1 + kdvOrani - stopajOrani - (kdvOrani * tevkifatCarpani);
        matrah = carpan > 0 ? girilenTutar / carpan : 0;
      } else {
        // Tutar = Brüt Matrah kabul ediyoruz
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

        return { ...f, data: { ...f.data, [field]: value }, errors: newErrors };
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
      if (!d.faturaNo.trim()) e.faturaNo = 'Zorunlu';
      if (!d.faturaTarihi) e.faturaTarihi = 'Zorunlu';
      if (!d.tedarikciAdi.trim()) e.tedarikciAdi = 'Zorunlu';
      if (!d.tedarikciVkn.trim()) e.tedarikciVkn = 'Zorunlu';
      if (!d.malHizmetAdi.trim()) e.malHizmetAdi = 'Zorunlu';
      if (!d.toplamTutar || parseFloat(d.toplamTutar) <= 0) e.toplamTutar = 'Geçersiz';

      if (Object.keys(e).length > 0) isValid = false;
      return { ...f, errors: e };
    }));
    return isValid;
  };

  const handleClose = () => {
    setForms([{ id: Date.now(), data: INITIAL_FORM, tutarTuru: 'dahil', errors: {} }]);
    setUploadedFile(null);
    setAiAddedCount(0);
    setIsScanning(false);
    closeAlisDrawer();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (forms.length === 0) {
      toast.error('Lütfen en az bir belge ekleyin.');
      return;
    }

    if (validateAll()) {
      forms.forEach(f => {
        const hes = getHesaplanan(f);
        // Form verisine dosyayı da dahil ediyoruz
        addAlisFatura({
          ...f.data,
          toplamTutar: f.tutarTuru === 'dahil' ? parseFloat(f.data.toplamTutar).toString() : hes.toplamNet.toString(),
          dosyaBase64: uploadedFile?.base64,
          dosyaAdi: uploadedFile?.name
        });
      });
      toast.success(`${forms.length} adet alış faturası kaydedildi (Medyaları ile birlikte)`);
      handleClose();
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

    // PDF ve Resim için ortak prompt (Gemini 1.5/2.5 Flash native PDF destekler)
    const prompt = `Bu dosyada BİRDEN FAZLA ayrı fiş veya fatura olabilir (örneğin yan yana 3 fiş veya çok sayfalı belge). 
Lütfen bulduğun TÜM fiş/faturaları çıkar ve aşağıdaki JSON DİZİSİ (Array) formatında döndür. 
Ayrı fişleri aynı hesaba KESİNLİKLE birleştirme. 
Ekstra Kural: Eğer AYNI fişin içinde KDV oranları (%1, %8 vesaire) ayrı ayrı KDV kısımlarına bölünmüşse, KDV oranlarına göre o fişi kendi içinde yeni fişlermiş gibi böl.
Ayrıca belgede Stopaj (Kesinti) veya KDV Tevkifatı varsa bu oranları da tespit et.
SADECE JSON döndür:
{
  "faturalar": [
    {
      "tedarikciAdi": "firma/satıcı adı",
      "tedarikciVkn": "bulunabilirse VKN veya T.C. (yoksa boş bırak)",
      "faturaNo": "fatura veya fiş altındaki belge numarası",
      "malHizmetAdi": "alınan hizmet/malın genel özeti",
      "faturaTarihi": "YYYY-MM-DD formatında tarih",
      "tutar": "toplam rakam (noktalı/virgüllü olmadan genel sayı formatı, örn: 120.50)",
      "tutar_tur": "dahil",
      "kdv_orani": "kdv yüzdesi (0, 1, 8, 10, 18, 20 gibi değerler. Bulamazsan 18)",
      "tevkifat_orani": "kdv tevkifat oranı (varsa '2/10', '9/10' gibi kesirli format, yoksa '0')",
      "stopaj_orani": "stopaj kesinti yüzdesi (varsa 20, 10 gibi sadece sayı, yoksa '0')",
      "aciklama": "varsa belge üzerindeki açıklama veya not"
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
          const matchedCari = cariler.find(c => c.vknTckn === f.tedarikciVkn && c.vknTckn && c.vknTckn.length > 5);
          return {
            id: Date.now() + idx,
            tutarTuru: f.tutar_tur || 'dahil',
            errors: {},
            data: {
              tedarikciAdi: matchedCari ? matchedCari.unvan : (f.tedarikciAdi || ''),
              tedarikciVkn: matchedCari ? matchedCari.vknTckn : (f.tedarikciVkn || ''),
              faturaNo: f.faturaNo || '',
              malHizmetAdi: f.malHizmetAdi || 'Fiş Gideri',
              faturaTarihi: f.faturaTarihi || INITIAL_FORM.faturaTarihi,
              vadeTarihi: '',
              toplamTutar: f.tutar?.toString() || '',
              kdvOrani: f.kdv_orani ? f.kdv_orani.toString() : '18',
              tevkifatOrani: f.tevkifat_orani?.toString() || '0',
              stopajOrani: f.stopaj_orani?.toString() || '0',
              aciklama: f.aciklama || '',
              cariId: matchedCari ? matchedCari.id : undefined
            }
          };
        });
        setForms(newForms);
        setAiAddedCount(newForms.length);
        toast.success(`AI tarafından ${newForms.length} adet belge PDF/Resimden çıkarıldı!`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('AI analizi başarısız oldu.');
    } finally {
      setIsScanning(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
  };

  const handleVknChange = (formId: number, val: string) => {
    updateForm(formId, 'tedarikciVkn', val);
    
    if (val.length >= 10) {
      const matched = cariler.find(c => c.vknTckn === val && c.tip !== 'musteri');
      if (matched) {
        setForms(prev => prev.map(f => {
          if (f.id === formId) {
            return {
              ...f,
              data: {
                ...f.data,
                cariId: matched.id,
                tedarikciAdi: matched.unvan
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
                <p className="text-sm text-slate-500 mt-1">Gelişmiş AI modeli PDF faturalarınızı ve resimleri anında okur!</p>
              </div>
            ) : (
              <div className="relative border rounded-xl overflow-hidden bg-slate-50 group">
                {uploadedFile.mimeType === 'application/pdf' ? (
                  <div className="w-full h-48 flex flex-col items-center justify-center bg-slate-100/50">
                    <FileText className="w-16 h-16 text-red-400 mb-2" />
                    <p className="font-medium text-slate-600 truncate px-8">{uploadedFile.name}</p>
                    <p className="text-sm text-slate-400">PDF Dosyası Tarama İçin Hazır</p>
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
                      {uploadedFile.mimeType === 'application/pdf' ? 'PDF\'i Analiz Et' : 'Bunu Analiz Et'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {aiAddedCount > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 mt-0.5" />
                <div className="text-sm text-indigo-900">
                  <span className="font-semibold">Tarama tamamlandı!</span> Görüntüden/Belgeden <b>{aiAddedCount} adet</b> sonuç çıkarıldı. Bu belge otomatik eklenecektir.
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

                    <div className="mb-4">
                      <Label className="text-xs font-medium text-emerald-600 mb-1 block">Kayıtlı Tedarikçi Seç (Otomatik Doldur)</Label>
                      <Select
                        value={form.data.cariId || 'yok'}
                        onValueChange={(val) => {
                          if (val === 'yok') {
                            setForms(prev => prev.map(fp => fp.id === form.id ? { ...fp, data: { ...fp.data, cariId: undefined } } : fp));
                            return;
                          }
                          const c = cariler.find(x => x.id === val);
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
                          {cariler.filter(c => c.tip !== 'musteri').map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.unvan} ({c.vknTckn})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

                    <div className="space-y-2 mb-4">
                      <Label className="text-xs font-medium text-slate-500">Hizmet/Ürün Açıklaması<span className="text-red-500">*</span></Label>
                      <Input value={form.data.malHizmetAdi} onChange={(e) => updateForm(form.id, 'malHizmetAdi', e.target.value)} className={form.errors.malHizmetAdi ? 'border-red-500 h-9' : 'h-9'} />
                    </div>

                    <div className="space-y-2 mb-4">
                      <Label className="text-xs font-medium text-slate-500">Belge Notu / Genel Açıklama</Label>
                      <Input value={form.data.aciklama} onChange={(e) => updateForm(form.id, 'aciklama', e.target.value)} placeholder="Örn: Proje bazlı alım" className="h-9" />
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

                    {/* Sonuç Özeti Inline */}
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
      </SheetContent>
    </Sheet>
  );
}
