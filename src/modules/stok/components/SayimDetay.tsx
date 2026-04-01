import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  useSayimDetay, 
  useSayimKalemKaydet, 
  useSayimOnayla 
} from '../hooks/useStokSayim';
import { useUrunler, useDepolar } from '../hooks/useStokQuery';
import { 
  ChevronLeft, 
  CheckCircle2, 
  Save, 
  Info, 
  Search,
  CheckCircle,
  AlertCircle,
  Warehouse,
  History,
  TrendingDown,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SayimDetayProps {
  id: string;
  onBack: () => void;
}

export const SayimDetay: React.FC<SayimDetayProps> = ({ id, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: sayimData, isLoading: isSayimLoading } = useSayimDetay(id);
  const { data: urunler } = useUrunler();
  const { data: depolar } = useDepolar();
  
  const saveKalemMut = useSayimKalemKaydet();
  const onaylaMut = useSayimOnayla();

  // Local state for counts being edited
  const [localCounts, setLocalCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (sayimData?.kalemler) {
      const counts: Record<string, number> = {};
      sayimData.kalemler.forEach(k => {
        counts[k.id] = k.sayimMiktari;
      });
      setLocalCounts(counts);
    }
  }, [sayimData]);

  const stats = useMemo(() => {
    if (!sayimData?.kalemler) return { match: 0, mismatch: 0, totalSafe: 0 };
    let match = 0;
    let mismatch = 0;
    sayimData.kalemler.forEach(k => {
      const currentCount = localCounts[k.id] ?? k.sayimMiktari;
      if (currentCount === k.sistemMiktari) match++;
      else mismatch++;
    });
    return { match, mismatch };
  }, [sayimData, localCounts]);

  const filteredKalemler = useMemo(() => {
    if (!sayimData?.kalemler) return [];
    if (!searchTerm) return sayimData.kalemler;
    const lowSearch = searchTerm.toLowerCase();
    return sayimData.kalemler.filter(k => {
      const urun = urunler?.find(u => u.id === k.urunId);
      return urun?.urunAdi.toLowerCase().includes(lowSearch) || urun?.stokKodu.toLowerCase().includes(lowSearch);
    });
  }, [sayimData, urunler, searchTerm]);

  const handleCountChange = (kalemId: string, val: string) => {
    const num = parseFloat(val) || 0;
    setLocalCounts(prev => ({ ...prev, [kalemId]: num }));
  };

  const saveKalem = async (kalemId: string) => {
    const amount = localCounts[kalemId];
    if (amount === undefined) return;
    try {
      await saveKalemMut.mutateAsync({ kalemId, sayimMiktari: amount });
    } catch (e) {}
  };

  const handleOnayla = async () => {
    if (window.confirm('Bu sayımı onaylamak istediğinizden emin misiniz? Aradaki farklar otomatik olarak stok hareketlerine yansıyacaktır.')) {
      try {
        await onaylaMut.mutateAsync(id);
        onBack();
      } catch (e) {}
    }
  };

  if (isSayimLoading) return <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Yükleniyor...</div>;
  if (!sayimData?.sayim) return <div>Hata: Sayım verisi bulunamadı.</div>;

  const isDraft = sayimData?.sayim?.durum === 'TASLAK';
  const depo = depolar?.find(d => d.id === sayimData?.sayim?.depoId);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full h-10 w-10 border border-slate-200">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="bg-white p-3 px-5 rounded-2xl border border-slate-200 flex flex-1 items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-800">Sayım Detayı</h2>
                <Badge className={sayimData?.sayim?.durum === 'TASLAK' ? "bg-amber-100/50 text-amber-700 border-amber-200 rounded-lg h-5 font-bold" : "bg-emerald-100/50 text-emerald-700 border-emerald-200 rounded-lg h-5 font-bold"}>
                   {sayimData?.sayim?.durum}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground mt-1">
                 <span className="flex items-center gap-1"><Warehouse className="w-3 h-3" /> {depo?.ad}</span>
                 <span className="flex items-center gap-1"><History className="w-3 h-3" /> {new Date(sayimData.sayim.tarih).toLocaleDateString('tr-TR')}</span>
              </div>
            </div>
            
            {isDraft && (
               <Button 
                onClick={handleOnayla} 
                className="bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold px-8 shadow-lg shadow-emerald-100"
                disabled={onaylaMut.isPending}
               >
                 {onaylaMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Sayımı Onayla</>}
               </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOPLAM KALEM</span>
            <span className="text-2xl font-black text-slate-800">{sayimData.kalemler.length} Ürün</span>
         </div>
         <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">EŞLEŞEN</span>
            <span className="text-2xl font-black text-emerald-700 flex items-center gap-2">
               <CheckCircle className="w-6 h-6 opacity-40 shrink-0" />
               {stats.match}
            </span>
         </div>
         <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">FARKLI (MUTABAKAT GEREKEN)</span>
            <span className="text-2xl font-black text-red-700 flex items-center gap-2">
               <AlertCircle className="w-6 h-6 opacity-40 shrink-0" />
               {stats.mismatch}
            </span>
         </div>
         <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DEPO DURUMU</span>
            <span className="text-xl font-black text-white flex items-center gap-2 mt-1">
               <Info className="w-5 h-5 text-blue-400 shrink-0" />
               Düzeltme Hazır
            </span>
         </div>
      </div>

      {/* Table & Sub-Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
           <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Ürün adı veya kod ara..." 
                className="pl-9 rounded-xl h-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           {isDraft && (
             <p className="text-[10px] font-bold text-amber-600 italic animate-pulse">
                Değişiklikler yapıldıktan sonra "Kaydet" butonuyla seans güncellenir.
             </p>
           )}
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="font-bold">Ürün Adı / Kod</TableHead>
              <TableHead className="font-bold text-center">Sistem Stoğu</TableHead>
              <TableHead className="font-bold text-center">Sayılan Miktar</TableHead>
              <TableHead className="font-bold text-center">Fark</TableHead>
              {isDraft && <TableHead className="text-right w-[80px]">Kaydet</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredKalemler.map((k) => {
              const urun = urunler?.find(u => u.id === k.urunId);
              const count = localCounts[k.id] ?? k.sayimMiktari;
              const diff = count - k.sistemMiktari;
              const hasChanged = count !== k.sayimMiktari;

              return (
                <TableRow key={k.id} className="group">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">{urun?.urunAdi}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{urun?.stokKodu}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono font-black text-slate-400">
                    {k.sistemMiktari}
                  </TableCell>
                  <TableCell className="w-[150px]">
                    <div className="flex items-center justify-center">
                      {isDraft ? (
                        <Input 
                          type="number" 
                          step="0.01"
                          className={`w-24 h-9 rounded-lg text-center font-black ${diff !== 0 ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}
                          value={count}
                          onChange={(e) => handleCountChange(k.id, e.target.value)}
                        />
                      ) : (
                        <span className="font-black text-slate-800">{k.sayimMiktari}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {diff === 0 ? (
                         <span className="text-xs font-bold text-emerald-600">EŞİT</span>
                      ) : (
                         <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${diff > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                           {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                           {diff > 0 ? '+' : ''}{diff}
                         </div>
                      )}
                    </div>
                  </TableCell>
                  {isDraft && (
                    <TableCell className="text-right">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className={`h-8 w-8 rounded-full ${hasChanged ? 'bg-amber-100 text-amber-700' : 'opacity-0 group-hover:opacity-100 text-slate-400'}`}
                        onClick={() => saveKalem(k.id)}
                        disabled={saveKalemMut.isPending}
                      >
                         {saveKalemMut.isPending ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {!isDraft && (
         <div className="p-6 bg-slate-100/50 rounded-3xl border border-dotted border-slate-300 flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
               <ClipboardCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="text-center space-y-1">
               <h4 className="font-black text-slate-800 uppercase tracking-tight">BU SAYIM ONAYLANDI</h4>
               <p className="text-xs text-muted-foreground font-medium">Bu işlem sonucunda oluşan farklar stok hareketlerine "SAYIM FİZİĞİ" olarak işlenmiştir.</p>
            </div>
         </div>
      )}
    </div>
  );
};

// Internal icon for summary
const ClipboardCheck = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>
);
