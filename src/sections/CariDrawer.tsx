import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { Save, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { CariFormData, CariTip } from '@/types';

const INITIAL_FORM: CariFormData = {
  tip: 'musteri',
  unvan: '',
  vknTckn: '',
  vergiDairesi: '',
  adres: '',
  telefon: '',
  eposta: ''
};

export function CariDrawer() {
  const { isCariDrawerOpen, closeCariDrawer, selectedCariId, cariler, addCari, updateCari } = useApp();
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
            eposta: cari.eposta || ''
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
