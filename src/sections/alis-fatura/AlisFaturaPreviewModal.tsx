import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, FileText } from 'lucide-react';

interface AlisFaturaPreviewModalProps {
  previewImage: { url: string; name: string } | null;
  onClose: () => void;
}

export function AlisFaturaPreviewModal({ previewImage, onClose }: AlisFaturaPreviewModalProps) {
  return (
        <Dialog open={!!previewImage} onOpenChange={(open) => !open && onClose()}>
          <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col p-4 bg-white">
            <DialogHeader className="pb-2 border-b">
              <DialogTitle className="text-base font-semibold flex items-center justify-between pr-6">
                <span className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                  {previewImage?.name || 'Fiş Önizleme'}
                </span>
                {previewImage?.url && (
                  <a
                    href={previewImage.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-normal"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Yeni Sekmede Aç
                  </a>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Fişin üzerindeki tutar, KDV ve firma adını inceleyerek soldaki form alanlarını doldurabilirsiniz.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto flex items-center justify-center p-3 bg-slate-900/5 rounded-lg min-h-[350px]">
              {previewImage?.url ? (
                previewImage.url.startsWith('data:application/pdf') ? (
                  <iframe 
                    src={previewImage.url} 
                    title={previewImage.name} 
                    className="w-full h-[65vh] border-0 rounded"
                  />
                ) : (
                  <img 
                    src={previewImage.url} 
                    alt={previewImage.name} 
                    className="max-h-[70vh] w-auto max-w-full object-contain rounded shadow-md border bg-white" 
                  />
                )
              ) : null}
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-xs text-slate-500 italic">Görseli inceledikten sonra pencereyi kapatıp formu tamamlayabilirsiniz.</span>
              <Button type="button" size="sm" variant="default" onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Tamam, Formu Doldur
              </Button>
            </div>
          </DialogContent>
        </Dialog>
  );
}
