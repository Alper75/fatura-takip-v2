import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { BellRing, Bell, X, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';

export function BildirimWidget() {
  const { satisFaturalari, alisFaturalari, cekSenetler, cariler, updateCekSenetDurum, updateSatisFaturaOdeme, updateAlisFaturaOdeme } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  
  const vadesiYaklasanlar = useMemo(() => {
    const simdi = new Date();
    const ucGunSonra = new Date();
    ucGunSonra.setDate(simdi.getDate() + 3);

    const satisGecikenler = satisFaturalari.filter(f => f.odemeDurumu === 'odenmedi' && f.vadeTarihi).map(f => ({ ...f, bTip: 'satis', bYon: 'alinan', baslik: 'Satış Tahsilatı', refId: f.id, cariIsmi: `${f.ad || ''} ${f.soyad || ''}` }));
    const alisGecikenler = alisFaturalari.filter(f => f.odemeDurumu === 'odenmedi' && f.vadeTarihi).map(f => ({ ...f, bTip: 'alis', bYon: 'verilen', baslik: 'Alış Ödemesi', refId: f.id, cariIsmi: f.tedarikciAdi }));
    
    const cekSenetAlinanGecikenler = cekSenetler.filter(c => c.durum === 'bekliyor' && c.islemTipi === 'alinan' && c.vadeTarihi).map(c => {
      const cari = cariler.find(ci => ci.id === c.cariId);
      return { ...c, bTip: 'ceksenet', bYon: 'alinan', baslik: `Alınan ${c.tip === 'cek' ? 'Çek' : 'Senet'}`, refId: c.id, alinanUcret: c.tutar, cariIsmi: cari ? cari.unvan : 'Bilinmeyen Cari' };
    });
    
    const cekSenetVerilenGecikenler = cekSenetler.filter(c => c.durum === 'bekliyor' && c.islemTipi === 'verilen' && c.vadeTarihi).map(c => {
      const cari = cariler.find(ci => ci.id === c.cariId);
      return { ...c, bTip: 'ceksenet', bYon: 'verilen', baslik: `Verilen ${c.tip === 'cek' ? 'Çek' : 'Senet'}`, refId: c.id, toplamTutar: c.tutar, cariIsmi: cari ? cari.unvan : 'Bilinmeyen Cari' };
    });

    const hepsi = [...satisGecikenler, ...alisGecikenler, ...cekSenetAlinanGecikenler, ...cekSenetVerilenGecikenler].filter(f => {
      if (!f.vadeTarihi) return false;
      const vDate = new Date(f.vadeTarihi);
      return vDate <= ucGunSonra;
    });

    return hepsi.sort((a, b) => new Date(a.vadeTarihi!).getTime() - new Date(b.vadeTarihi!).getTime());
  }, [satisFaturalari, alisFaturalari, cekSenetler, cariler]);

  const alinanlar = vadesiYaklasanlar.filter(v => v.bYon === 'alinan');
  const verilenler = vadesiYaklasanlar.filter(v => v.bYon === 'verilen');

  const toplamBildirim = vadesiYaklasanlar.length;

  const formatCurrency = (val: number) => {
    const safeVal = isNaN(val) || val === null || val === undefined ? 0 : val;
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(safeVal);
  };

  const safeFormatDate = (date: Date) => {
    if (isNaN(date.getTime())) return '-';
    return format(date, 'dd MMM yyyy', { locale: tr });
  };

  if (toplamBildirim === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.4)] bg-indigo-600 hover:bg-indigo-700 p-0 relative group border-2 border-white"
        >
          <BellRing className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white">
            {toplamBildirim}
          </span>
        </Button>
      </div>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[340px] sm:w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
          <div className="bg-slate-900 p-4 flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              Geciken/Yaklaşan İşlemler
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea className="h-[400px] max-h-[60vh] bg-slate-50/50">
            {alinanlar.length > 0 && (
              <div className="p-3">
                <div className="text-xs font-bold text-emerald-700 mb-2 mt-1 uppercase tracking-wider flex items-center gap-1.5 px-1">
                  <ArrowDownRight className="w-4 h-4" />
                  Ödeme Alınacaklar ({alinanlar.length})
                </div>
                <div className="space-y-2">
                  {alinanlar.map((item: any, i) => {
                    const tutar = item.alinanUcret;
                    const vDate = new Date(item.vadeTarihi);
                    const isGecmis = !isNaN(vDate.getTime()) && vDate < new Date(new Date().setHours(0,0,0,0));
                    return (
                      <div key={'al'+i} className={cn("p-3 bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow", isGecmis ? "border-red-200" : "border-slate-100")}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{item.baslik}</span>
                          <span className={cn("text-xs font-bold", isGecmis ? "text-red-600" : "text-amber-600")}>
                            {safeFormatDate(vDate)} {isGecmis && "(Geçti)"}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 truncate mt-1">{item.cariIsmi}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-base font-black text-emerald-600">{formatCurrency(tutar)}</span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3"
                            onClick={() => {
                              if (item.bTip === 'satis') updateSatisFaturaOdeme(item.refId, new Date().toISOString().split('T')[0], 'odendi');
                              if (item.bTip === 'ceksenet') updateCekSenetDurum(item.refId, 'odendi');
                              toast.success('Tahsilat başarıyla işlendi!');
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Tahsil Et
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {verilenler.length > 0 && (
              <div className={cn("p-3", alinanlar.length > 0 ? "border-t border-slate-200" : "")}>
                <div className="text-xs font-bold text-orange-700 mb-2 mt-1 uppercase tracking-wider flex items-center gap-1.5 px-1">
                  <ArrowUpRight className="w-4 h-4" />
                  Ödeme Yapılacaklar ({verilenler.length})
                </div>
                <div className="space-y-2">
                  {verilenler.map((item: any, i) => {
                    const tutar = item.toplamTutar;
                    const vDate = new Date(item.vadeTarihi);
                    const isGecmis = !isNaN(vDate.getTime()) && vDate < new Date(new Date().setHours(0,0,0,0));
                    return (
                      <div key={'ve'+i} className={cn("p-3 bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow", isGecmis ? "border-red-200" : "border-slate-100")}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{item.baslik}</span>
                          <span className={cn("text-xs font-bold", isGecmis ? "text-red-600" : "text-amber-600")}>
                            {safeFormatDate(vDate)} {isGecmis && "(Geçti)"}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 truncate mt-1">{item.cariIsmi}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-base font-black text-orange-600">{formatCurrency(tutar)}</span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs bg-orange-50 text-orange-700 hover:bg-orange-100 px-3"
                            onClick={() => {
                              if (item.bTip === 'alis') updateAlisFaturaOdeme(item.refId, new Date().toISOString().split('T')[0], 'odendi');
                              if (item.bTip === 'ceksenet') updateCekSenetDurum(item.refId, 'odendi');
                              toast.success('Ödeme başarıyla işlendi!');
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Ödendi İşaretle
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </>
  );
}
