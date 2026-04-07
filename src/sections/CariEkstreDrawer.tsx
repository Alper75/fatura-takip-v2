import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useApp } from '@/context/AppContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ArrowUpRight, ArrowDownRight, ArrowDownLeft, Wallet, Receipt, Trash2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { IslemTuru } from '@/types';

export function CariEkstreDrawer() {
  const { 
    isCariEkstreDrawerOpen, 
    closeCariEkstreDrawer, 
    selectedCariId, 
    cariler, 
    cariHareketler, 
    hesaplaCariBakiye,
    addCariHareket,
    deleteCariHareket,
    bankaHesaplari
  } = useApp();

  const [tutar, setTutar] = useState('');
  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [aciklama, setAciklama] = useState('');
  const [islemTipi, setIslemTipi] = useState<IslemTuru>('tahsilat');
  const [bankaId, setBankaId] = useState<string>('');

  if (!selectedCariId) return null;

  const cari = cariler.find(c => c.id === selectedCariId);
  if (!cari) return null;

  const ozet = hesaplaCariBakiye(cari.id);
  const hareketler = cariHareketler
    .filter(h => h.cariId === cari.id)
    .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());

  const formatCurrency = (val: number) => {
    const safeVal = isNaN(val) || val === null || val === undefined ? 0 : val;
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(safeVal);
  };
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy', { locale: tr });
    } catch {
      return dateStr;
    }
  };

  const islemTurLabel: Record<IslemTuru, { text: string; color: string; icon: any }> = {
    'satis_faturasi': { text: 'Satış Faturası', color: 'text-indigo-600 bg-indigo-50 border-indigo-100', icon: Receipt },
    'alis_faturasi': { text: 'Alış Faturası', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: Receipt },
    'tahsilat': { text: 'Tahsilat (Bize Ödenen)', color: 'text-green-600 bg-green-50 border-green-100', icon: ArrowDownRight },
    'odeme': { text: 'Ödeme (Bizim Ödediğimiz)', color: 'text-orange-600 bg-orange-50 border-orange-100', icon: ArrowUpRight },
    'cek_senet_alinan': { text: 'Alınan Çek / Senet', color: 'text-blue-600 bg-blue-50 border-blue-100', icon: ArrowDownRight },
    'cek_senet_verilen': { text: 'Verilen Çek / Senet', color: 'text-amber-600 bg-amber-50 border-amber-100', icon: ArrowUpRight },
    'vergi_kdv': { text: 'KDV Ödemesi', color: 'text-red-700 bg-red-50 border-red-200', icon: CreditCard },
    'vergi_muhtasar': { text: 'Muhtasar Vergi', color: 'text-red-600 bg-red-50 border-red-100', icon: CreditCard },
    'vergi_gecici': { text: 'Geçici Vergi', color: 'text-rose-600 bg-rose-50 border-rose-100', icon: CreditCard },
    'vergi_damga': { text: 'Damga Vergisi', color: 'text-orange-700 bg-orange-50 border-orange-200', icon: CreditCard },
    'maas_odemesi': { text: 'Maaş Ödemesi', color: 'text-cyan-600 bg-cyan-50 border-cyan-100', icon: CreditCard },
    'kira_odemesi': { text: 'Kira Ödemesi', color: 'text-yellow-600 bg-yellow-50 border-yellow-100', icon: CreditCard },
    'banka_masrafi': { text: 'Banka Masrafı', color: 'text-slate-600 bg-slate-50 border-slate-100', icon: CreditCard },
    'ssk_odemesi': { text: 'SSK/SGK Ödemesi', color: 'text-pink-600 bg-pink-50 border-pink-100', icon: CreditCard },
    'genel_gider': { text: 'Genel Gider', color: 'text-stone-600 bg-stone-50 border-stone-100', icon: CreditCard },
    'kredi_karti_odemesi': { text: 'Kredi Kartı Ödemesi', color: 'text-indigo-700 bg-indigo-50 border-indigo-200', icon: CreditCard },
    'transfer': { text: 'Hesaplar Arası Transfer', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: ArrowDownLeft },
  };

  const handleIslemEkle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutar || parseFloat(tutar) <= 0) {
      toast.error('Geçerli bir tutar giriniz.');
      return;
    }
    
    addCariHareket({
      cariId: cari.id,
      tarih: tarih,
      islemTuru: islemTipi,
      tutar: parseFloat(tutar),
      aciklama: aciklama || (islemTipi === 'tahsilat' ? 'Nakit/Banka Tahsilat' : 'Nakit/Banka Ödeme'),
      dekontDosya: null,
      bankaId: bankaId || null
    });
    
    toast.success('İşlem ekstresi başarıyla kaydedildi.');
    setTutar('');
    setAciklama('');
  };

  return (
    <Sheet open={isCariEkstreDrawerOpen} onOpenChange={closeCariEkstreDrawer}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side="right">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Wallet className="w-5 h-5 text-primary" />
            Cari Hesap Ekstresi
          </SheetTitle>
          <SheetDescription>
            {cari.unvan} ({cari.vknTckn}) detaylı hareket ve bakiye dökümü.
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* ÖZET KARTLARI */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 border rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500 mb-1">
                {cari.tip === 'tedarikci' ? 'Alışlardan Borcumuz' : 'Satışlardan Alacağımız'}
              </p>
              <h3 className="text-lg font-bold text-slate-900">
                {formatCurrency(cari.tip === 'tedarikci' ? ozet.toplamAlacak : ozet.toplamBorc)}
              </h3>
            </div>
            <div className="bg-slate-50 border rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500 mb-1">
                {cari.tip === 'tedarikci' ? 'Ödediğimiz Tutar' : 'Tahsil Ettiğimiz'}
              </p>
              <h3 className="text-lg font-bold text-slate-900">
                {formatCurrency(cari.tip === 'tedarikci' ? ozet.odenen : ozet.tahsilEdilen)}
              </h3>
            </div>
            <div className={cn("col-span-2 border rounded-xl p-4 flex items-center justify-between", 
              ozet.bakiyeDurumu === 'borclu' ? 'bg-indigo-50 border-indigo-200' : 
              ozet.bakiyeDurumu === 'alacakli' ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'
            )}>
              <div>
                <p className={cn("text-xs font-semibold mb-1 uppercase tracking-wider", 
                  ozet.bakiyeDurumu === 'borclu' ? 'text-indigo-600' : 
                  ozet.bakiyeDurumu === 'alacakli' ? 'text-orange-600' : 'text-green-600'
                )}>
                  GÜNCEL BAKİYE ({ozet.bakiyeDurumu === 'borclu' ? 'Müşteri Borçlu' : ozet.bakiyeDurumu === 'alacakli' ? 'Biz Borçluyuz' : 'Hesap Kapalı'})
                </p>
                <h2 className="text-3xl font-black text-slate-900">{formatCurrency(ozet.guncelBakiye)}</h2>
              </div>
            </div>
          </div>

          {/* HIZLI İŞLEM EKLE */}
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-4 border-b pb-2">HIZLI İŞLEM (TAHSİLAT / ÖDEME) EKLE</h3>
            <form onSubmit={handleIslemEkle} className="space-y-4">
              <div className="flex bg-slate-100 p-1 rounded-md">
                <button type="button" onClick={() => setIslemTipi('tahsilat')} className={cn("flex-1 text-xs font-medium py-2 rounded transition-all", islemTipi === 'tahsilat' ? 'bg-white shadow-sm text-green-700' : 'text-slate-500 hover:text-slate-700')}>Tahsilat Aldık</button>
                <button type="button" onClick={() => setIslemTipi('odeme')} className={cn("flex-1 text-xs font-medium py-2 rounded transition-all", islemTipi === 'odeme' ? 'bg-white shadow-sm text-orange-700' : 'text-slate-500 hover:text-slate-700')}>Ödeme Yaptık</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500">Tutar <span className="text-red-500">*</span></Label>
                  <Input type="number" step="0.01" min="0" value={tutar} onChange={(e) => setTutar(e.target.value)} required placeholder="Örn: 5000" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500">Tarih <span className="text-red-500">*</span></Label>
                  <Input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Banka Hesabı</Label>
                <Select value={bankaId} onValueChange={setBankaId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Kasa / Banka Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nakit">Nakit / Elden</SelectItem>
                    {bankaHesaplari.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.hesapAdi} ({b.bankaAdi})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Açıklama (Opsiyonel)</Label>
                <Input value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Banka havalesi, Nakit elden vb." />
              </div>

              <Button type="submit" className="w-full">İşlemi Kaydet</Button>
            </form>
          </div>

          {/* GEÇMİŞ HAREKETLER */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-4">HAREKET DÖKÜMÜ</h3>
            {hareketler.length === 0 ? (
              <div className="text-center py-8 text-slate-500 border rounded-xl bg-slate-50/50">
                Henüz hesap hareketi bulunmuyor.
              </div>
            ) : (
              <div className="space-y-3">
                {hareketler.map((h) => {
                  const TurIcon = islemTurLabel[h.islemTuru].icon;
                  return (
                    <div key={h.id} className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:border-slate-300 transition-colors group">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border", islemTurLabel[h.islemTuru].color)}>
                        <TurIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 flex items-center justify-between">
                          <span>{islemTurLabel[h.islemTuru].text}</span>
                          <span className={h.islemTuru === 'satis_faturasi' || h.islemTuru === 'tahsilat' ? 'text-indigo-700' : 'text-emerald-700'}>
                            {formatCurrency(h.tutar)}
                          </span>
                        </p>
                        <div className="text-xs text-slate-500 flex items-center justify-between mt-0.5">
                          <span className="truncate pr-4">
                            {h.aciklama} 
                            {h.bankaId && ` (${bankaHesaplari.find(b => b.id === h.bankaId)?.hesapAdi || 'Nakit'})`}
                          </span>
                          <span className="shrink-0">{formatDate(h.tarih)}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600" onClick={() => deleteCariHareket(h.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
