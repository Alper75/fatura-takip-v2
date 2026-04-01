import React from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { useStokAnaliz } from '../hooks/useStokAnaliz';
import { 
  TrendingUp, 
  AlertTriangle, 
  Activity, 
  ArrowUpRight,
  Loader2,
  Calendar,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StokDegerleme } from './StokDegerleme';
import { StokHareketAnalizi } from './StokHareketAnalizi';

export const StokRaporlar: React.FC = () => {
  const { data: analiz, isLoading } = useStokAnaliz();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
        <p className="font-bold">Analiz Verileri Hesaplanıyor...</p>
        <p className="text-xs">Envanter değerlemesi ve hareket trendleri hazırlanıyor.</p>
      </div>
    );
  }

  if (!analiz) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-none shadow-sm bg-slate-900 text-white overflow-hidden relative">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">TOPLAM ENVANTER DEĞERİ</CardDescription>
            <CardTitle className="text-2xl font-black text-white">
              {analiz.totalValuation.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-400/10 w-fit px-2 py-0.5 rounded-full">
               <TrendingUp className="w-3 h-3" /> %4.2 Artış
             </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-white border border-slate-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">KRİTİK STOK ADEDİ</CardDescription>
            <CardTitle className={`text-2xl font-black ${analiz.criticalCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {analiz.criticalCount} <span className="text-sm font-bold text-slate-400">Ürün</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
               <AlertTriangle className={`w-3 h-3 ${analiz.criticalCount > 0 ? 'text-red-500' : ''}`} /> Acil tedarik gerekenler
             </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-white border border-slate-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">STOK DEVİR HIZI</CardDescription>
            <CardTitle className="text-2xl font-black text-slate-800">
              6.8 <span className="text-sm font-bold text-slate-400">Kere/Yıl</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-2 text-blue-500 text-xs font-bold bg-blue-50 w-fit px-2 py-0.5 rounded-full">
               <Activity className="w-3 h-3" /> Sektör Ortalaması: 5.2
             </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-white border border-slate-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">SON SAYIM UYUMU</CardDescription>
            <CardTitle className="text-2xl font-black text-slate-800">
              %98.4
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
               <Calendar className="w-3 h-3" /> 12 Gün Önce
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left Side: Valuation and Category Distribution */}
         <div className="lg:col-span-2 space-y-6">
            <StokDegerleme data={analiz.categoryDist} total={analiz.totalValuation} />
            
            {/* Additional info card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-3xl text-white flex justify-between items-center relative overflow-hidden shadow-xl shadow-blue-100">
               <div className="absolute right-0 bottom-0 opacity-10">
                  <Layers className="w-48 h-48 translate-x-12 translate-y-12" />
               </div>
               <div className="space-y-1 relative z-10">
                  <h4 className="text-lg font-black tracking-tight">Akıllı Stok Öngörüsü</h4>
                  <p className="text-sm text-blue-100 max-w-sm">Mevcut çıkış trendlerine göre 'Laptop Standı' ürününün 4 gün içerisinde kritik seviyeye gelmesi beklenmektedir.</p>
               </div>
               <Button className="bg-white text-blue-700 hover:bg-blue-50 rounded-xl font-bold gap-2 shadow-lg relative z-10">
                  Siparişi Hazırla <ArrowUpRight className="w-4 h-4" />
               </Button>
            </div>
         </div>

         {/* Right Side: Top Movers */}
         <div className="lg:col-span-1">
            <StokHareketAnalizi data={analiz.topMovers} />
         </div>
      </div>
    </div>
  );
};
