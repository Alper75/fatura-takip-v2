import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useApp } from '@/context/AppContext';
import { Plus, Trash2, Edit, CreditCard, ArrowUpRight, ArrowDownRight, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { FilterBar } from '@/components/FilterBar';
import type { FilterValues } from '@/components/FilterBar';

export function CekSenetListe() {
  const { cekSenetler, deleteCekSenet, openCekSenetDrawer, cariler, updateCekSenetDurum } = useApp();
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<FilterValues>({
    search: '',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    status: 'all',
  });

  const filteredItems = cekSenetler.filter((item) => {
    const matchedCari = cariler.find(c => c.id === item.cariId);
    const cariIsmi = matchedCari ? matchedCari.unvan : '';
    
    const searchMatch = 
      item.belgeNo.toLowerCase().includes(filterValues.search.toLowerCase()) ||
      cariIsmi.toLowerCase().includes(filterValues.search.toLowerCase()) ||
      (item.aciklama && item.aciklama.toLowerCase().includes(filterValues.search.toLowerCase()));
      
    const typeMatch = filterValues.status === 'all' || item.islemTipi === filterValues.status;

    const matchesDate = (!filterValues.startDate || item.vadeTarihi >= filterValues.startDate) &&
                        (!filterValues.endDate || item.vadeTarihi <= filterValues.endDate);

    const matchesAmount = (!filterValues.minAmount || item.tutar >= parseFloat(filterValues.minAmount)) &&
                          (!filterValues.maxAmount || item.tutar <= parseFloat(filterValues.maxAmount));

    return searchMatch && typeMatch && matchesDate && matchesAmount;
  }).sort((a, b) => new Date(a.vadeTarihi).getTime() - new Date(b.vadeTarihi).getTime());

  const handleDelete = (id: string) => {
    deleteCekSenet(id);
    setItemToDelete(null);
    toast.success('Belge başarıyla silindi.');
  };

  const getDurumBadge = (durum: string) => {
    switch(durum) {
      case 'odendi': return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0"><CheckCircle2 className="w-3 h-3 mr-1"/> Ödendi</Badge>;
      case 'bekliyor': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0"><Clock className="w-3 h-3 mr-1"/> Bekliyor</Badge>;
      case 'karsiliksiz': return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0"><XCircle className="w-3 h-3 mr-1"/> Karşılıksız</Badge>;
      default: return null;
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy', { locale: tr });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Çek / Senet Takibi
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                İleri tarihli altyapı: Toplam {cekSenetler.length} belge
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button onClick={() => openCekSenetDrawer()} className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Yeni Belge
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <FilterBar 
        onFilterChange={setFilterValues}
        searchPlaceholder="Belge No, Cari veya açıklama ara..."
        statusOptions={[
          { label: 'Tüm Belgeler', value: 'all' },
          { label: 'Alınanlar', value: 'alinan' },
          { label: 'Verilenler', value: 'verilen' },
        ]}
      />

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="font-semibold text-slate-700">Belge / Tip</TableHead>
                  <TableHead className="font-semibold text-slate-700">Cari İşlem</TableHead>
                  <TableHead className="font-semibold text-slate-700">Tarih / Vade</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">Tutar</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center">Durum</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <CreditCard className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-base font-medium">Belge bulunamadı</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const cari = cariler.find(c => c.id === item.cariId);
                    const vDate = new Date(item.vadeTarihi);
                    const isGecmis = item.durum === 'bekliyor' && vDate < new Date(new Date().setHours(0,0,0,0));

                    return (
                      <TableRow key={item.id} className="group hover:bg-slate-50/50">
                        <TableCell>
                          <div className="font-medium text-slate-900">{item.belgeNo}</div>
                          <Badge variant="outline" className="mt-1 text-xs uppercase cursor-default">
                            {item.tip === 'cek' ? 'Çek' : 'Senet'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.islemTipi === 'alinan' ? (
                              <ArrowDownRight className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-orange-500" />
                            )}
                            <div>
                              <p className="font-medium text-slate-900">{cari ? cari.unvan : 'Bilinmeyen Cari'}</p>
                              <p className="text-xs text-slate-500">{item.islemTipi === 'alinan' ? 'Müşteriden Alınan' : 'Tedarikçiye Verilen'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="text-slate-500">Kayıt:</span> {formatDate(item.verilisTarihi)}
                          </div>
                          <div className={cn("text-sm font-semibold mt-0.5", isGecmis ? "text-red-600" : "text-slate-900")}>
                            <span className="text-slate-500 font-normal">Vade:</span> {formatDate(item.vadeTarihi)}
                            {isGecmis && <span className="text-xs ml-1 text-red-500">(Gecikmiş)</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn("font-bold", item.islemTipi === 'alinan' ? 'text-emerald-700' : 'text-orange-700')}>
                            {formatCurrency(item.tutar)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {getDurumBadge(item.durum)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {item.durum === 'bekliyor' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateCekSenetDurum(item.id, 'odendi')}
                                className="text-xs h-8 text-green-600 border-green-200 hover:bg-green-50 mr-2"
                              >
                                Ödendi / Tahsil Edildi
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openCekSenetDrawer(item.id)}
                              className="w-8 h-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog open={itemToDelete === item.id} onOpenChange={(open) => !open && setItemToDelete(null)}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setItemToDelete(item.id)}
                                  className="w-8 h-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Belgeyi Sil</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Bu çek/senet kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>İptal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-red-600 hover:bg-red-700">
                                    Sil
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
    </div>
  );
}
