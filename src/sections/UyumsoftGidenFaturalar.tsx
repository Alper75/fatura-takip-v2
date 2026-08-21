import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Download, RefreshCcw, Save } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import { IntegrationImportPreviewModal } from '../components/IntegrationImportPreviewModal';

export default function UyumsoftGidenFaturalar() {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [faturalar, setFaturalar] = useState<any[]>([]);
  const [savedInvoices, setSavedInvoices] = useState<string[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  const { fetchSatisFaturalari, fetchCariHareketler, satisFaturalari } = useApp();

  useEffect(() => {
    fetchFaturalar();
  }, []);

  const fetchFaturalar = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const startIso = new Date(startDate).toISOString();
      const endIso = new Date(endDate).toISOString();
      const res = await fetch(`/api/uyumsoft/giden-faturalar?baslangic=${startIso}&bitis=${endIso}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      console.log("=== LOGO RAW RESPONSE ===", data.rawLogoResponse);
      
      if (data.success) {
        setFaturalar(data.veriler || []);
      } else {
        toast.error(data.message || 'Faturalar alınamadı');
      }
    } catch (error) {
      console.error('Gelen faturalar alınamadı:', error);
      toast.error('Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (uuid: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/uyumsoft/fatura-pdf/${uuid}?token=${token}`);
      const data = await res.json();
      
      if (data.success && data.base64) {
        // Decode base64 to blob
        const byteCharacters = atob(data.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        // Trigger download
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = data.filename || `${uuid}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(link.href);
      } else {
        toast.error(data.message || 'PDF indirilemedi');
      }
    } catch (error) {
      console.error('PDF indirme hatası:', error);
      toast.error('PDF indirilirken hata oluştu');
    }
  };

  const handleImportInvoice = async (fatura: any) => {
    setImporting(fatura.uuid);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/invoices/import-satis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(fatura)
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(data.message);
        setSavedInvoices(prev => [...prev, fatura.uuid]);
        fetchSatisFaturalari(); fetchCariHareketler(); // Listeyi güncelle
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('İçe aktarma hatası:', error);
      toast.error('Fatura kaydedilirken bir hata oluştu');
    } finally {
      setImporting(null);
    }
  };

  const handleBulkImport = () => {
    if (selectedInvoices.length === 0) return;
    setShowPreviewModal(true);
  };


  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('tr-TR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Gelen E-Faturalar (Uyumsoft)</h2>
          <p className="text-muted-foreground mt-1">Uyumsoft portalınıza gelen e-Faturaları görüntüleyin ve kaydedin.</p>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="date" 
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-gray-500">-</span>
          <input 
            type="date" 
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <Button onClick={fetchFaturalar} disabled={loading} variant="outline" className="gap-2 ml-2">
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Getir
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-md bg-white">
        <CardHeader className="border-b bg-gray-50/50 pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg text-gray-800">Fatura Listesi</CardTitle>
            <CardDescription>
              GİB üzerinden tarafınıza kesilen faturalar.
            </CardDescription>
          </div>
          {selectedInvoices.length > 0 && (
            <Button 
              onClick={handleBulkImport} 
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Seçilenleri Kaydet ({selectedInvoices.length})
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-0 px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={faturalar.length > 0 && selectedInvoices.length === faturalar.filter(f => !(savedInvoices.includes(f.uuid) || satisFaturalari.some(a => a.faturaNo === f.faturaNo))).length && faturalar.filter(f => !(savedInvoices.includes(f.uuid) || satisFaturalari.some(a => a.faturaNo === f.faturaNo))).length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInvoices(faturalar.filter(f => !(savedInvoices.includes(f.uuid) || satisFaturalari.some(a => a.faturaNo === f.faturaNo))).map(f => f.uuid));
                        } else {
                          setSelectedInvoices([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600">Gönderen / VKN</TableHead>
                  <TableHead className="font-semibold text-slate-600">Fatura No</TableHead>
                  <TableHead className="font-semibold text-slate-600">Açıklama</TableHead>
                  <TableHead className="font-semibold text-slate-600">Tarih</TableHead>
                  <TableHead className="font-semibold text-slate-600 text-right">Tutar</TableHead>
                  <TableHead className="font-semibold text-slate-600 text-center">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                      Faturalar yükleniyor...
                    </TableCell>
                  </TableRow>
                ) : faturalar.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                      Gelen fatura bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  faturalar.map((f, i) => {
                    const isSaved = savedInvoices.includes(f.uuid) || satisFaturalari.some(a => a.faturaNo === f.faturaNo);
                    return (
                      <TableRow key={i} className={isSaved ? "bg-green-100/50 hover:bg-green-100/70" : "hover:bg-slate-50"}>
                        <TableCell className="text-center">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                            checked={selectedInvoices.includes(f.uuid)}
                            disabled={isSaved}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedInvoices(prev => [...prev, f.uuid]);
                              } else {
                                setSelectedInvoices(prev => prev.filter(id => id !== f.uuid));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-800">{f?.senderName || 'Bilinmiyor'}</div>
                          <div className="text-xs text-slate-500 mt-0.5">VKN: {f?.senderVkn || '-'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-700">{f?.invoiceNumber || f?.faturaNo || '-'}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5" title={f?.uuid || ''}>
                            {f?.uuid ? `${f.uuid.split('-')[0]}...` : 'Geçersiz UUID'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-600 truncate max-w-[200px]" title={f?.faturaAciklama}>
                            {f?.faturaAciklama || 'Belirtilmemiş'}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {formatDate(f?.issueDate)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium text-slate-900">
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: f?.currencyCode || 'TRY' }).format(f?.payableAmount || 0)}
                          </div>
                          {f?.matrah > 0 && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Matrah: {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: f.currencyCode || 'TRY' }).format(f.matrah)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8 gap-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200"
                              onClick={() => handleDownloadPdf(f.uuid)}
                            >
                              <Download className="w-3.5 h-3.5" /> PDF
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm"
                              disabled={importing === f.uuid || isSaved}
                              className={`h-8 gap-1.5 shadow-sm ${isSaved ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-800 hover:bg-slate-700'}`}
                              onClick={() => handleImportInvoice(f)}
                            >
                              {importing === f.uuid ? (
                                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Save className="w-3.5 h-3.5" />
                              )}
                              {isSaved ? "Kaydedildi" : "Kaydet"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          </CardContent>
        </Card>

      <IntegrationImportPreviewModal 
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        invoices={faturalar.filter(f => selectedInvoices.includes(f.uuid))}
        importApiUrl="/api/invoices/import-satis"
        onSuccess={() => {
          setSavedInvoices(prev => [...prev, ...selectedInvoices]);
          setSelectedInvoices([]);
          fetchSatisFaturalari(); fetchCariHareketler();
        }}
      />
    </div>
  );
}
