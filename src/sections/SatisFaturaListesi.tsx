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
  Receipt,
  Edit
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { ODEME_DURUMU_LABELS, ODEME_DURUMU_COLORS } from '@/types';
import { FilterBar } from '@/components/FilterBar';
import type { FilterValues } from '@/components/FilterBar';
import { useUrunler } from '../modules/stok/hooks/useStokQuery';

export function SatisFaturaListesi() {
  const { 
    satisFaturalari, 
    deleteSatisFatura, 
    uploadSatisPdf, 
    uploadSatisDekont,
    downloadSatisPdf, 
    downloadSatisDekont,
    updateSatisFaturaOdeme,
    openSatisDrawer,
    parseInvoiceXml,
    bankaHesaplari,
    addSatisFatura
  } = useApp();
  
  const { data: urunler } = useUrunler();
  
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
  
  // Batch XML States
  const [batchItems, setBatchItems] = useState<any[]>([]);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dekontInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const xmlInputRef = useRef<HTMLInputElement | null>(null);

  const handleXmlFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    
    // Single file flow (keep existing behavior of opening drawer if only one)
    if (filesArray.length === 1) {
      const file = filesArray[0];
      toast.info('XML dosyası işleniyor...', { id: 'xml-upload' });
      const result = await parseInvoiceXml(file);
      if (result.success && result.data) {
        toast.success('XML başarıyla okundu!', { id: 'xml-upload' });
        const data = result.data;
        const initialData = {
          tcVkn: data.customer?.vkn || '',
          ad: data.customer?.ad || '',
          soyad: data.customer?.soyad || '',
          vergiDairesi: data.customer?.vergiDairesi || '',
          adres: data.customer?.adres || '',
          hizmetAdi: data.items?.[0]?.name || 'Muhtelif İşlemler',
          alinanUcret: data.toplamTutar?.toString() || data.matrah?.toString() || '',
          faturaTarihi: data.faturaTarihi || new Date().toISOString().split('T')[0],
          kdvOrani: data.kdvOrani?.toString() || '20',
          tevkifatOrani: data.tevkifatOrani || '0',
          tevkifatKodu: data.tevkifatKodu || '',
          stopajOrani: data.stopajOrani || '0',
          stopajKodu: data.stopajKodu || '',
          faturaNo: data.faturaNo
        };
        openSatisDrawer(initialData);
      } else {
        toast.error(result.message || 'XML okunamadı.', { id: 'xml-upload' });
      }
    } else {
      // Multiple files flow
      toast.info(`${filesArray.length} XML dosyası hazırlanıyor...`, { id: 'xml-upload' });
      const results = [];
      for (const file of filesArray) {
        const result = await parseInvoiceXml(file);
        if (result.success && result.data) {
          results.push({
            ...result.data,
            fileName: file.name,
            status: 'pending' // pending, saved, exists, error
          });
        }
      }
      setBatchItems(results);
      setIsBatchOpen(true);
      toast.dismiss('xml-upload');
    }

    // Reset input
    if (xmlInputRef.current) xmlInputRef.current.value = '';
  };

  const handleSaveBatch = async (itemsToSave?: any[]) => {
    setIsProcessingBatch(true);
    const targetItems = itemsToSave || batchItems.filter(item => item.status === 'pending');
    
    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const item of targetItems) {
      // Duplicate check
      const exists = satisFaturalari.some(f => f.faturaNo === item.faturaNo);
      if (exists) {
        item.status = 'exists';
        skippedCount++;
        continue;
      }

      try {
        const initialData = {
          tcVkn: item.customer?.vkn || '',
          ad: item.customer?.ad || '',
          soyad: item.customer?.soyad || '',
          vergiDairesi: item.customer?.vergiDairesi || '',
          adres: item.customer?.adres || '',
          hizmetAdi: item.items?.[0]?.name || 'Muhtelif İşlemler',
          alinanUcret: item.toplamTutar?.toString() || item.matrah?.toString() || '',
          faturaTarihi: item.faturaTarihi || new Date().toISOString().split('T')[0],
          kdvOrani: item.kdvOrani?.toString() || '20',
          tevkifatOrani: item.tevkifatOrani || '0',
          tevkifatKodu: item.tevkifatKodu || '',
          stopajOrani: item.stopajOrani || '0',
          stopajKodu: item.stopajKodu || '',
          faturaNo: item.faturaNo // Important for batch
        };
        
        await addSatisFatura(initialData as any);
        
        item.status = 'saved';
        savedCount++;
      } catch (err) {
        console.error('Batch error:', err);
        item.status = 'error';
        errorCount++;
      }
    }

    setBatchItems([...batchItems]);
    setIsProcessingBatch(false);
    
    if (savedCount > 0 || skippedCount > 0) {
      toast.success(`${savedCount} fatura eklendi, ${skippedCount} fatura atlandı.`);
    }
  };

  const filteredFaturalar = satisFaturalari.filter((fatura) => {
    const searchLower = filterValues.search.toLowerCase();
    const matchesSearch = 
      String(fatura.tcVkn || '').toLowerCase().includes(searchLower) ||
      String(fatura.ad || '').toLowerCase().includes(searchLower) ||
      String(fatura.soyad || '').toLowerCase().includes(searchLower) ||
      String(fatura.adres || '').toLowerCase().includes(searchLower);

    const matchesStatus = filterValues.status === 'all' || fatura.odemeDurumu === filterValues.status;
    
    const matchesDate = (!filterValues.startDate || fatura.faturaTarihi >= filterValues.startDate) &&
                        (!filterValues.endDate || fatura.faturaTarihi <= filterValues.endDate);
    
    const amount = fatura.alinanUcret;
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
      uploadSatisPdf(faturaId, file);
      toast.success('Fatura PDF\'i yüklendi');
    }
  };

  const handleDekontSelect = (faturaId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      uploadSatisDekont(faturaId, file);
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
    deleteSatisFatura(id);
    setFaturaToDelete(null);
    toast.success('Fatura silindi');
  };

  const handleEdit = (fatura: typeof satisFaturalari[0] & { stokKalemleri?: any[] }) => {
    const initialData = {
      id: fatura.id,
      faturaNo: fatura.faturaNo,
      tcVkn: fatura.tcVkn,
      ad: fatura.ad,
      soyad: fatura.soyad,
      vergiDairesi: '', // We don't store VD in the main object but it's in the form
      adres: fatura.adres,
      hizmetAdi: '', // Usually not stored directly but we can leave it empty
      alinanUcret: fatura.alinanUcret.toString(),
      faturaTarihi: fatura.faturaTarihi,
      kdvOrani: fatura.kdvOrani.toString(),
      tevkifatOrani: fatura.tevkifatOrani || '0',
      tevkifatKodu: fatura.tevkifatKodu || '',
      stopajOrani: fatura.stopajOrani || '0',
      stopajKodu: fatura.stopajKodu || '',
      aciklama: fatura.aciklama || '',
      cariId: fatura.cariId,
      stokKalemleri: fatura.stokKalemleri
    };
    openSatisDrawer(initialData as any);
  };

  const openOdemeDialog = (fatura: typeof satisFaturalari[0]) => {
    setSelectedFatura(fatura.id);
    setOdemeTarihi(fatura.odemeTarihi || new Date().toISOString().split('T')[0]);
    setOdemeDurumu(fatura.odemeDurumu);
    setBankaId(''); // Reset bank selection
    setOdemeDialogOpen(true);
  };

  const saveOdeme = () => {
    if (selectedFatura) {
      updateSatisFaturaOdeme(selectedFatura, odemeTarihi, odemeDurumu, bankaId);
      setOdemeDialogOpen(false);
      toast.success('Ödeme bilgileri güncellendi');
    }
  };

  // Excel indirme
  const downloadExcel = () => {
    const pdfOlmayanFaturalar = filteredFaturalar.filter(f => !f.pdfDosya);
    
    if (pdfOlmayanFaturalar.length === 0) {
      toast.info('PDF\'i yüklenmemiş fatura bulunmuyor.');
      return;
    }

    const excelData = pdfOlmayanFaturalar.map(fatura => ({
      'Fatura Tarihi': fatura.faturaTarihi,
      'T.C. / VKN': fatura.tcVkn,
      'Ad': fatura.ad,
      'Soyad': fatura.soyad,
      'Adres': fatura.adres,
      'KDV Oranı (%)': fatura.kdvOrani,
      'Matrah (TL)': fatura.matrah,
      'KDV Tutarı (TL)': fatura.kdvTutari,
      'Toplam Tutar (TL)': fatura.alinanUcret,
      'Ödeme Durumu': ODEME_DURUMU_LABELS[fatura.odemeDurumu],
      'Ödeme Tarihi': fatura.odemeTarihi || '-',
      'PDF Durumu': fatura.pdfDosya ? 'Yüklü' : 'Yüklenmemiş'
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [
      { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 40 },
      { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PDF Olmayan Satış Faturaları');

    const fileName = `Satis_Faturalari_PDF_Olmayan_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast.success(`${pdfOlmayanFaturalar.length} adet fatura Excel olarak indirildi.`);
  };

  const pdfOlmayanSayisi = filteredFaturalar.filter(f => !f.pdfDosya).length;

  return (
    <div className="space-y-4">
      {/* Başlık ve Arama */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                Satış Fatura Listesi
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Toplam {satisFaturalari.length} satış faturası kayıtlı
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={downloadExcel} 
                className="gap-2 text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
                disabled={pdfOlmayanSayisi === 0}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Excel</span>
                {pdfOlmayanSayisi > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700">
                    {pdfOlmayanSayisi}
                  </Badge>
                )}
              </Button>

              <input 
                type="file"
                multiple
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

              <Button onClick={() => openSatisDrawer()} className="gap-2">
                <FilePlus className="w-4 h-4" />
                <span className="hidden sm:inline">Yeni</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <FilterBar 
        onFilterChange={setFilterValues} 
        searchPlaceholder="İsim, VKN veya adres ara..." 
      />

      {/* Tablo */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="font-semibold text-slate-700">Belge No / Tarih</TableHead>
                  <TableHead className="font-semibold text-slate-700">T.C. / VKN</TableHead>
                  <TableHead className="font-semibold text-slate-700">Ad Soyad</TableHead>
                  <TableHead className="font-semibold text-slate-700">Stok Kalemleri</TableHead>
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
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <FileText className="w-10 h-10 mb-2 opacity-50" />
                        <p className="text-sm">Henüz satış faturası kaydı bulunmuyor</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFaturalar.map((fatura) => (
                    <TableRow 
                      key={fatura.id} 
                      className="group"
                      data-luca-no={fatura.faturaNo || ''}
                      data-luca-tarih={fatura.faturaTarihi}
                      data-luca-unvan={`${fatura.ad || ''} ${fatura.soyad || ''}`}
                      data-luca-vkn={fatura.tcVkn}
                      data-luca-matrah={fatura.matrah}
                      data-luca-kdv={fatura.kdvTutari}
                      data-luca-kdv-oran={fatura.kdvOrani}
                      data-luca-toplam={fatura.alinanUcret}
                      data-luca-tevkifat-kodu={fatura.tevkifatKodu || ''}
                      data-luca-tevkifat-oran={fatura.tevkifatOrani || ''}
                      data-luca-stopaj-kodu={fatura.stopajKodu || ''}
                    >
                      <TableCell className="text-slate-600">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 font-medium text-slate-900">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            {fatura.faturaNo || '-'}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {formatDate(fatura.faturaTarihi)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {fatura.tcVkn}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-medium text-primary">
                              {(fatura.ad || '').charAt(0)}{(fatura.soyad || '').charAt(0)}
                            </span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-slate-700 font-medium truncate">{fatura.ad || ''} {fatura.soyad || ''}</span>
                            {fatura.aciklama && (
                              <span className="text-[10px] text-slate-400 italic truncate" title={fatura.aciklama}>
                                {fatura.aciklama}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 max-w-[200px]">
                          {(fatura as any).stokKalemleri && (fatura as any).stokKalemleri.length > 0 ? (
                            (fatura as any).stokKalemleri.map((sk: any, idx: number) => {
                              const ad = urunler?.find(u => u.id === sk.urunId)?.urunAdi || 'İsimsiz Ürün';
                              return (
                                <div key={idx} className="text-xs flex items-center justify-between bg-slate-50 border rounded px-1.5 py-0.5">
                                  <span className="truncate max-w-[120px]" title={ad}>{ad}</span>
                                  <span className="font-medium text-slate-600 bg-white px-1 rounded border shadow-sm ml-2">x{sk.miktar}</span>
                                </div>
                              )
                            })
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Stok bağlantısı yok</span>
                          )}
                        </div>
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
                        {formatCurrency(fatura.alinanUcret)}
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
                              onClick={() => downloadSatisPdf(fatura.id)}
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
                              onClick={() => downloadSatisDekont(fatura.id)}
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
                            className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                            title="Ödeme Düzenle"
                          >
                            <CreditCard className="w-4 h-4" />
                          </Button>

                          {/* Düzenle Butonu */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(fatura)}
                            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Faturayı Düzenle"
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
              <p className="text-sm text-slate-500 mb-1">Toplam KDV</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(filteredFaturalar.reduce((acc, f) => acc + (Number(f.kdvTutari) || 0), 0))}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-green-50/50">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500 mb-1">Genel Toplam</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(filteredFaturalar.reduce((acc, f) => acc + (Number(f.alinanUcret) || 0), 0))}
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
                    .reduce((acc, f) => acc + (Number(f.alinanUcret) || 0), 0)
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
                <Label>Tahsilatın Yapıldığı Hesap (Banka/Kasa)</Label>
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

      {/* Toplu İşlem Dialog */}
      <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              Toplu XML İçe Aktarma
            </DialogTitle>
            <DialogDescription>
              Seçilen {batchItems.length} XML dosyası ayrıştırıldı. İnceleyip kaydedebilirsiniz.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numara</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Ünvan</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                  <TableHead className="text-center">Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchItems.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">{item.faturaNo}</TableCell>
                    <TableCell className="text-xs">{item.faturaTarihi}</TableCell>
                    <TableCell className="text-xs font-medium truncate max-w-[200px]" title={item.customer?.ad}>
                      {item.customer?.ad} {item.customer?.soyad}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.toplamTutar || item.matrah)}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.status === 'pending' && <Badge variant="outline">Bekliyor</Badge>}
                      {item.status === 'saved' && <Badge className="bg-green-100 text-green-700">Kaydedildi</Badge>}
                      {item.status === 'exists' && <Badge className="bg-orange-100 text-orange-700">Mevcut (Atlandı)</Badge>}
                      {item.status === 'error' && <Badge className="bg-red-100 text-red-700">Hata</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsBatchOpen(false)}>
              Kapat
            </Button>
            <Button 
              onClick={() => handleSaveBatch()} 
              disabled={isProcessingBatch || !batchItems.some(i => i.status === 'pending')}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isProcessingBatch ? 'İşleniyor...' : 'Hepsini Kaydet (Mevcut olanlar atlanır)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
