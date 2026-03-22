import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from 'lucide-react';

export default function PuantajCetveli() {
  // Simple placeholder for pointage view
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Puantaj Cetveli</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aylık Puantaj Özeti (Mart 2026)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personel</TableHead>
                <TableHead>Çalışılan Gün</TableHead>
                <TableHead>İzinli Gün</TableHead>
                <TableHead>Fazla Mesai (Saat)</TableHead>
                <TableHead>Toplam Hakediş</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground italic">Veriler yükleniyor veya henüz girilmemiş...</TableCell>
                <TableCell>-</TableCell>
                <TableCell>-</TableCell>
                <TableCell>-</TableCell>
                <TableCell>-</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="mt-8 flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-20" />
            <p>Puantaj verileri için backend entegrasyonu tamamlanıyor.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
