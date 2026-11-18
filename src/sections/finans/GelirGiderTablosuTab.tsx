import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { AYLAR } from '@/types';
import { FileSpreadsheet, PieChart, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const OPERASYONEL_GIDER_TURLERI: Record<string, string> = {
  maas_odemesi: 'Personel Maaş Ödemeleri',
  kira_odemesi: 'Kira Giderleri',
  banka_masrafi: 'Banka & Komisyon Masrafları',
  ssk_odemesi: 'SGK / Prim Ödemeleri',
  genel_gider: 'Genel İşletme Giderleri',
  vergi_damga: 'Damga Vergisi',
};

export function GelirGiderTablosuTab() {
  const { satisFaturalari, alisFaturalari, cariHareketler, giderKategorileri } = useApp();
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear());

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v);

  const availableYillar = useMemo(() => {
    const s = new Set<number>([new Date().getFullYear()]);
    satisFaturalari.forEach((f) => {
      if (f.faturaTarihi) {
        const y = parseInt(f.faturaTarihi.substring(0, 4), 10);
        if (!isNaN(y)) s.add(y);
      }
    });
    alisFaturalari.forEach((f) => {
      if (f.faturaTarihi) {
        const y = parseInt(f.faturaTarihi.substring(0, 4), 10);
        if (!isNaN(y)) s.add(y);
      }
    });
    return Array.from(s).sort((a, b) => b - a);
  }, [satisFaturalari, alisFaturalari]);

  const summary = useMemo(() => {
    const months = AYLAR.map((a) => ({
      ay: a.value,
      ayAdi: a.label,
      satisMatrah: 0,
      digerGelir: 0,
      alisMatrah: 0,
      operasyonelGider: 0,
      kkegOiv: 0,
    }));

    const kategoriMap = new Map<string, number>();

    satisFaturalari.forEach((f) => {
      if (!f.faturaTarihi) return;
      const d = new Date(f.faturaTarihi);
      if (d.getFullYear() === selectedYil) {
        months[d.getMonth()].satisMatrah += Number(f.matrah) || 0;
      }
    });

    alisFaturalari.forEach((f) => {
      if (!f.faturaTarihi) return;
      const d = new Date(f.faturaTarihi);
      if (d.getFullYear() === selectedYil) {
        const idx = d.getMonth();
        const matrah = Number(f.matrah) || 0;
        const oiv = Number(f.oivTutari) || 0;
        months[idx].alisMatrah += matrah;
        months[idx].kkegOiv += oiv;

        const katId = (f as any).giderKategorisiId || (f as any).kategoriId;
        const katName =
          giderKategorileri.find((k) => k.id === katId)?.ad ||
          (f.muhasebeKodu ? `Hesap ${f.muhasebeKodu}` : 'Alış Faturaları & Mal/Hizmet');
        kategoriMap.set(katName, (kategoriMap.get(katName) || 0) + matrah);
      }
    });

    cariHareketler.forEach((h) => {
      if (!h.tarih) return;
      const d = new Date(h.tarih);
      if (d.getFullYear() !== selectedYil) return;
      const idx = d.getMonth();
      const tutar = Number(h.tutar) || 0;

      if (h.islemTuru === 'diger_gelir') {
        months[idx].digerGelir += tutar;
      } else if (OPERASYONEL_GIDER_TURLERI[h.islemTuru]) {
        months[idx].operasyonelGider += tutar;
        const label = OPERASYONEL_GIDER_TURLERI[h.islemTuru];
        kategoriMap.set(label, (kategoriMap.get(label) || 0) + tutar);
      }
    });

    const rows = months.map((m) => {
      const toplamGelir = m.satisMatrah + m.digerGelir;
      const toplamGider = m.alisMatrah + m.operasyonelGider + m.kkegOiv;
      const netKar = toplamGelir - toplamGider;
      const marj = toplamGelir > 0 ? (netKar / toplamGelir) * 100 : 0;
      return { ...m, toplamGelir, toplamGider, netKar, marj };
    });

    const totals = rows.reduce(
      (acc, r) => ({
        toplamGelir: acc.toplamGelir + r.toplamGelir,
        alisMatrah: acc.alisMatrah + r.alisMatrah,
        operasyonelGider: acc.operasyonelGider + r.operasyonelGider,
        kkegOiv: acc.kkegOiv + r.kkegOiv,
        toplamGider: acc.toplamGider + r.toplamGider,
        netKar: acc.netKar + r.netKar,
      }),
      {
        toplamGelir: 0,
        alisMatrah: 0,
        operasyonelGider: 0,
        kkegOiv: 0,
        toplamGider: 0,
        netKar: 0,
      }
    );

    const kategoriler = Array.from(kategoriMap.entries())
      .map(([ad, tutar]) => ({ ad, tutar }))
      .sort((a, b) => b.tutar - a.tutar);

    return { rows, totals, kategoriler };
  }, [satisFaturalari, alisFaturalari, cariHareketler, giderKategorileri, selectedYil]);

  const exportExcel = () => {
    const excelRows = summary.rows.map((r) => ({
      Ay: r.ayAdi,
      'Satış Geliri (Matrah)': Number(r.satisMatrah.toFixed(2)),
      'Diğer Gelir': Number(r.digerGelir.toFixed(2)),
      'Toplam Gelir': Number(r.toplamGelir.toFixed(2)),
      'Alış / Malzeme Maliyeti': Number(r.alisMatrah.toFixed(2)),
      'Operasyonel Gider (Maaş/Kira/Banka)': Number(r.operasyonelGider.toFixed(2)),
      'ÖİV / KKEG': Number(r.kkegOiv.toFixed(2)),
      'Toplam Gider': Number(r.toplamGider.toFixed(2)),
      'Net Faaliyet Kârı/Zararı': Number(r.netKar.toFixed(2)),
      'Kâr Marjı (%)': Number(r.marj.toFixed(1)),
    }));
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gelir Gider Tablosu');
    XLSX.writeFile(wb, `Gelir_Gider_Tablosu_${selectedYil}.xlsx`);
    toast.success('Gelir-Gider tablosu Excel olarak indirildi.');
  };

  const genelMarj =
    summary.totals.toplamGelir > 0
      ? (summary.totals.netKar / summary.totals.toplamGelir) * 100
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Dönem Yılı:</span>
          <Select value={selectedYil.toString()} onValueChange={(v) => setSelectedYil(parseInt(v, 10))}>
            <SelectTrigger className="w-28 bg-white h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYillar.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportExcel}
          className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50 h-9"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Excel
        </Button>
      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> {selectedYil} Toplam Gelir (KDV Hariç)
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatCurrency(summary.totals.toplamGelir)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-red-700 font-medium flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" /> {selectedYil} Toplam Gider &amp; Maliyet
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatCurrency(summary.totals.toplamGider)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-indigo-700 font-medium flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" /> Net Faaliyet Kârı / Zararı
            </p>
            <p
              className={cn(
                'text-2xl font-bold mt-1',
                summary.totals.netKar >= 0 ? 'text-emerald-700' : 'text-red-700'
              )}
            >
              {formatCurrency(summary.totals.netKar)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Kâr Marjı: %{genelMarj.toFixed(1)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Aylık Gelir-Gider Tablosu */}
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base">{selectedYil} Aylık Özet Gelir–Gider Tablosu</CardTitle>
          <CardDescription className="text-xs">
            Satış/Alış fatura matrahları ile maaş, kira, SGK ve banka masraflarını birleştirir.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr>
                <th className="text-left py-2.5 px-4 font-semibold">Ay</th>
                <th className="text-right py-2.5 px-3 font-semibold text-emerald-700">Gelir (Matrah)</th>
                <th className="text-right py-2.5 px-3 font-semibold">Alış Maliyeti</th>
                <th className="text-right py-2.5 px-3 font-semibold">Operasyonel Gider</th>
                <th className="text-right py-2.5 px-3 font-semibold text-amber-700">KKEG / ÖİV</th>
                <th className="text-right py-2.5 px-3 font-semibold">Net Kâr / Zarar</th>
                <th className="text-right py-2.5 px-4 font-semibold">Marj %</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summary.rows.map((r) => (
                <tr key={r.ay} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-medium text-slate-900">{r.ayAdi}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                    {formatCurrency(r.toplamGelir)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(r.alisMatrah)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                    {formatCurrency(r.operasyonelGider)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-700">
                    {r.kkegOiv > 0 ? formatCurrency(r.kkegOiv) : '-'}
                  </td>
                  <td
                    className={cn(
                      'py-2.5 px-3 text-right font-mono font-semibold',
                      r.netKar >= 0 ? 'text-emerald-700' : 'text-red-700'
                    )}
                  >
                    {formatCurrency(r.netKar)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                    %{r.marj.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 border-t font-bold text-slate-900">
              <tr>
                <td className="py-3 px-4">YILLIK TOPLAM</td>
                <td className="py-3 px-3 text-right font-mono text-emerald-700">
                  {formatCurrency(summary.totals.toplamGelir)}
                </td>
                <td className="py-3 px-3 text-right font-mono">
                  {formatCurrency(summary.totals.alisMatrah)}
                </td>
                <td className="py-3 px-3 text-right font-mono">
                  {formatCurrency(summary.totals.operasyonelGider)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-amber-700">
                  {formatCurrency(summary.totals.kkegOiv)}
                </td>
                <td
                  className={cn(
                    'py-3 px-3 text-right font-mono',
                    summary.totals.netKar >= 0 ? 'text-emerald-700' : 'text-red-700'
                  )}
                >
                  {formatCurrency(summary.totals.netKar)}
                </td>
                <td className="py-3 px-4 text-right font-mono">%{genelMarj.toFixed(1)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Gider Dağılımı */}
      {summary.kategoriler.length > 0 && (
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-600" />
              Gider &amp; Maliyet Dağılımı ({selectedYil})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {summary.kategoriler.slice(0, 10).map((k) => {
              const pay =
                summary.totals.toplamGider > 0
                  ? (k.tutar / summary.totals.toplamGider) * 100
                  : 0;
              return (
                <div key={k.ad} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{k.ad}</span>
                    <span className="font-mono text-slate-900">
                      {formatCurrency(k.tutar)} <span className="text-slate-400">(%{pay.toFixed(1)})</span>
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.min(100, pay)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
