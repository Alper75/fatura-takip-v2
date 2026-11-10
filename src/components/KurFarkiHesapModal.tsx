import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, Send, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import type { PreviewYevmiyeRow } from './LucaYevmiyePreviewModal';

interface KurFarkiHesapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenYevmiyePreview: (lines: PreviewYevmiyeRow[]) => void;
}

export function KurFarkiHesapModal({
  open,
  onOpenChange,
  onOpenYevmiyePreview,
}: KurFarkiHesapModalProps) {
  const { satisFaturalari, alisFaturalari, cariler, apiFetch } = useApp();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [includeKdv, setIncludeKdv] = useState(false);
  const [globalRates, setGlobalRates] = useState<Record<string, number>>({
    USD: 34.5,
    EUR: 37.2,
    GBP: 43.8,
  });
  const [rowOverrides, setRowOverrides] = useState<
    Record<string, { faturaKuru?: number; odemeKuru?: number; dovizTutar?: number; cariKod?: string }>
  >({});
  const [isFetchingTcmb, setIsFetchingTcmb] = useState(false);

  const handleFetchLiveRates = async () => {
    setIsFetchingTcmb(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [usdRes, eurRes, gbpRes] = await Promise.all([
        apiFetch(`/api/tcmb-kur?tarih=${today}&doviz=USD`).catch(() => null),
        apiFetch(`/api/tcmb-kur?tarih=${today}&doviz=EUR`).catch(() => null),
        apiFetch(`/api/tcmb-kur?tarih=${today}&doviz=GBP`).catch(() => null),
      ]);
      setGlobalRates((prev) => ({
        USD: Number(usdRes?.kur) || prev.USD,
        EUR: Number(eurRes?.kur) || prev.EUR,
        GBP: Number(gbpRes?.kur) || prev.GBP,
      }));
      toast.success('Güncel TCMB döviz kurları çekildi.');
    } catch {
      toast.error('TCMB kuru çekilemedi, manuel girebilirsiniz.');
    } finally {
      setIsFetchingTcmb(false);
    }
  };

  const fxInvoices = useMemo(() => {
    const list: Array<{
      id: string;
      tip: 'satis' | 'alis';
      faturaNo: string;
      tarih: string;
      unvan: string;
      vkn: string;
      paraBirimi: string;
      dovizTutar: number;
      faturaKuru: number;
      odemeKuru: number;
      cariKod: string;
    }> = [];

    for (const sf of satisFaturalari || []) {
      if (sf.durum === 'iptal') continue;
      const pb = String(sf.paraBirimi || 'TRY').toUpperCase();
      const kur = Number(sf.dovizKuru) || 1;
      if (pb === 'TRY' && kur <= 1) continue;

      const currency = pb === 'TRY' ? 'USD' : pb;
      const ov = rowOverrides[`satis_${sf.id}`] || {};
      const fKuru = ov.faturaKuru !== undefined ? ov.faturaKuru : (kur > 1 ? kur : globalRates[currency] || 34);
      const oKuru = ov.odemeKuru !== undefined ? ov.odemeKuru : (globalRates[currency] || fKuru);
      const rawTotal = Number(sf.alinanUcret) || 0;
      const calcDoviz = ov.dovizTutar !== undefined
        ? ov.dovizTutar
        : (rawTotal > 0 && fKuru > 1 ? Math.round((rawTotal / fKuru) * 100) / 100 : rawTotal);

      const matchedCari = (cariler || []).find(
        (c) => (sf.cariId && c.id === sf.cariId) || (sf.tcVkn && c.vknTckn === sf.tcVkn)
      );
      const defaultCariKod = ov.cariKod || sf.muhasebeKodu || matchedCari?.muhasebeKodu || '120.01.001';

      list.push({
        id: `satis_${sf.id}`,
        tip: 'satis',
        faturaNo: sf.faturaNo || '-',
        tarih: sf.faturaTarihi || '',
        unvan: `${sf.ad || ''} ${sf.soyad || ''}`.trim() || matchedCari?.unvan || 'Müşteri',
        vkn: sf.tcVkn || '',
        paraBirimi: currency,
        dovizTutar: calcDoviz,
        faturaKuru: fKuru,
        odemeKuru: oKuru,
        cariKod: defaultCariKod,
      });
    }

    for (const af of alisFaturalari || []) {
      if (af.durum === 'iptal') continue;
      const pb = String(af.paraBirimi || 'TRY').toUpperCase();
      const kur = Number(af.dovizKuru) || 1;
      if (pb === 'TRY' && kur <= 1) continue;

      const currency = pb === 'TRY' ? 'USD' : pb;
      const ov = rowOverrides[`alis_${af.id}`] || {};
      const fKuru = ov.faturaKuru !== undefined ? ov.faturaKuru : (kur > 1 ? kur : globalRates[currency] || 34);
      const oKuru = ov.odemeKuru !== undefined ? ov.odemeKuru : (globalRates[currency] || fKuru);
      const rawTotal = Number(af.toplamTutar) || 0;
      const calcDoviz = ov.dovizTutar !== undefined
        ? ov.dovizTutar
        : (rawTotal > 0 && fKuru > 1 ? Math.round((rawTotal / fKuru) * 100) / 100 : rawTotal);

      const matchedCari = (cariler || []).find(
        (c) => (af.cariId && c.id === af.cariId) || (af.tedarikciVkn && c.vknTckn === af.tedarikciVkn)
      );
      const defaultCariKod = ov.cariKod || af.karsiHesapKodu || matchedCari?.muhasebeKodu || '320.01.001';

      list.push({
        id: `alis_${af.id}`,
        tip: 'alis',
        faturaNo: af.faturaNo || '-',
        tarih: af.faturaTarihi || '',
        unvan: af.tedarikciAdi || matchedCari?.unvan || 'Tedarikçi',
        vkn: af.tedarikciVkn || '',
        paraBirimi: currency,
        dovizTutar: calcDoviz,
        faturaKuru: fKuru,
        odemeKuru: oKuru,
        cariKod: defaultCariKod,
      });
    }

    return list.map((item) => {
      const faturaTl = Math.round(item.dovizTutar * item.faturaKuru * 100) / 100;
      const odemeTl = Math.round(item.dovizTutar * item.odemeKuru * 100) / 100;
      const rawDiff = Math.round((odemeTl - faturaTl) * 100) / 100;
      // Satışta kur artışı 646 Kar, kur düşüşü 656 Zarar. Alışta kur düşüşü 646 Kar, kur artışı 656 Zarar.
      const isKar = item.tip === 'satis' ? rawDiff > 0 : rawDiff < 0;
      const absDiff = Math.abs(rawDiff);
      return {
        ...item,
        faturaTl,
        odemeTl,
        rawDiff,
        absDiff,
        isKar,
        hesap646_656: isKar ? '646.01' : '656.01',
        hesapAdi646_656: isKar ? 'Kambiyo Karları (Kur Farkı Geliri)' : 'Kambiyo Zararları (Kur Farkı Gideri)',
      };
    });
  }, [satisFaturalari, alisFaturalari, cariler, rowOverrides, globalRates]);

  const handleGenerateYevmiye = () => {
    const selected = fxInvoices.filter((r) => selectedIds.includes(r.id) && r.absDiff >= 0.01);
    if (selected.length === 0) {
      toast.warning('Lütfen kur farkı oluşan (fark > 0) en az 1 dövizli fatura seçin.');
      return;
    }

    const lines: PreviewYevmiyeRow[] = [];
    const todayStr = new Date().toLocaleDateString('tr-TR');

    selected.forEach((r) => {
      const matrah = includeKdv ? Math.round((r.absDiff / 1.2) * 100) / 100 : r.absDiff;
      const kdv = includeKdv ? Math.round((r.absDiff - matrah) * 100) / 100 : 0;
      const aciklama = `${r.faturaNo} (${r.dovizTutar} ${r.paraBirimi}) Kur Farkı (${r.faturaKuru} -> ${r.odemeKuru}) - ${r.unvan}`;

      if (r.isKar) {
        lines.push({
          id: `${r.id}_cari`,
          tarih: todayStr,
          evrakNo: r.faturaNo,
          belgeTuru: 'F',
          muhasebeKodu: r.cariKod,
          cariUnvan: r.unvan,
          vknTckn: r.vkn,
          aciklama,
          borc: r.absDiff,
          alacak: 0,
        });
        lines.push({
          id: `${r.id}_646`,
          tarih: todayStr,
          evrakNo: r.faturaNo,
          belgeTuru: 'F',
          muhasebeKodu: '646.01',
          cariUnvan: 'Kambiyo Karları',
          aciklama,
          borc: 0,
          alacak: matrah,
        });
        if (includeKdv && kdv > 0) {
          lines.push({
            id: `${r.id}_391`,
            tarih: todayStr,
            evrakNo: r.faturaNo,
            belgeTuru: 'F',
            muhasebeKodu: '391.20',
            cariUnvan: 'Hesaplanan KDV (%20 Kur Farkı)',
            aciklama,
            borc: 0,
            alacak: kdv,
          });
        }
      } else {
        lines.push({
          id: `${r.id}_656`,
          tarih: todayStr,
          evrakNo: r.faturaNo,
          belgeTuru: 'F',
          muhasebeKodu: '656.01',
          cariUnvan: 'Kambiyo Zararları',
          aciklama,
          borc: matrah,
          alacak: 0,
        });
        if (includeKdv && kdv > 0) {
          lines.push({
            id: `${r.id}_191`,
            tarih: todayStr,
            evrakNo: r.faturaNo,
            belgeTuru: 'F',
            muhasebeKodu: '191.20',
            cariUnvan: 'İndirilecek KDV (%20 Kur Farkı)',
            aciklama,
            borc: kdv,
            alacak: 0,
          });
        }
        lines.push({
          id: `${r.id}_cari`,
          tarih: todayStr,
          evrakNo: r.faturaNo,
          belgeTuru: 'F',
          muhasebeKodu: r.cariKod,
          cariUnvan: r.unvan,
          vknTckn: r.vkn,
          aciklama,
          borc: 0,
          alacak: r.absDiff,
        });
      }
    });

    onOpenChange(false);
    onOpenYevmiyePreview(lines);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[980px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-900">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            💱 Dövizli Fatura & Banka Kur Farkı (646 / 656) Hesaplama Motoru
          </DialogTitle>
          <DialogDescription>
            Dövizli alış ve satış faturalarınızın fatura tarihi kuru ile ödeme/değerleme kuru arasındaki farkı otomatik hesaplar ve <b>646 Kambiyo Karları / 656 Kambiyo Zararları</b> mahsup fişini üretir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Üst Kur Ayar Çubuğu */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700">Değerleme / Ödeme Kurları:</span>
              {(['USD', 'EUR', 'GBP'] as const).map((cur) => (
                <div key={cur} className="flex items-center gap-1">
                  <Badge variant="outline" className="font-mono text-xs bg-white">{cur}</Badge>
                  <Input
                    type="number"
                    step="0.0001"
                    value={globalRates[cur]}
                    onChange={(e) =>
                      setGlobalRates((prev) => ({ ...prev, [cur]: parseFloat(e.target.value) || 0 }))
                    }
                    className="h-7 w-24 text-xs font-mono text-right bg-white"
                  />
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={handleFetchLiveRates}
                disabled={isFetchingTcmb}
                className="h-7 text-xs border-indigo-200 text-indigo-700 bg-indigo-50"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isFetchingTcmb ? 'animate-spin' : ''}`} />
                TCMB Kuru Çek
              </Button>
            </div>

            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeKdv}
                onChange={(e) => setIncludeKdv(e.target.checked)}
                className="rounded border-slate-300"
              />
              Kur farkı tutarından %20 İç KDV (191 / 391) ayrıştır
            </label>
          </div>

          {/* Dövizli Faturalar Tablosu */}
          <div className="border rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700 border-b">
                <tr>
                  <th className="p-2.5 text-left w-8">
                    <Checkbox
                      checked={fxInvoices.length > 0 && selectedIds.length === fxInvoices.length}
                      onCheckedChange={() => {
                        if (selectedIds.length === fxInvoices.length) setSelectedIds([]);
                        else setSelectedIds(fxInvoices.map((r) => r.id));
                      }}
                    />
                  </th>
                  <th className="p-2.5 text-left">Fatura & Cari</th>
                  <th className="p-2.5 text-left">Cari Kodu</th>
                  <th className="p-2.5 text-right">Döviz Tutarı</th>
                  <th className="p-2.5 text-right">Fatura Kuru</th>
                  <th className="p-2.5 text-right">Ödeme Kuru</th>
                  <th className="p-2.5 text-right">Kur Farkı (TL)</th>
                  <th className="p-2.5 text-center">646 / 656 Hesap</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fxInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Sistemde dövizli (USD / EUR / GBP) fatura bulunamadı.
                    </td>
                  </tr>
                ) : (
                  fxInvoices.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="p-2.5">
                        <Checkbox
                          checked={selectedIds.includes(r.id)}
                          onCheckedChange={(checked) => {
                            setSelectedIds((prev) =>
                              checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                            );
                          }}
                        />
                      </td>
                      <td className="p-2.5">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1 py-0 ${
                              r.tip === 'satis'
                                ? 'border-blue-200 text-blue-700 bg-blue-50'
                                : 'border-amber-200 text-amber-700 bg-amber-50'
                            }`}
                          >
                            {r.tip === 'satis' ? 'SATIŞ' : 'ALIŞ'}
                          </Badge>
                          {r.faturaNo}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{r.unvan}</div>
                      </td>
                      <td className="p-2.5">
                        <Input
                          value={r.cariKod}
                          onChange={(e) =>
                            setRowOverrides((prev) => ({
                              ...prev,
                              [r.id]: { ...prev[r.id], cariKod: e.target.value },
                            }))
                          }
                          className="h-7 w-28 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={r.dovizTutar}
                            onChange={(e) =>
                              setRowOverrides((prev) => ({
                                ...prev,
                                [r.id]: { ...prev[r.id], dovizTutar: parseFloat(e.target.value) || 0 },
                              }))
                            }
                            className="h-7 w-24 text-xs font-mono text-right"
                          />
                          <span className="font-bold text-slate-600">{r.paraBirimi}</span>
                        </div>
                      </td>
                      <td className="p-2.5 text-right">
                        <Input
                          type="number"
                          step="0.0001"
                          value={r.faturaKuru}
                          onChange={(e) =>
                            setRowOverrides((prev) => ({
                              ...prev,
                              [r.id]: { ...prev[r.id], faturaKuru: parseFloat(e.target.value) || 0 },
                            }))
                          }
                          className="h-7 w-20 text-xs font-mono text-right ml-auto"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <Input
                          type="number"
                          step="0.0001"
                          value={r.odemeKuru}
                          onChange={(e) =>
                            setRowOverrides((prev) => ({
                              ...prev,
                              [r.id]: { ...prev[r.id], odemeKuru: parseFloat(e.target.value) || 0 },
                            }))
                          }
                          className="h-7 w-20 text-xs font-mono text-right ml-auto"
                        />
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        <span className={r.isKar ? 'text-emerald-700' : 'text-red-600'}>
                          {r.isKar ? '+' : '-'}
                          {r.absDiff.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        {r.absDiff < 0.01 ? (
                          <span className="text-slate-400">Fark Yok</span>
                        ) : r.isKar ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px]">
                            <TrendingUp className="w-3 h-3 mr-1" /> 646.01 Kar
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-0 text-[10px]">
                            <TrendingDown className="w-3 h-3 mr-1" /> 656.01 Zarar
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
          <Button
            onClick={handleGenerateYevmiye}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            <Send className="w-4 h-4 mr-2" />
            🔍 Seçililer İçin 646 / 656 Kur Farkı Fişi Oluştur ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
