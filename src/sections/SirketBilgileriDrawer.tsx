import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useApp } from '@/context/AppContext';
import { Building2, Mail, MapPin, Hash, CheckCircle2, ShieldCheck, Calendar, Car, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export function SirketBilgileriDrawer() {
  const { isSirketBilgileriOpen, closeSirketBilgileri, user, companies, addVehicle, deleteVehicle } = useApp();
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ plate: '', type: 'passenger' as 'passenger' | 'commercial', brand_model: '' });
  
  // Bulunulan kullanıcıya ait aktif şirketi bul
  const activeCompany = companies.find(c => c.id === user?.companyId);

  if (!activeCompany) return null;

  const handleAddVehicle = async () => {
    if (!newVehicle.plate) {
      toast.error('Lütfen plaka giriniz.');
      return;
    }
    const res = await addVehicle(newVehicle);
    if (res.success) {
      toast.success('Araç başarıyla eklendi.');
      setNewVehicle({ plate: '', type: 'passenger', brand_model: '' });
      setIsAddingVehicle(false);
    } else {
      toast.error(res.message || 'Hata oluştu.');
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    if (confirm('Bu aracı silmek istediğinize emin misiniz?')) {
      const res = await deleteVehicle(id);
      if (res.success) toast.success('Araç silindi.');
    }
  };

  return (
    <Sheet open={isSirketBilgileriOpen} onOpenChange={closeSirketBilgileri}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" side="right">
        <SheetHeader className="pb-6 border-b">
          <SheetTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            Firma Bilgileri
          </SheetTitle>
          <SheetDescription>
            Sistemde aktif olarak işlem yaptığınız şirkete ait resmi bilgiler ve araç listesi.
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-8">
          {/* Araç Yönetimi Bölümü */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Car className="w-4 h-4 text-indigo-600" /> Şirket Araçları & Gider Kısıtı
              </Label>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-xs gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                onClick={() => setIsAddingVehicle(!isAddingVehicle)}
              >
                <Plus className="w-3.5 h-3.5" /> {isAddingVehicle ? 'Vazgeç' : 'Araç Ekle'}
              </Button>
            </div>

            {isAddingVehicle && (
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Plaka</Label>
                    <Input 
                      placeholder="34 ABC 123" 
                      value={newVehicle.plate}
                      onChange={e => setNewVehicle(prev => ({ ...prev, plate: e.target.value }))}
                      className="h-9 uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Araç Türü</Label>
                    <Select 
                      value={newVehicle.type} 
                      onValueChange={(val: any) => setNewVehicle(prev => ({ ...prev, type: val }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="passenger">Binek (70/30 Gider)</SelectItem>
                        <SelectItem value="commercial">Ticari (Tam Gider)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Marka / Model (Opsiyonel)</Label>
                  <Input 
                    placeholder="Fiat Egea, Renault Megane vb." 
                    value={newVehicle.brand_model}
                    onChange={e => setNewVehicle(prev => ({ ...prev, brand_model: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <Button className="w-full h-9 bg-indigo-600 hover:bg-indigo-700" onClick={handleAddVehicle}>
                  Kaydet
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {activeCompany.vehicles && activeCompany.vehicles.length > 0 ? (
                activeCompany.vehicles.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg group hover:border-indigo-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        v.type === 'passenger' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                      )}>
                        <Car className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{v.plate}</p>
                        <p className="text-[10px] text-slate-500">
                          {v.brand_model ? `${v.brand_model} • ` : ''}
                          {v.type === 'passenger' ? 'Binek Araç' : 'Ticari Araç'}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteVehicle(v.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center border border-dashed rounded-xl bg-slate-50/50">
                  <Car className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Henüz kayıtlı araç bulunmuyor.</p>
                </div>
              )}
            </div>
            
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-[10px] text-amber-800 leading-normal">
                <strong>Gider Kısıtı Hakkında:</strong> Binek araçların akaryakıt, bakım, otopark ve yıkama giderlerinin sadece %70'i indirilebilir. Ticari araçlarda kısıtlama yoktur.
              </p>
            </div>
          </div>

          <div className="border-t pt-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">Aktif Şirket Onaylı</p>
                  <p className="text-xs text-emerald-600">Sistem yetkileri devrede</p>
                </div>
              </div>
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" /> Şirket Unvanı
                </Label>
                <Input 
                  readOnly 
                  value={activeCompany.name} 
                  className="bg-slate-50 font-medium text-slate-900 h-11" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5" /> Vergi / TC No
                  </Label>
                  <Input 
                    readOnly 
                    value={activeCompany.tax_no || 'Belirtilmedi'} 
                    className="bg-slate-50 text-slate-700" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" /> Defter Türü
                  </Label>
                  <Input 
                    readOnly 
                    value={activeCompany.company_type || 'BİLANÇO'} 
                    className="bg-slate-50 text-slate-700" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" /> E-Posta Adresi
                </Label>
                <Input 
                  readOnly 
                  value={activeCompany.email || 'Belirtilmedi'} 
                  className="bg-slate-50 text-slate-700" 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" /> Kayıtlı Adres
                </Label>
                <Textarea 
                  readOnly 
                  value={activeCompany.address || 'Belirtilmedi'} 
                  className="bg-slate-50 text-slate-700 resize-none min-h-[100px]" 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" /> Durum
                </Label>
                <Input 
                  readOnly 
                  value={activeCompany.status === 'active' ? 'Aktif Hesap' : 'Pasif Hesap'} 
                  className={activeCompany.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'} 
                />
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-blue-50 text-blue-800 text-xs rounded-xl border border-blue-100 leading-relaxed">
            <strong>Bilgi:</strong> Şirket temel bilgileri Süper Admin tarafından tanımlanır. Araç listesini binek araç gider kısıtlaması (70/30) hesaplamaları için buradan yönetebilirsiniz.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
