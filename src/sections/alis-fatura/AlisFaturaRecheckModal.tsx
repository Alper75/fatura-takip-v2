import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/context/AppContext';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface TaxSnapshot {
  matrah: number;
  kdvOrani: number;
  kdvTutari: number;
  kdv1: number;
  kdv10: number;
  kdv20: number;
  oivTutari: number;
}

interface ElogoDiffItem {
  id: string;
  faturaNo: string;
  faturaTarihi: string;
  tedarikciAdi: string;
  tedarikciVkn: string;
  toplamTutar: number;
  lucaTransferredAt: string | null;
  eski: TaxSnapshot;
  yeni: TaxSnapshot;
}

interface AlisFaturaRecheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function AlisFaturaRecheckModal({ isOpen, onClose, onUpdated }: AlisFaturaRecheckModalProps) {
  const { alisFaturalari, apiFetch, openAlisDrawer } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(sixtyDaysAgo);
  const [endDate, setEndDate] = useState(todayStr);
  const [isCheckingElogo, setIsCheckingElogo] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [elogoResult, setElogoResult] = useState<{
    checkedCount: number;
    dbCount?: number;
    elogoDocCount?: number;
    elogoWarning?: string | null;
    diffs: ElogoDiffItem[];
  } | null>(null);
  const [selectedDiffIds, setSelectedDiffIds] = useState<string[]>([]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v);

  // Katman 1: Anlık Matematiksel Tutarlılık Taraması
  const mathIssues = useMemo(() => {
    return (alisFaturalari || [])
      .map((f) => {
        const matrah = Number(f.matrah) || 0;
        const kdvTutari = Number(f.kdvTutari) || 0;
        const kdvOrani = Number(f.kdvOrani) || 0;
        const toplam = Number(f.toplamTutar) || 0;
        const oiv = Number(f.oivTutari) || 0;
        const kdv1 = Number(f.kdv1) || 0;
        const kdv10 = Number(f.kdv10) || 0;
        const kdv20 = Number(f.kdv20) || 0;
        const reasons: string[] = [];

        // 1. Oran ve matrah/kdv uyuşmazlığı (ör. %10 yerine %1 yazılmışsa)
        const bucketSum = kdv1 + kdv10 + kdv20;
        const hasMultipleBuckets = [kdv1, kdv10, kdv20].filter((x) => x > 0.01).length > 1;

        if (!hasMultipleBuckets && matrah > 0 && kdvTutari > 0 && kdvOrani > 0) {
          const beklenenKdv = (matrah * kdvOrani) / 100;
          if (Math.abs(beklenenKdv - kdvTutari) > Math.max(2, matrah * 0.015)) {
            const gercekOran = Math.round((kdvTutari / matrah) * 100);
            reasons.push(
              `Kayıtlı oran %${kdvOrani} ama KDV/Matrah oranı ≈ %${gercekOran} (${formatCurrency(kdvTutari)} / ${formatCurrency(matrah)})`
            );
          }
        }

        // 2. KDV dilimleri toplamı vs toplam KDV tutarı
        if (bucketSum > 0.05 && Math.abs(bucketSum - kdvTutari) > 1.0) {
          reasons.push(
            `KDV dilimleri toplamı (${formatCurrency(bucketSum)}) ile Fatura KDV (${formatCurrency(kdvTutari)}) uyuşmuyor`
          );
        }

        // 3. Genel toplam dengesizliği (ayrıştırılmamış Konaklama / ÖİV / Telsiz vb.)
        if (toplam > 0 && matrah + kdvTutari > 0) {
          const diff = toplam - (matrah + kdvTutari + oiv);
          if (Math.abs(diff) > 1.0 && !(f.tevkifatTutari && f.tevkifatTutari > 0)) {
            reasons.push(
              `Genel toplam farkı: ${formatCurrency(diff)} (ayrıştırılmamış Konaklama/ÖİV olabilir)`
            );
          }
        }

        return { fatura: f, reasons };
      })
      .filter((x) => x.reasons.length > 0);
  }, [alisFaturalari]);

