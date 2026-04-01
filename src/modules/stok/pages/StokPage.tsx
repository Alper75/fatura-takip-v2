import React, { useMemo, useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { UrunListesi } from '../components/UrunListesi';
import { DepoYonetimi } from '../components/DepoYonetimi';
import { HareketListesi } from '../components/HareketListesi';
import { StokSayim } from '../components/StokSayim';
import { StokRaporlar } from '../components/StokRaporlar';
import { StokHareketForm } from '../components/StokHareketForm';
import { 
  useUrunler, 
  useStokHareketler 
} from '../hooks/useStokQuery';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  History, 
  BarChart3,
  Warehouse,
  ClipboardList,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft
} from 'lucide-react';

/**
 * Main Inventory Management Page.
 * Displays summary stats and a tabbed interface for Products, Warehouses, Movements, etc.
 */
export const StokPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('products');
  const [isHareketFormOpen, setIsHareketFormOpen] = useState(false);
  const [hareketType, setHareketType] = useState<'GIRIS' | 'CIKIS' | 'TRANSFER'>('GIRIS');

  const { data: urunler } = useUrunler();
  const { data: hareketler } = useStokHareketler();

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (!urunler || !hareketler) return { totalItems: 0, criticalItems: 0, totalStock: 0 };
    
    const totalItems = urunler.length;
    let criticalItems = 0;
    let totalStock = 0;

    urunler.forEach(u => {
      const miktar = hareketler
        .filter(h => !h.iptal && h.urunId === u.id)
        .reduce((total, h) => {
          const isGiris = h.tip === 'GIRIS' || h.tip === 'TRANSFER_GIRIS';
          return isGiris ? total + h.miktar : total - h.miktar;
        }, 0);
      
      totalStock += miktar;
      if (miktar <= u.minimumStok) {
        criticalItems++;
      }
    });

    return { totalItems, criticalItems, totalStock };
  }, [urunler, hareketler]);

  const openHareket = (type: 'GIRIS' | 'CIKIS' | 'TRANSFER') => {
    setHareketType(type);
    setIsHareketFormOpen(true);
  };

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Stok Yönetimi</h1>
          <p className="text-muted-foreground font-medium">Ürünlerinizi, depolarınızı ve stok hareketlerinizi tek bir yerden yönetin.</p>
        </div>
        
        <div className="flex items-center gap-2">
           <Button 
            onClick={() => openHareket('GIRIS')} 
            className="bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold shadow-lg shadow-emerald-100"
          >
             <ArrowDownLeft className="w-4 h-4 mr-2" /> Hızlı Giriş
           </Button>
           <Button 
            onClick={() => openHareket('CIKIS')} 
            className="bg-red-600 hover:bg-red-700 rounded-xl font-bold shadow-lg shadow-red-100"
          >
             <ArrowUpRight className="w-4 h-4 mr-2" /> Hızlı Çıkış
           </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-blue-700 uppercase">Toplam Ürün Çeşidi</CardTitle>
            <Package className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">{stats.totalItems}</div>
            <p className="text-xs text-blue-600 mt-1 font-medium flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" />
              Aktif ürün listesi
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-red-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-red-700 uppercase">Kritik Stokta Olan</CardTitle>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">{stats.criticalItems}</div>
            <p className="text-xs text-red-600 mt-1 font-medium flex items-center">
              Acil kontrol gereken ürünler
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-emerald-700 uppercase">Toplam Stok Miktarı</CardTitle>
            <BarChart3 className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">{stats.totalStock.toLocaleString('tr-TR')}</div>
            <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center">
               Tüm depolardaki fiziksel toplam
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50">
          <TabsTrigger value="products" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Package className="w-4 h-4 mr-2" />
            Ürünler
          </TabsTrigger>
          <TabsTrigger value="warehouses" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Warehouse className="w-4 h-4 mr-2" />
            Depolar
          </TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <History className="w-4 h-4 mr-2" />
            Hareketler
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <ClipboardList className="w-4 h-4 mr-2" />
            Sayım
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm text-indigo-700">
            <BarChart3 className="w-4 h-4 mr-2" />
            Raporlar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-0 outline-none">
          <UrunListesi />
        </TabsContent>

        <TabsContent value="warehouses" className="mt-0 outline-none">
          <DepoYonetimi />
        </TabsContent>

        <TabsContent value="movements" className="mt-0 outline-none">
          <div className="space-y-4">
            <div className="flex justify-end gap-2 px-1">
               <Button onClick={() => openHareket('GIRIS')} variant="outline" className="rounded-xl font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                 <ArrowDownLeft className="w-4 h-4 mr-2" /> Stok Girişi
               </Button>
               <Button onClick={() => openHareket('CIKIS')} variant="outline" className="rounded-xl font-bold border-red-200 text-red-700 hover:bg-red-50">
                 <ArrowUpRight className="w-4 h-4 mr-2" /> Stok Çıkışı
               </Button>
               <Button onClick={() => openHareket('TRANSFER')} variant="outline" className="rounded-xl font-bold border-blue-200 text-blue-700 hover:bg-blue-50">
                 <ArrowRightLeft className="w-4 h-4 mr-2" /> Depo Transferi
               </Button>
            </div>
            <HareketListesi />
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-0 outline-none">
           <StokSayim />
        </TabsContent>

        <TabsContent value="reports" className="mt-0 outline-none">
           <StokRaporlar />
        </TabsContent>
      </Tabs>

      {/* Movement Modal */}
      <StokHareketForm
        isOpen={isHareketFormOpen}
        onClose={() => setIsHareketFormOpen(false)}
        initialType={hareketType}
      />
    </div>
  );
};
