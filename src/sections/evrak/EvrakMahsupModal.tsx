import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LucaAccountSelect } from '@/components/LucaAccountSelect';
import { useApp } from '@/context/AppContext';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RotateCw,
  Save,
  Scale,
  Trash2,
  ZoomIn,
  ZoomOut,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface EvrakMahsupSatir {
  id: string;
  maddeNo: number;
  kod: string;
  ad: string;
  borc: number;
  alacak: number;
  aciklama: string;
}

export interface EvrakItem {
  id: string;
  yon: 'ALIS' | 'SATIS';
  dosyaAdi: string;
  mimeType: string;
  durum: 'bekliyor' | 'isleniyor' | 'hazir' | 'hata' | 'aktarildi';
  hataMesaji?: string | null;
  faturaNo: string;
  faturaTarihi: string;
  cariAdi: string;
  cariVkn: string;
  malHizmet: string;
  matrah: number;
  kdvOrani: number;
  kdvTutari: number;
  kdv1: number;
  kdv10: number;
  kdv20: number;
  oivTutari: number;
  toplamTutar: number;
  muhasebeKodu: string;
  karsiHesapKodu: string;
  odemeSekli: string;
  mahsupSatirlari: EvrakMahsupSatir[];
  aktarilanFaturaId?: string | null;
  createdAt?: string;
}

interface EvrakMahsupModalProps {
  evrak: EvrakItem | null;
  allItems: EvrakItem[];
  onClose: () => void;
  onSelectEvrak: (evrak: EvrakItem) => void;
  onSaved: () => void;
}

