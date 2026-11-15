import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, FileText, Loader2, Plus, Sparkles, X } from 'lucide-react';
import type { FormEntry, SaveProgress, ScanProgress, UploadedFile } from './alisFaturaHelpers';

interface AlisFaturaUploadPanelProps {
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  setForms: React.Dispatch<React.SetStateAction<FormEntry[]>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  processFiles: (files: File[]) => void;
  scanImage: () => void;
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  isSaving: boolean;
  saveProgress: SaveProgress | null;
  aiAddedCount: number;
  setPreviewImage: (img: { url: string; name: string } | null) => void;
}

export function AlisFaturaUploadPanel({
  isDragging,
  setIsDragging,
  uploadedFiles,
  setUploadedFiles,
  setForms,
  fileInputRef,
  handleFileChange,
  processFiles,
  scanImage,
  isScanning,
  scanProgress,
  isSaving,
  saveProgress,
  aiAddedCount,
  setPreviewImage,
}: AlisFaturaUploadPanelProps) {
  return (
    <>
      {isScanning && scanProgress && (
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 mt-4 space-y-2 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              Dosyalar Taranıyor ({scanProgress.current} / {scanProgress.total})
            </span>
            <span className="bg-indigo-200/80 px-2 py-0.5 rounded text-indigo-900 font-bold">
              %{scanProgress.percent}
            </span>
          </div>
          <Progress value={scanProgress.percent} className="h-2.5 bg-indigo-100" />

          {scanProgress.isWaitingQuota && (
            <div className="bg-amber-100 border border-amber-300 rounded-lg p-2.5 text-xs text-amber-900 flex items-center justify-between animate-pulse">
              <span className="flex items-center gap-1.5 font-semibold">
                <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
                Google dakikalık kota sınırı (Dakikada 20 fiş). Otomatik bekleniyor...
              </span>
              <span className="font-mono font-bold bg-amber-200 px-2.5 py-1 rounded text-amber-900 text-xs">
                {scanProgress.quotaWaitSeconds} sn
              </span>
            </div>
          )}

          <div className="flex justify-between items-center text-[11px] text-indigo-700">
            <span className="truncate max-w-[260px] font-medium">
              {scanProgress.currentFileName || scanProgress.currentFile || 'Belge işleniyor...'}
            </span>
            <span>
              Kalan: <b>{scanProgress.remaining} dosya</b>
            </span>
          </div>
        </div>
      )}

      {isSaving && saveProgress && (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mt-4 space-y-2 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              Sisteme Aktarılıyor ({saveProgress.current} / {saveProgress.total})
            </span>
            <span className="bg-emerald-200/80 px-2 py-0.5 rounded text-emerald-900 font-bold">
              %{saveProgress.percent} Aktarıldı
            </span>
          </div>
          <Progress value={saveProgress.percent} className="h-2.5 bg-emerald-100" />
          <div className="flex justify-between items-center text-[11px] text-emerald-700">
            <span className="truncate max-w-[260px] font-medium">{saveProgress.currentInvoice}</span>
            <span>
              Kalan: <b>{saveProgress.remaining} fiş</b>
            </span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {uploadedFiles.length === 0 ? (
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors relative',
              isDragging ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.length > 0) processFiles(Array.from(e.dataTransfer.files));
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*,application/pdf"
              multiple
              onChange={handleFileChange}
            />
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6 text-slate-500" />
            </div>
            <h4 className="font-semibold text-slate-900">PDF veya Resim (Fatura/Fiş) Yükleyin</h4>
            <p className="text-sm text-slate-500 mt-1">Gelişmiş AI modeli birden fazla PDF ve resmi anında okur!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {uploadedFiles.map((file, idx) => {
                const isErr = file.status === 'error';
                const isSuccess = file.status === 'success';
                const isScan = file.status === 'scanning';

                return (
                  <div
                    key={idx}
                    onClick={() => setPreviewImage({ url: file.base64, name: file.name })}
                    className={cn(
                      'relative rounded-lg overflow-hidden bg-slate-50 group aspect-square flex items-center justify-center cursor-pointer transition-all',
                      isErr
                        ? 'border-2 border-red-500 ring-2 ring-red-400/40 bg-red-50 shadow-sm'
                        : isSuccess
                          ? 'border-2 border-emerald-500 bg-emerald-50/20'
                          : isScan
                            ? 'border-2 border-indigo-500 animate-pulse bg-indigo-50/30'
                            : 'border border-slate-200'
                    )}
                    title={isErr ? `Okunamadı: ${file.errorMessage || 'Hata'}` : file.name}
                  >
                    {file.mimeType === 'application/pdf' ? (
                      <div className="flex flex-col items-center justify-center p-2 text-center">
                        <FileText
                          className={cn(
                            'w-8 h-8 mb-1',
                            isErr ? 'text-red-500' : isSuccess ? 'text-emerald-500' : 'text-slate-400'
                          )}
                        />
                        <p className="text-xs font-medium text-slate-600 truncate w-full px-2">{file.name}</p>
                      </div>
                    ) : (
                      <img src={file.base64} alt={file.name} className="w-full h-full object-cover" />
                    )}

                    {isErr && (
                      <div className="absolute top-1 left-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 z-10">
                        <AlertCircle className="w-3 h-3" /> Hata
                      </div>
                    )}
                    {isSuccess && (
                      <div className="absolute top-1 left-1 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 z-10">
                        <CheckCircle2 className="w-3 h-3" /> Okundu
                      </div>
                    )}
                    {isScan && (
                      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white z-10">
                        <Loader2 className="w-5 h-5 animate-spin mb-1" />
                        <span className="text-[10px] font-medium">Taranıyor</span>
                      </div>
                    )}

                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="h-6 w-6 rounded-full shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
                          setForms((prev) => prev.filter((f) => f.data.dosyaAdi !== file.name));
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-slate-50 transition-colors aspect-square"
              >
                <Plus className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500 font-medium">Dosya Ekle</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {aiAddedCount === 0 && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  onClick={scanImage}
                  disabled={isScanning}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg font-semibold rounded-full px-8 py-6 text-lg"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      {scanProgress ? `Diziliyor (${scanProgress.current}/${scanProgress.total})...` : 'Analiz Ediliyor...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-3" />
                      Tümünü Analiz Et ({uploadedFiles.length} Dosya)
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {aiAddedCount > 0 && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div className="text-sm text-emerald-900">
              <span className="font-semibold text-base block mb-1">Tarama tamamlandı!</span>
              Yüklediğiniz dosyalardan toplam <b>{aiAddedCount} adet</b> fiş/fatura çıkarıldı.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
