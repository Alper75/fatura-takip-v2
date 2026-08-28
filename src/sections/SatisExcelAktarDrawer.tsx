import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileUp, Download, Loader2, Save, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useApp } from '@/context/AppContext';

interface SatisExcelAktarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SatisExcelAktarDrawer({ isOpen, onClose, onSuccess }: SatisExcelAktarDrawerProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { apiFetch } = useApp();

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        'Makbuz / Fatura No': 'SMM2026000000001',
        'Doküman No (UUID)': 'be65e676-6ab8-460d-a20c-140d8108864a',
        'Belge Tarihi': '01.07.2026',
        'Alıcı VKN/TCKN': '7620269371',
        'Alıcı Ünvanı': 'SEREN ASFALT NAKLİYE İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ',
        'Matrah (TL)': 2335.37,
        'KDV Oranı (%)': 20,
        'KDV Tutarı (TL)': 467.07,
        'Stopaj Tutarı (TL)': 0,
        'Tevkifat Tutarı (TL)': 0,
        'Ödenecek Tutar (TL)': 2802.44,
        'Açıklama': 'Serbest Meslek Makbuzu / Satış Faturası'
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Satis_Faturalari');
    XLSX.writeFile(wb, 'Satis_Fatura_Aktarim_Sablonu.xlsx');
  };

  const parseTurkishNumber = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim();
    if (str.includes(',') && str.includes('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
    return parseFloat(str) || 0;
  };

  const parseTurkishDate = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    
    // Excel serial number
    if (typeof val === 'number') {
      const parsedExcelDate = new Date(Math.round((val - 25569) * 86400 * 1000));
      return parsedExcelDate.toISOString().split('T')[0];
    }
    
    let str = String(val).trim().split(' ')[0]; // Remove time part
    
    // DD.MM.YYYY or DD.MM.YY (Turkish standard with dots)
    const matchDot = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (matchDot) {
      const day = matchDot[1].padStart(2, '0');
      const month = matchDot[2].padStart(2, '0');
      let year = matchDot[3];
      if (year.length === 2) year = '20' + year;
      return `${year}-${month}-${day}`;
    }

    // DD/MM/YYYY or DD/MM/YY (Turkish standard with slashes)
    const matchSlash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (matchSlash) {
      const p1 = parseInt(matchSlash[1], 10);
      const p2 = parseInt(matchSlash[2], 10);
      let year = matchSlash[3];
      if (year.length === 2) year = '20' + year;

      let day = String(p1).padStart(2, '0');
      let month = String(p2).padStart(2, '0');
      if (p2 > 12 && p1 <= 12) {
        day = String(p2).padStart(2, '0');
        month = String(p1).padStart(2, '0');
      }
      return `${year}-${month}-${day}`;
    }
    
    // YYYY-MM-DD
    const matchIso = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
    if (matchIso) {
      const year = matchIso[1];
      const month = matchIso[2].padStart(2, '0');
      const day = matchIso[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return str;
  };

  const parseCsvTextDirectly = (text: string): any[] => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];
    
    const headerLine = lines[0];
    let delimiter = ';';
    if (headerLine.includes(';') && (headerLine.split(';').length >= headerLine.split(',').length)) {
      delimiter = ';';
    } else if (headerLine.includes(',')) {
      delimiter = ',';
    } else if (headerLine.includes('\t')) {
      delimiter = '\t';
    }

    const cleanCell = (str: string) => {
      if (!str) return '';
      return str.trim().replace(/^['"]+|['"]+$/g, '').trim();
    };

    const headers = headerLine.split(delimiter).map(cleanCell);
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rawCells = lines[i].split(delimiter);
      if (rawCells.length === 0 || rawCells.every(c => !c.trim())) continue;
      const rowObj: any = {};
      headers.forEach((header, idx) => {
        if (header) {
          rowObj[header] = cleanCell(rawCells[idx] || '');
        }
      });
      rows.push(rowObj);
    }

    return rows;
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    try {
      let rows: any[] = [];
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
        // Direct text parsing to preserve pure raw dates (e.g. 01.07.2026) without SheetJS distortion
        const text = await file.text();
        rows = parseCsvTextDirectly(text);
      } else {
        // XLSX or XLS
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { raw: true, cellDates: false });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(firstSheet, { raw: true, defval: '' });
      }

      if (rows.length === 0) {
        toast.error('Dosya boş veya okunamadı.');
        return;
      }

      const formatted = rows.map((row: any) => {
        const faturaNo = String(
          row['Makbuz No'] || row['Fatura No'] || row['Belge No'] || row['Makbuz / Fatura No'] || row['faturaNo'] || ''
        ).trim();

        const uuid = String(
          row['Doküman No'] || row['Doküman No (UUID)'] || row['ETTN'] || row['UUID'] || row['uuid'] || ''
        ).trim();

        const vkn = String(
          row['Alıcı VKN/TCKN'] || row['VKN/TCKN'] || row['VKN'] || row['TCKN'] || row['Vergi No'] || row['tcVkn'] || ''
        ).replace(/['"]/g, '').trim();

        const unvan = String(
          row['Alıcı'] || row['Alıcı Ünvanı'] || row['Müşteri'] || row['Müşteri Adı'] || row['Ünvan'] || row['ad'] || ''
        ).trim();

        const rawDate = row['Belge Tarihi'] || row['Fatura Tarihi'] || row['Tarih'] || row['issueDate'];
        const issueDate = parseTurkishDate(rawDate);

        const payableAmount = parseTurkishNumber(row['Ödenecek Tutar'] || row['Ödenecek Tutar (TL)'] || row['Toplam Tutar'] || row['Net Ücret'] || row['Tutar']);
        const kdvTutari = parseTurkishNumber(row['Toplam KDV'] || row['KDV Tutarı'] || row['KDV Tutarı (TL)'] || row['Toplam Vergi']);
        const matrah = parseTurkishNumber(row['Toplam KDV Matrah'] || row['Matrah'] || row['Matrah (TL)'] || row['Brüt Toplam']) || (payableAmount - kdvTutari);
        const stopajTutari = parseTurkishNumber(row['Toplam Stopaj'] || row['Stopaj Tutarı'] || row['Stopaj Tutarı (TL)']);
        const tevkifatTutari = parseTurkishNumber(row['Toplam Tevkifat Tutarı'] || row['Tevkifat Tutarı'] || row['Tevkifat Tutarı (TL)']);
        const kdvOrani = parseTurkishNumber(row['KDV Oranı (%)'] || row['KDV Oranı']) || (matrah > 0 && kdvTutari > 0 ? Math.round((kdvTutari / matrah) * 100) : 20);

        const aciklama = String(row['Açıklama'] || row['Mal/Hizmet'] || row['Makbuz Durumu'] || 'Excel İçe Aktarımı').trim();

        return {
          faturaNo,
          uuid,
          senderVkn: vkn,
          senderName: unvan || 'Bilinmeyen Müşteri',
          issueDate,
          payableAmount,
          matrah,
          kdvTutari,
          kdvOrani,
          stopajTutari,
          tevkifatTutari,
          faturaAciklama: aciklama
        };
      }).filter(r => r.faturaNo || r.uuid || r.payableAmount > 0);

      if (formatted.length === 0) {
        toast.error('Geçerli bir satış/makbuz kaydı bulunamadı. Lütfen sütun başlıklarını kontrol edin.');
        return;
      }

      setParsedRows(formatted);
      toast.success(`${formatted.length} adet kayıt başarıyla okundu! Lütfen önizlemeyi inceleyip kaydedin.`);
    } catch (err: any) {
      console.error(err);
      toast.error('Dosya okunurken bir hata oluştu: ' + err.message);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveAll = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);
    try {
      const res = await apiFetch('/api/invoices/bulk-import-satis', {
        method: 'POST',
        body: JSON.stringify({ invoices: parsedRows })
      });

      if (res.success) {
        toast.success(res.message || `${res.count} adet fatura başarıyla kaydedildi!`);
        onSuccess();
        onClose();
        setParsedRows([]);
      } else {
        toast.error('Kayıt başarısız: ' + res.message);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Aktarım hatası: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[95vw] sm:max-w-4xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
            Excel / CSV'den Satış Belgeleri ve Makbuz Aktarımı
          </SheetTitle>
          <SheetDescription>
            Uyumsoft, GİB veya Excel formatındaki satış faturaları ve e-SMM makbuzlarınızı sisteme topluca yükleyin.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Yükleme Alanı */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
            onDragLeave={() => setIsHovering(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsHovering(false);
              if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
              isHovering ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-500 bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) processFile(e.target.files[0]);
              }}
            />
            {isProcessing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-sm font-medium text-slate-600">Dosya işleniyor...</p>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                  <FileUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Excel veya CSV dosyasını sürükleyin veya <span className="text-indigo-600 underline">seçin</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">.xlsx, .xls ve .csv formatları tam desteklenir</p>
                </div>
              </>
            )}
          </div>

          {/* Şablon İndirme */}
          <div className="flex items-center justify-between p-3.5 bg-slate-100/80 rounded-lg border text-xs">
            <span className="text-slate-600 font-medium">Excel formatında örnek şablonu incelemek ister misiniz?</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="h-8 gap-1.5 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Örnek Şablon İndir
            </Button>
          </div>

          {/* Önizleme Tablosu */}
          {parsedRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Okunan Belgeler ({parsedRows.length} Adet)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Toplam Tutar: {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(parsedRows.reduce((sum, r) => sum + r.payableAmount, 0))}
                  </p>
                </div>
                <Button
                  onClick={handleSaveAll}
                  disabled={isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Hepsini Sisteme Aktar ({parsedRows.length})
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-[380px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-xs font-bold">Makbuz / Fatura No</TableHead>
                      <TableHead className="text-xs font-bold">Müşteri / VKN</TableHead>
                      <TableHead className="text-xs font-bold">Tarih</TableHead>
                      <TableHead className="text-xs font-bold text-right">Matrah</TableHead>
                      <TableHead className="text-xs font-bold text-right">KDV</TableHead>
                      <TableHead className="text-xs font-bold text-right">Ödenecek Tutar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y text-xs">
                    {parsedRows.map((r, i) => (
                      <TableRow key={i} className="hover:bg-slate-50">
                        <TableCell className="font-mono font-semibold text-slate-900">
                          {r.faturaNo || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">{r.senderName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">VKN: {r.senderVkn || '-'}</div>
                        </TableCell>
                        <TableCell className="text-slate-600 whitespace-nowrap font-medium">
                          {r.issueDate ? new Date(r.issueDate).toLocaleDateString('tr-TR') : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-700">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(r.matrah)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-700">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(r.kdvTutari)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(r.payableAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
