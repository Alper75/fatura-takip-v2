import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Check, X, Calendar, Clock } from 'lucide-react';

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

export default function IzinYonetimi() {
  const { leaves, fetchLeaves, updateLeaveStatus } = useApp();
  const [filterDurum, setFilterDurum] = useState<string>('PENDING');

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const filteredLeaves = filterDurum === 'all'
    ? leaves
    : leaves.filter((l) => l.status === filterDurum);

  const handleStatusUpdate = async (id: number, status: string) => {
    const result = await updateLeaveStatus(id, status);
    if (result.success) {
      toast.success(status === 'APPROVED' ? 'İzin onaylandı.' : 'İzin reddedildi.');
    } else {
      toast.error(result.message);
    }
  };

  const bekleyenSayisi = leaves.filter((l) => l.status === 'PENDING').length;
  const onaylananGun = leaves
    .filter((l) => l.status === 'APPROVED')
    .reduce((acc, l) => acc + calcDays(l.start_date, l.end_date), 0);

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">İzin Yönetimi</h2>
          <p className="text-sm text-muted-foreground mt-1">Personel izin taleplerini inceleyin ve onaylayın</p>
        </div>
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
            <Calendar className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-xs text-slate-500">Onaylanan Toplam Gün</p>
              <p className="text-xl font-bold text-green-700">{onaylananGun}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-slate-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Toplam Talep</p>
              <p className="text-xl font-bold text-slate-700">{leaves.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tablo */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">İzin Talepleri</CardTitle>
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
                <TableHead className="font-semibold text-slate-700">Personel</TableHead>
                <TableHead className="font-semibold text-slate-700">İzin Türü</TableHead>
                <TableHead className="font-semibold text-slate-700">Başlangıç</TableHead>
                <TableHead className="font-semibold text-slate-700">Bitiş</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">Gün</TableHead>
                <TableHead className="font-semibold text-slate-700">Açıklama</TableHead>
                <TableHead className="font-semibold text-slate-700">Durum</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    {filterDurum === 'PENDING' ? 'Bekleyen izin talebi yok.' : 'Gösterilecek kayıt yok.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeaves.map((leave) => {
                  const cfg = DURUM_CONFIG[leave.status] ?? DURUM_CONFIG.PENDING;
                  return (
                    <TableRow key={leave.id}>
                      <TableCell className="font-medium">
                        {leave.first_name} {leave.last_name}
                      </TableCell>
                      <TableCell>{IZIN_TUR_LABELS[leave.type] ?? leave.type}</TableCell>
                      <TableCell>{leave.start_date}</TableCell>
                      <TableCell>{leave.end_date}</TableCell>
                      <TableCell className="text-center font-semibold text-slate-700">
                        {calcDays(leave.start_date, leave.end_date)}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-slate-500">
                        {leave.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cfg.className}>
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {leave.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                              onClick={() => handleStatusUpdate(leave.id, 'APPROVED')}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              onClick={() => handleStatusUpdate(leave.id, 'REJECTED')}
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
