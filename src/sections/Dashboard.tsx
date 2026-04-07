import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useApp } from '@/context/AppContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  FileText, 
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  Wallet
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

export function Dashboard() {
  const { satisFaturalari, alisFaturalari, cariHareketler, bankaHesaplari, cariler } = useApp();

  // 1. Özet Kart Verileri
  const stats = useMemo(() => {
    const toplamSatis = satisFaturalari.reduce((sum, f) => sum + (Number(f.alinanUcret) || 0), 0);
    const toplamAlis = alisFaturalari.reduce((sum, f) => sum + (Number(f.toplamTutar) || 0), 0);
    const toplamBanka = bankaHesaplari.reduce((sum, b) => sum + (Number(b.guncelBakiye) || 0), 0);
    const aktifCari = cariler.length;

    return [
      { id: 1, name: 'Toplam Satış', value: toplamSatis, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { id: 2, name: 'Toplam Alış', value: toplamAlis, icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50' },
      { id: 3, name: 'Banka Bakiyesi', value: toplamBanka, icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-50' },
      { id: 4, name: 'Aktif Cariler', value: aktifCari, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50', isCurrency: false },
    ];
  }, [satisFaturalari, alisFaturalari, bankaHesaplari, cariler]);

  // 2. Aylık Satış vs Alış Grafiği Verisi (Son 6 Ay)
  const monthlyData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const targetDate = subMonths(new Date(), i);
      const start = startOfMonth(targetDate);
      const end = endOfMonth(targetDate);
      
      const label = format(targetDate, 'MMM', { locale: tr });
      
      const satis = satisFaturalari
        .filter(f => {
          const d = new Date(f.faturaTarihi);
          return isWithinInterval(d, { start, end });
        })
        .reduce((sum, f) => sum + (Number(f.alinanUcret) || 0), 0);

      const alis = alisFaturalari
        .filter(f => {
          const d = new Date(f.faturaTarihi);
          return isWithinInterval(d, { start, end });
        })
        .reduce((sum, f) => sum + (Number(f.toplamTutar) || 0), 0);

      data.push({ month: label, satis, alis });
    }
    return data;
  }, [satisFaturalari, alisFaturalari]);

  // 3. Gider Dağılımı Verisi
  const expenseDistribution = useMemo(() => {
    const counts: Record<string, number> = {
      'Vergi': 0,
      'Maaş': 0,
      'Kira': 0,
      'SSK/SGK': 0,
      'Banka Masrafı': 0,
      'Genel Gider': 0,
    };

    cariHareketler.forEach(h => {
      if (h.islemTuru.startsWith('vergi_')) counts['Vergi'] += h.tutar;
      else if (h.islemTuru === 'maas_odemesi') counts['Maaş'] += h.tutar;
      else if (h.islemTuru === 'kira_odemesi') counts['Kira'] += h.tutar;
      else if (h.islemTuru === 'ssk_odemesi') counts['SSK/SGK'] += h.tutar;
      else if (h.islemTuru === 'banka_masrafi') counts['Banka Masrafı'] += h.tutar;
      else if (h.islemTuru === 'genel_gider') counts['Genel Gider'] += h.tutar;
    });

    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [cariHareketler]);

  // 4. Son Hareketler
  const lastMovements = useMemo(() => {
    return [...cariHareketler]
      .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime())
      .slice(0, 5);
  }, [cariHareketler]);

  const formatCurrency = (val: number) => {
    const safeVal = isNaN(val) || val === null || val === undefined ? 0 : val;
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(safeVal);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">İşletmenizin finansal durumuna genel bakış.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((item) => (
          <Card key={item.id} className="border-0 shadow-sm overflow-hidden group hover:shadow-md transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{item.name}</p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {item.isCurrency === false ? item.value : formatCurrency(item.value)}
                  </h3>
                </div>
                <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110", item.bg, item.color)}>
                  <item.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Area Chart */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Alış - Satış Analizi</CardTitle>
            <CardDescription>Son 6 aylık performans karşılaştırması</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSatis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAlis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(val) => `${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                  formatter={(val: number) => formatCurrency(val)}
                />
                <Legend iconType="circle" verticalAlign="top" align="right" wrapperStyle={{ paddingTop: '0px', paddingBottom: '20px' }} />
                <Area type="monotone" name="Satış" dataKey="satis" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSatis)" />
                <Area type="monotone" name="Alış" dataKey="alis" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorAlis)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expense Pie Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Gider Dağılımı</CardTitle>
            <CardDescription>Kategorilere göre harcamalar</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] flex flex-col items-center justify-center">
            {expenseDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseDistribution}
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {expenseDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number) => formatCurrency(val)}
                  />
                  <Legend verticalAlign="bottom" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400">
                <FileText className="w-12 h-12 mb-2 opacity-20" />
                <p className="text-sm">Henüz gider verisi yok</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Son Hareketler</CardTitle>
              <CardDescription>Banka ve kasa akışı</CardDescription>
            </div>
            <div className="p-2 bg-slate-100 rounded-lg">
               <Wallet className="w-5 h-5 text-slate-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lastMovements.length > 0 ? (
                lastMovements.map((h) => {
                  const isPositive = ['tahsilat', 'satis_faturasi', 'cek_senet_alinan'].includes(h.islemTuru);
                  return (
                    <div key={h.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-2 rounded-xl",
                          isPositive ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                        )}>
                          {isPositive ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 truncate max-w-[200px]">{h.aciklama}</p>
                          <p className="text-xs text-slate-500">{format(new Date(h.tarih), 'dd MMMM yyyy', { locale: tr })}</p>
                        </div>
                      </div>
                      <p className={cn("text-sm font-bold", isPositive ? "text-emerald-600" : "text-slate-900")}>
                        {isPositive ? '+' : '-'}{formatCurrency(h.tutar)}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <p>Henüz hareket kaydı bulunamadı.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Debt/Credit Overview */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Cari Dengesi</CardTitle>
            <CardDescription>Bekleyen tahsilat ve ödemeler</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Alacaklarımız', tutar: satisFaturalari.reduce((sum, f) => sum + (f.odemeDurumu !== 'odendi' ? f.alinanUcret : 0), 0) },
                  { name: 'Borçlarımız', tutar: alisFaturalari.reduce((sum, f) => sum + (f.odemeDurumu !== 'odendi' ? f.toplamTutar : 0), 0) }
                ]}
                layout="vertical"
                margin={{ left: 20, right: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'medium', fill: '#64748b'}} width={100} />
                <Tooltip 
                   formatter={(val: number) => formatCurrency(val)}
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="tutar" radius={[0, 8, 8, 0]} barSize={32}>
                  <Cell fill="#6366f1" />
                  <Cell fill="#f43f5e" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
