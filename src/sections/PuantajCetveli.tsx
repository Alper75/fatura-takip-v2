import { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from 'lucide-react';

export default function PuantajCetveli() {
  const { pointages, fetchPointages } = useApp();

  useEffect(() => {
    fetchPointages();
  }, [fetchPointages]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'Work': return 'Çalıştı';
      case 'Weekend': return 'Hafta Sonu';
      case 'Holiday': return 'Tatil';
      case 'Annual Leave': return 'Yıllık İzin';
      case 'Unpaid Leave': return 'Ücretsiz İzin';
      case 'Sickness': return 'Raporlu';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Puantaj Cetveli</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Genel Puantaj Geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personel</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Fazla Mesai (Saat)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pointages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">
                    Henüz puantaj kaydı bulunmuyor.
                  </TableCell>
                </TableRow>
              ) : (
                pointages.map((pt) => (
                  <TableRow key={pt.id}>
                    <TableCell className="font-medium">{pt.first_name} {pt.last_name}</TableCell>
                    <TableCell>{pt.date}</TableCell>
                    <TableCell>{getStatusText(pt.status)}</TableCell>
                    <TableCell>{pt.overtime_hours} sa</TableCell>
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
