import React, { useState, useRef, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useApp } from '@/context/AppContext';
import { Upload, Save, Trash2, FileCode2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { generatePdfFromUblXml } from '@/lib/xmlToPdf';

interface AlisTopluXMLUploadProps {
  isOpen: boolean;
  onClose: () => void;
}

interface XmlSatiri {
  id: string;
  dosyaAdi: string;
  faturaNo: string;
  faturaTarihi: string;
  tedarikciVkn: string;
  tedarikciAdi: string;
  matrah: number;
  kdv1: number;
  kdv10: number;
  kdv20: number;
  kdvOrani: number;
  kdvTutari: number;
  digerVergiler: number;
  toplamTutar: number;
  tevkifatOrani: string;
  tevkifatTutari: number;
  stopajOrani: string;
  stopajTutari: number;
  tevkifatKodu: string;
  stopajKodu: string;
  
  eslesenCariId: string | null;
  muhasebeKodu: string | null; 
  selected: boolean;
  
  dosyaBase64?: string;
  pdfDosyaAdi?: string;
}

const CellDropdown = ({ value, options, onChange, placeholder }: { value: string; options: {value: string, label: string}[]; onChange: (v: string) => void, placeholder: string }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState('');
  
  if (!isEditing) {
    const displayValue = options.find(o => o.value === value)?.label;
    return (
      <div 
        className={`text-[11px] p-1.5 border border-transparent hover:border-slate-300 rounded cursor-pointer min-h-[28px] flex items-center ${!displayValue ? 'text-rose-600 font-medium bg-rose-50/50' : 'text-slate-700 line-clamp-1'}`}
        onClick={() => { setIsEditing(true); setSearch(''); }}
        title={displayValue || placeholder}
      >
        {displayValue || placeholder}
      </div>
    );
  }

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()) || o.value.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative">
      <input 
        autoFocus
        className="flex h-8 w-full items-center justify-between rounded-md border border-indigo-500 bg-white px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
        value={search}
        placeholder="Ara..."
        onChange={e => setSearch(e.target.value)}
        onBlur={() => setTimeout(() => setIsEditing(false), 150)}
      />
      <div className="absolute top-full left-0 w-full min-w-[250px] max-h-48 overflow-auto bg-white border border-slate-200 shadow-xl rounded-md z-50 mt-1 p-1">
        <div 
          className="text-[11px] p-1.5 hover:bg-slate-100 cursor-pointer text-slate-500 rounded"
          onClick={() => { onChange(''); setIsEditing(false); }}
        >
          {placeholder} (Temizle)
        </div>
        {filtered.length === 0 && <div className="text-[11px] p-1.5 text-slate-400">Sonuç bulunamadı</div>}
        {filtered.map(o => (
          <div 
            key={o.value} 
            className="text-[11px] p-1.5 hover:bg-indigo-50 cursor-pointer text-slate-700 rounded truncate"
            onClick={() => { onChange(o.value); setIsEditing(false); }}
            title={o.label}
          >
            {o.label}
          </div>
        ))}
      </div>
    </div>
  );
};

