import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useApp } from '@/context/AppContext';
import { Building2, Mail, MapPin, Hash, CheckCircle2, ShieldCheck, Calendar } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function SirketBilgileriDrawer() {
  const { isSirketBilgileriOpen, closeSirketBilgileri, user, companies } = useApp();
  
  // Bulunulan kullanıcıya ait aktif şirketi bul
  const activeCompany = companies.find(c => c.id === user?.companyId);

  if (!activeCompany) return null;

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
            Sistemde aktif olarak işlem yaptığınız şirkete ait resmi ve genel bilgiler.
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
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
          
          <div className="p-4 bg-blue-50 text-blue-800 text-xs rounded-xl border border-blue-100 leading-relaxed">
            <strong>Bilgi:</strong> Şirket temel bilgileri Süper Admin tarafından tanımlanır ve fatura entegrasyonlarında (GİB / E-Arşiv) kullanılır. Bir hata olduğunu düşünüyorsanız sistem yöneticinizle iletişime geçin.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
