import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Building2,
  TrendingUp,
  Receipt,
  ShoppingCart,
  DollarSign,
  Download,
  Search,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  CheckCircle2,
  Clock,
  Loader2,
  Store
} from 'lucide-react';
import { useUrunFaturalari } from '../hooks/useStokQuery';
import type { IUrun } from '../types/stok.types';

interface UrunFaturaGecmisiModalProps {
  isOpen: boolean;
  onClose: () => void;
  urun: IUrun | null;
}

export const UrunFaturaGecmisiModal: React.FC<UrunFaturaGecmisiModalProps> = ({
  isOpen,
  onClose,
  urun,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('alis');

  const { data, isLoading } = useUrunFaturalari(isOpen && urun ? urun.id : null);

  const istatistik = data?.istatistik || {
    toplamAlisMiktari: 0,
    toplamAlisTutari: 0,
    ortalamaAlisFiyati: 0,
    minAlisFiyati: 0,
    maxAlisFiyati: 0,
    alisFaturaSayisi: 0,
    toplamSatisMiktari: 0,
    toplamSatisTutari: 0,
    satisFaturaSayisi: 0,
    anaTedarikci: null,
    enSonAlis: null,
  };

  const alisFaturalari: any[] = data?.alisFaturalari || [];
  const satisFaturalari: any[] = data?.satisFaturalari || [];
  const tedarikciler: any[] = data?.tedarikciler || [];

  // Filtered Alış Faturaları
  const filteredAlis = useMemo(() => {
    if (!searchTerm) return alisFaturalari;
    const term = searchTerm.toLowerCase();
    return alisFaturalari.filter(
      (f) =>
        f.tedarikciAdi?.toLowerCase().includes(term) ||
        f.faturaNo?.toLowerCase().includes(term) ||
        f.tedarikciVkn?.toLowerCase().includes(term)
    );
  }, [alisFaturalari, searchTerm]);

  // Filtered Satış Faturaları
  const filteredSatis = useMemo(() => {
    if (!searchTerm) return satisFaturalari;
    const term = searchTerm.toLowerCase();
    return satisFaturalari.filter(
      (f) =>
        f.musteriAdi?.toLowerCase().includes(term) ||
        f.faturaNo?.toLowerCase().includes(term) ||
        f.musteriVkn?.toLowerCase().includes(term)
    );
  }, [satisFaturalari, searchTerm]);

  if (!urun) return null;

  const anaBirim = urun.anaBirim || 'Adet';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl border-slate-200 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-indigo-300">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
                  {urun.urunAdi}
                  <Badge variant="secondary" className="bg-white/20 text-white text-xs border-none font-mono">
                    {urun.stokKodu}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-xs mt-1 flex items-center gap-2">
                  <span>Barkod: <strong>{urun.barkod || 'Yok'}</strong></span>
                  <span>•</span>
                  <span>Ana Birim: <strong>{anaBirim}</strong></span>
                  {urun.birimFiyat > 0 && (
                    <>
                      <span>•</span>
                      <span>Kayıtlı Fiyat: <strong>{urun.birimFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</strong></span>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-3 py-1">
                Fatura & Tedarik Geçmişi
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium">Bu ürüne ait fatura ve tedarikçi hareketleri yükleniyor...</p>
            </div>
          ) : (
            <>
              {/* Özet KPI Kartları */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                {/* 1. Toplam Alınan Miktar */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                    <span>Toplam Alınan Miktar</span>
                    <Package className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {istatistik.toplamAlisMiktari.toLocaleString('tr-TR')}
                    <span className="text-xs font-medium text-slate-500 ml-1.5">{anaBirim}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                    <span>{istatistik.alisFaturaSayisi} alış faturasında</span>
                  </div>
                  <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full -mr-4 -mt-4 pointer-events-none" />
                </div>

                {/* 2. Toplam Alış Harcaması */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                    <span>Toplam Alış Tutarı</span>
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {istatistik.toplamAlisTutari.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-xs font-medium text-slate-500 ml-1">₺</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 font-medium">
                    Tedarikçilere ödenen toplam
                  </div>
                  <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -mr-4 -mt-4 pointer-events-none" />
                </div>

                {/* 3. Ağırlıklı Ortalama Alış Fiyatı */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                    <span>Ortalama Alış Fiyatı</span>
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-black text-indigo-700 tracking-tight">
                    {istatistik.ortalamaAlisFiyati.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-xs font-medium text-slate-500 ml-1">₺</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium truncate">
                    <span>Min: {istatistik.minAlisFiyati > 0 ? istatistik.minAlisFiyati.toFixed(2) : '0'} ₺</span>
                    <span>•</span>
                    <span>Max: {istatistik.maxAlisFiyati > 0 ? istatistik.maxAlisFiyati.toFixed(2) : '0'} ₺</span>
                  </div>
                  <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-full -mr-4 -mt-4 pointer-events-none" />
                </div>

                {/* 4. Ana Tedarikçi */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                    <span>Başlıca Tedarikçi</span>
                    <Building2 className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-base font-bold text-slate-900 truncate" title={istatistik.anaTedarikci?.tedarikciAdi || 'Veri Yok'}>
                    {istatistik.anaTedarikci?.tedarikciAdi || 'Henüz alım yok'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between font-medium">
                    <span>{tedarikciler.length} farklı tedarikçi</span>
                    {istatistik.enSonAlis?.faturaTarihi && (
                      <span className="text-slate-400">Son: {istatistik.enSonAlis.faturaTarihi}</span>
                    )}
                  </div>
                  <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full -mr-4 -mt-4 pointer-events-none" />
                </div>
              </div>

              {/* Sekmeler & Tablolar */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <TabsList className="bg-slate-200/70 p-1 rounded-xl">
                    <TabsTrigger value="alis" className="gap-2 rounded-lg text-xs font-semibold">
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Tedarikçi Alış Faturaları ({alisFaturalari.length})
                    </TabsTrigger>
                    <TabsTrigger value="tedarikciler" className="gap-2 rounded-lg text-xs font-semibold">
                      <Store className="w-3.5 h-3.5" />
                      Tedarikçi Dağılımı ({tedarikciler.length})
                    </TabsTrigger>
                    <TabsTrigger value="satis" className="gap-2 rounded-lg text-xs font-semibold">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Müşteri Satışları ({satisFaturalari.length})
                    </TabsTrigger>
                  </TabsList>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Firma veya fatura ara..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9 text-xs bg-white rounded-lg border-slate-200"
                    />
                  </div>
                </div>

                {/* 1. Alış Faturaları Tablosu */}
                <TabsContent value="alis" className="m-0 space-y-4">
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                    <Table>
                      <TableHeader className="bg-slate-50/80">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-bold w-[120px]">Fatura No</TableHead>
                          <TableHead className="text-xs font-bold w-[95px]">Tarih</TableHead>
                          <TableHead className="text-xs font-bold">Tedarikçi Firma / Ünvan</TableHead>
                          <TableHead className="text-right text-xs font-bold">Alınan Miktar</TableHead>
                          <TableHead className="text-right text-xs font-bold">Birim Fiyat</TableHead>
                          <TableHead className="text-right text-xs font-bold">KDV</TableHead>
                          <TableHead className="text-right text-xs font-bold">Toplam Tutar</TableHead>
                          <TableHead className="text-center text-xs font-bold">Depo</TableHead>
                          <TableHead className="text-center text-xs font-bold w-[80px]">Belge</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAlis.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="h-40 text-center text-slate-400">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Receipt className="w-8 h-8 opacity-20" />
                                <p className="text-sm font-medium">Bu ürüne ait alış faturası kaydı bulunamadı.</p>
                                <p className="text-xs text-slate-400">XML yükleyerek veya Alış Faturaları ekranından fatura ekleyebilirsiniz.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredAlis.map((f, idx) => {
                            const birimFiyat = f.hesaplananBirimFiyat || 0;
                            const miktar = f.hesaplananMiktar || 1;
                            const toplam = f.hesaplananTutar || (miktar * birimFiyat);

                            return (
                              <TableRow key={f.faturaId || idx} className="hover:bg-slate-50/60 transition-colors">
                                <TableCell className="font-mono text-xs font-semibold text-slate-800">
                                  {f.faturaNo || '-'}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-slate-600">
                                  {f.faturaTarihi || '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-xs text-slate-900 truncate max-w-[220px]" title={f.tedarikciAdi}>
                                      {f.tedarikciAdi}
                                    </span>
                                    {f.tedarikciVkn && (
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        VKN: {f.tedarikciVkn}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                                  {miktar.toLocaleString('tr-TR')} {anaBirim}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-semibold text-indigo-700 bg-indigo-50/20">
                                  {birimFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                </TableCell>
                                <TableCell className="text-right font-mono text-[11px] text-slate-500">
                                  %{f.kdvOrani || 20}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                                  {toplam.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                </TableCell>
                                <TableCell className="text-center text-xs text-slate-600">
                                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 font-normal">
                                    {f.depoAdi || 'Merkez Depo'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  {f.pdfDosya ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => window.open(f.pdfDosya, '_blank')}
                                      className="h-7 w-7 p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                      title="Fatura PDF İndir / Görüntüle"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </Button>
                                  ) : (
                                    <span className="text-[11px] text-slate-300">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* 2. Tedarikçi Dağılımı Tablosu */}
                <TabsContent value="tedarikciler" className="m-0 space-y-4">
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                    <Table>
                      <TableHeader className="bg-slate-50/80">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-bold">Tedarikçi Firma</TableHead>
                          <TableHead className="text-center text-xs font-bold w-[100px]">Fatura Sayısı</TableHead>
                          <TableHead className="text-right text-xs font-bold">Toplam Alınan Miktar</TableHead>
                          <TableHead className="text-right text-xs font-bold">Toplam Ödeme Tutarı</TableHead>
                          <TableHead className="text-right text-xs font-bold">Ortalama Birim Fiyat</TableHead>
                          <TableHead className="text-right text-xs font-bold">Son Alış Fiyatı</TableHead>
                          <TableHead className="text-center text-xs font-bold w-[120px]">Pay Oranı</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tedarikciler.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-32 text-center text-slate-400">
                              Henüz tedarikçi verisi bulunmuyor.
                            </TableCell>
                          </TableRow>
                        ) : (
                          tedarikciler.map((t, i) => {
                            const payOrani = istatistik.toplamAlisTutari > 0 
                              ? Math.round((t.toplamTutar / istatistik.toplamAlisTutari) * 100) 
                              : 0;
                            const ortFiyat = t.toplamMiktar > 0 ? (t.toplamTutar / t.toplamMiktar) : 0;

                            return (
                              <TableRow key={i} className="hover:bg-slate-50/60 transition-colors">
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                                      {t.tedarikciAdi.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-semibold text-xs text-slate-900">{t.tedarikciAdi}</div>
                                      {t.tedarikciVkn && (
                                        <div className="text-[10px] text-slate-400 font-mono">VKN: {t.tedarikciVkn}</div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center font-mono text-xs font-medium">
                                  {t.faturaSayisi} adet
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                                  {t.toplamMiktar.toLocaleString('tr-TR')} {anaBirim}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-bold text-emerald-700">
                                  {t.toplamTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-semibold text-slate-700">
                                  {ortFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-slate-600">
                                  {t.sonBirimFiyat > 0 ? `${t.sonBirimFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center gap-2 justify-center">
                                    <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-indigo-600 rounded-full" 
                                        style={{ width: `${Math.min(payOrani, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-mono text-slate-600 font-semibold">%{payOrani}</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* 3. Satış Faturaları Tablosu */}
                <TabsContent value="satis" className="m-0 space-y-4">
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                    <Table>
                      <TableHeader className="bg-slate-50/80">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-bold w-[120px]">Fatura No</TableHead>
                          <TableHead className="text-xs font-bold w-[95px]">Tarih</TableHead>
                          <TableHead className="text-xs font-bold">Müşteri / Firma</TableHead>
                          <TableHead className="text-right text-xs font-bold">Satılan Miktar</TableHead>
                          <TableHead className="text-right text-xs font-bold">Satış Birim Fiyatı</TableHead>
                          <TableHead className="text-right text-xs font-bold">Toplam Satış Tutarı</TableHead>
                          <TableHead className="text-center text-xs font-bold w-[80px]">Belge</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSatis.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-32 text-center text-slate-400">
                              Bu ürüne ait satış faturası kaydı bulunamadı.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredSatis.map((f, idx) => {
                            const birimFiyat = f.hesaplananBirimFiyat || 0;
                            const miktar = f.hesaplananMiktar || 1;
                            const toplam = f.hesaplananTutar || (miktar * birimFiyat);

                            return (
                              <TableRow key={f.faturaId || idx} className="hover:bg-slate-50/60 transition-colors">
                                <TableCell className="font-mono text-xs font-semibold text-slate-800">
                                  {f.faturaNo || '-'}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-slate-600">
                                  {f.faturaTarihi || '-'}
                                </TableCell>
                                <TableCell className="font-semibold text-xs text-slate-900">
                                  {f.musteriAdi || 'Muhtelif Müşteri'}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                                  {miktar.toLocaleString('tr-TR')} {anaBirim}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-semibold text-blue-700 bg-blue-50/20">
                                  {birimFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                                  {toplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                </TableCell>
                                <TableCell className="text-center">
                                  {f.pdfDosya ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => window.open(f.pdfDosya, '_blank')}
                                      className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      title="Fatura PDF İndir"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </Button>
                                  ) : (
                                    <span className="text-[11px] text-slate-300">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-slate-100/80 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            * Alış faturaları ve stok giriş hareketleri otomatik olarak eşleştirilmiştir.
          </div>
          <Button variant="outline" onClick={onClose} className="h-9 px-4 text-xs font-semibold">
            Kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
