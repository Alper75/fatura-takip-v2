import React from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Layers, PieChart } from 'lucide-react';

interface CategoryData {
  id: string;
  ad: string;
  deger: number;
  yuzde: number;
}

interface StokDegerlemeProps {
  data: CategoryData[];
  total: number;
}

export const StokDegerleme: React.FC<StokDegerlemeProps> = ({ data, total }) => {
  return (
    <Card className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden bg-white">
      <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 p-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl shadow-sm">
              <PieChart className="w-5 h-5" />
           </div>
           <div>
              <CardTitle className="text-lg font-black text-slate-800">Kategori Bazlı Değerleme</CardTitle>
              <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">ENENVANTER BÜYÜKLÜĞÜ</p>
           </div>
        </div>
        <div className="text-right">
           <span className="text-2xl font-black text-slate-800 tracking-tighter">{total.toLocaleString('tr-TR', { minimumFractionDigits: 0 })} ₺</span>
           <p className="text-[11px] font-bold text-slate-400">Toplam Portföy</p>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
           {data.filter(c => c.deger > 0).map((cat, idx) => {
             const colors = ['bg-indigo-600', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-slate-700'];
             const currentColor = colors[idx % colors.length];
             
             return (
               <div key={cat.id} className="space-y-2">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Layers className={`w-3.5 h-3.5 ${currentColor.replace('bg-', 'text-')}`} />
                       <span className="font-bold text-slate-700 text-sm">{cat.ad}</span>
                       <span className="text-[11px] font-bold text-slate-400 px-2 bg-slate-100 rounded-lg">%{cat.yuzde.toFixed(1)}</span>
                    </div>
                    <span className="font-black text-slate-800 text-sm">
                      {cat.deger.toLocaleString('tr-TR', { minimumFractionDigits: 0 })} ₺
                    </span>
                 </div>
                 <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${currentColor} rounded-full transition-all duration-1000 ease-out`}
                      style={{ width: `${cat.yuzde}%` }}
                    />
                 </div>
               </div>
             );
           })}

           {data.filter(c => c.deger > 0).length === 0 && (
             <div className="h-32 flex flex-col items-center justify-center text-slate-300 font-bold border-2 border-dashed border-slate-50 rounded-2xl">
                <PieChart className="w-12 h-12 mb-2 opacity-10" />
                <p>Yeterli veri bulunmamaktadır.</p>
             </div>
           )}
        </div>
        
        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between">
           <div className="flex gap-4">
              <div className="flex flex-col">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">EN YÜKSEK</span>
                 <span className="text-sm font-bold text-slate-700">{data.length > 0 ? data[0].ad : '-'}</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">İSKONTO PAYI</span>
                 <span className="text-sm font-bold text-slate-700">%12.5</span>
              </div>
           </div>
           <p className="text-[10px] text-muted-foreground italic font-medium max-w-[200px] text-right">
              Değerleme, son satın alma fiyatları ve mevcut stok miktarları çarpımıyla hesaplanmıştır.
           </p>
        </div>
      </CardContent>
    </Card>
  );
};