export function AlisTopluXMLUpload({ isOpen, onClose }: AlisTopluXMLUploadProps) {
  const { 
    cariler, 
    alisFaturalari, 
    lucaAccounts,
    parseInvoiceXml,
    addAlisFatura 
  } = useApp();
  
  const [satirlar, setSatirlar] = useState<XmlSatiri[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [generatePdf, setGeneratePdf] = useState(false);
  
  // Bulk selection states for dropdowns
  const [bulkCariId, setBulkCariId] = useState<string>('');
  const [bulkMuhasebeKodu, setBulkMuhasebeKodu] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: files.length });
    toast.info(`${files.length} XML dosyası işleniyor...`, { id: 'batch-xml' });

    const yeniSatirlar: XmlSatiri[] = [];

    const fileArray = Array.from(files);
    const chunkSize = 20;

    for (let i = 0; i < fileArray.length; i += chunkSize) {
      const chunk = fileArray.slice(i, i + chunkSize);
      
      const chunkResults = await Promise.all(chunk.map(async (file, index) => {
        try {
          const result = await parseInvoiceXml(file);
          if (result.success && result.data) {
            const data = result.data;
            
            const vkn = data.supplier?.vkn || '';
            const ad = data.supplier?.ad ? `${data.supplier.ad} ${data.supplier.soyad || ''}`.trim() : 'Bilinmiyor';
            
            // Calculate KDV first so we can use it in Smart Learning
            const kdv1 = typeof data.kdv1 === 'number' ? data.kdv1 : 0;
            const kdv10 = typeof data.kdv10 === 'number' ? data.kdv10 : 0;
            const kdv20 = typeof data.kdv20 === 'number' ? data.kdv20 : 0;
            
            let kdvOrani = 0;
            if (kdv20 > 0) kdvOrani = 20;
            else if (kdv10 > 0) kdvOrani = 10;
            else if (kdv1 > 0) kdvOrani = 1;

            // Smart Learning: Find Cari
            const matchedCari = cariler.find(c => c.vknTckn === vkn || c.unvan.includes(ad));
            const eslesenCariId = matchedCari ? matchedCari.id : null;

            // Smart Learning: Find past Gider Hesabi (muhasebeKodu) for this VKN matching the same KDV rate
            let muhasebeKodu = null;
            const pastFaturaKdvMached = alisFaturalari.find(f => f.tedarikciVkn === vkn && f.muhasebeKodu && Number(f.kdvOrani) === kdvOrani);
            
            if (pastFaturaKdvMached) {
              muhasebeKodu = pastFaturaKdvMached.muhasebeKodu || null;
            }

            const kdvTutari = kdv1 + kdv10 + kdv20;

            const tevkifatTutari = typeof data.tevkifatTutari === 'number' ? data.tevkifatTutari : 0;
            const stopajTutari = typeof data.stopajTutari === 'number' ? data.stopajTutari : 0;
            const digerVergiler = tevkifatTutari + stopajTutari;

            // PDF oluştur (opsiyonel)
            let dosyaBase64: string | undefined = undefined;
            let pdfDosyaAdi: string | undefined = undefined;
            
            if (generatePdf) {
              try {
                const pdfBase64 = await generatePdfFromUblXml(file);
                if (pdfBase64) {
                  dosyaBase64 = pdfBase64;
                  pdfDosyaAdi = file.name.replace('.xml', '.pdf');
                }
              } catch (pdfErr) {
                console.error('PDF dönüştürme başarısız:', pdfErr);
              }
            }

            return {
              id: `xml-${Date.now()}-${i + index}`,
              dosyaAdi: file.name,
              faturaNo: data.faturaNo || '',
              faturaTarihi: data.faturaTarihi || new Date().toISOString().split('T')[0],
              tedarikciVkn: vkn,
              tedarikciAdi: ad,
              matrah: parseFloat(data.matrah || '0'),
              kdv1,
              kdv10,
              kdv20,
              kdvOrani,
              kdvTutari,
              digerVergiler,
              toplamTutar: parseFloat(data.toplamTutar || '0'),
              tevkifatOrani: data.tevkifatOrani || '0',
              tevkifatTutari,
              stopajOrani: data.stopajOrani || '0',
              stopajTutari,
              tevkifatKodu: data.tevkifatKodu || '',
              stopajKodu: data.stopajKodu || '',
              eslesenCariId,
              muhasebeKodu,
              selected: true,
              dosyaBase64,
              pdfDosyaAdi
            } as XmlSatiri;
          }
        } catch (err) {
          console.error('XML parse error on file', file.name, err);
        }
        return null;
      }));
      
      yeniSatirlar.push(...(chunkResults.filter(Boolean) as XmlSatiri[]));
      setProgress(prev => ({ ...prev, current: Math.min(prev.current + chunk.length, files.length) }));
    }

    setSatirlar(prev => [...prev, ...yeniSatirlar]);
    setIsProcessing(false);
    toast.success(`${yeniSatirlar.length} fatura başarıyla eklendi.`, { id: 'batch-xml' });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleSelect = (id: string) => {
    setSatirlar(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s));
  };

  const toggleSelectAll = () => {
    const allSelected = satirlar.every(s => s.selected);
    setSatirlar(prev => prev.map(s => ({ ...s, selected: !allSelected })));
  };

  const removeRow = (id: string) => {
    setSatirlar(prev => prev.filter(s => s.id !== id));
  };

  const updateRow = (id: string, field: keyof XmlSatiri, value: any) => {
    setSatirlar(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const applyBulkAction = (type: 'cari' | 'hesap') => {
    setSatirlar(prev => prev.map(s => {
      if (s.selected) {
        if (type === 'cari' && bulkCariId) return { ...s, eslesenCariId: bulkCariId };
        if (type === 'hesap' && bulkMuhasebeKodu) return { ...s, muhasebeKodu: bulkMuhasebeKodu };
      }
      return s;
    }));
    toast.success('Seçili satırlar güncellendi.');
  };

  const handleSave = () => {
    const toSave = satirlar.filter(s => s.selected);
    if (toSave.length === 0) {
      toast.error('Kaydedilecek satır seçmediniz!');
      return;
    }

    let successCount = 0;
    toSave.forEach(s => {
      addAlisFatura({
        faturaNo: s.faturaNo,
        faturaTarihi: s.faturaTarihi,
        tedarikciAdi: s.tedarikciAdi,
        tedarikciVkn: s.tedarikciVkn,
        malHizmetAdi: 'Muhtelif İşlemler', // Default
        toplamTutar: s.toplamTutar.toString(),
        kdvOrani: s.kdvOrani.toString(),
        
        // Matematiksel geriye hesaplamayı iptal edip kuruşu kuruşuna XML değerlerini yolluyoruz:
        matrah: s.matrah,
        kdvTutari: s.kdvTutari,
        tevkifatTutari: s.tevkifatTutari,
        stopajTutari: s.stopajTutari,
        kdv1: s.kdv1,
        kdv10: s.kdv10,
        kdv20: s.kdv20,

        tevkifatOrani: s.tevkifatOrani,
        stopajOrani: s.stopajOrani,
        tevkifatKodu: s.tevkifatKodu,
        stopajKodu: s.stopajKodu,
        muhasebeKodu: s.muhasebeKodu || undefined,
        cariId: s.eslesenCariId || undefined,
        dosyaBase64: s.dosyaBase64,
        dosyaAdi: s.pdfDosyaAdi
      } as any); // Cast as any because some fields might not perfectly match FormData, but addAlisFatura takes them.
      successCount++;
    });

    toast.success(`${successCount} fatura başarıyla kaydedildi!`);
    setSatirlar(prev => prev.filter(s => !s.selected));
  };

  const filteredSatirlar = useMemo(() => {
    let result = satirlar;
    
    if (filterType === 'UNMATCHED_CARI') {
      result = result.filter(s => !s.eslesenCariId);
    } else if (filterType === 'UNMATCHED_HESAP') {
      result = result.filter(s => !s.muhasebeKodu);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(s => s.tedarikciAdi.toLowerCase().includes(lower) || s.tedarikciVkn.includes(lower));
    }
    
    return result;
  }, [satirlar, searchTerm, filterType]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-7xl overflow-y-auto bg-slate-50/50">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                <FileCode2 className="h-6 w-6 text-indigo-600" />
                Toplu XML Yükleme (Alış Faturaları)
              </SheetTitle>
              <SheetDescription>
                Birden fazla XML dosyasını seçip hızlıca carileri ve gider hesaplarını eşleştirebilirsiniz.
              </SheetDescription>
            </div>
            
            <div className="flex items-center gap-3">
              {isProcessing && progress.total > 0 && (
                <span className="text-sm font-semibold text-indigo-700 bg-indigo-50 px-3 py-2 rounded-md border border-indigo-100 flex items-center gap-2 h-10 shadow-sm animate-pulse">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  İşleniyor: {progress.current} / {progress.total}
                </span>
              )}
              
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 bg-white border px-3 py-2 rounded-md hover:bg-slate-50 transition-colors h-10">
                <Checkbox checked={generatePdf} onCheckedChange={(checked) => setGeneratePdf(checked as boolean)} />
                <span>PDF Oluştur (Yavaş)</span>
              </label>
              
              <input
                type="file"
                multiple
                accept=".xml"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isProcessing}
                variant="outline"
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                XML Yükle
              </Button>
              <Button onClick={handleSave} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isProcessing || satirlar.length === 0}>
                <Save className="h-4 w-4" />
                Seçili Olanları Kaydet
              </Button>
            </div>
          </div>
        </SheetHeader>

        {satirlar.length > 0 && (
          <div className="space-y-4">
            {/* Top Bar for Bulk Actions & Search */}
            <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Arama (Cari Adı/VKN)</label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Cari ara..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                  <select 
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="ALL">Tümü</option>
                    <option value="UNMATCHED_CARI">Cari Eşleşmeyenler</option>
                    <option value="UNMATCHED_HESAP">Hesap Eşleşmeyenler</option>
                  </select>
                </div>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Toplu Cari Ata (Seçililere)</label>
                <div className="flex gap-2">
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={bulkCariId}
                    onChange={(e) => setBulkCariId(e.target.value)}
                  >
                    <option value="">Seçiniz...</option>
                    {cariler.map(c => (
                      <option key={c.id} value={c.id}>{c.unvan}</option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={() => applyBulkAction('cari')} disabled={!bulkCariId}>Uygula</Button>
                </div>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Toplu Gider Hesabı Ata</label>
                <div className="flex gap-2">
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={bulkMuhasebeKodu}
                    onChange={(e) => setBulkMuhasebeKodu(e.target.value)}
                  >
                    <option value="">Seçiniz...</option>
                    {lucaAccounts.map(a => (
                      <option key={a.kod} value={a.kod}>{a.kod} - {a.ad}</option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={() => applyBulkAction('hesap')} disabled={!bulkMuhasebeKodu}>Uygula</Button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="w-[50px] text-center">
                        <Checkbox 
                          checked={satirlar.length > 0 && satirlar.every(s => s.selected)}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Fatura No</TableHead>
                      <TableHead>Cari Unvan</TableHead>
                      <TableHead className="text-right">Matrah</TableHead>
                      <TableHead className="text-right">%1 KDV</TableHead>
                      <TableHead className="text-right">%10 KDV</TableHead>
                      <TableHead className="text-right">%20 KDV</TableHead>
                      <TableHead className="text-right">D. Vergiler</TableHead>
                      <TableHead className="text-right">Toplam</TableHead>
                      <TableHead className="min-w-[180px]">Cari Eşleştirme</TableHead>
                      <TableHead className="min-w-[180px]">Gider Hesabı</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSatirlar.map(satir => (
                      <TableRow key={satir.id} className={satir.selected ? "bg-indigo-50/50" : ""}>
                        <TableCell className="text-center">
                          <Checkbox 
                            checked={satir.selected}
                            onCheckedChange={() => toggleSelect(satir.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-xs">
                          {satir.faturaNo}
                          <div className="text-[10px] text-slate-400">{satir.faturaTarihi}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="line-clamp-1" title={satir.tedarikciAdi}>{satir.tedarikciAdi}</div>
                          <div className="text-[10px] text-slate-500">{satir.tedarikciVkn}</div>
                        </TableCell>
                        <TableCell className="text-right text-xs">{formatCurrency(satir.matrah)}</TableCell>
                        <TableCell className="text-right text-xs text-slate-600">{formatCurrency(satir.kdv1)}</TableCell>
                        <TableCell className="text-right text-xs text-slate-600">{formatCurrency(satir.kdv10)}</TableCell>
                        <TableCell className="text-right text-xs text-slate-600">{formatCurrency(satir.kdv20)}</TableCell>
                        <TableCell className="text-right text-xs text-orange-600">{formatCurrency(satir.digerVergiler)}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">{formatCurrency(satir.toplamTutar)}</TableCell>
                        
                        <TableCell>
                          <CellDropdown 
                            value={satir.eslesenCariId || ''}
                            placeholder="Cari Seç (Eşleşmedi)"
                            options={cariler.map(c => ({ value: c.id, label: c.unvan }))}
                            onChange={(val) => updateRow(satir.id, 'eslesenCariId', val)}
                          />
                        </TableCell>
                        <TableCell>
                          <CellDropdown 
                            value={satir.muhasebeKodu || ''}
                            placeholder="Hesap Seç (Eşleşmedi)"
                            options={lucaAccounts.map(a => ({ value: a.kod, label: `${a.kod} - ${a.ad}` }))}
                            onChange={(val) => updateRow(satir.id, 'muhasebeKodu', val)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeRow(satir.id)} className="h-8 w-8 text-rose-500 hover:bg-rose-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSatirlar.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-8 text-slate-500">
                          Görüntülenecek satır bulunamadı.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
