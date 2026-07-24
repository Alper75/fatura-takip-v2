import React, { useState, useRef, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useApp } from '@/context/AppContext';
import { Upload, Save, Trash2, FileCode2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

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
}

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
  const [searchTerm, setSearchTerm] = useState('');
  
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
    toast.info(`${files.length} XML dosyası işleniyor...`, { id: 'batch-xml' });

    const yeniSatirlar: XmlSatiri[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = await parseInvoiceXml(file);
        if (result.success && result.data) {
          const data = result.data;
          
          const vkn = data.supplier?.vkn || '';
          const ad = data.supplier?.ad ? `${data.supplier.ad} ${data.supplier.soyad || ''}`.trim() : 'Bilinmiyor';
          
          // Smart Learning: Find Cari
          const matchedCari = cariler.find(c => c.vknTckn === vkn || c.unvan.includes(ad));
          const eslesenCariId = matchedCari ? matchedCari.id : null;

          // Smart Learning: Find past Gider Hesabi (muhasebeKodu) for this VKN
          let muhasebeKodu = null;
          const pastFatura = alisFaturalari.find(f => f.tedarikciVkn === vkn && f.muhasebeKodu);
          if (pastFatura) {
            muhasebeKodu = pastFatura.muhasebeKodu || null;
          } else if (matchedCari?.muhasebeKodu) {
            muhasebeKodu = matchedCari.muhasebeKodu;
          }

          const kdvOrani = parseFloat(data.kdvOrani || '20');
          const kdvTutari = parseFloat(data.kdvTutari || '0');
          
          let kdv1 = 0, kdv10 = 0, kdv20 = 0;
          if (kdvOrani === 1) kdv1 = kdvTutari;
          else if (kdvOrani === 10) kdv10 = kdvTutari;
          else if (kdvOrani === 20) kdv20 = kdvTutari;
          else kdv20 = kdvTutari; // default fallback

          const tevkifatTutari = parseFloat(data.tevkifatTutari || '0');
          const stopajTutari = parseFloat(data.stopajTutari || '0');
          const digerVergiler = tevkifatTutari + stopajTutari;

          yeniSatirlar.push({
            id: `xml-${Date.now()}-${i}`,
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
            selected: true // By default let's select new rows
          });
        }
      } catch (err) {
        console.error('XML parse error on file', file.name, err);
      }
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
        tevkifatOrani: s.tevkifatOrani,
        stopajOrani: s.stopajOrani,
        tevkifatKodu: s.tevkifatKodu,
        stopajKodu: s.stopajKodu,
        muhasebeKodu: s.muhasebeKodu || undefined,
        cariId: s.eslesenCariId || undefined,
      } as any); // Cast as any because some fields might not perfectly match FormData, but addAlisFatura takes them.
      successCount++;
    });

    toast.success(`${successCount} fatura başarıyla kaydedildi!`);
    setSatirlar(prev => prev.filter(s => !s.selected));
  };

  const filteredSatirlar = useMemo(() => {
    if (!searchTerm) return satirlar;
    const lower = searchTerm.toLowerCase();
    return satirlar.filter(s => s.tedarikciAdi.toLowerCase().includes(lower) || s.tedarikciVkn.includes(lower));
  }, [satirlar, searchTerm]);

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
                <Input 
                  placeholder="Cari ara..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
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
                          <select 
                            className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1 text-xs ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={satir.eslesenCariId || ''}
                            onChange={(e) => updateRow(satir.id, 'eslesenCariId', e.target.value)}
                          >
                            <option value="">Seçiniz...</option>
                            {cariler.map(c => (
                              <option key={c.id} value={c.id}>{c.unvan}</option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <select 
                            className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1 text-xs ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={satir.muhasebeKodu || ''}
                            onChange={(e) => updateRow(satir.id, 'muhasebeKodu', e.target.value)}
                          >
                            <option value="">Seçiniz...</option>
                            {lucaAccounts.map(a => (
                              <option key={a.kod} value={a.kod}>{a.kod} - {a.ad}</option>
                            ))}
                          </select>
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
