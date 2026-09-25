import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LUCA_STOPAJ_KODLARI, LucaStopajKodu } from '@/constants/lucaStopajKodlari';
import { Search, ShieldAlert, ArrowRight, Check, Sparkles } from 'lucide-react';

interface StopajInvoiceItem {
  id: string;
  faturaNo?: string;
  faturaTarihi?: string;
  ad?: string;
  matrah?: number | string;
  stopajOrani?: number | string;
  stopajTutari?: number | string;
  stopajKodu?: string;
  _type?: string;
}

interface StopajKoduModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: StopajInvoiceItem[];
  initialMap: Record<string, string>; // invoiceId -> stopajKodu (e.g. "022-20")
  actionType: 'export' | 'copy_script';
  onConfirm: (selectedKodMap: Record<string, string>) => void;
}

export function StopajKoduModal({
  isOpen,
  onClose,
  invoices,
  initialMap,
  actionType,
  onConfirm
}: StopajKoduModalProps) {
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>({});
  const [bulkCode, setBulkCode] = useState<string>('022-20');
  const [searchFilter, setSearchFilter] = useState('');

  // Modalı açtığında initialMap'i yükle
  React.useEffect(() => {
    if (isOpen) {
      const nextMap: Record<string, string> = { ...initialMap };
      invoices.forEach(inv => {
        if (!nextMap[inv.id]) {
          nextMap[inv.id] = inv.stopajKodu || '022-20';
        }
      });
      setSelectedMap(nextMap);
      setSearchFilter('');
    }
  }, [isOpen, initialMap, invoices]);

  const handleApplyBulk = () => {
    if (!bulkCode) return;
    const next: Record<string, string> = { ...selectedMap };
    invoices.forEach(inv => {
      next[inv.id] = bulkCode;
    });
    setSelectedMap(next);
  };

  const handleItemChange = (invId: string, val: string) => {
    setSelectedMap(prev => ({
      ...prev,
      [invId]: val
    }));
  };

  const filteredInvoices = useMemo(() => {
    if (!searchFilter.trim()) return invoices;
    const q = searchFilter.toLowerCase();
    return invoices.filter(inv =>
      (inv.faturaNo || '').toLowerCase().includes(q) ||
      (inv.ad || '').toLowerCase().includes(q)
    );
  }, [invoices, searchFilter]);

  const handleConfirm = () => {
    onConfirm(selectedMap);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white shadow-2xl rounded-2xl border">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-amber-500/10 via-amber-50 to-indigo-50/40 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-700 border border-amber-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                İşletme Defteri Stopaj Kodu Seçimi
                <Badge variant="outline" className="bg-amber-100/80 text-amber-900 border-amber-300 font-mono text-xs">
                  {invoices.length} Stopajlı Fatura
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 mt-1">
                İşletme defterlerinde Luca'ya gönderirken <strong>stopaj tutarı yazılmaz</strong>, onun yerine Luca sisteminin talep ettiği ilgili <strong>Stopaj Kodu</strong> seçilir.
              </DialogDescription>
            </div>
          </div>

          {/* Toplu Atama Barı */}
          <div className="mt-4 p-3 bg-white/90 backdrop-blur rounded-xl border border-amber-200/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Tüm Stopajlı Faturalara Toplu Uygula:</span>
            </div>
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <select
                value={bulkCode}
                onChange={e => setBulkCode(e.target.value)}
                className="h-9 flex-1 text-xs border border-slate-300 rounded-lg px-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-amber-500 font-medium"
              >
                {LUCA_STOPAJ_KODLARI.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                onClick={handleApplyBulk}
                className="h-9 px-3.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-sm gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Tümüne Uygula
              </Button>
            </div>
          </div>
        </div>

        {/* Fatura Tablosu */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Fatura No veya Firma Ara..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Her fatura için stopaj kodunu tek tek değiştirebilirsiniz:
            </span>
          </div>

          <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="w-[120px] text-xs">Evrak No</TableHead>
                  <TableHead className="w-[90px] text-xs">Tarih</TableHead>
                  <TableHead className="text-xs">Firma / Ünvan</TableHead>
                  <TableHead className="text-right text-xs">Matrah</TableHead>
                  <TableHead className="text-center text-xs">Stopaj Oranı</TableHead>
                  <TableHead className="text-right text-xs">Stopaj Tutarı</TableHead>
                  <TableHead className="w-[360px] text-xs font-bold text-amber-900 bg-amber-50/50">
                    Luca Stopaj Kodu (td27)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map(inv => {
                  const matrah = parseFloat(String(inv.matrah || 0)) || 0;
                  const stopajTutari = parseFloat(String(inv.stopajTutari || 0)) || 0;
                  const stopajOrani = inv.stopajOrani || '20';
                  const currentKod = selectedMap[inv.id] || '022-20';

                  return (
                    <TableRow key={inv.id} className="hover:bg-amber-50/20 transition-colors">
                      <TableCell className="font-mono text-xs font-semibold text-slate-900">
                        {inv.faturaNo || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-mono">
                        {inv.faturaTarihi || '-'}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-800 max-w-[180px] truncate" title={inv.ad}>
                        {inv.ad || 'Muhtelif Cari'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-700">
                        {matrah.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[11px] font-mono">
                          %{stopajOrani}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-red-600">
                        {stopajTutari.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </TableCell>
                      <TableCell className="bg-amber-50/30">
                        <select
                          value={currentKod}
                          onChange={e => handleItemChange(inv.id, e.target.value)}
                          className="h-8 w-full text-xs border border-amber-300 rounded-md px-2 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-amber-500 shadow-xs"
                        >
                          {LUCA_STOPAJ_KODLARI.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            * Seçilen stopaj kodları aktarım esnasında Luca'nın ilgili satırına otomatik doldurulacaktır.
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-10 text-xs px-4">
              Vazgeç
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              className="h-10 text-xs px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md gap-2"
            >
              {actionType === 'copy_script' ? (
                <>Stopaj Kodlarını Onayla & Scripti Kopyala <ArrowRight className="w-4 h-4" /></>
              ) : (
                <>Stopaj Kodlarını Onayla & Luca'ya Aktar <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
