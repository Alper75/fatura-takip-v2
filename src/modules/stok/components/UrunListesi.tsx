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
import { Checkbox } from '@/components/ui/checkbox';
import { 
  useUrunler, 
  useStokKategoriler as useKategoriler, 
  useDepolar, 
  useStokHareketler,
  useUrunMutations 
} from '../hooks/useStokQuery';
import { StokBadge } from './StokBadge';
import { UrunForm } from './UrunForm';
import { 
  Edit, 
  Trash2, 
  Plus, 
  Minus, 
  Search, 
  Filter, 
  ArrowUpDown, 
  MoreHorizontal,
  PackageCheck,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { IUrun, IStokKategori } from '../types/stok.types';

export const UrunListesi: React.FC = () => {
  // State for filtering and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKategori, setSelectedKategori] = useState('all');
  const [selectedDepo, setSelectedDepo] = useState('all');
  const [onlyKritikStok, setOnlyKritikStok] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUrun, setEditingUrun] = useState<IUrun | null>(null);

  // Data fetching
  const { data: urunler, isLoading: isUrunlerLoading } = useUrunler();
  const { data: kategoriler } = useKategoriler();
  const { data: depolar } = useDepolar();
  const { data: hareketler } = useStokHareketler();
  const { deleteUrun } = useUrunMutations();

  // Helper to calculate stock for all products
  const productStocks = useMemo(() => {
    if (!urunler || !hareketler) return {};
    const stockMap: Record<string, number> = {};
    
    urunler.forEach(u => {
      let miktar = hareketler
        .filter(h => h.urunId === u.id && (selectedDepo === 'all' || h.depoId === selectedDepo))
        .reduce((total, h) => h.tip === 'GIRIS' ? total + h.miktar : total - h.miktar, 0);
      stockMap[u.id] = miktar;
    });
    
    return stockMap;
  }, [urunler, hareketler, selectedDepo]);

  // Filtered and sorted data
  const processedData = useMemo(() => {
    if (!urunler) return [];
    
    let result = [...urunler];

    // Search filter
    if (searchTerm) {
      const lowSearch = searchTerm.toLowerCase();
      result = result.filter(u => 
        u.urunAdi.toLowerCase().includes(lowSearch) || 
        u.stokKodu.toLowerCase().includes(lowSearch) || 
        (u.barkod && u.barkod.toLowerCase().includes(lowSearch))
      );
    }

    // Category filter
    if (selectedKategori !== 'all') {
      result = result.filter(u => u.kategoriId === selectedKategori);
    }

    // Critical stock filter
    if (onlyKritikStok) {
      result = result.filter(u => (productStocks[u.id] || 0) <= u.minimumStok);
    }

    // Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        let aVal: any, bVal: any;
        if (sortConfig.key === 'stok') {
          aVal = productStocks[a.id] || 0;
          bVal = productStocks[b.id] || 0;
        } else {
          aVal = (a as any)[sortConfig.key];
          bVal = (b as any)[sortConfig.key];
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [urunler, searchTerm, selectedKategori, onlyKritikStok, productStocks, sortConfig]);

  // Pagination logic
  const totalPages = Math.ceil(processedData.length / pageSize);
  const pagedData = processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key && current.direction === 'asc') return { key, direction: 'desc' };
      return { key, direction: 'asc' };
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bu ürünü silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
      try {
        await deleteUrun.mutateAsync(id);
        toast.success('Ürün başarıyla silindi.');
      } catch (error) {
        toast.error('Silme işlemi başarısız oldu.');
      }
    }
  };

  const handleEdit = (urun: IUrun) => {
    setEditingUrun(urun);
    setIsFormOpen(true);
  };

  const handleNewUrun = () => {
    setEditingUrun(null);
    setIsFormOpen(true);
  };

  if (isUrunlerLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-slate-100 rounded-lg w-full" />
        <div className="h-64 bg-slate-50 rounded-lg w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Ara (Ad, Kod, Barkod)..." 
              className="pl-9 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Select value={selectedKategori} onValueChange={setSelectedKategori}>
            <SelectTrigger className="w-full md:w-40 rounded-xl">
              <Filter className="w-3.5 h-3.5 mr-2 opacity-50" />
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Kategoriler</SelectItem>
              {kategoriler?.map((cat: IStokKategori) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.ad}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedDepo} onValueChange={setSelectedDepo}>
            <SelectTrigger className="w-full md:w-40 rounded-xl">
              <PackageCheck className="w-3.5 h-3.5 mr-2 opacity-50" />
              <SelectValue placeholder="Depo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Depolar</SelectItem>
              {depolar?.map(depo => (
                <SelectItem key={depo.id} value={depo.id}>{depo.ad}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
            <Checkbox 
              id="kritik" 
              checked={onlyKritikStok} 
              onCheckedChange={(val) => setOnlyKritikStok(!!val)} 
            />
            <label htmlFor="kritik" className="text-sm font-medium leading-none cursor-pointer flex items-center text-red-600">
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
              Kritik Stoklar
            </label>
          </div>
        </div>

        <Button onClick={handleNewUrun} className="rounded-xl shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" />
          Yeni Ürün Ekle
        </Button>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
              <TableHead className="w-[120px] font-bold">Stok Kodu</TableHead>
              <TableHead className="font-bold">Ürün Adı</TableHead>
              <TableHead className="hidden lg:table-cell font-bold">Kategori</TableHead>
              <TableHead 
                className="cursor-pointer font-bold hover:text-primary transition-colors"
                onClick={() => handleSort('stok')}
              >
                <div className="flex items-center">
                  Toplam Stok
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="font-bold">Durum</TableHead>
              <TableHead className="text-right font-bold w-[100px]">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <PackageCheck className="h-12 w-12 mb-4 opacity-20" />
                    <p className="text-lg font-medium">Sonuç bulunamadı</p>
                    <p className="text-sm">Filtreleri değiştirmeyi deneyin ya da yeni ürün ekleyin.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pagedData.map((urun) => {
                const stokMiktarı = productStocks[urun.id] || 0;
                const isKritik = stokMiktarı <= urun.minimumStok;
                
                return (
                  <TableRow key={urun.id} className={isKritik ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-slate-50/30 transition-colors"}>
                    <TableCell className="font-mono text-xs">{urun.stokKodu}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-slate-800">{urun.urunAdi}</span>
                        <span className="text-[10px] text-muted-foreground">{urun.barkod || 'Barkod Yok'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-xs px-2 py-1 bg-slate-100 rounded-md text-slate-600">
                        {kategoriler?.find((c: IStokKategori) => c.id === urun.kategoriId)?.ad || 'Belirtilmemiş'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{stokMiktarı}</span>
                        <span className="text-[11px] text-muted-foreground font-medium">{urun.anaBirim}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StokBadge miktar={stokMiktarı} minimumStok={urun.minimumStok} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-40">
                          <DropdownMenuItem className="cursor-pointer flex items-center" onClick={() => handleEdit(urun)}>
                            <Edit className="mr-2 h-4 w-4 text-blue-600" /> Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer flex items-center text-green-600">
                            <Plus className="mr-2 h-4 w-4" /> Hızlı Giriş
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer flex items-center text-amber-600">
                            <Minus className="mr-2 h-4 w-4" /> Hızlı Çıkış
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer flex items-center text-red-600" onClick={() => handleDelete(urun.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination & Summary footer */}
      {processedData.length > 0 && (
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500 font-medium">
          <p>Toplam {processedData.length} ürün listeleniyor.</p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="rounded-lg h-8 w-8 p-0"
            >
              &lt;
            </Button>
            <div className="flex gap-1">
              {[...Array(totalPages)].map((_, i) => (
                <Button
                  key={i}
                  variant={currentPage === i + 1 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(i + 1)}
                  className="rounded-lg h-8 w-8 p-0"
                >
                  {i + 1}
                </Button>
              ))}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="rounded-lg h-8 w-8 p-0"
            >
              &gt;
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span>Satır:</span>
            <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); }}>
              <SelectTrigger className="w-[70px] h-8 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Form Modal */}
      <UrunForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        editingUrun={editingUrun} 
      />
    </div>
  );
};
