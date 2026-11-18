import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { FileSpreadsheet, Search, Users, AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AgingRow {
  cariKey: string;
  cariId?: string;
  cariAdi: string;
  vkn: string;
  faturaAdet: number;
  vadesiGelmemis: number;
  gun1_30: number;
  gun31_60: number;
  gun61_90: number;
  gun90Plus: number;
  toplam: number;
  enEskiGecikme: number;
}

export function CariYaslandirmaTab() {
  const { satisFaturalari, alisFaturalari, cariler, openCariEkstreDrawer } = useApp();
  const [mode, setMode] = useState<'alacak' | 'borc'>('alacak');
  const [search, setSearch] = useState('');

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v);

  const agingData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const map = new Map<string, AgingRow>();

    const addInvoice = (
      cariId: string | undefined,
      cariAdi: string,
      vkn: string,
      vadeTarihiStr: string | null | undefined,
      faturaTarihiStr: string,
      openAmount: number
    ) => {
      if (openAmount <= 0.01) return;
      const vadeStr = vadeTarihiStr || faturaTarihiStr || today.toISOString().split('T')[0];
      const vadeDate = new Date(vadeStr);
      vadeDate.setHours(0, 0, 0, 0);
      const gecikmeGun = Math.floor((today.getTime() - vadeDate.getTime()) / (1000 * 60 * 60 * 24));

      const matchedCari = cariId ? cariler.find((c) => c.id === cariId) : undefined;
      const resolvedAdi = matchedCari?.unvan || cariAdi || 'Tanımsız Cari';
      const resolvedVkn = matchedCari?.vknTckn || vkn || '';
      const key = cariId || `${resolvedVkn}_${resolvedAdi.toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          cariKey: key,
          cariId,
          cariAdi: resolvedAdi,
          vkn: resolvedVkn,
          faturaAdet: 0,
          vadesiGelmemis: 0,
          gun1_30: 0,
          gun31_60: 0,
          gun61_90: 0,
          gun90Plus: 0,
          toplam: 0,
          enEskiGecikme: 0,
        });
      }

      const row = map.get(key)!;
      row.faturaAdet += 1;
      row.toplam += openAmount;

      if (gecikmeGun <= 0) {
        row.vadesiGelmemis += openAmount;
      } else if (gecikmeGun <= 30) {
        row.gun1_30 += openAmount;
      } else if (gecikmeGun <= 60) {
        row.gun31_60 += openAmount;
      } else if (gecikmeGun <= 90) {
        row.gun61_90 += openAmount;
      } else {
        row.gun90Plus += openAmount;
      }

      if (gecikmeGun > row.enEskiGecikme) {
        row.enEskiGecikme = gecikmeGun;
      }
    };

    if (mode === 'alacak') {
      satisFaturalari
        .filter((f) => f.odemeDurumu !== 'odendi')
        .forEach((f) => {
          const total = Number(f.alinanUcret || 0);
          const openAmount =
            f.kalanTutar !== undefined && f.kalanTutar !== null && (f.odenenTutar ?? 0) > 0
              ? Number(f.kalanTutar)
              : total;
          const adi = f.ad ? `${f.ad} ${f.soyad || ''}`.trim() : 'Müşteri';
          addInvoice(f.cariId, adi, f.tcVkn, f.vadeTarihi, f.faturaTarihi, openAmount);
        });
    } else {
      alisFaturalari
        .filter((f) => f.odemeDurumu !== 'odendi')
        .forEach((f) => {
          const total = Number(f.toplamTutar || 0);
          const openAmount =
            f.kalanTutar !== undefined && f.kalanTutar !== null && (f.odenenTutar ?? 0) > 0
              ? Number(f.kalanTutar)
              : total;
          addInvoice(
            f.cariId,
            f.tedarikciAdi || 'Tedarikçi',
            f.tedarikciVkn,
            f.vadeTarihi,
            f.faturaTarihi,
            openAmount
          );
        });
    }

    const q = search.trim().toLowerCase();
    const rows = Array.from(map.values())
      .filter(
        (r) =>
          !q ||
          r.cariAdi.toLowerCase().includes(q) ||
          r.vkn.toLowerCase().includes(q)
      )
      .sort((a, b) => b.toplam - a.toplam);

    const totals = rows.reduce(
      (acc, r) => ({
        vadesiGelmemis: acc.vadesiGelmemis + r.vadesiGelmemis,
        gun1_30: acc.gun1_30 + r.gun1_30,
        gun31_60: acc.gun31_60 + r.gun31_60,
        gun61_90: acc.gun61_90 + r.gun61_90,
        gun90Plus: acc.gun90Plus + r.gun90Plus,
        toplam: acc.toplam + r.toplam,
      }),
      { vadesiGelmemis: 0, gun1_30: 0, gun31_60: 0, gun61_90: 0, gun90Plus: 0, toplam: 0 }
    );

    return { rows, totals };
  }, [mode, satisFaturalari, alisFaturalari, cariler, search]);

  const gecikmisToplam =
    agingData.totals.gun1_30 +
    agingData.totals.gun31_60 +
    agingData.totals.gun61_90 +
    agingData.totals.gun90Plus;

  const exportExcel = () => {
    const excelRows = agingData.rows.map((r) => ({
      'Cari Ünvanı': r.cariAdi,
      'VKN / T.C.': r.vkn,
      'Açık Fatura': r.faturaAdet,
      'Vadesi Gelmemiş (TL)': Number(r.vadesiGelmemis.toFixed(2)),
      '1-30 Gün Gecikmiş (TL)': Number(r.gun1_30.toFixed(2)),
      '31-60 Gün Gecikmiş (TL)': Number(r.gun31_60.toFixed(2)),
      '61-90 Gün Gecikmiş (TL)': Number(r.gun61_90.toFixed(2)),
      '90+ Gün Kritik (TL)': Number(r.gun90Plus.toFixed(2)),
      'Toplam Açık Bakiye (TL)': Number(r.toplam.toFixed(2)),
      'En Eski Gecikme (Gün)': r.enEskiGecikme,
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cari Yaşlandırma');
    XLSX.writeFile(wb, `Cari_Yaslandirma_${mode === 'alacak' ? 'Alacaklar' : 'Borclar'}.xlsx`);
    toast.success('Cari yaşlandırma raporu Excel olarak indirildi.');
  };

  return (
    <div className="space-y-6">
      {/* Üst Filtre & Özet */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm w-fit">
          <Button
            type="button"
            size="sm"
            variant={mode === 'alacak' ? 'default' : 'ghost'}
            onClick={() => setMode('alacak')}
          >
            Müşteri Alacakları (Satış)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'borc' ? 'default' : 'ghost'}
            onClick={() => setMode('borc')}
          >
            Tedarikçi Borçları (Alış)
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ünvanı veya VKN ara..."
              className="pl-9 h-9 bg-white"
            />
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
      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 font-medium">
              Toplam Açık {mode === 'alacak' ? 'Alacak' : 'Borç'}
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {formatCurrency(agingData.totals.toplam)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">{agingData.rows.length} cari hesap</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Vadesi Gelmemiş
            </p>
            <p className="text-xl font-bold text-emerald-700 mt-1">
              {formatCurrency(agingData.totals.vadesiGelmemis)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-amber-50/50 border-amber-200">
          <CardContent className="p-4">
            <p className="text-xs text-amber-800 font-medium">Toplam Vadesi Geçmiş</p>
            <p className="text-xl font-bold text-amber-900 mt-1">
              {formatCurrency(gecikmisToplam)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-red-50/60 border-red-200">
          <CardContent className="p-4">
            <p className="text-xs text-red-700 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> 90+ Gün Kritik
            </p>
            <p className="text-xl font-bold text-red-700 mt-1">
              {formatCurrency(agingData.totals.gun90Plus)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Yaşlandırma Tablosu */}
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            {mode === 'alacak' ? 'Alacak Yaşlandırma Matrisi' : 'Borç Yaşlandırma Matrisi'}
          </CardTitle>
          <CardDescription className="text-xs">
            Açık faturalar vade tarihine göre gruplanır. Cari satırına tıklayarak ekstreyi açabilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {agingData.rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Açık {mode === 'alacak' ? 'alacak' : 'borç'} kaydı bulunamadı.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b text-slate-600">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Cari Ünvanı</th>
                  <th className="text-center py-3 px-2 font-semibold">Adet</th>
                  <th className="text-right py-3 px-3 font-semibold text-emerald-700">Vadesi Gelmemiş</th>
                  <th className="text-right py-3 px-3 font-semibold">1–30 Gün</th>
                  <th className="text-right py-3 px-3 font-semibold text-amber-700">31–60 Gün</th>
                  <th className="text-right py-3 px-3 font-semibold text-orange-700">61–90 Gün</th>
                  <th className="text-right py-3 px-3 font-semibold text-red-700">90+ Gün</th>
                  <th className="text-right py-3 px-4 font-semibold">Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {agingData.rows.map((r) => (
                  <tr
                    key={r.cariKey}
                    onClick={() => r.cariId && openCariEkstreDrawer(r.cariId)}
                    className={cn(
                      'hover:bg-slate-50 transition-colors',
                      r.cariId && 'cursor-pointer'
                    )}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-slate-900">
                        <span>{r.cariAdi}</span>
                        {r.cariId && <ExternalLink className="w-3 h-3 text-slate-400" />}
                      </div>
                      {r.vkn && <div className="text-[11px] text-slate-400">{r.vkn}</div>}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Badge variant="secondary" className="text-[11px]">
                        {r.faturaAdet}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-700">
                      {r.vadesiGelmemis > 0 ? formatCurrency(r.vadesiGelmemis) : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {r.gun1_30 > 0 ? formatCurrency(r.gun1_30) : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-700 font-medium">
                      {r.gun31_60 > 0 ? formatCurrency(r.gun31_60) : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-orange-700 font-semibold">
                      {r.gun61_90 > 0 ? formatCurrency(r.gun61_90) : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-red-700 font-bold">
                      {r.gun90Plus > 0 ? formatCurrency(r.gun90Plus) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(r.toplam)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 border-t font-bold text-slate-900">
                <tr>
                  <td className="py-3 px-4" colSpan={2}>
                    GENEL TOPLAM
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-700">
                    {formatCurrency(agingData.totals.vadesiGelmemis)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {formatCurrency(agingData.totals.gun1_30)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-amber-700">
                    {formatCurrency(agingData.totals.gun31_60)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-orange-700">
                    {formatCurrency(agingData.totals.gun61_90)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-red-700">
                    {formatCurrency(agingData.totals.gun90Plus)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatCurrency(agingData.totals.toplam)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
