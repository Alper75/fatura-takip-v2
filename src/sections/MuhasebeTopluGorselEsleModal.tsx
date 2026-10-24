import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UploadCloud, CheckCircle2, AlertTriangle, FileText, Image as ImageIcon, X, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/context/AppContext';
import type { AlisFatura } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingInvoices: AlisFatura[];
  onCompleted?: () => void;
}

interface SelectedFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
  isPdf: boolean;
}

interface MatchItem {
  invoiceId: string;
  invoice: AlisFatura;
  fileId: string | null; // SelectedFileItem id
}

export function MuhasebeTopluGorselEsleModal({ open, onOpenChange, missingInvoices, onCompleted }: Props) {
  const { apiFetch, updateAlisFatura } = useApp();

  const [files, setFiles] = useState<SelectedFileItem[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; percent: number } | null>(null);

  // Dosyalar seçildiğinde
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    const newFiles: SelectedFileItem[] = [];
    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      newFiles.push({
        id: `f_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        file,
        name: file.name,
        size: file.size,
        previewUrl: isPdf ? '' : URL.createObjectURL(file),
        isPdf
      });
    }

    const allFiles = [...files, ...newFiles];
    setFiles(allFiles);

    // Otomatik Akıllı Eşleştirme Yap
    const initialMatches: MatchItem[] = missingInvoices.map((inv, idx) => {
      // 1. İsim veya numara bazlı eşleşme
      const invNo = (inv.faturaNo || '').toLowerCase();
      const supName = (inv.tedarikciAdi || '').toLowerCase();

      let matchedFile = allFiles.find(f => {
        const fName = f.name.toLowerCase();
        if (invNo && invNo.length > 2 && fName.includes(invNo)) return true;
        if (supName && supName.length > 3 && fName.includes(supName.split(' ')[0])) return true;
        return false;
      });

      // 2. Yoksa sırasına göre eşleştir
      if (!matchedFile && allFiles[idx]) {
        matchedFile = allFiles[idx];
      }

      return {
        invoiceId: inv.id,
        invoice: inv,
        fileId: matchedFile ? matchedFile.id : null
      };
    });

    setMatches(initialMatches);
    toast.success(`${newFiles.length} adet dosya seçildi ve eşleştirme listesine aktarıldı.`);
  };

  // Eşleştirmeyi değiştir
  const handleAssignFile = (invoiceId: string, fileId: string | null) => {
    setMatches(prev => prev.map(m => m.invoiceId === invoiceId ? { ...m, fileId } : m));
  };

  // Tek tıkla otomatik sırayla eşle
  const handleAutoSequentialMatch = () => {
    setMatches(prev => prev.map((m, idx) => ({
      ...m,
      fileId: files[idx] ? files[idx].id : null
    })));
    toast.info('Dosyalar sırasıyla fişlerle eşleştirildi.');
  };

  // Dosyayı base64'e çevir
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Tüm Eşleşenleri Kaydet
  const handleSaveAll = async () => {
    const validMatches = matches.filter(m => !!m.fileId);
    if (validMatches.length === 0) {
      toast.error('Lütfen en az bir fiş için dosya eşleştirin.');
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: validMatches.length, percent: 0 });

    let successCount = 0;
    const fileMap = new Map(files.map(f => [f.id, f]));

    try {
      for (let i = 0; i < validMatches.length; i++) {
        const item = validMatches[i];
        const selectedFile = fileMap.get(item.fileId!);
        if (!selectedFile) continue;

        try {
          const base64Data = await fileToBase64(selectedFile.file);

          // Backend'e kaydet (Sunucu diskine ve DB'ye yazar)
          await apiFetch(`/api/alis-faturalari/${item.invoiceId}`, {
            method: 'PUT',
            body: JSON.stringify({
              pdfDosya: base64Data,
              pdfDosyaAdi: selectedFile.name
            })
          });

          // AppContext state'ini güncelle
          updateAlisFatura(item.invoiceId, {
            ...item.invoice,
            pdfDosya: base64Data,
            pdfDosyaAdi: selectedFile.name
          } as any);

          successCount++;
        } catch (err) {
          console.error(`Fatura ${item.invoice.faturaNo} görsel aktarım hatası:`, err);
        }

        const curr = i + 1;
        setProgress({
          current: curr,
          total: validMatches.length,
          percent: Math.round((curr / validMatches.length) * 100)
        });
      }

      toast.success(`${successCount} adet fiş görseli başarıyla sisteme aktarıldı ve kaydedildi!`);
      if (onCompleted) onCompleted();
      onOpenChange(false);
      setFiles([]);
      setMatches([]);
    } catch (e: any) {
      toast.error('İşlem sırasında genel hata: ' + e.message);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isProcessing && onOpenChange(val)}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-indigo-600" />
            Toplu Fiş Görseli Yükle & Otomatik Eşleştir
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              {missingInvoices.length} Görselsiz Fiş
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Taslaktan aktarılan veya görseli yüklenmemiş fişler için fotoğrafları / PDF'leri topluca seçip saniyeler içinde eşleştirebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        {/* 1. ADIM: DOSYA SEÇİM ALANI */}
        <div className="shrink-0 border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 rounded-xl p-4 bg-indigo-50/40 dark:bg-indigo-950/20 text-center flex flex-col items-center justify-center gap-2">
          <UploadCloud className="w-8 h-8 text-indigo-500" />
          <div className="text-xs text-slate-600 dark:text-slate-300">
            Bilgisayarınızdan fiş görsellerini (JPG, PNG, WEBP, PDF) seçin (Ctrl ile çoklu seçebilirsiniz)
          </div>
          <div className="flex items-center gap-2 mt-1">
            <label className="cursor-pointer">
              <input 
                type="file" 
                multiple 
                accept="image/*,application/pdf" 
                className="hidden" 
                onChange={handleFilesSelected}
                disabled={isProcessing}
              />
              <span className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors">
                📁 Çoklu Dosya Seç ({files.length} Dosya Seçildi)
              </span>
            </label>

            {files.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAutoSequentialMatch} 
                disabled={isProcessing}
                className="text-xs h-8"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Sırasıyla Eşleştir
              </Button>
            )}

            {files.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setFiles([]); setMatches([]); }} 
                disabled={isProcessing}
                className="text-xs h-8 text-red-600 hover:bg-red-50"
              >
                Temizle
              </Button>
            )}
          </div>
        </div>

        {/* İlerleme Çubuğu */}
        {isProcessing && progress && (
          <div className="shrink-0 p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-1.5 my-2">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fiş görselleri sunucuya aktarılıyor...
              </span>
              <span>{progress.current} / {progress.total} (%{progress.percent})</span>
            </div>
            <Progress value={progress.percent} className="h-2" />
          </div>
        )}

        {/* 2. ADIM: EŞLEŞTİRME LİSTESİ */}
        <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl min-h-0 my-3 divide-y divide-slate-100 dark:divide-slate-800">
          {matches.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Yukarıdaki alandan fiş fotoğraflarını seçtiğinizde eşleştirme tablosu burada görüntülenecektir.
            </div>
          ) : (
            matches.map((item, idx) => {
              const assignedFile = files.find(f => f.id === item.fileId);

              return (
                <div key={item.invoiceId} className="p-2.5 px-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  {/* Fiş Bilgisi */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-6 text-[11px] font-mono text-slate-400 shrink-0 text-right">
                      {idx + 1}.
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-2">
                        <span>{item.invoice.tedarikciAdi || 'Bilinmeyen Tedarikçi'}</span>
                        <Badge variant="secondary" className="text-[10px] h-4 font-mono">
                          {item.invoice.faturaNo || 'No Yok'}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>📅 {item.invoice.faturaTarihi}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {item.invoice.toplamTutar?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </span>
                        {item.invoice.malHizmetAdi && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[140px]">{item.invoice.malHizmetAdi}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ok İkonu */}
                  <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

                  {/* Eşleşen Dosya Seçici */}
                  <div className="flex items-center gap-2 min-w-[280px] max-w-[340px] shrink-0">
                    {assignedFile?.previewUrl && (
                      <img 
                        src={assignedFile.previewUrl} 
                        alt="Önizleme" 
                        className="w-8 h-8 object-cover rounded border border-slate-200 shrink-0"
                      />
                    )}
                    {assignedFile?.isPdf && (
                      <div className="w-8 h-8 rounded bg-red-100 text-red-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                        PDF
                      </div>
                    )}

                    <Select 
                      value={item.fileId || 'none'} 
                      onValueChange={(val) => handleAssignFile(item.invoiceId, val === 'none' ? null : val)}
                    >
                      <SelectTrigger className="h-8 text-xs truncate">
                        <SelectValue placeholder="Dosya Seçin..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="none">-- Dosya Eşleşmedi --</SelectItem>
                        {files.map((f, fIdx) => (
                          <SelectItem key={f.id} value={f.id}>
                            #{fIdx + 1} - {f.name} ({(f.size / 1024).toFixed(0)} KB)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ALT AKSİYONLAR */}
        <div className="shrink-0 flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">
            Eşleşen: <span className="font-bold text-indigo-600">{matches.filter(m => !!m.fileId).length}</span> / {missingInvoices.length} fiş
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onOpenChange(false)} 
              disabled={isProcessing}
            >
              Vazgeç
            </Button>
            <Button 
              size="sm" 
              onClick={handleSaveAll} 
              disabled={isProcessing || matches.filter(m => !!m.fileId).length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Tüm Eşleşenleri Kaydet ({matches.filter(m => !!m.fileId).length})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export default MuhasebeTopluGorselEsleModal;
