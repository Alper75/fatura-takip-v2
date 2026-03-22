import { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function PersonelMasraflarim() {
  const { requests, fetchRequests } = useApp();

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const myRequests = requests; 

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Harcama ve Taleplerim</h2>

      <Card>
        <CardHeader>
          <CardTitle>Talep Geçmişim</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tür</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Henüz bir talebiniz bulunmuyor.
                  </TableCell>
                </TableRow>
              ) : (
                myRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{req.type === 'Expense' ? 'Masraf' : 'Avans'}</TableCell>
                    <TableCell>₺{req.amount?.toLocaleString('tr-TR')}</TableCell>
                    <TableCell>{req.date}</TableCell>
                    <TableCell>{req.description}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        req.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                        req.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-101 text-yellow-800'
                      }`}>
                        {req.status === 'PENDING' ? 'Beklemede' : 
                         req.status === 'APPROVED' ? 'Onaylandı' : 'Reddedildi'}
                      </span>
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
