import React, { useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UrunListesi } from '../components/UrunListesi';
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
  ClipboardList
} from 'lucide-react';

/**
 * Main Inventory Management Page.
 * Displays summary stats and a tabbed interface for Products, Warehouses, Movements, etc.
 */
export const StokPage: React.FC = () => {
  const { data: urunler } = useUrunler();
  const { data: hareketler } = useStokHareketler();

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (!urunler || !hareketler) return { totalItems: 0, criticalItems: 0, totalStock: 0 };
    
    let totalItems = urunler.length;
    let criticalItems = 0;
    let totalStock = 0;

    urunler.forEach(u => {
      const miktar = hareketler
        .filter(h => h.urunId === u.id)
        .reduce((total, h) => h.tip === 'GIRIS' ? total + h.miktar : total - h.miktar, 0);
      
      totalStock += miktar;
      if (miktar <= u.minimumStok) {
        criticalItems++;
      }
    });

    return { totalItems, criticalItems, totalStock };
  }, [urunler, hareketler]);

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Stok Yönetimi</h1>
        <p className="text-muted-foreground font-medium">Ürünlerinizi, depolarınızı ve stok hareketlerinizi tek bir yerden yönetin.</p>
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
            <div className="text-3xl font-black text-slate-800">{stats.totalStock}</div>
            <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center">
               Tüm depolardaki fiziksel toplam
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Container */}
      <Tabs defaultValue="products" className="w-full space-y-6">
        <TabsList className="bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50">
          <TabsTrigger value="products" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Package className="w-4 h-4 mr-2" />
            Ürünler
          </TabsTrigger>
          <TabsTrigger value="warehouses" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm opacity-50 cursor-not-allowed">
            <Warehouse className="w-4 h-4 mr-2" />
            Depolar
          </TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm opacity-50 cursor-not-allowed">
            <History className="w-4 h-4 mr-2" />
            Hareketler
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm opacity-50 cursor-not-allowed">
            <ClipboardList className="w-4 h-4 mr-2" />
            Sayım
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-0 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <UrunListesi />
        </TabsContent>

        {/* Other tabs are placeholders for now */}
        <TabsContent value="warehouses" className="h-64 border-2 border-dashed border-slate-100 rounded-3xl flex items-center justify-center text-slate-300 font-bold">
           Depo yönetimi yakında...
        </TabsContent>
      </Tabs>
    </div>
  );
};
