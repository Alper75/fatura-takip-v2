import React from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { 
  Box, 
  Zap, 
  ChevronRight,
  TrendingUp,
  BarChartHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TopMover {
  urunAdi: string;
  stokKodu: string;
  moveCount: number;
  miktar: number;
}

interface StokHareketAnaliziProps {
  data: TopMover[];
}

export const StokHareketAnalizi: React.FC<StokHareketAnaliziProps> = ({ data }) => {
  return (
    <div className="space-y-6">
       {/* Most Active Products Card */}
       <Card className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 p-6 border-b border-slate-100 flex flex-row items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shadow-sm">
                   <Zap className="w-5 h-5" />
                </div>
                <div>
                   <CardTitle className="text-lg font-black text-slate-800">En Aktif Ürünler</CardTitle>
                   <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">TOP 5 HAREKET HACMİ</CardDescription>
                </div>
             </div>
             <BarChartHorizontal className="w-5 h-5 text-slate-300" />
          </CardHeader>
          <CardContent className="p-6">
             <div className="space-y-4">
                {data.map((item, idx) => (
                   <div key={item.stokKodu} className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 p-1.5 rounded-2xl transition-all">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 font-black text-[10px] rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-colors">
                            {idx + 1}
                         </div>
                         <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700">{item.urunAdi}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">{item.stokKodu}</span>
                         </div>
                      </div>
                      <div className="flex flex-col items-end">
                         <span className="text-xs font-black text-slate-800">{item.moveCount} <span className="text-[10px] text-muted-foreground">İşlem</span></span>
                         <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                            <TrendingUp className="w-3 h-3" /> Aktif
                         </div>
                      </div>
                   </div>
                ))}

                {data.length === 0 && (
                  <div className="py-20 text-center text-slate-300 font-bold">
                     <p>Hareketli ürün bulunamadı.</p>
                  </div>
                )}
             </div>
             
             <Button variant="ghost" className="w-full mt-6 rounded-2xl font-bold bg-slate-100/50 hover:bg-slate-100 text-slate-600 gap-2 h-11 border-none shadow-none">
                Tüm Analizi Gör <ChevronRight className="w-4 h-4" />
             </Button>
          </CardContent>
       </Card>

       {/* Turnover Small Card (Mock-ish but visual) */}
       <Card className="rounded-3xl border-none shadow-sm overflow-hidden bg-slate-50">
          <CardContent className="p-6 space-y-4">
             <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-tighter">STOK DEVİR DETAYI</span>
             </div>
             <div className="flex flex-col gap-1">
                <div className="flex justify-between items-baseline">
                   <h3 className="text-2xl font-black text-slate-800">54 Gün</h3>
                   <span className="text-xs font-bold text-red-500">-%8 Azalma</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">Ortalama stok tutma süresi (geçen aya göre)</p>
             </div>
             <div className="flex items-center gap-1.5 mt-2">
                <div className="h-1.5 w-12 bg-blue-500 rounded-full" />
                <div className="h-1.5 w-12 bg-blue-500 rounded-full" />
                <div className="h-1.5 w-12 bg-blue-500 rounded-full" />
                <div className="h-1.5 w-12 bg-blue-200 rounded-full" />
                <div className="h-1.5 w-4 bg-blue-100 rounded-full" />
             </div>
          </CardContent>
       </Card>
    </div>
  );
};
