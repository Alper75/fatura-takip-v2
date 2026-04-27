import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  CheckCircle2, 
  XCircle, 
  Printer, 
  Building2, 
  FileText,
  AlertCircle,
  Loader2,
  ChevronRight,
  FileDown,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export function PublicTeklifView({ token }: { token: string }) {
  const { fetchPublicTeklif, approvePublicTeklif } = useApp();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetchPublicTeklif(token);
      if (res.success) {
        setData(res); // api payload includes { success: true, teklif, kalemler, company } directly in res.
      } else {
        setError(res.message || 'Teklif yüklenirken bir hata oluştu.');
      }
      setLoading(false);
    }
    load();
  }, [token, fetchPublicTeklif]);

  const handleApprove = async () => {
    setApproving(true);
    const res = await approvePublicTeklif(token);
    if (res.success) {
      toast.success('Teklif başarıyla onaylandı ve siparişe dönüştürüldü!');
      // Reload to show status change
      const resNew = await fetchPublicTeklif(token);
      if (resNew.success) setData(resNew.data);
    } else {
      toast.error(res.message || 'Onaylanırken bir hata oluştu.');
    }
    setApproving(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  const handleExportExcel = () => {
    if (!data) return;
    const { teklif, kalemler } = data;
    const exportData = kalemler.map((k: any) => ({
      'Ürün Adı': k.urun_adi,
      'Miktar': k.miktar,
      'Birim': k.birim,
      'Birim Fiyat': k.birim_fiyat,
      'İskonto (%)': k.iskonto_orani || 0,
      'KDV (%)': k.kdv_orani,
      'Toplam': k.toplam_tutar
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teklif Detayı");
    XLSX.writeFile(wb, `${teklif.teklif_no}_Teklif.xlsx`);
    toast.success("Excel dosyası indirildi.");
  };

  const handleExportPDF = async () => {
    if (!data) return;
    const input = document.getElementById('teklif-pdf-content');
    if (!input) {
      toast.error("PDF oluşturulurken hedef alan bulunamadı.");
      return;
    }
    
    toast.loading("PDF yüksek çözünürlükte hazırlanıyor, lütfen bekleyin...", { id: "pdf-loading" });
    try {
      const canvas = await html2canvas(input, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${data.teklif.teklif_no}_Teklif.pdf`);
      toast.success("PDF başarıyla indirildi.", { id: "pdf-loading" });
    } catch (e) {
      console.error("PDF generation error:", e);
      toast.error("PDF oluşturulurken beklenmeyen bir hata oluştu.", { id: "pdf-loading" });
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Teklif hazırlanıyor...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full border-none shadow-2xl">
          <CardContent className="pt-10 pb-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Hata Oluştu</h2>
            <p className="text-slate-500 mb-8">{error || 'Teklif bulunamadı veya süresi dolmuş.'}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>Tekrar Dene</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { teklif, kalemler, company } = data;
  const isPending = teklif.durum === 'Bekliyor';

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4 sm:py-12 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Top Actions & Logo Area */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{company.name}</h1>
              <p className="text-sm text-slate-500 font-medium">Resmi Teklif Formu</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4 sm:mt-0">
            <Button variant="outline" className="gap-2 border-slate-200 hover:bg-slate-100 rounded-xl" onClick={handleExportPDF}>
              <FileDown className="w-4 h-4 text-rose-500" /> PDF
            </Button>
            <Button variant="outline" className="gap-2 border-slate-200 hover:bg-slate-100 rounded-xl" onClick={handleExportExcel}>
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Excel
            </Button>
            <Button variant="outline" className="gap-2 border-slate-200 hover:bg-slate-100 rounded-xl" onClick={() => window.print()}>
              <Printer className="w-4 h-4 text-slate-500" /> Yazdır
            </Button>
          </div>
        </div>

        {/* Status Banner */}
        {!isPending && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 ${
            teklif.durum.includes('Onaylandı') 
              ? 'bg-green-50 text-green-700 border border-green-100' 
              : 'bg-red-50 text-red-700 border border-red-100'
          } animate-in zoom-in duration-500`}>
            {teklif.durum.includes('Onaylandı') ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <span className="font-bold">Bu teklif {teklif.durum.toLowerCase()} durumundadır.</span>
          </div>
        )}

        {/* Main Document Card */}
        <Card id="teklif-pdf-content" className="border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden bg-white">
          {/* Document Header */}
          <div className="bg-slate-900 p-8 sm:p-12 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8">
              <div className="space-y-4">
                <Badge className="bg-primary/20 text-primary-foreground border-none hover:bg-primary/30 py-1 px-3">
                  TEKLİF NO: {teklif.teklif_no}
                </Badge>
                <div className="space-y-1">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Hazırlayan Firma</p>
                  <h2 className="text-2xl font-bold">{company.name}</h2>
                  <p className="text-slate-400 text-sm max-w-sm">{company.address || 'Adres bilgisi bulunmuyor.'}</p>
                </div>
              </div>
              
              <div className="flex flex-col md:items-end justify-end space-y-4">
                <div className="text-right">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Müşteri / Alıcı</p>
                  <h3 className="text-xl font-bold text-white">{teklif.musteri_adi}</h3>
                  <p className="text-slate-400 text-sm">{teklif.musteri_vkn || '-'}</p>
                </div>
                <div className="flex gap-6 text-right">
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Tarih</p>
                    <p className="text-sm font-semibold">{new Date(teklif.tarih).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Geçerlilik</p>
                    <p className="text-sm font-semibold">{teklif.vade_tarihi ? new Date(teklif.vade_tarihi).toLocaleDateString('tr-TR') : '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <CardContent className="p-0">
            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="py-4 px-8 text-xs font-bold uppercase tracking-wider">Açıklama / Ürün</th>
                    <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-center">Miktar</th>
                    <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-right">Birim Fiyat</th>
                    <th className="py-4 px-8 text-xs font-bold uppercase tracking-wider text-right">Toplam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kalemler.map((kalem: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-6 px-8">
                        <p className="font-bold text-slate-900">{kalem.urun_adi}</p>
                        <p className="text-xs text-slate-400 mt-1">Stok No: {kalem.urun_id || '-'}</p>
                      </td>
                      <td className="py-6 px-4 text-center">
                        <span className="font-semibold text-slate-700">{kalem.miktar}</span>
                        <span className="text-xs text-slate-400 ml-1">{kalem.birim}</span>
                      </td>
                      <td className="py-6 px-4 text-right font-medium text-slate-700">
                        {formatCurrency(kalem.birim_fiyat)}
                      </td>
                      <td className="py-6 px-8 text-right font-bold text-slate-900">
                        {formatCurrency(kalem.toplam_tutar)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Area */}
            <div className="p-8 sm:p-12 bg-slate-50/30 flex flex-col md:flex-row justify-between gap-12">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold">
                  <AlertCircle className="w-4 h-4 text-primary" />
                  <span>Teklif Notları</span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed italic">
                  {teklif.notlar || "Bu teklifte belirtilen fiyatlara KDV dahildir. Ödeme şartları teyit edilen siparişe göre belirlenecektir."}
                </p>
              </div>

              <div className="w-full md:w-64 space-y-3">
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Ara Toplam</span>
                  <span>{formatCurrency(kalemler.reduce((acc: number, k: any) => acc + (k.miktar * k.birim_fiyat), 0))}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-400">
                  <span>KDV Toplamı</span>
                  <span>{formatCurrency(teklif.toplam_tutar - kalemler.reduce((acc: number, k: any) => acc + (k.miktar * k.birim_fiyat), 0))}</span>
                </div>
                <div className="h-px bg-slate-200 my-4" />
                <div className="flex justify-between items-center">
                  <span className="text-slate-900 font-bold">GENEL TOPLAM</span>
                  <span className="text-2xl font-black text-primary font-mono">{formatCurrency(teklif.toplam_tutar)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval Footer - Only if Pending */}
        {isPending && (
          <Card className="border-none shadow-2xl bg-white p-6 sm:p-10 sticky bottom-8 z-20 animate-in slide-in-from-bottom-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Onay İşlemi</h4>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Yukarıdaki şartları ve fiyatları kabul ediyorsanız dijital olarak onaylayabilirsiniz.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <Button 
                  variant="ghost" 
                  className="flex-1 md:flex-none text-red-500 hover:text-red-700 hover:bg-red-50"
                  disabled={approving}
                >
                  Teklifi Reddet
                </Button>
                <Button 
                  className="flex-1 md:flex-none h-14 px-12 text-lg font-bold gap-3 shadow-xl shadow-primary/30"
                  onClick={handleApprove}
                  disabled={approving}
                >
                  {approving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                  Şimdi Onayla
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Footer Info */}
        <div className="text-center pt-8 pb-12 space-y-4">
          <p className="text-xs text-slate-400 font-medium">
            Bu belge otomatik olarak üretilmiştir. Her hakkı saklıdır. &copy; {new Date().getFullYear()} {company.name}
          </p>
          <div className="flex justify-center gap-6">
             <span className="text-[10px] text-slate-300 flex items-center gap-1 uppercase tracking-widest"><Building2 className="w-3 h-3" /> Güvenli Ödeme</span>
             <span className="text-[10px] text-slate-300 flex items-center gap-1 uppercase tracking-widest"><AlertCircle className="w-3 h-3" /> Şeffaf Fiyat</span>
          </div>
        </div>

      </div>
    </div>
  );
}
