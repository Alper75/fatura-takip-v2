import { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

export default function TalepYonetimi() {
  const { requests, fetchRequests, updateRequestStatus } = useApp();

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleStatusUpdate = async (id: number, status: string) => {
    const result = await updateRequestStatus(id, status);
    if (result.success) {
      toast.success('Talep durumu güncellendi');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Talep Yönetimi</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bekleyen Avans ve Masraf Talepleri</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personel</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Bulunan talep yok.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.first_name} {req.last_name}</TableCell>
                    <TableCell>{req.type === 'Expense' ? 'Masraf' : 'Avans'}</TableCell>
                    <TableCell>₺{req.amount?.toLocaleString('tr-TR')}</TableCell>
                    <TableCell>{req.date}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{req.description}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        req.status === 'Approved' ? 'bg-green-100 text-green-800' :
                        req.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {req.status === 'Pending' ? 'Beklemede' : 
                         req.status === 'Approved' ? 'Onaylandı' : 'Reddedildi'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === 'Pending' && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700" onClick={() => handleStatusUpdate(req.id, 'Approved')}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleStatusUpdate(req.id, 'Rejected')}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
