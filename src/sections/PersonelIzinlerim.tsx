import { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function PersonelIzinlerim() {
  const { leaves, fetchLeaves } = useApp();

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  // Filter leaves to only show currentUser's leaves if applicable
  // In a real scenario, the backend would filter by user_id
  const myLeaves = leaves; // Simplified for now as current fetchLeaves might be role-scoped by backend

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">İzinlerim</h2>

      <Card>
        <CardHeader>
          <CardTitle>İzin Geçmişim</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tür</TableHead>
                <TableHead>Başlangıç</TableHead>
                <TableHead>Bitiş</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myLeaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Henüz bir izin talebiniz bulunmuyor.
                  </TableCell>
                </TableRow>
              ) : (
                myLeaves.map((leave) => (
                  <TableRow key={leave.id}>
                    <TableCell>{leave.type}</TableCell>
                    <TableCell>{leave.start_date}</TableCell>
                    <TableCell>{leave.end_date}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        leave.status === 'Approved' ? 'bg-green-100 text-green-800' :
                        leave.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {leave.status === 'Pending' ? 'Beklemede' : 
                         leave.status === 'Approved' ? 'Onaylandı' : 'Reddedildi'}
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
