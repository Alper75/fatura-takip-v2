import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useApp } from '@/context/AppContext';
import {
  CheckCircle2,
  Clock,
  FileText,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  Trash2,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EvrakMahsupModal, type EvrakItem } from './evrak/EvrakMahsupModal';

function EvrakThumbnail({ id, mimeType, name }: { id: string; mimeType: string; name: string }) {
  const { apiFetch } = useApp();
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (mimeType === 'application/pdf') return;
    let cancelled = false;
    apiFetch(`/api/evrak-havuzu/${id}/file`)
      .then((res: any) => {
        if (!cancelled && res?.success && res.dataUrl) {
          setThumbUrl(res.dataUrl);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, mimeType, apiFetch]);

  if (mimeType === 'application/pdf') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 p-2">
        <FileText className="w-8 h-8 text-red-500 mb-1" />
        <span className="text-[10px] font-medium text-center truncate w-full">{name}</span>
      </div>
    );
  }

  if (!thumbUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
        <FileText className="w-6 h-6 opacity-50" />
      </div>
    );
  }

  return <img src={thumbUrl} alt={name} className="w-full h-full object-cover" />;
}

export function EvrakHavuzu() {
  const { apiFetch, setCurrentView, fetchAlisFaturalari, fetchSatisFaturalari } = useApp();

  const [items, setItems] = useState<EvrakItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadYon, setUploadYon] = useState<'ALIS' | 'SATIS'>('ALIS');
  const [filterYon, setFilterYon] = useState<'ALL' | 'ALIS' | 'SATIS'>('ALL');
  const [filterDurum, setFilterDurum] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid2'>('list');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeEvrak, setActiveEvrak] = useState<EvrakItem | null>(null);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await apiFetch('/api/evrak-havuzu');
      if (res?.success) {
        setItems(res.data || []);
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Kuyrukta bekleyen veya işlenen evrak varken otomatik yenile
  useEffect(() => {
    const hasPending = items.some((i) => i.durum === 'bekliyor' || i.durum === 'isleniyor');
    if (!hasPending) return;
    const timer = setInterval(() => {
      fetchItems(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [items, fetchItems]);

  const handleUploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('yon', uploadYon);
      files.forEach((f) => fd.append('files', f));

      const res = await apiFetch('/api/evrak-havuzu/upload', {
        method: 'POST',
        body: fd,
      });
      if (res?.success) {
        toast.success(`${res.count || files.length} evrak havuza eklendi. Yapay zeka arka planda analiz edecek.`);
        fetchItems(true);
      } else {
        toast.error(res?.message || 'Yükleme başarısız.');
      }
    } catch (e: any) {
      toast.error('Yükleme hatası: ' + (e?.message || 'Bilinmeyen hata'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkApproving(true);
    try {
      const res = await apiFetch('/api/evrak-havuzu/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res?.success) {
        toast.success(`${res.count || selectedIds.length} evrak onaylandı ve sisteme aktarıldı.`);
        setSelectedIds([]);
        fetchItems(true);
        fetchAlisFaturalari();
        fetchSatisFaturalari();
      } else {
        toast.error(res?.message || 'Toplu onay başarısız.');
      }
    } finally {
      setIsBulkApproving(false);
    }
  };

  const handleReanalyze = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await apiFetch(`/api/evrak-havuzu/${id}/reanalyze`, { method: 'POST' });
    if (res?.success) {
      toast.info('Evrak tekrar AI kuyruğuna alındı.');
      fetchItems(true);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await apiFetch(`/api/evrak-havuzu/${id}`, { method: 'DELETE' });
    if (res?.success) {
      toast.success('Evrak havuzdan silindi.');
      setItems((prev) => prev.filter((x) => x.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const counts = useMemo(() => {
    return {
      bekliyor: items.filter((i) => i.durum === 'bekliyor' || i.durum === 'isleniyor').length,
      hazir: items.filter((i) => i.durum === 'hazir').length,
      hata: items.filter((i) => i.durum === 'hata').length,
      aktarildi: items.filter((i) => i.durum === 'aktarildi').length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (filterYon !== 'ALL' && i.yon !== filterYon) return false;
      if (filterDurum !== 'ALL' && i.durum !== filterDurum) return false;
      if (
        q &&
        !i.cariAdi.toLowerCase().includes(q) &&
        !i.faturaNo.toLowerCase().includes(q) &&
        !i.dosyaAdi.toLowerCase().includes(q) &&
        !i.cariVkn.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [items, filterYon, filterDurum, search]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v);

  const renderDurumBadge = (item: EvrakItem) => {
    switch (item.durum) {
      case 'bekliyor':
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 gap-1 text-[11px]">
            <Clock className="w-3 h-3" /> Sırada
          </Badge>
        );
      case 'isleniyor':
        return (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-300 gap-1 text-[11px]">
            <Loader2 className="w-3 h-3 animate-spin" /> AI Okuyor
          </Badge>
        );
      case 'hazir':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 gap-1 text-[11px]">
            <Sparkles className="w-3 h-3" /> Onay Bekliyor
          </Badge>
        );
      case 'aktarildi':
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1 text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> Aktarıldı
          </Badge>
        );
      case 'hata':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 gap-1 text-[11px]" title={item.hataMesaji || ''}>
            <AlertCircle className="w-3 h-3" /> Hata
          </Badge>
        );
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-5">
      {/* Üst Başlık ve Hızlı Yükleme Kutusu */}
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Evrak Havuzu (Arka Plan AI Kuyruğu)
              </CardTitle>
              <CardDescription className="mt-1">
                Fiş ve faturaları beklemeden yükleyin; sistem arka planda yapay zeka ile analiz etsin, siz hazır olduğunda mahsup fişiyle onaylayın.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentView('muhasebe-fis-inceleme')}
                className="gap-2 text-indigo-700 bg-indigo-50/60 border-indigo-200 hover:bg-indigo-100"
              >
                <Scale className="w-4 h-4" />
                Muhasebe Fiş Denetimi &amp; Mahsup Kontrolü
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => fetchItems()} title="Yenile">
                <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {/* Yön Seçimi + Sürükle Bırak Yükleme */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className="lg:col-span-3 flex flex-col justify-between gap-2 p-3.5 rounded-xl bg-slate-50 border">
              <span className="text-xs font-semibold text-slate-600">Yüklenecek Evrak Türü</span>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={uploadYon === 'ALIS' ? 'default' : 'outline'}
                  onClick={() => setUploadYon('ALIS')}
                  className={uploadYon === 'ALIS' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
                >
                  Alış / Fiş
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={uploadYon === 'SATIS' ? 'default' : 'outline'}
                  onClick={() => setUploadYon('SATIS')}
                  className={uploadYon === 'SATIS' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                >
                  Satış
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1">
                <span className="bg-white border rounded px-2 py-1 text-slate-600">Sırada: <b>{counts.bekliyor}</b></span>
                <span className="bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-800">Hazır: <b>{counts.hazir}</b></span>
                <span className="bg-emerald-50 border border-emerald-200 rounded px-2 py-1 text-emerald-700">Aktarılan: <b>{counts.aktarildi}</b></span>
                <span className="bg-red-50 border border-red-200 rounded px-2 py-1 text-red-700">Hatalı: <b>{counts.hata}</b></span>
              </div>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.length) handleUploadFiles(Array.from(e.dataTransfer.files));
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'lg:col-span-9 border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all',
                isDragging ? 'border-indigo-500 bg-indigo-50/70' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleUploadFiles(Array.from(e.target.files));
                    e.target.value = '';
                  }
                }}
              />
              {isUploading ? (
                <div className="flex items-center gap-2 text-indigo-700 font-semibold">
                  <Loader2 className="w-5 h-5 animate-spin" /> Dosyalar havuza yükleniyor...
                </div>
              ) : (
                <>
                  <Upload className="w-7 h-7 text-indigo-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-800">
                    {uploadYon === 'ALIS' ? 'Alış Fiş / Faturalarını' : 'Satış Faturalarını'} Buraya Sürükleyin veya Seçin
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Çoklu PDF / Fotoğraf destekler — Yüklediğiniz anda sıraya alınır, beklemenize gerek kalmaz.
                  </p>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filtre Barı + Sahibinden Tarzı Görünüm Switch + Toplu Onay */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ünvan, Fatura No, VKN ara..."
              className="pl-8 h-9 text-xs"
            />
          </div>

          <div className="flex items-center border rounded-lg p-0.5 bg-slate-50 text-xs">
            {(['ALL', 'ALIS', 'SATIS'] as const).map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setFilterYon(y)}
                className={cn(
                  'px-2.5 py-1 rounded-md font-medium transition-colors',
                  filterYon === y ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {y === 'ALL' ? 'Tümü' : y === 'ALIS' ? 'Alış' : 'Satış'}
              </button>
            ))}
          </div>

          <div className="flex items-center border rounded-lg p-0.5 bg-slate-50 text-xs">
            {[
              { k: 'ALL', l: 'Hepsi' },
              { k: 'hazir', l: `Hazır (${counts.hazir})` },
              { k: 'bekliyor', l: `Sırada (${counts.bekliyor})` },
              { k: 'hata', l: `Hatalı (${counts.hata})` },
              { k: 'aktarildi', l: `Aktarılan (${counts.aktarildi})` },
            ].map((d) => (
              <button
                key={d.k}
                type="button"
                onClick={() => setFilterDurum(d.k)}
                className={cn(
                  'px-2.5 py-1 rounded-md font-medium transition-colors',
                  filterDurum === d.k ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {d.l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={handleBulkApprove}
              disabled={isBulkApproving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-9"
            >
              {isBulkApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Seçilenleri Onayla &amp; Aktar ({selectedIds.length})
            </Button>
          )}

          {/* Sahibinden Tarzı Liste / 2'li Grid Geçiş Butonu */}
          <div className="flex items-center border rounded-lg p-0.5 bg-slate-100">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setViewMode('list')}
              className={cn('h-8 px-2.5 gap-1 text-xs', viewMode === 'list' && 'bg-white text-slate-900 shadow-xs hover:bg-white')}
              title="Alt Alta Liste Görünümü"
            >
              <List className="w-4 h-4" /> Liste
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'grid2' ? 'default' : 'ghost'}
              onClick={() => setViewMode('grid2')}
              className={cn('h-8 px-2.5 gap-1 text-xs', viewMode === 'grid2' && 'bg-white text-slate-900 shadow-xs hover:bg-white')}
              title="2 Sütunlu Kart Görünümü"
            >
              <LayoutGrid className="w-4 h-4" /> 2&apos;li Kart
            </Button>
          </div>
        </div>
      </div>

      {/* Evrak Listesi (Sahibinden Tarzı Liste veya 2'li Kart Görünümü) */}
      {filteredItems.length === 0 ? (
        <Card className="border-0 shadow-sm bg-white p-12 text-center text-slate-400 text-sm">
          Havuzda gösterilecek evrak bulunmuyor. Yukarıdan fiş veya fatura yükleyebilirsiniz.
        </Card>
      ) : viewMode === 'list' ? (
        <Card className="border-0 shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 border-b text-slate-700">
                <tr>
                  <th className="p-2.5 w-8 text-center">
                    <Checkbox
                      checked={
                        filteredItems.filter((i) => i.durum === 'hazir').length > 0 &&
                        filteredItems.filter((i) => i.durum === 'hazir').every((i) => selectedIds.includes(i.id))
                      }
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedIds(filteredItems.filter((i) => i.durum === 'hazir').map((i) => i.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                    />
                  </th>
                  <th className="p-2.5 w-28 text-left">Belge</th>
                  <th className="p-2.5 text-left">Cari / Başlık</th>
                  <th className="p-2.5 text-right">Matrah</th>
                  <th className="p-2.5 text-right">KDV</th>
                  <th className="p-2.5 text-right">Toplam Tutar</th>
                  <th className="p-2.5 text-center">Fatura Tarihi</th>
                  <th className="p-2.5 text-center">Durum</th>
                  <th className="p-2.5 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setActiveEvrak(item)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="p-2.5 text-center" onClick={(e) => toggleSelect(item.id, e)}>
                      <Checkbox
                        checked={selectedIds.includes(item.id)}
                        disabled={item.durum === 'aktarildi'}
                      />
                    </td>
                    <td className="p-2">
                      <div className="w-24 h-16 rounded border overflow-hidden bg-slate-50 shrink-0">
                        <EvrakThumbnail id={item.id} mimeType={item.mimeType} name={item.dosyaAdi} />
                      </div>
                    </td>
                    <td className="p-2.5 align-top">
                      <div className="font-semibold text-sm text-blue-900 hover:underline">
                        {item.cariAdi || item.dosyaAdi}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] py-0">
                          {item.yon === 'ALIS' ? 'Alış' : 'Satış'}
                        </Badge>
                        {item.faturaNo && <span className="font-mono">No: {item.faturaNo}</span>}
                        {item.muhasebeKodu && <span className="font-mono text-indigo-700">Kod: {item.muhasebeKodu}</span>}
                      </div>
                      {item.malHizmet && (
                        <div className="text-[11px] text-slate-500 truncate max-w-md mt-0.5">{item.malHizmet}</div>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-mono">{formatCurrency(item.matrah)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-600">{formatCurrency(item.kdvTutari)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-red-700 text-sm">
                      {formatCurrency(item.toplamTutar)}
                    </td>
                    <td className="p-2.5 text-center text-slate-600">{item.faturaTarihi || '-'}</td>
                    <td className="p-2.5 text-center">{renderDurumBadge(item)}</td>
                    <td className="p-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {item.durum === 'hata' && (
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-indigo-600" onClick={(e) => handleReanalyze(item.id, e)} title="Tekrar Tara">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={(e) => handleDelete(item.id, e)} title="Sil">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* 2 Sütunlu Kart (Sahibinden 2'li Grid Görünümü) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              onClick={() => setActiveEvrak(item)}
              className={cn(
                'border shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden bg-white',
                selectedIds.includes(item.id) && 'ring-2 ring-indigo-500'
              )}
            >
              <CardContent className="p-3 flex gap-3.5 items-stretch">
                <div className="w-36 h-32 rounded-lg border overflow-hidden bg-slate-50 shrink-0 relative">
                  <EvrakThumbnail id={item.id} mimeType={item.mimeType} name={item.dosyaAdi} />
                  <div
                    className="absolute top-1.5 left-1.5 bg-white/90 rounded p-0.5 shadow-xs"
                    onClick={(e) => toggleSelect(item.id, e)}
                  >
                    <Checkbox checked={selectedIds.includes(item.id)} disabled={item.durum === 'aktarildi'} />
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span className="font-mono truncate">#{item.faturaNo || item.dosyaAdi}</span>
                      {renderDurumBadge(item)}
                    </div>
                    <h4 className="font-semibold text-sm text-blue-900 truncate mt-0.5">
                      {item.cariAdi || item.dosyaAdi}
                    </h4>
                    <p className="text-base font-bold text-red-700 font-mono mt-1">
                      {formatCurrency(item.toplamTutar)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-600 mt-2 pt-2 border-t">
                    <div>Matrah: <b className="font-mono">{formatCurrency(item.matrah)}</b></div>
                    <div>KDV: <b className="font-mono">{formatCurrency(item.kdvTutari)}</b></div>
                    <div>Tarih: <b>{item.faturaTarihi || '-'}</b></div>
                    <div>Kod: <b className="font-mono text-indigo-700">{item.muhasebeKodu || '-'}</b></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EvrakMahsupModal
        evrak={activeEvrak}
        allItems={filteredItems}
        onClose={() => setActiveEvrak(null)}
        onSelectEvrak={(next) => setActiveEvrak(next)}
        onSaved={() => {
          fetchItems(true);
          fetchAlisFaturalari();
          fetchSatisFaturalari();
        }}
      />
    </div>
  );
}
