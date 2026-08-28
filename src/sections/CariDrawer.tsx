import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { Save, Users, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { LucaAccountSelect } from '@/components/LucaAccountSelect';
import type { CariFormData, CariTip } from '@/types';

const INITIAL_FORM: CariFormData = {
  tip: 'musteri',
  unvan: '',
  vknTckn: '',
  vergiDairesi: '',
  adres: '',
  telefon: '',
  eposta: '',
  muhasebeKodu: ''
};

export function CariDrawer() {
  const { isCariDrawerOpen, closeCariDrawer, selectedCariId, cariler, addCari, updateCari, lucaAccounts, companies, user } = useApp();
  const [formData, setFormData] = useState<CariFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof CariFormData, string>>>({});

  const isEditing = !!selectedCariId;

  useEffect(() => {
    if (isCariDrawerOpen) {
      if (selectedCariId) {
        const cari = cariler.find(c => c.id === selectedCariId);
        if (cari) {
          setFormData({
            tip: cari.tip,
            unvan: cari.unvan,
            vknTckn: cari.vknTckn,
            vergiDairesi: cari.vergiDairesi || '',
            adres: cari.adres || '',
            telefon: cari.telefon || '',
            eposta: cari.eposta || '',
            muhasebeKodu: cari.muhasebeKodu || ''
          });
        }
      } else {
        setFormData(INITIAL_FORM);
      }
      setErrors({});
    }
  }, [isCariDrawerOpen, selectedCariId, cariler]);

  const updateField = (field: keyof CariFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrs = { ...prev };
        delete newErrs[field];
        return newErrs;
      });
    }
  };

  const validate = () => {
    const errs: Partial<Record<keyof CariFormData, string>> = {};
    if (!String(formData.unvan || '').trim()) errs.unvan = 'Zorunlu alan';
    if (!String(formData.vknTckn || '').trim()) errs.vknTckn = 'Zorunlu alan';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const suggestNextCode = () => {
    const unvan = (formData.unvan || '').trim().toLocaleUpperCase('tr-TR');
    let prefixLetter = 'A';
    if (unvan.length > 0) {
      const firstChar = unvan[0];
      if (/^[A-ZÇĞİÖŞÜ]/i.test(firstChar)) {
        prefixLetter = firstChar.toLocaleUpperCase('tr-TR');
      }
    }
    const anaHesap = formData.tip === 'tedarikci' ? '320.01' : '120.01';
    const targetPrefix = `${anaHesap}.${prefixLetter}`;
    
    // Mevcut cariler ve lucaAccounts içindeki kodları tara
    const existingCodes = [
      ...cariler.map(c => c.muhasebeKodu || ''),
      ...lucaAccounts.map(a => a.kod || '')
    ].filter(k => k.startsWith(targetPrefix));

    let maxNum = 0;
    existingCodes.forEach(code => {
      const numPart = code.substring(targetPrefix.length);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    });

    const nextNum = maxNum + 1;
    const padded = nextNum.toString().padStart(3, '0');
    const generated = `${targetPrefix}${padded}`;
    updateField('muhasebeKodu', generated);
    toast.success(`Önerilen kod: ${generated}`);
  };

  const handleCreateInLuca = async () => {
    if (!validate()) {
      toast.error('Lütfen önce cari ünvanı ve VKN alanlarını doldurun.');
      return;
    }
    if (!formData.muhasebeKodu) {
      toast.error('Lütfen bir Luca Muhasebe Kodu girin veya öner butonuna tıklayın.');
      return;
    }

    const activeCompany = companies.find(c => c.id === (user?.companyId || 1));
    const payload = {
      targetCompany: {
        id: activeCompany?.id || 1,
        vkn: activeCompany?.tax_no || (activeCompany as any)?.vknTckn || '',
        unvan: activeCompany?.name || (activeCompany as any)?.unvan || ''
      },
      cari: {
        id: selectedCariId || '',
        hesapKodu: formData.muhasebeKodu,
        unvan: formData.unvan,
        vknTckn: formData.vknTckn,
        vergiDairesi: formData.vergiDairesi || '',
        adres: formData.adres || '',
        telefon: formData.telefon || '',
        eposta: formData.eposta || '',
        tip: formData.tip
      },
      timestamp: Date.now()
    };

    try {
      localStorage.setItem('fatura_app_luca_create_cari', JSON.stringify(payload));
    } catch(e) {
      console.error(e);
    }

    window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_CREATE_CARI', { detail: payload }));
    document.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_CREATE_CARI', { detail: payload }));
    window.postMessage({ type: 'FATURA_APP_LUCA_CREATE_CARI', detail: payload, payload }, '*');

    // Sistemimizde de kaydet
    if (isEditing && selectedCariId) {
      updateCari(selectedCariId, formData);
    } else {
      addCari(formData);
    }

    toast.success(`⚡ ${formData.muhasebeKodu} kodlu cari Luca'ya otomatik olarak iletildi ve açıldı!`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Lütfen zorunlu alanları doldurun.');
      return;
    }

    if (isEditing && selectedCariId) {
      updateCari(selectedCariId, formData);
      toast.success('Cari kart güncellendi.');
    } else {
      addCari(formData);
      toast.success('Yeni cari kart eklendi.');
    }
    closeCariDrawer();
  };

  return (
    <Sheet open={isCariDrawerOpen} onOpenChange={(open) => !open && closeCariDrawer()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" side="right">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Users className="w-5 h-5 text-primary" />
            {isEditing ? 'Cari Kartı Düzenle' : 'Yeni Cari Hesap'}
          </SheetTitle>
          <SheetDescription>
            {isEditing ? 'Seçili carinin bilgilerini güncelleyebilirsiniz.' : 'Müşteri veya tedarikçi bilgilerinizi kaydederek fatura işlemlerini hızlandırın.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="py-6 space-y-4">
          <div className="space-y-2">
            <Label>Cari Tipi <span className="text-red-500">*</span></Label>
            <Select value={formData.tip} onValueChange={(v: CariTip) => updateField('tip', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seçiniz..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="musteri">Sadece Müşteri (Alıcı)</SelectItem>
                <SelectItem value="tedarikci">Sadece Tedarikçi (Satıcı)</SelectItem>
                <SelectItem value="ikisi">Hem Müşteri Hem Tedarikçi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ünvan / Ad Soyad <span className="text-red-500">*</span></Label>
            <Input 
              value={formData.unvan} 
              onChange={e => updateField('unvan', e.target.value)}
              className={errors.unvan ? 'border-red-500' : ''}
              placeholder="Örn: ABC Teknoloji A.Ş. veya Ahmet Yılmaz"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>T.C. Kimlik / VKN <span className="text-red-500">*</span></Label>
              <Input 
                value={formData.vknTckn} 
                onChange={e => updateField('vknTckn', e.target.value)}
                className={errors.vknTckn ? 'border-red-500' : ''}
                placeholder="10 veya 11 Haneli"
              />
            </div>
            <div className="space-y-2">
              <Label>Vergi Dairesi</Label>
              <Input 
                value={formData.vergiDairesi} 
                onChange={e => updateField('vergiDairesi', e.target.value)}
                placeholder="İsteğe bağlı"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input 
                value={formData.telefon} 
                onChange={e => updateField('telefon', e.target.value)}
                placeholder="Örn: 0555..."
              />
            </div>
            <div className="space-y-2">
              <Label>E-posta</Label>
              <Input 
                type="email"
                value={formData.eposta} 
                onChange={e => updateField('eposta', e.target.value)}
                placeholder="ornek@firma.com"
              />
            </div>
          </div>

          <div className="space-y-2 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
            <div className="flex items-center justify-between">
              <Label className="text-indigo-950 font-semibold text-xs flex items-center gap-1.5">
                <span>Luca Muhasebe Kodu</span>
                <span className="text-[10px] text-indigo-500 font-normal">(Örn: 120.01.A001)</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={suggestNextCode}
                className="h-6 px-2 text-[11px] text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100/60 font-medium"
                title="Firmanın baş harfine göre sıradaki kodu öner"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Sıradaki Kodu Öner
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                value={formData.muhasebeKodu || ''}
                onChange={e => updateField('muhasebeKodu', e.target.value.toUpperCase())}
                placeholder="Örn: 120.01.A001"
                className="font-mono text-sm uppercase bg-white flex-1 font-semibold"
              />
              <Button
                type="button"
                onClick={handleCreateInLuca}
                disabled={!formData.muhasebeKodu}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs gap-1.5 shrink-0 shadow-sm"
                title="Bu cariyi güvenlik doğrulaması ile Luca'da oluştur"
              >
                <Zap className="w-3.5 h-3.5" />
                Luca'da Aç
              </Button>
            </div>

            <div className="pt-1">
              <LucaAccountSelect 
                value={formData.muhasebeKodu || ''}
                onChange={(code) => updateField('muhasebeKodu', code)}
                placeholder="Veya mevcut Luca hesap planından seçin..."
                className="bg-white text-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Adres</Label>
            <Textarea 
              value={formData.adres} 
              onChange={e => updateField('adres', e.target.value)}
              rows={3}
              className="resize-none"
              placeholder="Firma veya şahıs açık adresi..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white z-10">
            <Button type="button" variant="outline" className="flex-1" onClick={closeCariDrawer}>
              İptal
            </Button>
            <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">
              <Save className="w-4 h-4 mr-2" /> 
              {isEditing ? 'Güncelle' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