export function EvrakMahsupModal({
  evrak,
  allItems,
  onClose,
  onSelectEvrak,
  onSaved,
}: EvrakMahsupModalProps) {
  const { apiFetch } = useApp();

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const [form, setForm] = useState<EvrakItem | null>(null);

  useEffect(() => {
    if (!evrak) {
      setForm(null);
      setFileUrl(null);
      return;
    }
    setForm({
      ...evrak,
      mahsupSatirlari: Array.isArray(evrak.mahsupSatirlari) ? [...evrak.mahsupSatirlari] : [],
    });
    setZoom(1);
    setRotation(0);
    setLoadingFile(true);
    apiFetch(`/api/evrak-havuzu/${evrak.id}/file`)
      .then((res: any) => {
        if (res?.success && res.dataUrl) setFileUrl(res.dataUrl);
        else setFileUrl(null);
      })
      .catch(() => setFileUrl(null))
      .finally(() => setLoadingFile(false));
  }, [evrak?.id, apiFetch]);

  if (!evrak || !form) return null;

  const currentIdx = allItems.findIndex((i) => i.id === evrak.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < allItems.length - 1;

  const toplamBorc = form.mahsupSatirlari.reduce((s, r) => s + (Number(r.borc) || 0), 0);
  const toplamAlacak = form.mahsupSatirlari.reduce((s, r) => s + (Number(r.alacak) || 0), 0);
  const fark = Math.abs(toplamBorc - toplamAlacak);
  const isBalanced = fark < 0.05;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v);

  const updateMahsupRow = (idx: number, field: keyof EvrakMahsupSatir, val: string | number) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = [...prev.mahsupSatirlari];
      next[idx] = { ...next[idx], [field]: val };
      return { ...prev, mahsupSatirlari: next };
    });
  };

  const addMahsupRow = () => {
    setForm((prev) => {
      if (!prev) return prev;
      const nextNo = prev.mahsupSatirlari.length + 1;
      return {
        ...prev,
        mahsupSatirlari: [
          ...prev.mahsupSatirlari,
          { id: `m_${Date.now()}`, maddeNo: nextNo, kod: '', ad: '', borc: 0, alacak: 0, aciklama: prev.cariAdi || '' },
        ],
      };
    });
  };

  const removeMahsupRow = (idx: number) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        mahsupSatirlari: prev.mahsupSatirlari.filter((_, i) => i !== idx),
      };
    });
  };

  const handleSaveOnly = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch(`/api/evrak-havuzu/${form.id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      if (res?.success) {
        toast.success('Evrak ve mahsup fişi kaydedildi.');
        onSaved();
      } else {
        toast.error(res?.message || 'Kaydedilemedi.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndApprove = async () => {
    setIsApproving(true);
    try {
      const saveRes = await apiFetch(`/api/evrak-havuzu/${form.id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      if (!saveRes?.success) {
        toast.error(saveRes?.message || 'Kaydedilemedi.');
        return;
      }
      const appRes = await apiFetch(`/api/evrak-havuzu/${form.id}/approve`, {
        method: 'POST',
      });
      if (appRes?.success) {
        toast.success(
          form.yon === 'ALIS'
            ? 'Evrak onaylandı ve Alış Faturalarına aktarıldı.'
            : 'Evrak onaylandı ve Satış Faturalarına aktarıldı.'
        );
        onSaved();
        if (hasNext) {
          onSelectEvrak(allItems[currentIdx + 1]);
        } else {
          onClose();
        }
      } else {
        toast.error(appRes?.message || 'Aktarım başarısız.');
      }
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <Dialog open={!!evrak} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[95vw] w-[95vw] max-w-[1400px] h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b bg-slate-50 flex-row items-center justify-between space-y-0">
          <div>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Scale className="w-5 h-5 text-indigo-600" />
              Evrak Mahsup Fişi &amp; Denetim Ekranı
              <Badge variant="outline" className={form.yon === 'ALIS' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-800 border-blue-200'}>
                {form.yon === 'ALIS' ? 'Alış Faturası / Fiş' : 'Satış Faturası'}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs mt-0.5">
              {form.dosyaAdi} ({currentIdx + 1} / {allItems.length})
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2 pr-8">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!hasPrev}
              onClick={() => hasPrev && onSelectEvrak(allItems[currentIdx - 1])}
              className="h-8 gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Önceki
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!hasNext}
              onClick={() => hasNext && onSelectEvrak(allItems[currentIdx + 1])}
              className="h-8 gap-1"
            >
              Sonraki <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Sol: Fiş / PDF Görseli */}
          <div className="lg:col-span-5 bg-slate-900 flex flex-col border-r border-slate-700 overflow-hidden">
            <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-white text-xs">
              <span className="truncate font-medium">{form.dosyaAdi}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-slate-200" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <span className="font-mono text-[11px] px-1">%{Math.round(zoom * 100)}</span>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-slate-200" onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}>
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-slate-200" onClick={() => setRotation((r) => (r + 90) % 360)}>
                  <RotateCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-slate-950/70">
              {loadingFile ? (
                <div className="text-slate-300 flex items-center gap-2 mt-20">
                  <Loader2 className="w-5 h-5 animate-spin" /> Belge yükleniyor...
                </div>
              ) : !fileUrl ? (
                <div className="text-slate-400 flex flex-col items-center gap-2 mt-20 text-xs">
                  <FileText className="w-10 h-10 opacity-40" /> Önizleme yüklenemedi
                </div>
              ) : form.mimeType === 'application/pdf' || fileUrl.startsWith('data:application/pdf') ? (
                <iframe src={fileUrl} title={form.dosyaAdi} className="w-full h-full min-h-[500px] bg-white rounded" />
              ) : (
                <img
                  src={fileUrl}
                  alt={form.dosyaAdi}
                  style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: 'top center' }}
                  className="max-w-full h-auto rounded shadow-xl transition-transform"
                />
              )}
            </div>
          </div>

          {/* Sağ: Fatura Bilgileri + Mahsup Satırları */}
          <div className="lg:col-span-7 overflow-y-auto p-5 space-y-5 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-500">Yön</Label>
                <Select value={form.yon} onValueChange={(v: 'ALIS' | 'SATIS') => setForm({ ...form, yon: v })}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALIS">Alış Faturası / Fiş</SelectItem>
                    <SelectItem value="SATIS">Satış Faturası</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Fatura / Fiş No</Label>
                <Input className="h-9 mt-1" value={form.faturaNo} onChange={(e) => setForm({ ...form, faturaNo: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Tarih</Label>
                <Input type="date" className="h-9 mt-1" value={form.faturaTarihi} onChange={(e) => setForm({ ...form, faturaTarihi: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-slate-500">Cari Ünvanı (Tedarikçi / Müşteri)</Label>
                <Input className="h-9 mt-1" value={form.cariAdi} onChange={(e) => setForm({ ...form, cariAdi: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs text-slate-500">VKN / TCKN</Label>
                <Input className="h-9 mt-1 font-mono" value={form.cariVkn} onChange={(e) => setForm({ ...form, cariVkn: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-slate-500">Mal / Hizmet Açıklaması</Label>
                <Input className="h-9 mt-1" value={form.malHizmet} onChange={(e) => setForm({ ...form, malHizmet: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Ana Muhasebe Kodu</Label>
                <div className="mt-1">
                  <LucaAccountSelect
                    value={form.muhasebeKodu}
                    onChange={(v) => setForm({ ...form, muhasebeKodu: v })}
                    placeholder="Hesap Kodu"
                  />
                </div>
              </div>
            </div>

            {/* Tutar Kutuları */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 bg-slate-50 rounded-xl border">
              <div>
                <Label className="text-[11px] text-slate-500">Matrah</Label>
                <Input type="number" step="0.01" className="h-8 mt-1 bg-white font-mono text-xs" value={form.matrah} onChange={(e) => setForm({ ...form, matrah: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-[11px] text-slate-500">KDV %1</Label>
                <Input type="number" step="0.01" className="h-8 mt-1 bg-white font-mono text-xs" value={form.kdv1} onChange={(e) => setForm({ ...form, kdv1: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-[11px] text-slate-500">KDV %10</Label>
                <Input type="number" step="0.01" className="h-8 mt-1 bg-white font-mono text-xs" value={form.kdv10} onChange={(e) => setForm({ ...form, kdv10: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-[11px] text-slate-500">KDV %20</Label>
                <Input type="number" step="0.01" className="h-8 mt-1 bg-white font-mono text-xs" value={form.kdv20} onChange={(e) => setForm({ ...form, kdv20: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-[11px] text-slate-500 font-semibold text-indigo-700">Genel Toplam</Label>
                <Input type="number" step="0.01" className="h-8 mt-1 bg-white font-mono text-xs font-bold" value={form.toplamTutar} onChange={(e) => setForm({ ...form, toplamTutar: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            {/* Mahsup Fişi Satırları */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  Muhasebe Mahsup Fişi Satırları
                  <Badge className={cn('text-[11px]', isBalanced ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-red-100 text-red-800 hover:bg-red-100')}>
                    {isBalanced ? 'Borç = Alacak Denk' : `Fark: ${formatCurrency(fark)}`}
                  </Badge>
                </h4>
                <Button type="button" size="sm" variant="outline" onClick={addMahsupRow} className="h-7 text-xs gap-1">
                  <Plus className="w-3.5 h-3.5" /> Satır Ekle
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 border-b text-slate-600">
                    <tr>
                      <th className="p-2 text-left w-36">Hesap Kodu</th>
                      <th className="p-2 text-left">Açıklama</th>
                      <th className="p-2 text-right w-28">Borç</th>
                      <th className="p-2 text-right w-28">Alacak</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {form.mahsupSatirlari.map((row, idx) => (
                      <tr key={row.id || idx}>
                        <td className="p-1.5">
                          <Input
                            className="h-7 text-xs font-mono"
                            value={row.kod}
                            onChange={(e) => updateMahsupRow(idx, 'kod', e.target.value)}
                            placeholder="770.01"
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            className="h-7 text-xs"
                            value={row.aciklama}
                            onChange={(e) => updateMahsupRow(idx, 'aciklama', e.target.value)}
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-7 text-xs text-right font-mono"
                            value={row.borc}
                            onChange={(e) => updateMahsupRow(idx, 'borc', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-7 text-xs text-right font-mono"
                            value={row.alacak}
                            onChange={(e) => updateMahsupRow(idx, 'alacak', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-1.5 text-center">
                          <button type="button" onClick={() => removeMahsupRow(idx)} className="text-slate-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t font-bold">
                    <tr>
                      <td colSpan={2} className="p-2 text-right">TOPLAM:</td>
                      <td className="p-2 text-right font-mono text-emerald-700">{formatCurrency(toplamBorc)}</td>
                      <td className="p-2 text-right font-mono text-indigo-700">{formatCurrency(toplamAlacak)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Alt Aksiyon Butonları */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Kapat
              </Button>
              <Button type="button" variant="outline" onClick={handleSaveOnly} disabled={isSaving || isApproving} className="gap-1.5">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Taslak Kaydet
              </Button>
              {form.durum !== 'aktarildi' && (
                <Button
                  type="button"
                  onClick={handleSaveAndApprove}
                  disabled={isApproving || isSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Onayla ve Faturaya Aktar
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
