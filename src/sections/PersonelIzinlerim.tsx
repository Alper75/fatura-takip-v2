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
import { Plus, Calendar, Clock } from 'lucide-react';

const IZIN_TUR_LABELS: Record<string, string> = {
  Annual: 'Yıllık İzin',
  Unpaid: 'Ücretsiz İzin',
  Maternity: 'Doğum İzni',
  Sickness: 'Hastalık İzni',
};

const DURUM_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING:  { label: 'Beklemede', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  APPROVED: { label: 'Onaylandı', className: 'bg-green-100 text-green-800 border-green-200' },
  REJECTED: { label: 'Reddedildi', className: 'bg-red-100 text-red-800 border-red-200' },
};

const calcDays = (start: string, end: string) => {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
};

export default function PersonelIzinlerim() {
  const { leaves, fetchLeaves, submitLeaveRequest } = useApp();

  const [filterDurum, setFilterDurum] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: 'Annual',
    start_date: '',
    end_date: '',
    description: '',
  });

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const filteredLeaves = filterDurum === 'all'
    ? leaves
    : leaves.filter((l) => l.status === filterDurum);

  const handleSubmit = async () => {
    if (!form.start_date || !form.end_date) {
      toast.error('Lütfen başlangıç ve bitiş tarihini doldurun.');
      return;
    }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      toast.error('Bitiş tarihi başlangıçtan önce olamaz.');
      return;
    }
    setLoading(true);
    const result = await submitLeaveRequest(form);
    setLoading(false);
    if (result.success) {
      toast.success('İzin talebiniz iletildi.');
      setIsDialogOpen(false);
      setForm({ type: 'Annual', start_date: '', end_date: '', description: '' });
      fetchLeaves();
    } else {
      toast.error(result.message || 'Bir hata oluştu.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">İzinlerim</h2>
          <p className="text-sm text-muted-foreground mt-1">Geçmiş ve bekleyen izin talepleriniz</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Yeni İzin Talebi
        </Button>
      </div>

      {/* Özet Kartları */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-yellow-50/70">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-xs text-slate-500">Bekleyen</p>
              <p className="text-xl font-bold text-yellow-700">
                {leaves.filter((l) => l.status === 'PENDING').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-green-50/70">
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-xs text-slate-500">Onaylanan</p>
              <p className="text-xl font-bold text-green-700">
                {leaves.filter((l) => l.status === 'APPROVED').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-slate-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Toplam Onaylanan Gün</p>
              <p className="text-xl font-bold text-slate-700">
                {leaves
                  .filter((l) => l.status === 'APPROVED')
                  .reduce((acc, l) => acc + calcDays(l.start_date, l.end_date), 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tablo */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">İzin Geçmişim</CardTitle>
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
                <TableHead className="font-semibold text-slate-700">İzin Türü</TableHead>
                <TableHead className="font-semibold text-slate-700">Başlangıç</TableHead>
                <TableHead className="font-semibold text-slate-700">Bitiş</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">Gün</TableHead>
                <TableHead className="font-semibold text-slate-700">Açıklama</TableHead>
                <TableHead className="font-semibold text-slate-700">Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Henüz izin talebiniz bulunmuyor.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeaves.map((leave) => {
                  const cfg = DURUM_CONFIG[leave.status] ?? DURUM_CONFIG.PENDING;
                  return (
                    <TableRow key={leave.id}>
                      <TableCell className="font-medium">{IZIN_TUR_LABELS[leave.type] ?? leave.type}</TableCell>
                      <TableCell>{leave.start_date}</TableCell>
                      <TableCell>{leave.end_date}</TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-slate-700">
                          {calcDays(leave.start_date, leave.end_date)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-slate-500">
                        {leave.description || '-'}
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

      {/* Yeni İzin Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni İzin Talebi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>İzin Türü</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Annual">Yıllık İzin</SelectItem>
                  <SelectItem value="Unpaid">Ücretsiz İzin</SelectItem>
                  <SelectItem value="Maternity">Doğum İzni</SelectItem>
                  <SelectItem value="Sickness">Hastalık İzni</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Başlangıç Tarihi</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Bitiş Tarihi</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                />
              </div>
            </div>
            {form.start_date && form.end_date && (
              <p className="text-sm text-slate-500">
                Toplam: <span className="font-semibold text-slate-700">{calcDays(form.start_date, form.end_date)} gün</span>
              </p>
            )}
            <div className="space-y-2">
              <Label>Açıklama <span className="text-slate-400">(isteğe bağlı)</span></Label>
              <Input
                placeholder="Kısa bir not..."
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
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
