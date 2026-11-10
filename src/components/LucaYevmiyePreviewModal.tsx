import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Send,
  RotateCcw,
} from 'lucide-react';

export interface PreviewYevmiyeRow {
  id: string;
  tarih: string;
  evrakNo: string;
  belgeTuru: string;
  muhasebeKodu: string;
  aciklama: string;
  borc: number;
  alacak: number;
  cariUnvan?: string;
  vknTckn?: string;
  vergiDairesi?: string;
  faturaId?: string;
  hareketId?: string;
  dovizTuru?: string;
  dovizTutar?: number;
  dovizKuru?: number;
  raw?: any;
}

interface LucaYevmiyePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  documentCount: number;
  initialRows: PreviewYevmiyeRow[];
  onConfirmSend: (finalRows: PreviewYevmiyeRow[]) => void;
}

const DEFAULT_FALLBACK_CODES = new Set([
  '120',
  '120.01',
  '120.01.001',
  '320',
  '320.01',
  '320.01.001',
  '153',
  '600',
  '102',
  '102.01',
  '102.01.001',
]);

export function LucaYevmiyePreviewModal({
  isOpen,
  onClose,
  title = 'Luca Yevmiye Fişi Önizleme & Bakiye Kontrolü',
  subtitle = "Luca'ya göndermeden önce oluşacak mahsup satırlarını, hesap kodlarını ve Borç/Alacak dengesini kontrol edin.",
  documentCount,
  initialRows,
  onConfirmSend,
}: LucaYevmiyePreviewModalProps) {
  const [rows, setRows] = useState<PreviewYevmiyeRow[]>([]);

  useEffect(() => {
    if (isOpen) {
      setRows(initialRows.map((r) => ({ ...r })));
    }
  }, [isOpen, initialRows]);

  const stats = useMemo(() => {
    let totalBorc = 0;
    let totalAlacak = 0;
    let emptyCodeCount = 0;
    let defaultCodeCount = 0;

    rows.forEach((r) => {
      totalBorc += Number(r.borc) || 0;
      totalAlacak += Number(r.alacak) || 0;
      const code = (r.muhasebeKodu || '').trim();
      if (!code) {
        emptyCodeCount++;
      } else if (DEFAULT_FALLBACK_CODES.has(code)) {
        defaultCodeCount++;
      }
    });

    totalBorc = Math.round(totalBorc * 100) / 100;
    totalAlacak = Math.round(totalAlacak * 100) / 100;
    const diff = Math.round(Math.abs(totalBorc - totalAlacak) * 100) / 100;
    const isBalanced = diff <= 0.02;

    return {
      totalBorc,
      totalAlacak,
      diff,
      isBalanced,
      emptyCodeCount,
      defaultCodeCount,
    };
  }, [rows]);

  const handleRowChange = (index: number, field: keyof PreviewYevmiyeRow, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  };

  const handleDownloadPreviewExcel = () => {
    const excelData = rows.map((r) => ({
      'Evrak Tarihi': r.tarih,
      'Evrak No': r.evrakNo,
      'Belge Türü': r.belgeTuru || 'FT',
      'Hesap Kodu': r.muhasebeKodu,
      'Cari / Muhatap': r.cariUnvan || '',
      'Detay Açıklama': r.aciklama,
      Borç: Number(r.borc) || 0,
      Alacak: Number(r.alacak) || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Yevmiye_Onizleme');
    XLSX.writeFile(wb, `Luca_Yevmiye_Onizleme_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-slate-200 shadow-2xl">
        {/* Başlık ve Özet Kartları */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-slate-800 text-white p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                <Layers className="w-6 h-6 text-indigo-200" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  {title}
                </DialogTitle>
                <DialogDescription className="text-indigo-100 text-xs mt-0.5">
                  {subtitle}
                </DialogDescription>
              </div>
            </div>

            {stats.isBalanced ? (
              <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 px-3 py-1 text-xs font-bold flex items-center gap-1.5 w-fit">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                Fiş Dengeli (Borç = Alacak)
              </Badge>
            ) : (
              <Badge className="bg-amber-500/25 text-amber-200 border border-amber-400/50 px-3 py-1 text-xs font-bold flex items-center gap-1.5 w-fit">
                <AlertTriangle className="w-4 h-4 text-amber-300" />
                Fark Var: {stats.diff.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-white/15">
            <div className="bg-white/10 rounded-lg p-2.5">
              <div className="text-[11px] text-indigo-200">Belge / Satır Sayısı</div>
              <div className="text-base font-bold text-white">
                {documentCount} Belge • {rows.length} Satır
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5">
              <div className="text-[11px] text-indigo-200">Toplam Borç</div>
              <div className="text-base font-bold text-emerald-300 font-mono">
                {stats.totalBorc.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5">
              <div className="text-[11px] text-indigo-200">Toplam Alacak</div>
              <div className="text-base font-bold text-sky-300 font-mono">
                {stats.totalAlacak.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5">
              <div className="text-[11px] text-indigo-200">Hesap Kodu Kontrolü</div>
              <div className="text-xs font-semibold text-white mt-0.5">
                {stats.emptyCodeCount > 0 ? (
                  <span className="text-rose-300">{stats.emptyCodeCount} Boş Kod!</span>
                ) : stats.defaultCodeCount > 0 ? (
                  <span className="text-amber-200">
                    {stats.defaultCodeCount} Varsayılan Kod (Otomatik Açılır)
                  </span>
                ) : (
                  <span className="text-emerald-300">✔ Tüm Kodlar Tanımlı</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Yevmiye Satırları Tablosu */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 max-h-[55vh]">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 font-semibold w-24">Tarih</th>
                  <th className="py-2.5 px-3 font-semibold w-28">Evrak No</th>
                  <th className="py-2.5 px-3 font-semibold w-44">Hesap Kodu (Düzenlenebilir)</th>
                  <th className="py-2.5 px-3 font-semibold">Cari / Detay Açıklama</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-28">Borç (₺)</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-28">Alacak (₺)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => {
                  const codeTrim = (row.muhasebeKodu || '').trim();
                  const isDefault = DEFAULT_FALLBACK_CODES.has(codeTrim);
                  return (
                    <tr key={row.id || idx} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-1.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {row.tarih}
                      </td>
                      <td className="py-1.5 px-3 font-mono text-slate-700 truncate max-w-[110px]" title={row.evrakNo}>
                        {row.evrakNo || '-'}
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-1">
                          <Input
                            value={row.muhasebeKodu}
                            onChange={(e) => handleRowChange(idx, 'muhasebeKodu', e.target.value)}
                            className={`h-7 text-xs font-mono px-2 ${
                              !codeTrim
                                ? 'border-rose-400 bg-rose-50'
                                : isDefault
                                ? 'border-amber-300 bg-amber-50/50'
                                : 'border-slate-200'
                            }`}
                            placeholder="Örn: 770.01"
                          />
                        </div>
                      </td>
                      <td className="py-1.5 px-3">
                        <Input
                          value={row.aciklama}
                          onChange={(e) => handleRowChange(idx, 'aciklama', e.target.value)}
                          className="h-7 text-xs px-2 border-slate-200"
                        />
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-semibold text-emerald-700">
                        {row.borc > 0
                          ? row.borc.toLocaleString('tr-TR', { minimumFractionDigits: 2 })
                          : '-'}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-semibold text-indigo-700">
                        {row.alacak > 0
                          ? row.alacak.toLocaleString('tr-TR', { minimumFractionDigits: 2 })
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-200 font-mono">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right font-sans">
                    GENEL TOPLAM ({rows.length} Yevmiye Satırı):
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-800">
                    {stats.totalBorc.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </td>
                  <td className="py-2.5 px-3 text-right text-indigo-800">
                    {stats.totalAlacak.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Alt Bar / Aksiyonlar */}
        <DialogFooter className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows(initialRows.map((r) => ({ ...r })))}
              className="gap-1.5 text-xs h-8 text-slate-600"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Varsayılana Sıfırla
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadPreviewExcel}
              className="gap-1.5 text-xs h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Önizleme Excel İndir
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs h-9">
              Vazgeç
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => onConfirmSend(rows)}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-4 font-semibold shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              Onayla ve Doğrudan Luca'ya Aktar ({documentCount} Belge)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

