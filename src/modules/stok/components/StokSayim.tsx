import React, { useState } from 'react';
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
  useSayimListesi, 
  useSayimBaslat
} from '../hooks/useStokSayim';
import { useDepolar } from '../hooks/useStokQuery';
import { 
  ClipboardCheck, 
  Plus, 
  Calendar,
  Warehouse,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SayimDetay } from './SayimDetay';

export const StokSayim: React.FC = () => {
  const [isNewSayimOpen, setIsNewSayimOpen] = useState(false);
  const [selectedSayimId, setSelectedSayimId] = useState<string | null>(null);
  const [newSayimDepoId, setNewSayimDepoId] = useState('');
  const [newSayimAciklama, setNewSayimAciklama] = useState('');

  const { data: sayimlar, isLoading } = useSayimListesi();
  const { data: depolar } = useDepolar();
  const baslatMut = useSayimBaslat();

  const handleStart = async () => {
    if (!newSayimDepoId) return;
    try {
      await baslatMut.mutateAsync({ 
        depoId: newSayimDepoId, 
        aciklama: newSayimAciklama 
      });
      setIsNewSayimOpen(false);
      setNewSayimDepoId('');
      setNewSayimAciklama('');
    } catch (error) {
      // Handled in hook
    }
  };

  if (selectedSayimId) {
    return <SayimDetay id={selectedSayimId} onBack={() => setSelectedSayimId(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
             <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Sayım Seansları</h2>
            <p className="text-xs text-muted-foreground">Depo stok mutabakatı için sayım seanslarını buradan yönetin.</p>
          </div>
        </div>
        <Button 
          onClick={() => setIsNewSayimOpen(true)} 
          className="rounded-xl shadow-lg shadow-primary/20 font-bold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Yeni Sayım Başlat
        </Button>
      </div>

      {/* Table section */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="font-bold">Tarih</TableHead>
              <TableHead className="font-bold">Depo</TableHead>
              <TableHead className="font-bold">Açıklama</TableHead>
              <TableHead className="font-bold">Durum</TableHead>
              <TableHead className="text-right font-bold">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...
                  </div>
                </TableCell>
              </TableRow>
            ) : sayimlar?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground font-medium">
                  Henüz bir sayım seansı bulunmamaktadır.
                </TableCell>
              </TableRow>
            ) : (
              sayimlar?.map((s) => {
                const depo = depolar?.find(d => d.id === s.depoId);
                return (
                  <TableRow key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-semibold text-slate-600">
                       <div className="flex items-center gap-2">
                         <Calendar className="w-3.5 h-3.5 opacity-40" />
                         {new Date(s.tarih).toLocaleDateString('tr-TR', {
                            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                         })}
                       </div>
                    </TableCell>
                    <TableCell className="font-bold text-slate-700">
                       <div className="flex items-center gap-2">
                         <Warehouse className="w-3.5 h-3.5 opacity-40" />
                         {depo?.ad || 'Bilinmiyor'}
                       </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                       {s.aciklama || '-'}
                    </TableCell>
                    <TableCell>
                       {s.durum === 'ONAYLANDI' ? (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 gap-1.5 font-bold rounded-lg px-2.5 py-0.5">
                             <CheckCircle2 className="w-3 h-3" />
                             ONAYLANDI
                          </Badge>
                       ) : (
                          <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 gap-1.5 font-bold rounded-lg px-2.5 py-0.5">
                             <Clock className="w-3 h-3" />
                             TASLAK
                          </Badge>
                       )}
                    </TableCell>
                    <TableCell className="text-right">
                       <Button 
                        variant="ghost" 
                        size="sm" 
                        className="rounded-xl font-bold gap-2 text-primary hover:bg-primary/5"
                        onClick={() => setSelectedSayimId(s.id)}
                       >
                         {s.durum === 'TASLAK' ? (
                            <>
                              <ArrowRight className="w-4 h-4" /> Sayımı Düzenle
                            </>
                         ) : (
                            <>
                              <Eye className="w-4 h-4" /> Detayları Gör
                            </>
                         )}
                       </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* New Sayim Dialog */}
      <Dialog open={isNewSayimOpen} onOpenChange={setIsNewSayimOpen}>
        <DialogContent className="rounded-3xl sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
               <Plus className="w-5 h-5 text-primary" />
               Yeni Sayım Seansı Başlat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="space-y-2">
                <p className="text-sm font-bold text-slate-700">Hangi Depo Sayılacak? *</p>
                <Select value={newSayimDepoId} onValueChange={setNewSayimDepoId}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue placeholder="Depo Seçiniz" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {depolar?.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.ad}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <p className="text-sm font-bold text-slate-700">Açıklama (Opsiyonel)</p>
                <Input 
                  placeholder="Yıl sonu sayımı, genel kontrol vb." 
                  className="rounded-xl h-11"
                  value={newSayimAciklama}
                  onChange={(e) => setNewSayimAciklama(e.target.value)}
                />
             </div>
             <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                <p className="text-[11px] text-blue-700 font-medium">
                  Sayım başlatıldığında, sistemdeki mevcut stok miktarları "Sistem Stoğu" olarak seansa dondurulur.
                </p>
             </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewSayimOpen(false)} className="rounded-xl">Vazgeç</Button>
            <Button 
              onClick={handleStart} 
              disabled={!newSayimDepoId || baslatMut.isPending} 
              className="rounded-xl font-bold px-8"
            >
              {baslatMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Seansı Başlat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
