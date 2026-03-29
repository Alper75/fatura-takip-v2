import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, X, Wallet, Clock, CheckCircle2, Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const DURUM_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING:  { label: 'Beklemede', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  APPROVED: { label: 'Onaylandı', className: 'bg-green-100 text-green-800 border-green-200' },
  REJECTED: { label: 'Reddedildi', className: 'bg-red-100 text-red-800 border-red-200' },
};

export default function TalepYonetimi() {
  const { requests, fetchRequests, updateRequestStatus } = useApp();
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = requests.filter((r) => r.status === activeTab);

  const handleStatusUpdate = async (id: number, status: string) => {
    const result = await updateRequestStatus(id, status);
    if (result.success) {
      toast.success(status === 'APPROVED' ? 'Talep onaylandı.' : 'Talep reddedildi.');
    } else {
      toast.error(result.message);
    }
  };

  const bekleyenSayisi = requests.filter((r) => r.status === 'PENDING').length;
  const onaylananToplam = requests
    .filter((r) => r.status === 'APPROVED')
    .reduce((acc, r) => acc + (r.amount ?? 0), 0);

  const exportToCSV = () => {
    const headers = ['Personel', 'Tür', 'Tutar', 'Tarih', 'Açıklama', 'Durum', 'Belge URL'];
    const rows = filteredRequests.map(r => [
      `${r.first_name || ''} ${r.last_name || ''}`,
      r.type === 'Expense' ? 'Masraf' : 'Avans',
      r.amount || 0,
      r.date || '',
      `"${(r.description || '').replace(/"/g, '""')}"`,
      DURUM_CONFIG[r.status]?.label || r.status,
      r.receipt_path ? `http://localhost:5000${r.receipt_path}` : '-'
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `talepler_${activeTab}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Talep Yönetimi</h2>
          <p className="text-sm text-muted-foreground mt-1">Avans ve masraf taleplerini inceleyin ve onaylayın</p>
        </div>
        <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Excel (CSV) İndir
        </Button>
      </div>

      {/* Özet Kartları */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-yellow-50/70">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-xs text-slate-500">Bekleyen Talep</p>
              <p className="text-xl font-bold text-yellow-700">{bekleyenSayisi}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-green-50/70">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-xs text-slate-500">Onaylanan Toplam</p>
              <p className="text-xl font-bold text-green-700">
                ₺{onaylananToplam.toLocaleString('tr-TR')}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-slate-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Wallet className="w-5 h-5 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Toplam Talep</p>
              <p className="text-xl font-bold text-slate-700">{requests.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Switcher (Custom Tabs) */}
      <div className="flex bg-slate-100/50 p-1 rounded-lg w-fit border border-slate-200">
        <button 
          onClick={() => setActiveTab('PENDING')}
          className={cn(
            "px-6 py-2 text-sm font-medium rounded-md transition-all",
            activeTab === 'PENDING' ? "bg-white text-indigo-700 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Bekleyenler ({bekleyenSayisi})
        </button>
        <button 
          onClick={() => setActiveTab('APPROVED')}
          className={cn(
            "px-6 py-2 text-sm font-medium rounded-md transition-all",
            activeTab === 'APPROVED' ? "bg-white text-green-700 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Onaylananlar
        </button>
        <button 
          onClick={() => setActiveTab('REJECTED')}
          className={cn(
            "px-6 py-2 text-sm font-medium rounded-md transition-all",
            activeTab === 'REJECTED' ? "bg-white text-red-700 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Reddedilenler
        </button>
      </div>

      {/* Tablo */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {activeTab === 'PENDING' ? 'Onay Bekleyen Talepler' : activeTab === 'APPROVED' ? 'Onaylanmış Masraf ve Avanslar' : 'Reddedilen Talepler'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="font-semibold text-slate-700">Personel</TableHead>
                <TableHead className="font-semibold text-slate-700">Tür</TableHead>
                <TableHead className="font-semibold text-slate-700">Tutar</TableHead>
                <TableHead className="font-semibold text-slate-700">Tarih</TableHead>
                <TableHead className="font-semibold text-slate-700">Açıklama</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">Belge</TableHead>
                <TableHead className="font-semibold text-slate-700">Durum</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    {activeTab === 'PENDING' ? 'Bekleyen talep yok.' : 'Gösterilecek kayıt yok.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((req) => {
                  const cfg = DURUM_CONFIG[req.status] ?? DURUM_CONFIG.PENDING;
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">
                        {req.first_name} {req.last_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={req.type === 'Expense' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}>
                          {req.type === 'Expense' ? 'Masraf' : 'Avans'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800">
                        ₺{req.amount?.toLocaleString('tr-TR')}
                      </TableCell>
                      <TableCell>{req.date}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-slate-500">
                        {req.description || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {req.receipt_path ? (
                          <a href={`http://localhost:5000${req.receipt_path}`} target="_blank" rel="noreferrer" className="inline-flex items-center text-blue-600 hover:underline">
                            <FileText className="w-4 h-4 mr-1" />
                            Gör
                          </a>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cfg.className}>
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {req.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                              onClick={() => handleStatusUpdate(req.id, 'APPROVED')}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              onClick={() => handleStatusUpdate(req.id, 'REJECTED')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
