import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Download, RefreshCcw, Save, Search, CheckCircle2, Clock, Layers } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import { IntegrationImportPreviewModal } from '../components/IntegrationImportPreviewModal';

export default function GelenUyumsoftFaturalar() {
  const [loading, setLoading] = useState(false);
  const [faturalar, setFaturalar] = useState<any[]>([]);
  const [savedInvoices, setSavedInvoices] = useState<string[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNSAVED' | 'SAVED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  const { fetchAlisFaturalari, fetchCariHareketler, alisFaturalari } = useApp();

  useEffect(() => {
    fetchFaturalar();
    fetchAlisFaturalari();
    fetchCariHareketler();
  }, []);

  const fetchFaturalar = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const startIso = new Date(startDate).toISOString();
      const endIso = new Date(endDate).toISOString();
      const res = await fetch(`/api/uyumsoft/gelen-faturalar?baslangic=${startIso}&bitis=${endIso}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
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
        const byteCharacters = atob(data.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
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

  const handleImportInvoice = (fatura: any) => {
    setSelectedInvoices([fatura.uuid]);
    setShowPreviewModal(true);
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

    const checkIsSaved = (f: any) => {
    if (!f) return false;
    if (f.isAlreadySaved) return true;
    const fNo = String(f.invoiceNumber || f.faturaNo || f.documentId || '').trim().toLowerCase();
    const fUuid = String(f.uuid || f.documentUuid || '').trim().toLowerCase();
    
    if (fUuid && savedInvoices.map(s => s.toLowerCase()).includes(fUuid)) return true;
    
    return (alisFaturalari || []).some((a: any) => {
      const aNo = String(a.faturaNo || a.fatura_no || '').trim().toLowerCase();
      const aUuid = String(a.gibUuid || a.gib_uuid || a.uuid || '').trim().toLowerCase();
      if (fNo && aNo && aNo === fNo) return true;
      if (fUuid && aUuid && aUuid === fUuid) return true;
      return false;
    });
  };

  const savedCount = useMemo(() => faturalar.filter(f => checkIsSaved(f)).length, [faturalar, savedInvoices, alisFaturalari]);
  const unsavedCount = useMemo(() => faturalar.filter(f => !checkIsSaved(f)).length, [faturalar, savedInvoices, alisFaturalari]);

  const filteredFaturalar = useMemo(() => {
    return faturalar.filter(f => {
      const isSaved = checkIsSaved(f);
      if (statusFilter === 'UNSAVED' && isSaved) return false;
      if (statusFilter === 'SAVED' && !isSaved) return false;
      
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = (f.senderName || f.aliciUnvan || '').toLowerCase().includes(q);
        const matchVkn = (f.senderVkn || f.aliciVkn || '').toLowerCase().includes(q);
        const matchNo = (f.invoiceNumber || f.faturaNo || '').toLowerCase().includes(q);
        const matchDesc = (f.faturaAciklama || '').toLowerCase().includes(q);
        return matchName || matchVkn || matchNo || matchDesc;
      }
      return true;
    });
  }, [faturalar, statusFilter, searchTerm, savedInvoices, alisFaturalari]);

  const selectableFiltered = useMemo(() => filteredFaturalar.filter(f => !checkIsSaved(f)), [filteredFaturalar, savedInvoices, alisFaturalari]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Gelen Faturalar (Uyumsoft)</h2>
          <p className="text-muted-foreground mt-1">Uyumsoft portalınıza gelen e-Faturaları görüntüleyin, filtreleyin ve kaydedin.</p>
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
          <Button onClick={fetchFaturalar} disabled={loading} variant="outline" className="gap-2 ml-2 shadow-sm">
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Getir
          </Button>
        </div>
      </div>

      <Card className="border shadow-sm bg-white overflow-hidden">
        <CardHeader className="border-b bg-gray-50/70 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-gray-800">Fatura Listesi</CardTitle>
              <CardDescription>
                Uyumsoft üzerinden tarafınıza kesilen faturalar.
              </CardDescription>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Filtre Butonları */}
              <div className="flex items-center bg-slate-200/70 p-1 rounded-lg border border-slate-300/60 shadow-inner">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    statusFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Tümü ({faturalar.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('UNSAVED')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    statusFilter === 'UNSAVED'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-indigo-600'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Kaydedilmemiş ({unsavedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('SAVED')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    statusFilter === 'SAVED'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-emerald-600'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Kaydedilmiş ({savedCount})
                </button>
              </div>

              {/* Arama Inputu */}
              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Firma, VKN veya No Ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {selectedInvoices.length > 0 && (
                <Button 
                  onClick={handleBulkImport} 
                  className="bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                  size="sm"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  Seçilenleri Kaydet ({selectedInvoices.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={selectableFiltered.length > 0 && selectableFiltered.every(f => selectedInvoices.includes(f.uuid))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const toAdd = selectableFiltered.map(f => f.uuid);
                          setSelectedInvoices(prev => Array.from(new Set([...prev, ...toAdd])));
                        } else {
                          const toRemove = new Set(selectableFiltered.map(f => f.uuid));
                          setSelectedInvoices(prev => prev.filter(id => !toRemove.has(id)));
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700">Gönderen / VKN</TableHead>
                  <TableHead className="font-semibold text-slate-700">Fatura No</TableHead>
                  <TableHead className="font-semibold text-slate-700">Fatura Açıklaması</TableHead>
                  <TableHead className="font-semibold text-slate-700">Tarih</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">Tutar</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center w-28">Durum</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center w-36">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                      Faturalar yükleniyor...
                    </TableCell>
                  </TableRow>
                ) : filteredFaturalar.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                      {statusFilter === 'UNSAVED' 
                        ? 'Tüm faturalar sisteme kaydedilmiş.' 
                        : statusFilter === 'SAVED' 
                        ? 'Henüz sisteme kaydedilmiş fatura yok.' 
                        : 'Fatura bulunamadı.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFaturalar.map((f, i) => {
                    const isSaved = checkIsSaved(f);
                    return (
                      <TableRow key={i} className={isSaved ? "bg-emerald-50/40 hover:bg-emerald-50/70" : "hover:bg-slate-50/80"}>
                        <TableCell className="text-center">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40"
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
                          <div className="font-medium text-slate-900">{f?.senderName || 'Bilinmiyor'}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">VKN: {f?.senderVkn || '-'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs font-semibold text-slate-800">{f?.invoiceNumber || f?.faturaNo || '-'}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5" title={f?.uuid || ''}>
                            {f?.uuid ? `${f.uuid.split('-')[0]}...` : 'Geçersiz UUID'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-slate-600 truncate max-w-[220px]" title={f?.faturaAciklama}>
                            {f?.faturaAciklama || 'Belirtilmemiş'}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {formatDate(f?.issueDate)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-sm">
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: f?.currencyCode || 'TRY' }).format(f?.payableAmount || 0)}
                          </div>
                          {f?.matrah > 0 && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Matrah: {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: f.currencyCode || 'TRY' }).format(f.matrah)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {isSaved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Kayıtlı
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3" /> Bekliyor
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1.5">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8 px-2.5 gap-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200"
                              onClick={() => handleDownloadPdf(f.uuid)}
                              title="Fatura PDF İndir"
                            >
                              <Download className="w-3.5 h-3.5" /> PDF
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm"
                              disabled={isSaved}
                              className={`h-8 px-3 gap-1 shadow-sm ${isSaved ? 'bg-emerald-600 text-white cursor-default opacity-80' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                              onClick={() => handleImportInvoice(f)}
                            >
                              <Save className="w-3.5 h-3.5" />
                              {isSaved ? "Kayıtlı" : "Kaydet"}
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
        importApiUrl="/api/invoices/import-from-uyumsoft"
        onSuccess={() => {
          setSavedInvoices(prev => [...prev, ...selectedInvoices]);
          setSelectedInvoices([]);
          fetchAlisFaturalari(); fetchCariHareketler();
        }}
      />
    </div>
  );
}
