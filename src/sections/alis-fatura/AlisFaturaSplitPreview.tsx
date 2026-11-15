import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FormEntry } from './alisFaturaHelpers';

interface AlisFaturaSplitPreviewProps {
  activeFormForPreview: FormEntry;
  activePreviewIndex: number;
  forms: FormEntry[];
  splitZoom: number;
  setSplitZoom: React.Dispatch<React.SetStateAction<number>>;
  focusAndScrollToForm: (targetFormId: number, focusFieldKey?: string) => void;
  onOpenFullPreview: (img: { url: string; name: string }) => void;
}

export function AlisFaturaSplitPreview({
  activeFormForPreview,
  activePreviewIndex,
  forms,
  splitZoom,
  setSplitZoom,
  focusAndScrollToForm,
  onOpenFullPreview,
}: AlisFaturaSplitPreviewProps) {
  return (
    <div className="lg:col-span-5 sticky top-4 bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-xl flex flex-col max-h-[82vh]">
      <div className="px-3.5 py-2.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between gap-2 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <span className="bg-indigo-600 text-white text-[11px] font-bold px-2 py-0.5 rounded shrink-0">
            Fiş #{activePreviewIndex + 1} / {forms.length}
          </span>
          <span className="text-xs font-medium text-slate-200 truncate">
            {activeFormForPreview.data.dosyaAdi || 'Fiş Görseli'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-200 hover:text-white hover:bg-slate-700"
            onClick={() => setSplitZoom(z => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
            title="Uzaklaştır"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[11px] font-mono text-slate-300 px-1">%{Math.round(splitZoom * 100)}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-200 hover:text-white hover:bg-slate-700"
            onClick={() => setSplitZoom(z => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
            title="Yakınlaştır"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          {forms.length > 1 && (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-200 hover:text-white hover:bg-slate-700 ml-1"
                disabled={activePreviewIndex <= 0}
                onClick={() => {
                  if (activePreviewIndex > 0) {
                    focusAndScrollToForm(forms[activePreviewIndex - 1].id);
                  }
                }}
                title="Önceki Fiş (İlgili satıra git)"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-200 hover:text-white hover:bg-slate-700"
                disabled={activePreviewIndex >= forms.length - 1}
                onClick={() => {
                  if (activePreviewIndex < forms.length - 1) {
                    focusAndScrollToForm(forms[activePreviewIndex + 1].id);
                  }
                }}
                title="Sonraki Fiş (İlgili satıra git)"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="p-3 overflow-auto flex-1 flex items-start justify-center bg-slate-950/60 min-h-[420px]">
        {activeFormForPreview.data.dosyaBase64?.startsWith('data:application/pdf') ? (
          <iframe
            src={activeFormForPreview.data.dosyaBase64}
            title={activeFormForPreview.data.dosyaAdi || 'PDF'}
            className="w-full h-[68vh] rounded border-0 bg-white"
          />
        ) : (
          <img
            src={activeFormForPreview.data.dosyaBase64}
            alt={activeFormForPreview.data.dosyaAdi || 'Fiş'}
            style={{ transform: `scale(${splitZoom})`, transformOrigin: 'top center' }}
            className="max-w-full h-auto rounded shadow-lg transition-transform duration-150"
          />
        )}
      </div>
      <div className="px-3.5 py-2 bg-slate-800/90 border-t border-slate-700 text-[11px] text-slate-300 flex items-center justify-between">
        <span>Ok tuşları (&lt; / &gt;) ile fiş değiştirdiğinizde ilgili satır otomatik yanına gelir.</span>
        <button
          type="button"
          onClick={() =>
            onOpenFullPreview({
              url: activeFormForPreview.data.dosyaBase64!,
              name: activeFormForPreview.data.dosyaAdi || 'Fiş',
            })
          }
          className="text-indigo-300 hover:text-white underline font-semibold shrink-0 ml-2"
        >
          Tam Ekran Aç
        </button>
      </div>
    </div>
  );
}