  const handleCheckElogo = async () => {
    setIsCheckingElogo(true);
    try {
      const res = await apiFetch('/api/alis-faturalari/recheck-elogo', {
        method: 'POST',
        body: JSON.stringify({ startDate, endDate }),
      });
      if (!res?.success) {
        toast.error(res?.message || 'e-Logo kontrolü sırasında hata oluştu.');
        return;
      }
      const diffs: ElogoDiffItem[] = res.diffs || [];
      setElogoResult({
        checkedCount: res.checkedCount || 0,
        dbCount: res.dbCount,
        elogoDocCount: res.elogoDocCount,
        elogoWarning: res.elogoWarning,
        diffs,
      });
      // Luca'ya aktarılmamış olanları varsayılan seç
      setSelectedDiffIds(diffs.filter((d) => !d.lucaTransferredAt).map((d) => d.id));
      if (diffs.length === 0) {
        toast.success(`${res.checkedCount || 0} fatura e-Logo XML ile karşılaştırıldı, fark bulunamadı.`);
      } else {
        toast.warning(`${res.checkedCount} faturadan ${diffs.length} adedinde KDV/Matrah farkı tespit edildi.`);
      }
    } catch (e: any) {
      toast.error('Kontrol hatası: ' + (e?.message || 'Bilinmeyen hata'));
    } finally {
      setIsCheckingElogo(false);
    }
  };

  const handleApplyUpdates = async () => {
    if (!elogoResult || selectedDiffIds.length === 0) return;
    setIsApplying(true);
    try {
      const updates = elogoResult.diffs
        .filter((d) => selectedDiffIds.includes(d.id))
        .map((d) => ({
          id: d.id,
          ...d.yeni,
        }));
      const res = await apiFetch('/api/alis-faturalari/apply-recheck', {
        method: 'POST',
        body: JSON.stringify({ updates }),
      });
      if (res?.success) {
        toast.success(`${res.updatedCount || updates.length} fatura güncel XML verileriyle düzeltildi.`);
        onUpdated();
        onClose();
      } else {
        toast.error(res?.message || 'Güncelleme başarısız.');
      }
    } catch (e: any) {
      toast.error('Güncelleme hatası: ' + (e?.message || 'Bilinmeyen hata'));
    } finally {
      setIsApplying(false);
    }
  };

