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
import { Plus, Trash2, Edit, Users, MapPin, Phone, Mail, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FilterBar } from '@/components/FilterBar';
import type { FilterValues } from '@/components/FilterBar';

export function CariListe() {
  const { cariler, deleteCari, openCariDrawer, openCariEkstreDrawer, hesaplaCariBakiye } = useApp();
  const [cariToDelete, setCariToDelete] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<FilterValues>({
    search: '',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    status: 'all',
  });

  const filteredCariler = cariler.filter((cari) => {
    const searchLower = filterValues.search.toLowerCase();
    const matchesSearch = 
      String(cari.unvan || '').toLowerCase().includes(searchLower) ||
      String(cari.vknTckn || '').toLowerCase().includes(searchLower) ||
      String(cari.adres || '').toLowerCase().includes(searchLower);

    const matchesType = filterValues.status === 'all' || cari.tip === filterValues.status;

    // Optional: Date filter for creation date if needed
    const matchesDate = (!filterValues.startDate || (cari.olusturmaTarihi && cari.olusturmaTarihi >= filterValues.startDate)) &&
                        (!filterValues.endDate || (cari.olusturmaTarihi && cari.olusturmaTarihi <= filterValues.endDate));

    return matchesSearch && matchesType && matchesDate;
  });

  const handleDelete = (id: string) => {
    deleteCari(id);
    setCariToDelete(null);
    toast.success('Cari kart silindi');
  };

  const getTipBadgeColor = (tip: string) => {
    if (tip === 'musteri') return 'bg-blue-100 text-blue-700';
    if (tip === 'tedarikci') return 'bg-orange-100 text-orange-700';
    return 'bg-purple-100 text-purple-700';
  };

  const getTipLabel = (tip: string) => {
    if (tip === 'musteri') return 'Müşteri';
    if (tip === 'tedarikci') return 'Tedarikçi';
    return 'Müşteri & Tedarikçi';
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Cari Kartlar
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Sistemde kayıtlı toplam {cariler.length} cari kart bulunuyor
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => openCariDrawer()} className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Yeni Cari Ekle</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <FilterBar 
        onFilterChange={setFilterValues} 
        searchPlaceholder="Ünvan, T.C./VKN veya adres ara..."
        statusOptions={[
          { label: 'Tüm Tipler', value: 'all' },
          { label: 'Müşteriler', value: 'musteri' },
          { label: 'Tedarikçiler', value: 'tedarikci' },
        ]}
      />

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="font-semibold text-slate-700">Ünvan / Ad Soyad</TableHead>
                  <TableHead className="font-semibold text-slate-700">T.C. / VKN</TableHead>
                  <TableHead className="font-semibold text-slate-700">Tip</TableHead>
                  <TableHead className="font-semibold text-slate-700">İletişim</TableHead>
                  <TableHead className="font-semibold text-slate-700">Bakiye</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCariler.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Users className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-base font-medium">Cari kaydı bulunamadı</p>
                        <p className="text-sm mt-1">Yeni cari ekleyerek başlayabilirsiniz.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCariler.map((cari) => (
                    <TableRow key={cari.id} className="group hover:bg-slate-50/50">
                      <TableCell>
                        <div className="font-medium text-slate-900">{cari.unvan}</div>
                        {cari.adres && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1 max-w-[250px] truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{cari.adres}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 font-medium">
                        {cari.vknTckn}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getTipBadgeColor(cari.tip)} uppercase text-[10px] tracking-wider font-semibold border-0`}>
                          {getTipLabel(cari.tip)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {cari.telefon && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {cari.telefon}
                            </div>
                          )}
                          {cari.eposta && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              {cari.eposta}
                            </div>
                          )}
                          {!cari.telefon && !cari.eposta && (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm font-medium">
                        {(() => {
                          const bakiyeOzeti = hesaplaCariBakiye(cari.id);
                          const { bakiyeDurumu, guncelBakiye } = bakiyeOzeti;
                          if (guncelBakiye === 0) return <span className="text-slate-400 font-semibold tracking-wide">0,00 ₺</span>;
                          return (
                            <div className={cn("font-bold tracking-wide", bakiyeDurumu === 'borclu' ? 'text-indigo-600' : 'text-orange-600')}>
                              {bakiyeDurumu === 'borclu' ? '+ ' : '- '}
                              {(() => {
                                const safeVal = isNaN(guncelBakiye) || guncelBakiye === null || guncelBakiye === undefined ? 0 : guncelBakiye;
                                return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(safeVal);
                              })()}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCariEkstreDrawer(cari.id)}
                            className="bg-indigo-50/50 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-100 font-semibold mr-2"
                            title="Hesap Ekstresi"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Ekstre
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCariDrawer(cari.id)}
                            className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            title="Düzenle"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          
                          <AlertDialog open={cariToDelete === cari.id} onOpenChange={(open) => !open && setCariToDelete(null)}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCariToDelete(cari.id)}
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cari Kartı Sil</AlertDialogTitle>
                                <AlertDialogDescription>
                                  <strong className="text-slate-900">{cari.unvan}</strong> adlı cariyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(cari.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Sil
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
