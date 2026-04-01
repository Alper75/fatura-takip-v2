import React, { useState, useMemo } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  useStokHareketler, 
  useUrunler, 
  useDepolar 
} from '../hooks/useStokQuery';
import { useStokHareketIptal } from '../hooks/useStokHareket';
import { 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowRightLeft, 
  Search,
  Filter,
  Trash2,
  MoreVertical,
  Info
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { IStokHareket } from '../types/stok.types';

export const HareketListesi: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedDepo, setSelectedDepo] = useState('ALL');

  const { data: hareketler, isLoading } = useStokHareketler();
  const { data: urunler } = useUrunler();
  const { data: depolar } = useDepolar();
  const { mutateAsync: iptalEt } = useStokHareketIptal();

  const filteredHareketler = useMemo(() => {
    if (!hareketler) return [];
    
    return [...hareketler].reverse().filter(h => {
      // Type filter
      if (selectedType !== 'ALL' && h.tip !== selectedType) return false;
      
      // Depo filter
      if (selectedDepo !== 'ALL' && h.depoId !== selectedDepo) return false;

      // Search (Product name or code)
      if (searchTerm) {
        const urun = urunler?.find(u => u.id === h.urunId);
        const lowSearch = searchTerm.toLowerCase();
        if (!urun?.urunAdi.toLowerCase().includes(lowSearch) && 
            !urun?.stokKodu.toLowerCase().includes(lowSearch) &&
            !h.referans?.toLowerCase().includes(lowSearch)) return false;
      }

      return true;
    });
  }, [hareketler, urunler, searchTerm, selectedType, selectedDepo]);

  const handleIptal = async (h: IStokHareket) => {
    if (window.confirm('Bu hareketi iptal etmek istediğinizden emin misiniz?')) {
      try {
        await iptalEt(h.id);
      } catch (error) {
        // Handled in hook
      }
    }
  };

  if (isLoading) return <div className="p-8 text-center">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      {/* Filters Area */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Ürün veya ref no ara..." 
              className="pl-9 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full md:w-40 rounded-xl">
              <Filter className="w-3.5 h-3.5 mr-2 opacity-50" />
              <SelectValue placeholder="İşlem Tipi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tüm İşlemler</SelectItem>
              <SelectItem value="GIRIS">Stok Girişi</SelectItem>
              <SelectItem value="CIKIS">Stok Çıkışı</SelectItem>
              <SelectItem value="TRANSFER_CIKIS">Transfer (Çıkış)</SelectItem>
              <SelectItem value="TRANSFER_GIRIS">Transfer (Giriş)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedDepo} onValueChange={setSelectedDepo}>
            <SelectTrigger className="w-full md:w-40 rounded-xl">
              <SelectValue placeholder="Depo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tüm Depolar</SelectItem>
              {depolar?.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.ad}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-slate-400">
           <History className="w-4 h-4" />
           SON HAREKETLER
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="font-bold">Tarih</TableHead>
              <TableHead className="font-bold">Hareket</TableHead>
              <TableHead className="font-bold">Ürün / Kod</TableHead>
              <TableHead className="font-bold">Depo</TableHead>
              <TableHead className="font-bold">Miktar</TableHead>
              <TableHead className="font-bold">Tutar</TableHead>
              <TableHead className="text-right font-bold w-[60px]">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredHareketler.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center text-muted-foreground font-medium">
                  Kayda değer bir hareket bulunamadı.
                </TableCell>
              </TableRow>
            ) : (
              filteredHareketler.map((h) => {
                const urun = urunler?.find(u => u.id === h.urunId);
                const depo = depolar?.find(d => d.id === h.depoId);
                const isIptal = h.iptal;

                return (
                  <TableRow key={h.id} className={`${isIptal ? 'opacity-40 grayscale italic bg-slate-50' : 'hover:bg-slate-50/50 transition-colors'}`}>
                    <TableCell className="text-xs font-medium text-slate-500 whitespace-nowrap">
                      {new Date(h.tarih).toLocaleDateString('tr-TR', {
                         day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {h.tip === 'GIRIS' && (
                          <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {h.tip === 'CIKIS' && (
                          <div className="p-1.5 bg-red-100 text-red-700 rounded-lg">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {(h.tip === 'TRANSFER_GIRIS' || h.tip === 'TRANSFER_CIKIS') && (
                          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span className="text-[11px] font-black uppercase tracking-tighter">
                          {h.tip.replace('_', ' ')}
                          {isIptal && <span className="ml-1 text-[9px] text-red-500"> (İPTAL)</span>}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">{urun?.urunAdi}</span>
                        <span className="text-[9px] font-mono text-muted-foreground">{urun?.stokKodu}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] font-bold text-slate-600">{depo?.ad}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-black ${h.tip === 'GIRIS' || h.tip === 'TRANSFER_GIRIS' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {h.tip === 'GIRIS' || h.tip === 'TRANSFER_GIRIS' ? '+' : '-'}{h.miktar}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-bold">{urun?.anaBirim}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                       <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                         {(h.tutar || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                       </span>
                    </TableCell>
                    <TableCell className="text-right">
                       {!isIptal && (
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                               <MoreVertical className="h-4 w-4" />
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end" className="rounded-xl w-40">
                             <DropdownMenuItem className="cursor-pointer flex items-center font-bold">
                               <Info className="mr-2 h-4 w-4 text-blue-500" /> Detaylar
                             </DropdownMenuItem>
                             <DropdownMenuItem 
                               className="cursor-pointer flex items-center text-red-600 font-bold"
                               onClick={() => handleIptal(h)}
                             >
                               <Trash2 className="mr-2 h-4 w-4" /> İptal Et
                             </DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
                       )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
