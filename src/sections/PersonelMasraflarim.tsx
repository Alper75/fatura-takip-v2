import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Wallet, Clock, CheckCircle2, Download, FileText } from 'lucide-react';

const DURUM_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING:  { label: 'Beklemede', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  APPROVED: { label: 'Onaylandı', className: 'bg-green-100 text-green-800 border-green-200' },
  REJECTED: { label: 'Reddedildi', className: 'bg-red-100 text-red-800 border-red-200' },
};

export default function PersonelMasraflarim() {
  const { requests, fetchRequests, submitExpenseRequest } = useApp();

  const [filterDurum, setFilterDurum] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: 'Expense',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    file: null as File | null
  });

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = filterDurum === 'all'
    ? requests
    : requests.filter((r) => r.status === filterDurum);

  const handleSubmit = async () => {
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      toast.error('Lütfen geçerli bir tutar girin.');
      return;
    }
    if (!form.date) {
      toast.error('Lütfen tarih seçin.');
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('type', form.type);
    formData.append('amount', form.amount);
    formData.append('date', form.date);
    formData.append('description', form.description);
    if (form.file) formData.append('receipt', form.file);

    const result = await submitExpenseRequest(formData);
    setLoading(false);
    if (result.success) {
      toast.success('Talebiniz iletildi.');
      setIsDialogOpen(false);
      setForm({ type: 'Expense', amount: '', date: new Date().toISOString().split('T')[0], description: '', file: null });
      fetchRequests();
    } else {
      toast.error(result.message || 'Bir hata oluştu.');
    }
  };

  // Özet hesaplamaları
  const bekleyen = requests.filter((r) => r.status === 'PENDING').length;
  const onaylananToplam = requests
    .filter((r) => r.status === 'APPROVED')
    .reduce((acc, r) => acc + (r.amount ?? 0), 0);

  const exportToCSV = () => {
    const headers = ['Tür', 'Tutar', 'Tarih', 'Açıklama', 'Durum', 'Belge URL'];
    const rows = filteredRequests.map(r => [
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
    link.setAttribute("download", `masraflarim_${filterDurum}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Harcama ve Taleplerim</h2>
          <p className="text-sm text-muted-foreground mt-1">Avans ve masraf taleplerinizi buradan yönetin</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Excel (CSV) İndir
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Yeni Talep
          </Button>
        </div>
      </div>

      {/* Özet Kartları */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-yellow-50/70">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-xs text-slate-500">Bekleyen</p>
              <p className="text-xl font-bold text-yellow-700">{bekleyen}</p>
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

      {/* Tablo */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Talep Geçmişim</CardTitle>
            <Select value={filterDurum} onValueChange={setFilterDurum}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="PENDING">Bekleyen</SelectItem>
                <SelectItem value="APPROVED">Onaylanan</SelectItem>
                <SelectItem value="REJECTED">Reddedilen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="font-semibold text-slate-700">Tür</TableHead>
                <TableHead className="font-semibold text-slate-700">Tutar</TableHead>
                <TableHead className="font-semibold text-slate-700">Tarih</TableHead>
                <TableHead className="font-semibold text-slate-700">Açıklama</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">Belge</TableHead>
                <TableHead className="font-semibold text-slate-700">Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Henüz bir talebiniz bulunmuyor.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((req) => {
                  const cfg = DURUM_CONFIG[req.status] ?? DURUM_CONFIG.PENDING;
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">
                        {req.type === 'Expense' ? 'Masraf' : 'Avans'}
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
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Yeni Talep Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Avans / Masraf Talebi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Talep Türü</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Expense">Masraf Talebi</SelectItem>
                  <SelectItem value="Advance">Avans Talebi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tutar (₺)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tarih</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Input
                placeholder="Harcama/avans sebebini belirtin..."
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Belge / Dekont Yükle</Label>
              <Input
                type="file"
                onChange={(e) => setForm((p) => ({ ...p, file: e.target.files?.[0] || null }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Gönderiliyor...' : 'Talebi Gönder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
