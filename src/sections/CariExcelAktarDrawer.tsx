import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { FileUp, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useApp } from '@/context/AppContext';

interface CariExcelAktarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CariExcelAktarDrawer({ isOpen, onClose, onSuccess }: CariExcelAktarDrawerProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { apiFetch } = useApp();

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        'Muhasebe Hesap Kodu': '120.01.001',
        'Şirket Ünvanı': 'Örnek Teknoloji A.Ş.',
        'Vergi veya T.C. No': '1234567890',
        'Şirket Adresi': 'Örnek Mah. Teknoloji Cad. No:1',
        'Mail Adresi': 'info@ornek.com'
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cariler');
    XLSX.writeFile(wb, 'Cari_Aktarim_Sablonu.xlsx');
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet);

      if (rows.length === 0) {
        toast.error('Excel dosyası boş.');
        return;
      }

      const cariler = rows.map((row: any) => ({
        muhasebeKodu: String(row['Muhasebe Hesap Kodu'] || row['Hesap Kodu'] || '').trim(),
        unvan: String(row['Şirket Ünvanı'] || row['Unvan'] || '').trim(),
        vknTckn: String(row['Vergi veya T.C. No'] || row['VKN'] || row['TCKN'] || '').trim(),
        adres: String(row['Şirket Adresi'] || row['Adres'] || '').trim(),
        eposta: String(row['Mail Adresi'] || row['E-posta'] || row['Eposta'] || '').trim(),
        tip: 'musteri' // varsayılan
      })).filter(c => c.unvan);

      if (cariler.length === 0) {
        toast.error('Geçerli bir cari kaydı bulunamadı. Lütfen şablonu kontrol edin.');
        return;
      }

      const res = await apiFetch('/api/cariler/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ cariler })
      });

      if (res.success) {
        toast.success(`${res.count} adet cari başarıyla içeri aktarıldı!`);
        onSuccess();
        onClose();
      } else {
        toast.error('Aktarım başarısız: ' + res.message);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Dosya okunurken bir hata oluştu: ' + err.message);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <FileUp className="w-5 h-5 text-indigo-600" />
            Excel'den Cari Aktar
          </SheetTitle>
          <SheetDescription>
            Cari kartlarınızı oluşturmak veya mevcut olanların VKN, Muhasebe kodu ve e-posta bilgilerini güncelleyebilmek için toplu Excel yükleyebilirsiniz.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          <div className="bg-slate-50 p-4 border rounded-xl">
            <h4 className="font-semibold text-sm mb-2 text-slate-800">Nasıl Yüklenir?</h4>
            <ul className="text-xs text-slate-600 space-y-1 mb-4 list-disc pl-4">
              <li>Sistemin beklediği sütun başlıklarına göre bir Excel hazırlayın.</li>
              <li>Aynı VKN veya Muhasebe koduna sahip olan cari kartlar otomatik güncellenir.</li>
              <li>Sadece <b>Şirket Ünvanı</b> dolu olan satırlar işleme alınır.</li>
            </ul>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="w-full text-xs font-medium border-dashed border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100">
              <Download className="w-4 h-4 mr-2" /> Şablonu İndir
            </Button>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isHovering ? 'border-primary bg-primary/5' : 'border-slate-300 hover:border-slate-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
            onDragLeave={() => setIsHovering(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsHovering(false);
              const file = e.dataTransfer.files[0];
              if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                processFile(file);
              } else {
                toast.error('Lütfen sadece .xlsx veya .xls uzantılı Excel dosyası yükleyin.');
              }
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".xlsx,.xls"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  processFile(e.target.files[0]);
                }
              }}
            />
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center space-y-2 text-primary">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
                <p className="text-sm font-medium">İşleniyor, lütfen bekleyin...</p>
              </div>
            ) : (
              <>
                <FileUp className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">Dosyayı buraya sürükleyin</p>
                <p className="text-xs text-slate-500 mt-1">veya seçmek için tıklayın</p>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
