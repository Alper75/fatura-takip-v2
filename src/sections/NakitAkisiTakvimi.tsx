import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Landmark, 
  Calendar as CalendarIcon, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileText, 
  CreditCard, 
  MessageSquare, 
  Copy, 
  ExternalLink, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Send,
  Eye,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import type { SatisFatura, AlisFatura, CekSenet } from '@/types';
import { ParcaliOdemeModal } from '@/components/ParcaliOdemeModal';

interface CashFlowItem {
  id: string;
  sourceType: 'satis_faturasi' | 'alis_faturasi' | 'alinan_cek' | 'verilen_cek';
  direction: 'in' | 'out'; // in = Tahsilat, out = Ödeme
  title: string;
  cariAdi: string;
  cariId?: string;
  belgeNo: string;
  tutar: number;
  vadeTarihi: string;
  faturaTarihi?: string;
  diffDays: number; // negatif = gecikmiş, 0 = bugün, pozitif = gelecek
  durum: string;
  rawRef: SatisFatura | AlisFatura | CekSenet;
}

export default function NakitAkisiTakvimi() {
  const { 
    bankaHesaplari, 
    satisFaturalari, 
    alisFaturalari, 
    cekSenetler, 
    cariler,
    updateSatisFaturaOdeme,
    updateAlisFaturaOdeme,
    fetchSatisFaturalari,
    fetchAlisFaturalari,
    fetchCariHareketler
  } = useApp();

  const [activeTab, setActiveTab] = useState<'genel' | 'takvim' | 'liste'>('genel');
  const [filterType, setFilterType] = useState<'all' | 'overdue' | 'this_week' | 'in' | 'out'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [projectionDays, setProjectionDays] = useState<30 | 60 | 90>(30);

  // Takvim Seçili Ay State'i
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedCalendarDayItems, setSelectedCalendarDayItems] = useState<{ dayStr: string; items: CashFlowItem[] } | null>(null);

  // Hatırlatıcı Dialog State
  const [reminderItem, setReminderItem] = useState<CashFlowItem | null>(null);
  const [reminderChannel, setReminderChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [copied, setCopied] = useState(false);

  // Parçalı Ödeme Modalı State'i
  const [partialModalTarget, setPartialModalTarget] = useState<{ fatura: any; tip: 'satis' | 'alis' } | null>(null);

  // 1. Başlangıç Likiditesi (Kasa & Banka Toplamı)
  const currentLiquidity = useMemo(() => {
    return bankaHesaplari.reduce((sum, b) => sum + (Number(b.guncelBakiye) || 0), 0);
  }, [bankaHesaplari]);

  // 2. Tüm Açık Nakit Akışı Kalemlerini Birleştir
  const cashFlowItems = useMemo<CashFlowItem[]>(() => {
    const items: CashFlowItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const calcDiffDays = (dateStr: string) => {
      if (!dateStr) return 0;
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    // A. Açık Satış Faturaları (Tahsilat / Giriş)
    satisFaturalari
      .filter(f => f.odemeDurumu !== 'ODENDI' && f.odemeDurumu !== 'odendi' as any)
      .forEach(f => {
        const vade = f.vadeTarihi || f.faturaTarihi || new Date().toISOString().split('T')[0];
        const isPartiallyPaid = Boolean((f as any).odenenTutar > 0 || f.odemeDurumu === 'kismi_odendi');
        const total = Number(f.toplamTutar || (f as any).alinanUcret || 0);
        const openAmount = Number(
          (f as any).kalanTutar !== undefined && (f as any).kalanTutar !== null && (f as any).odenenTutar > 0
            ? (f as any).kalanTutar
            : total
        );
        const cariAd = f.musteriAdi || (f.ad ? `${f.ad} ${f.soyad || ''}`.trim() : 'Müşteri');
        items.push({
          id: 'sf_' + f.id,
          sourceType: 'satis_faturasi',
          direction: 'in',
          title: isPartiallyPaid ? 'Kısmi Tahsilatlı Satış Faturası' : 'Satış Faturası Alacağı',
          cariAdi: cariAd,
          cariId: f.cariId,
          belgeNo: f.faturaNo,
          tutar: openAmount,
          vadeTarihi: vade,
          faturaTarihi: f.faturaTarihi,
          diffDays: calcDiffDays(vade),
          durum: f.odemeDurumu,
          rawRef: f
        });
      });

    // B. Açık Alış Faturaları (Ödeme / Çıkış)
    alisFaturalari
      .filter(f => f.odemeDurumu !== 'odendi')
      .forEach(f => {
        const vade = f.vadeTarihi || f.faturaTarihi || new Date().toISOString().split('T')[0];
        const isPartiallyPaid = Boolean((f as any).odenenTutar > 0 || f.odemeDurumu === 'kismi_odendi');
        const total = Number(f.toplamTutar || 0);
        const openAmount = Number(
          (f as any).kalanTutar !== undefined && (f as any).kalanTutar !== null && (f as any).odenenTutar > 0
            ? (f as any).kalanTutar
            : total
        );
        items.push({
          id: 'af_' + f.id,
          sourceType: 'alis_faturasi',
          direction: 'out',
          title: isPartiallyPaid ? 'Kısmi Ödenmiş Alış Faturası' : 'Alış Faturası Ödemesi',
          cariAdi: f.tedarikciAdi || 'Tedarikçi',
          cariId: f.cariId,
          belgeNo: f.faturaNo,
          tutar: openAmount,
          vadeTarihi: vade,
          faturaTarihi: f.faturaTarihi,
          diffDays: calcDiffDays(vade),
          durum: f.odemeDurumu,
          rawRef: f
        });
      });

    // C. Bekleyen Çek ve Senetler
    (cekSenetler || [])
      .filter(c => c.durum === 'bekliyor')
      .forEach(c => {
        const cari = cariler.find(cr => cr.id === c.cariId);
        const isIn = c.islemTipi === 'alinan';
        items.push({
          id: 'cs_' + c.id,
          sourceType: isIn ? 'alinan_cek' : 'verilen_cek',
          direction: isIn ? 'in' : 'out',
          title: `${isIn ? 'Alınan' : 'Verilen'} ${c.tip === 'cek' ? 'Çek' : 'Senet'}`,
          cariAdi: cari?.unvan || 'Cari',
          cariId: c.cariId,
          belgeNo: c.belgeNo,
          tutar: Number(c.tutar) || 0,
          vadeTarihi: c.vadeTarihi,
          diffDays: calcDiffDays(c.vadeTarihi),
          durum: c.durum,
          rawRef: c
        });
      });

    // Tarihe göre sırala (Gecikmişler en başta, ardından en yakın vadeler)
    return items.sort((a, b) => a.diffDays - b.diffDays);
  }, [satisFaturalari, alisFaturalari, cekSenetler, cariler]);

  // 3. Özet KPI Hesaplamaları
  const summary = useMemo(() => {
    let overdueIn = 0;
    let overdueOut = 0;
    let next30In = 0;
    let next30Out = 0;
    let totalIn = 0;
    let totalOut = 0;

    cashFlowItems.forEach(item => {
      if (item.direction === 'in') {
        totalIn += item.tutar;
        if (item.diffDays < 0) overdueIn += item.tutar;
        else if (item.diffDays <= 30) next30In += item.tutar;
      } else {
        totalOut += item.tutar;
        if (item.diffDays < 0) overdueOut += item.tutar;
        else if (item.diffDays <= 30) next30Out += item.tutar;
      }
    });

    const projectedLiquidity = currentLiquidity + totalIn - totalOut;

    return {
      currentLiquidity,
      overdueIn,
      overdueOut,
      next30In,
      next30Out,
      totalIn,
      totalOut,
      projectedLiquidity,
      netFlow30: next30In - next30Out
    };
  }, [cashFlowItems, currentLiquidity]);

  // 4. Günlük Kümülatif Projeksiyon Grafiği Verisi
  const chartData = useMemo(() => {
    const daysMap = new Map<string, { inAmount: number; outAmount: number; label: string }>();
    const today = new Date();

    // Önümüzdeki N günü oluştur
    for (let i = 0; i <= projectionDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
      daysMap.set(dateStr, { inAmount: 0, outAmount: 0, label });
    }

    // Geçmişteki vadesi geçen kalemleri bugüne (0. güne) ekle
    const todayStr = today.toISOString().split('T')[0];
    cashFlowItems.forEach(item => {
      if (item.diffDays < 0) {
        const todayEntry = daysMap.get(todayStr);
        if (todayEntry) {
          if (item.direction === 'in') todayEntry.inAmount += item.tutar;
          else todayEntry.outAmount += item.tutar;
        }
      } else if (daysMap.has(item.vadeTarihi)) {
        const entry = daysMap.get(item.vadeTarihi)!;
        if (item.direction === 'in') entry.inAmount += item.tutar;
        else entry.outAmount += item.tutar;
      }
    });

    // Kümülatif bakiye hesapla
    let runningBalance = currentLiquidity;
    const result: Array<{
      date: string;
      label: string;
      bakiye: number;
      giris: number;
      cikis: number;
    }> = [];

    daysMap.forEach((val, dateStr) => {
      runningBalance = runningBalance + val.inAmount - val.outAmount;
      result.push({
        date: dateStr,
        label: val.label,
        bakiye: Math.round(runningBalance),
        giris: Math.round(val.inAmount),
        cikis: Math.round(val.outAmount)
      });
    });

    return result;
  }, [cashFlowItems, currentLiquidity, projectionDays]);

  // 5. Filtrelenmiş Liste
  const filteredList = useMemo(() => {
    return cashFlowItems.filter(item => {
      if (filterType === 'overdue' && item.diffDays >= 0) return false;
      if (filterType === 'this_week' && (item.diffDays < 0 || item.diffDays > 7)) return false;
      if (filterType === 'in' && item.direction !== 'in') return false;
      if (filterType === 'out' && item.direction !== 'out') return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          item.cariAdi.toLowerCase().includes(q) ||
          item.belgeNo.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cashFlowItems, filterType, searchTerm]);

  // 6. Takvim Günleri Hesaplama
  const calendarDays = useMemo(() => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayIndex = (firstDay.getDay() + 6) % 7; // Pazartesi 0
    const totalDays = lastDay.getDate();

    const days = [];
    // Boş günler
    for (let i = 0; i < startingDayIndex; i++) {
      days.push({ dayNumber: null, dateStr: '', items: [] });
    }

    // Ayın günleri
    for (let d = 1; d <= totalDays; d++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const fullDateStr = `${year}-${monthStr}-${dayStr}`;
      const dayItems = cashFlowItems.filter(item => item.vadeTarihi === fullDateStr);

      const inTotal = dayItems.filter(i => i.direction === 'in').reduce((acc, i) => acc + i.tutar, 0);
      const outTotal = dayItems.filter(i => i.direction === 'out').reduce((acc, i) => acc + i.tutar, 0);

      days.push({
        dayNumber: d,
        dateStr: fullDateStr,
        items: dayItems,
        inTotal,
        outTotal
      });
    }

    return days;
  }, [currentCalendarDate, cashFlowItems]);

  // Hızlı Fatura Kapama (Ödendi yapma)
  const handleMarkAsPaid = (item: CashFlowItem) => {
    const today = new Date().toISOString().split('T')[0];
    if (item.sourceType === 'satis_faturasi') {
      updateSatisFaturaOdeme(item.rawRef.id, today, 'ODENDI' as any);
      toast.success(`Satış faturası (${item.belgeNo}) ödendi olarak işaretlendi.`);
    } else if (item.sourceType === 'alis_faturasi') {
      updateAlisFaturaOdeme(item.rawRef.id, today, 'odendi');
      toast.success(`Alış faturası (${item.belgeNo}) ödendi olarak işaretlendi.`);
    }
  };

  // Hatırlatma Metni Oluşturma
  const reminderMessage = useMemo(() => {
    if (!reminderItem) return '';
    const banka = bankaHesaplari[0];
    const delayText = reminderItem.diffDays < 0 
      ? `${Math.abs(reminderItem.diffDays)} gün önce dolmuştur` 
      : reminderItem.diffDays === 0 
      ? 'bugün dolmaktadır' 
      : `${reminderItem.diffDays} gün sonra dolacaktır`;

    return `Sayın ${reminderItem.cariAdi},

Şirketimizce düzenlenen ${reminderItem.belgeNo} numaralı ve ${reminderItem.vadeTarihi} vadeli, ${reminderItem.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ tutarındaki faturanızın vadesi ${delayText}.

Ödemenizi aşağıdaki şirket hesabımıza iletmenizi rica ederiz:
${banka ? `Banka: ${banka.bankaAdi}\nIBAN: ${banka.iban}` : ''}

Bilgilerinize sunar, iyi çalışmalar dileriz.`;
  }, [reminderItem, bankaHesaplari]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(reminderMessage);
    setCopied(true);
    toast.success('Hatırlatma metni panoya kopyalandı.');
    setTimeout(() => setCopied(false), 2500);
  };

  const openWhatsAppWeb = () => {
    const encoded = encodeURIComponent(reminderMessage);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-24">
      {/* Üst Başlık & Aksiyonlar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            Nakit Akışı & Vade Takvimi
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Gelecek tahsilatları, fatura vadelerini ve çek/senetleri nakit projeksiyonuyla izleyin.
          </p>
        </div>

        {/* Görünüm Değiştirici */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
          <Button
            size="sm"
            variant={activeTab === 'genel' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('genel')}
            className="text-xs h-8 rounded-lg"
          >
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Projeksiyon & Grafikler
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'takvim' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('takvim')}
            className="text-xs h-8 rounded-lg"
          >
            <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
            Vade Takvimi
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'liste' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('liste')}
            className="text-xs h-8 rounded-lg"
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Tüm Vadeler ({cashFlowItems.length})
          </Button>
        </div>
      </div>

      {/* ==================== 1. KPI FİNANSAL ÖZET KARTLARI ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Kart 1: Mevcut Likidite */}
        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <div className="h-1.5 bg-blue-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mevcut Likidite</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {summary.currentLiquidity.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {bankaHesaplari.length} aktif banka hesabı bakiyesi
            </div>
          </CardContent>
        </Card>

        {/* Kart 2: Beklenen Tahsilatlar */}
        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <div className="h-1.5 bg-emerald-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gelecek Girişler</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">
              +{summary.next30In.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </div>
            <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
              <span>Gelecek 30 gün içinde</span>
              {summary.overdueIn > 0 && (
                <span className="text-rose-600 font-semibold" title="Vadesi geçen açık alacaklar">
                  {summary.overdueIn.toLocaleString('tr-TR', { minimumFractionDigits: 0 })} ₺ Gecikmiş
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Kart 3: Beklenen Ödemeler */}
        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <div className="h-1.5 bg-rose-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gelecek Çıkışlar</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-600">
              -{summary.next30Out.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </div>
            <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
              <span>Alış faturası & çek ödemeleri</span>
              {summary.overdueOut > 0 && (
                <span className="text-rose-600 font-semibold">
                  {summary.overdueOut.toLocaleString('tr-TR', { minimumFractionDigits: 0 })} ₺ Vadesi Geçmiş
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Kart 4: Net Projeksiyon */}
        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <div className={`h-1.5 ${summary.projectedLiquidity >= 0 ? 'bg-indigo-600' : 'bg-rose-600'}`} />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Projeksiyon Bakiye</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${summary.projectedLiquidity >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                {summary.projectedLiquidity >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
            </div>
            <div className={`mt-2 text-2xl font-bold ${summary.projectedLiquidity >= 0 ? 'text-indigo-900' : 'text-rose-600'}`}>
              {summary.projectedLiquidity.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Tüm açık kalemler tahsil edilip ödendiğinde
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ==================== 2. GENEL BAKIŞ & GRAFİKLER ==================== */}
      {activeTab === 'genel' && (
        <div className="space-y-6">
          {/* Grafik 1: Kümülatif Nakit Dengesi */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Kümülatif Nakit Likiditesi Projeksiyonu
                </CardTitle>
                <CardDescription className="text-xs">
                  Gelecek günlerde kasanızda kalması beklenen tahmini nakit dengesi.
                </CardDescription>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <Button 
                  size="sm" 
                  variant={projectionDays === 30 ? 'default' : 'ghost'} 
                  onClick={() => setProjectionDays(30)}
                  className="text-xs h-7 px-2.5 rounded-md"
                >
                  30 Gün
                </Button>
                <Button 
                  size="sm" 
                  variant={projectionDays === 60 ? 'default' : 'ghost'} 
                  onClick={() => setProjectionDays(60)}
                  className="text-xs h-7 px-2.5 rounded-md"
                >
                  60 Gün
                </Button>
                <Button 
                  size="sm" 
                  variant={projectionDays === 90 ? 'default' : 'ghost'} 
                  onClick={() => setProjectionDays(90)}
                  className="text-xs h-7 px-2.5 rounded-md"
                >
                  90 Gün
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBakiye" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      tickLine={false}
                      tickFormatter={(val) => `${(val / 1000).toFixed(0)}k ₺`} 
                    />
                    <Tooltip 
                      formatter={(val: any) => [`${Number(val).toLocaleString('tr-TR')} ₺`, 'Tahmini Bakiye']}
                      labelFormatter={(label) => `Tarih: ${label}`}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="bakiye" 
                      stroke="#4f46e5" 
                      strokeWidth={2.5} 
                      fillOpacity={1} 
                      fill="url(#colorBakiye)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Grafik 2: Günlük Beklenen Giriş vs Çıkış */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                Günlük Beklenen Nakit Giriş & Çıkış Dağılımı
              </CardTitle>
              <CardDescription className="text-xs">
                Önümüzdeki günlerde hangi tarihlerde yüksek ödeme veya tahsilat yoğunluğu olduğunu görün.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      tickLine={false}
                      tickFormatter={(val) => `${(val / 1000).toFixed(0)}k ₺`} 
                    />
                    <Tooltip 
                      formatter={(val: any, name: any) => [
                        `${Number(val).toLocaleString('tr-TR')} ₺`, 
                        name === 'giris' ? 'Beklenen Tahsilat' : 'Beklenen Ödeme'
                      ]}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right"
                      wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }}
                      formatter={(val) => val === 'giris' ? 'Girişler (Tahsilat)' : 'Çıkışlar (Ödeme)'}
                    />
                    <Bar dataKey="giris" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="cikis" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== 3. VADE TAKVİMİ GÖRÜNÜMÜ ==================== */}
      {activeTab === 'takvim' && (
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold text-slate-800">
                {currentCalendarDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }).toUpperCase()}
              </h3>
              <Badge variant="outline" className="text-xs bg-white text-slate-600">
                {calendarDays.filter(d => d.items.length > 0).length} gün hareket var
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const d = new Date(currentCalendarDate);
                  d.setMonth(d.getMonth() - 1);
                  setCurrentCalendarDate(d);
                }}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentCalendarDate(new Date())}
                className="h-8 text-xs px-2.5"
              >
                Bugün
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const d = new Date(currentCalendarDate);
                  d.setMonth(d.getMonth() + 1);
                  setCurrentCalendarDate(d);
                }}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Haftanın Günleri */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
              <div>Pzt</div>
              <div>Sal</div>
              <div>Çar</div>
              <div>Per</div>
              <div>Cum</div>
              <div>Cmt</div>
              <div>Paz</div>
            </div>

            {/* Gün Hücreleri */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((cell, idx) => {
                if (!cell.dayNumber) {
                  return <div key={`empty_${idx}`} className="min-h-[90px] bg-slate-50/40 rounded-xl" />;
                }

                const isToday = cell.dateStr === new Date().toISOString().split('T')[0];
                const hasIn = cell.inTotal && cell.inTotal > 0;
                const hasOut = cell.outTotal && cell.outTotal > 0;

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => {
                      if (cell.items.length > 0) {
                        setSelectedCalendarDayItems({ dayStr: cell.dateStr, items: cell.items });
                      }
                    }}
                    className={`min-h-[95px] p-2 rounded-xl border transition-all flex flex-col justify-between ${
                      cell.items.length > 0 ? 'cursor-pointer hover:border-indigo-400 hover:shadow-sm' : ''
                    } ${isToday ? 'border-indigo-500 bg-indigo-50/20 ring-1 ring-indigo-500' : 'border-slate-100 bg-white'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-slate-700'}`}>
                        {cell.dayNumber}
                      </span>
                      {cell.items.length > 0 && (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-full">
                          {cell.items.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 mt-1">
                      {hasIn && (
                        <div className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded px-1.5 py-0.5 text-[10px] font-bold truncate">
                          +{cell.inTotal!.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                        </div>
                      )}
                      {hasOut && (
                        <div className="bg-rose-50 text-rose-700 border border-rose-200/60 rounded px-1.5 py-0.5 text-[10px] font-bold truncate">
                          -{cell.outTotal!.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================== 4. TÜM VADE KALEMLERİ LİSTESİ ==================== */}
      {activeTab === 'liste' && (
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">Vade ve Tahsilat Listesi</CardTitle>
                <CardDescription className="text-xs">
                  Vadesi yaklaşan faturaları ve çekleri filtreleyin, tek tıkla müşteriye hatırlatma iletin.
                </CardDescription>
              </div>

              {/* Arama & Filtreler */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Cari veya fatura no ara..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-48 h-8 text-xs bg-slate-50"
                />
              </div>
            </div>

            {/* Hızlı Filtre Butonları */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
              <Button
                size="sm"
                variant={filterType === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterType('all')}
                className="text-xs h-7 px-2.5 rounded-lg"
              >
                Tümü ({cashFlowItems.length})
              </Button>
              <Button
                size="sm"
                variant={filterType === 'overdue' ? 'default' : 'outline'}
                onClick={() => setFilterType('overdue')}
                className="text-xs h-7 px-2.5 rounded-lg text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 gap-1"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Vadesi Geçenler ({cashFlowItems.filter(i => i.diffDays < 0).length})
              </Button>
              <Button
                size="sm"
                variant={filterType === 'this_week' ? 'default' : 'outline'}
                onClick={() => setFilterType('this_week')}
                className="text-xs h-7 px-2.5 rounded-lg"
              >
                Bu Hafta ({cashFlowItems.filter(i => i.diffDays >= 0 && i.diffDays <= 7).length})
              </Button>
              <Button
                size="sm"
                variant={filterType === 'in' ? 'default' : 'outline'}
                onClick={() => setFilterType('in')}
                className="text-xs h-7 px-2.5 rounded-lg text-emerald-700 bg-emerald-50 border-emerald-200"
              >
                Tahsilatlar (Giriş)
              </Button>
              <Button
                size="sm"
                variant={filterType === 'out' ? 'default' : 'outline'}
                onClick={() => setFilterType('out')}
                className="text-xs h-7 px-2.5 rounded-lg text-rose-700 bg-rose-50 border-rose-200"
              >
                Ödemeler (Çıkış)
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/60">
                    <TableHead className="w-36 text-xs font-bold">Belge Türü</TableHead>
                    <TableHead className="text-xs font-bold">Cari / Müşteri</TableHead>
                    <TableHead className="w-28 text-xs font-bold">Belge No</TableHead>
                    <TableHead className="w-28 text-xs font-bold">Vade Tarihi</TableHead>
                    <TableHead className="w-32 text-xs font-bold">Kalan Süre</TableHead>
                    <TableHead className="text-right w-36 text-xs font-bold">Tutar</TableHead>
                    <TableHead className="text-right w-44 text-xs font-bold">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                        Filtreye uygun bekleyen vade kalemi bulunamadı.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredList.map(item => {
                      const isOverdue = item.diffDays < 0;
                      const isToday = item.diffDays === 0;

                      return (
                        <TableRow key={item.id} className="hover:bg-slate-50/80">
                          {/* Tür */}
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              {item.direction === 'in' ? (
                                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                  <ArrowDownLeft className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <span className="text-xs font-semibold text-slate-700 truncate max-w-[110px]" title={item.title}>
                                {item.title}
                              </span>
                            </div>
                          </TableCell>

                          {/* Cari */}
                          <TableCell className="text-xs font-medium text-slate-800">
                            {item.cariAdi}
                          </TableCell>

                          {/* Belge No */}
                          <TableCell className="text-xs font-mono text-slate-600">
                            {item.belgeNo || '-'}
                          </TableCell>

                          {/* Vade Tarihi */}
                          <TableCell className="text-xs font-medium text-slate-700">
                            {item.vadeTarihi}
                          </TableCell>

                          {/* Kalan Gün Rozeti */}
                          <TableCell>
                            {isOverdue ? (
                              <Badge className="bg-rose-100 text-rose-700 border-rose-300 text-[10px] font-bold">
                                {Math.abs(item.diffDays)} Gün Gecikti
                              </Badge>
                            ) : isToday ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold animate-pulse">
                                Bugün Vadesi
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-medium">
                                {item.diffDays} Gün Kaldı
                              </Badge>
                            )}
                          </TableCell>

                          {/* Tutar */}
                          <TableCell className="text-right font-bold text-xs">
                            <span className={item.direction === 'in' ? 'text-emerald-700' : 'text-rose-700'}>
                              {item.direction === 'in' ? '+' : '-'}
                              {item.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                            </span>
                          </TableCell>

                          {/* Aksiyonlar */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.direction === 'in' && item.sourceType === 'satis_faturasi' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setReminderItem(item)}
                                  className="h-7 px-2 text-[11px] text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1"
                                  title="Müşteriye Vade Hatırlat"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  Hatırlat
                                </Button>
                              )}
                              {(item.sourceType === 'satis_faturasi' || item.sourceType === 'alis_faturasi') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setPartialModalTarget({
                                    fatura: item.rawRef,
                                    tip: item.sourceType === 'satis_faturasi' ? 'satis' : 'alis'
                                  })}
                                  className="h-7 px-2 text-[11px] text-amber-700 border-amber-200 hover:bg-amber-50 gap-1"
                                  title="Parçalı Ödeme / Tahsilat Gir"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  Kısmi
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkAsPaid(item)}
                                className="h-7 px-2 text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1"
                                title="Ödendi olarak kapat"
                              >
                                <Check className="w-3 h-3" />
                                Ödendi
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================== TAKVİM GÜNÜ DETAY MODAL ==================== */}
      <Dialog 
        open={Boolean(selectedCalendarDayItems)} 
        onOpenChange={() => setSelectedCalendarDayItems(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-indigo-600" />
              {selectedCalendarDayItems?.dayStr} Vadesi Dolan Kalemler
            </DialogTitle>
            <DialogDescription className="text-xs">
              Bu tarihte vadesi gelen tahsilat ve ödeme hareketleri.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 max-h-80 overflow-y-auto py-2">
            {selectedCalendarDayItems?.items.map(item => (
              <div 
                key={item.id}
                className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    item.direction === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {item.direction === 'in' ? '+' : '-'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{item.cariAdi}</div>
                    <div className="text-[11px] text-slate-500">{item.title} ({item.belgeNo})</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-sm font-bold ${item.direction === 'in' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {item.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </div>
                  <div className="flex items-center gap-2 justify-end mt-0.5">
                    {(item.sourceType === 'satis_faturasi' || item.sourceType === 'alis_faturasi') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPartialModalTarget({
                            fatura: item.rawRef,
                            tip: item.sourceType === 'satis_faturasi' ? 'satis' : 'alis'
                          });
                          setSelectedCalendarDayItems(null);
                        }}
                        className="h-6 text-[10px] text-amber-700 hover:text-amber-800 p-0"
                      >
                        Kısmi Öde
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        handleMarkAsPaid(item);
                        setSelectedCalendarDayItems(null);
                      }}
                      className="h-6 text-[10px] text-slate-500 hover:text-emerald-700 p-0"
                    >
                      Ödendi Yap
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== AKILLI VADE HATIRLATICI DİALOG ==================== */}
      <Dialog open={Boolean(reminderItem)} onOpenChange={() => setReminderItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Vade ve Tahsilat Hatırlatıcısı
            </DialogTitle>
            <DialogDescription className="text-xs">
              Müşterinize vadesi yaklaşan veya geçen faturası için otomatik şablon mesajı gönderin.
            </DialogDescription>
          </DialogHeader>

          {reminderItem && (
            <div className="space-y-4 pt-2">
              {/* Bilgi Kutusu */}
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-indigo-950">{reminderItem.cariAdi}</div>
                  <div className="text-indigo-700">Fatura No: {reminderItem.belgeNo}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-indigo-900">
                    {reminderItem.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </div>
                  <div className="text-[11px] text-indigo-600">Vade: {reminderItem.vadeTarihi}</div>
                </div>
              </div>

              {/* Mesaj Şablonu */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Oluşturulan Hatırlatma Metni:</label>
                <textarea
                  readOnly
                  value={reminderMessage}
                  rows={8}
                  className="w-full text-xs p-3 rounded-lg border border-slate-200 bg-slate-50 font-sans focus:outline-none leading-relaxed"
                />
              </div>

              {/* Aksiyon Butonları */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <Button
                  onClick={copyToClipboard}
                  variant="outline"
                  className="w-full sm:flex-1 text-xs h-9 gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Kopyalandı!' : 'Metni Kopyala'}
                </Button>

                <Button
                  onClick={openWhatsAppWeb}
                  className="w-full sm:flex-1 text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  WhatsApp'ta Aç
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================== PARÇALI ÖDEME MODAL ==================== */}
      <ParcaliOdemeModal
        isOpen={Boolean(partialModalTarget)}
        onClose={() => setPartialModalTarget(null)}
        fatura={partialModalTarget?.fatura || null}
        faturaTipi={partialModalTarget?.tip || 'satis'}
        onSuccess={() => {
          if (fetchSatisFaturalari) fetchSatisFaturalari();
          if (fetchAlisFaturalari) fetchAlisFaturalari();
          if (fetchCariHareketler) fetchCariHareketler();
        }}
      />
    </div>
  );
}