  const toggleSelectDiff = (id: string) => {
    setSelectedDiffIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            Alış Faturaları KDV &amp; Tutar Kontrolü
          </DialogTitle>
          <DialogDescription>
            Kayıtlı faturaları hem matematiksel olarak tarayın hem de e-Logo orijinal XML verileriyle karşılaştırıp tek tıkla düzeltin.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="elogo" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-fit">
            <TabsTrigger value="elogo">e-Logo XML ile Doğrula &amp; Düzelt</TabsTrigger>
            <TabsTrigger value="math">
              Matematiksel Tutarlılık ({mathIssues.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="elogo" className="flex-1 overflow-y-auto space-y-4 mt-3 pr-1">
            <div className="flex flex-wrap items-end gap-3 p-3 bg-slate-50 rounded-lg border">
              <div>
                <Label className="text-xs text-slate-600">Başlangıç Tarihi</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 bg-white mt-1 w-40"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Bitiş Tarihi</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 bg-white mt-1 w-40"
                />
              </div>
              <Button onClick={handleCheckElogo} disabled={isCheckingElogo} className="gap-2 h-9">
                {isCheckingElogo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isCheckingElogo ? 'XML Taranıyor...' : 'Faturaları Tekrar Kontrol Et'}
              </Button>
            </div>

            {elogoResult && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
                  <span className="text-slate-600">
                    Sistemdeki fatura: <b>{elogoResult.dbCount ?? '-'}</b> · e-Logo belge: <b>{elogoResult.elogoDocCount ?? '-'}</b> · XML karşılaştırılan: <b>{elogoResult.checkedCount}</b> · Fark bulunan:{' '}
                    <b className={elogoResult.diffs.length > 0 ? 'text-red-700' : 'text-emerald-700'}>
                      {elogoResult.diffs.length}
                    </b>
                  </span>
                  {elogoResult.elogoWarning && (
                    <span className="text-amber-700 font-medium">Uyarı: {elogoResult.elogoWarning}</span>
                  )}
                </div>

                {elogoResult.diffs.length === 0 ? (
                  <div className="p-8 text-center border rounded-lg bg-emerald-50/40 text-emerald-800 text-sm flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    Seçili tarih aralığındaki tüm e-Logo faturaları XML ile birebir uyumlu.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 border-b text-slate-700">
                        <tr>
                          <th className="p-2.5 w-8"></th>
                          <th className="p-2.5 text-left">Fatura</th>
                          <th className="p-2.5 text-left">Mevcut Kayıt</th>
                          <th className="p-2.5 text-left">Orijinal e-Logo XML (Yeni)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {elogoResult.diffs.map((d) => (
                          <tr key={d.id} className="hover:bg-slate-50">
                            <td className="p-2.5 align-top">
                              <Checkbox
                                checked={selectedDiffIds.includes(d.id)}
                                onCheckedChange={() => toggleSelectDiff(d.id)}
                              />
                            </td>
                            <td className="p-2.5 align-top">
                              <div className="font-semibold text-slate-900">{d.faturaNo}</div>
                              <div className="text-slate-500">{d.tedarikciAdi}</div>
                              <div className="text-[11px] text-slate-400">{d.faturaTarihi}</div>
                              {d.lucaTransferredAt && (
                                <Badge variant="outline" className="mt-1 text-[10px] border-amber-300 text-amber-800 bg-amber-50">
                                  Luca&apos;ya Aktarılmış
                                </Badge>
                              )}
                            </td>
                            <td className="p-2.5 align-top text-red-700 bg-red-50/40 space-y-0.5 font-mono">
                              <div>Oran: <b>%{d.eski.kdvOrani}</b> · Toplam KDV: <b>{formatCurrency(d.eski.kdvTutari)}</b></div>
                              <div>Matrah: {formatCurrency(d.eski.matrah)}</div>
                              <div>
                                KDV (%1 / %10 / %20): {formatCurrency(d.eski.kdv1)} / {formatCurrency(d.eski.kdv10)} / {formatCurrency(d.eski.kdv20)}
                              </div>
                              <div>ÖİV/Konaklama: {formatCurrency(d.eski.oivTutari)}</div>
                            </td>
                            <td className="p-2.5 align-top text-emerald-800 bg-emerald-50/40 space-y-0.5 font-mono">
                              <div>Oran: <b>%{d.yeni.kdvOrani}</b> · Toplam KDV: <b>{formatCurrency(d.yeni.kdvTutari)}</b></div>
                              <div>Matrah: {formatCurrency(d.yeni.matrah)}</div>
                              <div>
                                KDV (%1 / %10 / %20): {formatCurrency(d.yeni.kdv1)} / {formatCurrency(d.yeni.kdv10)} / {formatCurrency(d.yeni.kdv20)}
                              </div>
                              <div>ÖİV/Konaklama: {formatCurrency(d.yeni.oivTutari)}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="math" className="flex-1 overflow-y-auto space-y-2 mt-3 pr-1">
            {mathIssues.length === 0 ? (
              <div className="p-8 text-center border rounded-lg bg-emerald-50/40 text-emerald-800 text-sm flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                Tüm alış faturaları matematiksel olarak tutarlı görünüyor.
              </div>
            ) : (
              mathIssues.map(({ fatura, reasons }) => (
                <div key={fatura.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 flex items-start justify-between gap-3">
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{fatura.faturaNo || 'No Yok'}</span>
                      <span className="text-slate-500 font-normal">· {fatura.tedarikciAdi}</span>
                      <span className="text-slate-400 font-normal">({fatura.faturaTarihi})</span>
                    </div>
                    <ul className="list-disc list-inside text-amber-900 space-y-0.5">
                      {reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-8 text-xs bg-white"
                    onClick={() => {
                      onClose();
                      openAlisDrawer(fatura as any);
                    }}
                  >
                    Düzenle
                  </Button>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-3 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Kapat
          </Button>
          {elogoResult && elogoResult.diffs.length > 0 && (
            <Button
              type="button"
              onClick={handleApplyUpdates}
              disabled={isApplying || selectedDiffIds.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isApplying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Seçilenleri Güncelle ({selectedDiffIds.length})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
