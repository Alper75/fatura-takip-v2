import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { 
  Upload, 
  FileText, 
  Trash2, 
  CheckCircle2,
  XCircle,
  FilePlus,
  FileSpreadsheet,
  Calendar,
  CreditCard,
  ShoppingCart,
  Building2,
  Edit
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { ODEME_DURUMU_LABELS, ODEME_DURUMU_COLORS } from '@/types';
import { FilterBar } from '@/components/FilterBar';
import type { FilterValues } from '@/components/FilterBar';

export function AlisFaturaListesi() {
  const { 
    alisFaturalari, 
    deleteAlisFatura, 
    uploadAlisPdf, 
    uploadAlisDekont,
    downloadAlisPdf, 
    downloadAlisDekont,
    updateAlisFaturaOdeme,
    openAlisDrawer,
    parseInvoiceXml,
    bankaHesaplari
  } = useApp();
  
  const [faturaToDelete, setFaturaToDelete] = useState<string | null>(null);
  const [odemeDialogOpen, setOdemeDialogOpen] = useState(false);
  const [selectedFatura, setSelectedFatura] = useState<string | null>(null);
  const [odemeTarihi, setOdemeTarihi] = useState('');
  const [odemeDurumu, setOdemeDurumu] = useState<'odenmedi' | 'odendi' | 'bekliyor'>('odendi');
  const [bankaId, setBankaId] = useState<string>('');
  const [filterValues, setFilterValues] = useState<FilterValues>({
    search: '',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    status: 'all',
  });
  
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dekontInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const xmlInputRef = useRef<HTMLInputElement | null>(null);

  const handleXmlFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      toast.info('XML dosyası işleniyor...', { id: 'xml-upload' });
      const result = await parseInvoiceXml(file);
      if (result.success && result.data) {
        toast.success('XML başarıyla okundu!', { id: 'xml-upload' });
        const data = result.data;
        const initialData = {
          tedarikciVkn: data.supplier?.vkn || '',
          tedarikciAdi: (data.supplier?.ad ? `${data.supplier.ad} ${data.supplier.soyad || ''}`.trim() : '') || 'Bilinmiyor',
          faturaNo: data.faturaNo || '',
          faturaTarihi: data.faturaTarihi || new Date().toISOString().split('T')[0],
          vadeTarihi: '',
          malHizmetAdi: data.items?.[0]?.name || 'Muhtelif İşlemler',
          toplamTutar: data.toplamTutar?.toString() || data.matrah?.toString() || '',
          kdvOrani: data.kdvOrani?.toString() || '20',
          tevkifatOrani: data.tevkifatOrani || '0',
          stopajOrani: data.stopajOrani || '0',
          aciklama: ''
        };
        openAlisDrawer(initialData);
      } else {
        toast.error(result.message || 'XML okunamadı.', { id: 'xml-upload' });
      }
      if (xmlInputRef.current) xmlInputRef.current.value = '';
    }
  };

  const filteredFaturalar = alisFaturalari.filter((fatura) => {
    const searchLower = filterValues.search.toLowerCase();
    const matchesSearch = 
      (fatura.faturaNo || '').toLowerCase().includes(searchLower) ||
      (fatura.tedarikciAdi || '').toLowerCase().includes(searchLower) ||
      (fatura.tedarikciVkn || '').toLowerCase().includes(searchLower) ||
      (fatura.malHizmetAdi || '').toLowerCase().includes(searchLower);

    const matchesStatus = filterValues.status === 'all' || fatura.odemeDurumu === filterValues.status;
    
    const matchesDate = (!filterValues.startDate || fatura.faturaTarihi >= filterValues.startDate) &&
                        (!filterValues.endDate || fatura.faturaTarihi <= filterValues.endDate);
    
    const amount = fatura.toplamTutar;
    const matchesAmount = (!filterValues.minAmount || amount >= parseFloat(filterValues.minAmount)) &&
                          (!filterValues.maxAmount || amount <= parseFloat(filterValues.maxAmount));

    return matchesSearch && matchesStatus && matchesDate && matchesAmount;
  });

  const formatCurrency = (value: number) => {
    const safeValue = isNaN(value) || value === null || value === undefined ? 0 : value;
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 0
    }).format(safeValue);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleFileSelect = (faturaId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      uploadAlisPdf(faturaId, file);
      toast.success('Fatura PDF\'i yüklendi');
    }
  };

  const handleDekontSelect = (faturaId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      uploadAlisDekont(faturaId, file);
      toast.success('Ödeme dekontu yüklendi');
    }
  };

  const triggerFileInput = (faturaId: string) => {
    fileInputRefs.current[faturaId]?.click();
  };

  const triggerDekontInput = (faturaId: string) => {
    dekontInputRefs.current[faturaId]?.click();
  };

  const handleDelete = (id: string) => {
    deleteAlisFatura(id);
    setFaturaToDelete(null);
    toast.success('Fatura silindi');
  };

  const openOdemeDialog = (fatura: typeof alisFaturalari[0]) => {
    setSelectedFatura(fatura.id);
    setOdemeTarihi(fatura.odemeTarihi || new Date().toISOString().split('T')[0]);
    setOdemeDurumu(fatura.odemeDurumu);
    setBankaId(''); // Reset bank selection
    setOdemeDialogOpen(true);
  };

  const saveOdeme = () => {
    if (selectedFatura) {
      updateAlisFaturaOdeme(selectedFatura, odemeTarihi, odemeDurumu, bankaId);
      setOdemeDialogOpen(false);
      toast.success('Ödeme bilgileri güncellendi');
    }
  };

  // Excel indirme
  const downloadExcel = () => {
    const excelData = filteredFaturalar.map(fatura => ({
      'Fatura No': fatura.faturaNo,
      'Fatura Tarihi': fatura.faturaTarihi,
      'Tedarikçi': fatura.tedarikciAdi,
      'Tedarikçi VKN': fatura.tedarikciVkn,
      'Mal/Hizmet': fatura.malHizmetAdi,
      'KDV Oranı (%)': fatura.kdvOrani,
      'Matrah (TL)': fatura.matrah,
      'KDV Tutarı (TL)': fatura.kdvTutari,
      'Toplam Tutar (TL)': fatura.toplamTutar,
      'Ödeme Durumu': ODEME_DURUMU_LABELS[fatura.odemeDurumu],
      'Ödeme Tarihi': fatura.odemeTarihi || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [
      { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 30 },
      { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alış Faturaları');

    const fileName = `Alis_Faturalari_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast.success(`${filteredFaturalar.length} adet alış faturası Excel olarak indirildi.`);
  };

  return (
    <div className="space-y-4">
      {/* Başlık ve Arama */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Alış Fatura Listesi
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Toplam {alisFaturalari.length} alış faturası kayıtlı
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={downloadExcel} 
                className="gap-2 text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Excel</span>
              </Button>

              <input 
                type="file" 
                accept=".xml" 
                ref={xmlInputRef} 
                onChange={handleXmlFileSelect} 
                className="hidden" 
              />
              <Button 
                variant="outline" 
                onClick={() => xmlInputRef.current?.click()} 
                className="gap-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">XML Gönder</span>
              </Button>

              <Button onClick={() => openAlisDrawer()} className="gap-2">
                <FilePlus className="w-4 h-4" />
                <span className="hidden sm:inline">Yeni</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <FilterBar 
        onFilterChange={setFilterValues} 
        searchPlaceholder="No, Tedarikçi veya VKN ara..." 
      />

      {/* Tablo */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="font-semibold text-slate-700">Fatura No</TableHead>
                  <TableHead className="font-semibold text-slate-700">Tarih</TableHead>
                  <TableHead className="font-semibold text-slate-700">Tedarikçi</TableHead>
                  <TableHead className="font-semibold text-slate-700">Mal/Hizmet</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">Matrah</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">KDV</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">Toplam</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center">Ödeme</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center">PDF</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFaturalar.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <FileText className="w-10 h-10 mb-2 opacity-50" />
                        <p className="text-sm">Henüz alış faturası kaydı bulunmuyor</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFaturalar.map((fatura) => (
                    <TableRow key={fatura.id} className="group">
                      <TableCell className="font-medium text-slate-900">
                        {fatura.faturaNo}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(fatura.faturaTarihi)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <p className="text-slate-700 font-medium truncate">{fatura.tedarikciAdi}</p>
                            <p className="text-xs text-slate-400">{fatura.tedarikciVkn}</p>
                            {fatura.aciklama && (
                              <p className="text-[10px] text-slate-400 italic truncate" title={fatura.aciklama}>
                                {fatura.aciklama}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 max-w-xs truncate">
                        {fatura.malHizmetAdi}
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-700">
                        {formatCurrency(fatura.matrah)}
                      </TableCell>
                      <TableCell className="text-right text-slate-600">
                        <span className="text-xs text-slate-400">%{fatura.kdvOrani}</span>
                        <br />
                        {formatCurrency(fatura.kdvTutari)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        {formatCurrency(fatura.toplamTutar)}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => openOdemeDialog(fatura)}
                          className="hover:opacity-80 transition-opacity"
                        >
                          <Badge className={ODEME_DURUMU_COLORS[fatura.odemeDurumu]}>
                            {ODEME_DURUMU_LABELS[fatura.odemeDurumu]}
                          </Badge>
                        </button>
                        {fatura.odemeTarihi && (
                          <p className="text-xs text-slate-400 mt-1">
                            {formatDate(fatura.odemeTarihi)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {fatura.pdfDosya ? (
                          <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Var
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-100 gap-1">
                            <XCircle className="w-3 h-3" />
                            Yok
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Fatura PDF */}
                          <input
                            type="file"
                            accept=".pdf"
                            ref={(el) => { fileInputRefs.current[fatura.id] = el; }}
                            onChange={(e) => handleFileSelect(fatura.id, e)}
                            className="hidden"
                          />
                          
                          {/* Dekont PDF */}
                          <input
                            type="file"
                            accept=".pdf"
                            ref={(el) => { dekontInputRefs.current[fatura.id] = el; }}
                            onChange={(e) => handleDekontSelect(fatura.id, e)}
                            className="hidden"
                          />
                          
                          {/* Fatura PDF Butonu */}
                          {fatura.pdfDosya ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadAlisPdf(fatura.id)}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              title="Fatura PDF İndir"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => triggerFileInput(fatura.id)}
                              className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                              title="Fatura PDF Yükle"
                            >
                              <Upload className="w-4 h-4" />
                            </Button>
                          )}

                          {/* Dekont Butonu */}
                          {fatura.odemeDekontu ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadAlisDekont(fatura.id)}
                              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                              title="Dekont İndir"
                            >
                              <CreditCard className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => triggerDekontInput(fatura.id)}
                              className="text-slate-400 hover:text-purple-600 hover:bg-purple-50"
                              title="Dekont Yükle"
                            >
                              <CreditCard className="w-4 h-4" />
                            </Button>
                          )}

                          {/* Ödeme Düzenle */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openOdemeDialog(fatura)}
                            className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            title="Ödeme Düzenle"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>

                          {/* Silme */}
                          <AlertDialog open={faturaToDelete === fatura.id} onOpenChange={(open) => !open && setFaturaToDelete(null)}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFaturaToDelete(fatura.id)}
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Faturayı Sil</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Bu fatura kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(fatura.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Sil
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Özet Kartları */}
      {filteredFaturalar.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm bg-blue-50/50">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500 mb-1">Toplam Matrah</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(filteredFaturalar.reduce((acc, f) => acc + (Number(f.matrah) || 0), 0))}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-orange-50/50">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500 mb-1">Toplam KDV (İndirilecek)</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(filteredFaturalar.reduce((acc, f) => acc + (Number(f.kdvTutari) || 0), 0))}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-green-50/50">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500 mb-1">Genel Toplam</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(filteredFaturalar.reduce((acc, f) => acc + (Number(f.toplamTutar) || 0), 0))}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-purple-50/50">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500 mb-1">Ödenen</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(
                  filteredFaturalar
                    .filter(f => f.odemeDurumu === 'odendi')
                    .reduce((acc, f) => acc + (Number(f.toplamTutar) || 0), 0)
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ödeme Dialog */}
      <Dialog open={odemeDialogOpen} onOpenChange={setOdemeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ödeme Bilgilerini Düzenle</DialogTitle>
            <DialogDescription>
              Fatura ödeme durumunu ve tarihini güncelleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="odemeDurumu">Ödeme Durumu</Label>
              <Select value={odemeDurumu} onValueChange={(v: any) => setOdemeDurumu(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="odenmedi">Ödenmedi</SelectItem>
                  <SelectItem value="bekliyor">Bekliyor</SelectItem>
                  <SelectItem value="odendi">Ödendi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="odemeTarihi">Ödeme Tarihi</Label>
              <Input
                id="odemeTarihi"
                type="date"
                value={odemeTarihi}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOdemeTarihi(e.target.value)}
              />
            </div>
          </div>
          {odemeDurumu === 'odendi' && (
            <div className="space-y-4 py-2 border-t mt-4 pt-4 text-left">
              <div className="space-y-2">
                <Label>Ödemenin Yapıldığı Hesap (Banka/Kasa)</Label>
                <Select value={String(bankaId || 'nakit')} onValueChange={setBankaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kasa / Banka Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nakit">Nakit / Elden</SelectItem>
                    {(bankaHesaplari || []).map((b, idx) => (
                      <SelectItem key={b.id !== undefined && b.id !== null ? String(b.id) : `banka-${idx}`} value={String(b.id ?? '')}>{String(b.hesapAdi ?? '')} ({String(b.bankaAdi ?? '')})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOdemeDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={saveOdeme}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
