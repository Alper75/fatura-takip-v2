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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useDepolar, 
  useUrunler, 
  useStokHareketler,
  useDepoMutations
} from '../hooks/useStokQuery';
import { 
  Warehouse, 
  Plus, 
  Edit, 
  Trash2, 
  MapPin, 
  CheckCircle2, 
  Package,
  Search,
  BoxSelect
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const DepoYonetimi: React.FC = () => {
  const [activeTab, setActiveTab] = useState('definitions');
  const [selectedDepoId, setSelectedDepoId] = useState<string>('1');
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [stockSearch, setStockSearch] = useState('');

  const { data: depolar, isLoading: isDepoLoading } = useDepolar();
  const { data: urunler } = useUrunler();
  const { data: hareketler } = useStokHareketler();
  const { deleteDepo } = useDepoMutations();

  // Selected warehouse stock levels
  const warehouseStock = useMemo(() => {
    if (!urunler || !hareketler || !selectedDepoId) return [];

    return urunler.map(u => {
      const miktar = hareketler
        .filter(h => !h.iptal && h.urunId === u.id && h.depoId === selectedDepoId)
        .reduce((total, h) => {
          const isGiris = h.tip === 'GIRIS' || h.tip === 'TRANSFER_GIRIS';
          return isGiris ? total + h.miktar : total - h.miktar;
        }, 0);
      
      const sonHareket = hareketler
        .filter(h => !h.iptal && h.urunId === u.id && h.depoId === selectedDepoId)
        .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime())[0];

      return {
        ...u,
        miktar,
        sonHareketTarihi: sonHareket?.tarih || null
      };
    }).filter(item => {
      if (!stockSearch) return true;
      const lowSearch = stockSearch.toLowerCase();
      return item.urunAdi.toLowerCase().includes(lowSearch) || item.stokKodu.toLowerCase().includes(lowSearch);
    });
  }, [urunler, hareketler, selectedDepoId, stockSearch]);

  const filteredDepolar = useMemo(() => {
    if (!depolar) return [];
    if (!warehouseSearch) return depolar;
    const lowSearch = warehouseSearch.toLowerCase();
    return depolar.filter(d => d.ad.toLowerCase().includes(lowSearch) || d.kod.toLowerCase().includes(lowSearch));
  }, [depolar, warehouseSearch]);

  const handleDelete = async (id: string, ad: string) => {
    if (window.confirm(`${ad} deposunu silmek istediğinizden emin misiniz?`)) {
      try {
        await deleteDepo.mutateAsync(id);
      } catch (error: any) {
        // Error already handled by toast in hook
      }
    }
  };

  if (isDepoLoading) {
    return <div className="h-64 flex items-center justify-center">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-50 border border-slate-200/50 p-1 rounded-xl">
          <TabsTrigger value="definitions" className="rounded-lg font-bold px-6">
            <Warehouse className="w-4 h-4 mr-2" />
            Depo Tanımları
          </TabsTrigger>
          <TabsTrigger value="status" className="rounded-lg font-bold px-6">
            <BoxSelect className="w-4 h-4 mr-2" />
            Depo Stok Durumu
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Definitions */}
        <TabsContent value="definitions" className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Depo ara..." 
                className="pl-9 rounded-xl"
                value={warehouseSearch}
                onChange={(e) => setWarehouseSearch(e.target.value)}
              />
            </div>
            <Button className="rounded-xl shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" />
              Yeni Depo Ekle
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-bold">Kod</TableHead>
                  <TableHead className="font-bold">Depo Adı</TableHead>
                  <TableHead className="font-bold">Adres</TableHead>
                  <TableHead className="font-bold">Varsayılan</TableHead>
                  <TableHead className="font-bold text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDepolar.map((depo) => (
                  <TableRow key={depo.id}>
                    <TableCell className="font-mono text-xs">{depo.kod}</TableCell>
                    <TableCell className="font-bold">{depo.ad}</TableCell>
                    <TableCell className="text-muted-foreground text-sm flex items-center">
                      <MapPin className="w-3 h-3 mr-2 opacity-50" />
                      {depo.adres || 'Belirtilmemiş'}
                    </TableCell>
                    <TableCell>
                      {depo.varsayilan && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1.5 font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          Varsayılan
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                        <Edit className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-full text-red-600"
                        onClick={() => handleDelete(depo.id, depo.ad)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab 2: Stock Status */}
        <TabsContent value="status" className="mt-6 space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex flex-wrap gap-2">
              {depolar?.map(depo => (
                <Button 
                  key={depo.id}
                  variant={selectedDepoId === depo.id ? "default" : "outline"}
                  onClick={() => setSelectedDepoId(depo.id)}
                  className="rounded-xl px-4 py-2 font-bold"
                >
                  {depo.ad}
                </Button>
              ))}
            </div>
            
            <div className="md:ml-auto relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Ürün ara..." 
                className="pl-9 rounded-xl"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-bold">Ürün Adı</TableHead>
                  <TableHead className="font-bold">Stok Kodu</TableHead>
                  <TableHead className="font-bold">Mevcut Miktar</TableHead>
                  <TableHead className="font-bold">Son Hareket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouseStock.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Package className="h-10 w-10 mb-4 opacity-10" />
                        <p className="font-bold">Bu depoda stok kaydı bulunamadı.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  warehouseStock.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-bold text-slate-800">{item.urunAdi}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.stokKodu}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-black ${item.miktar <= item.minimumStok ? 'text-red-600' : 'text-slate-800'}`}>
                            {item.miktar}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-slate-400">{item.anaBirim}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {item.sonHareketTarihi ? new Date(item.sonHareketTarihi).toLocaleDateString('tr-TR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
