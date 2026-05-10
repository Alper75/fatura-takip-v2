import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { 
  FileSpreadsheet,
  Search, 
  Trash2, 
  Landmark, 
  ArrowUpRight, 
  ArrowDownLeft,
  FilterX,
  Pencil,
  Tag,
  ExternalLink
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { CariHareket } from '@/types';
import { LucaAccountSelect } from '@/components/LucaAccountSelect';

export function BankaEkstreListesi() {
  const { 
    cariHareketler, 
    bankaHesaplari, 
    cariler, 
    deleteCariHareket, 
    updateCariHareket,
    giderKategorileri,
    addGiderKategorisi,
    deleteGiderKategorisi,
    updateGiderKategorisi
  } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBanka, setSelectedBanka] = useState<string>('all');
  
  // Filtre State'leri
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // Düzenleme State'leri
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CariHareket>>({});

  // Toplu İşlem State'i
  const [selectedHareketIds, setSelectedHareketIds] = useState<string[]>([]);

  const filteredHareketler = useMemo(() => {
    return cariHareketler
      .filter(h => h.bankaId !== null && h.bankaId !== undefined)
      .filter(h => {
        const matchesSearch = (h.aciklama || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBanka = selectedBanka === 'all' || h.bankaId === selectedBanka;
        
        const hDate = new Date(h.tarih);
        const matchesStartDate = !startDate || hDate >= new Date(startDate);
        const matchesEndDate = !endDate || hDate <= new Date(endDate);
        
        const amount = h.tutar;
        const matchesMinVal = !minAmount || amount >= parseFloat(minAmount);
        const matchesMaxVal = !maxAmount || amount <= parseFloat(maxAmount);

        return matchesSearch && matchesBanka && matchesStartDate && matchesEndDate && matchesMinVal && matchesMaxVal;
      })
      .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
  }, [cariHareketler, searchTerm, selectedBanka, startDate, endDate, minAmount, maxAmount]);

  const exportToExcel = () => {
    const exportData = filteredHareketler.map(h => {
      const banka = bankaHesaplari.find(b => b.id === h.bankaId);
      const cari = cariler.find(c => c.id === h.cariId);
      const kategori = h.kategoriId ? giderKategorileri.find(k => k.id === h.kategoriId) : null;
      return {
        'Tarih': h.tarih,
        'Banka': banka?.hesapAdi || 'Bilinmiyor',
        'Açıklama': h.aciklama,
        'Cari': cari?.unvan || 'Diğer',
        'Kategori': kategori?.ad || h.islemTuru,
        'Luca Kodu': h.muhasebeKodu || '',
        'Tutar': h.tutar,
        'Yön': (h.islemTuru === 'tahsilat' || h.islemTuru === 'satis_faturasi' || (h.islemTuru === 'transfer' && h.aciklama.includes('GELEN'))) ? 'GİRİŞ' : 'ÇIKIŞ'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Banka Ekstresi');
    XLSX.writeFile(wb, `Banka_Ekstre_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel dosyası indiriliyor...');
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  const toggleSelection = (id: string) => {
    setSelectedHareketIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedHareketIds.length === filteredHareketler.length) {
      setSelectedHareketIds([]);
    } else {
      setSelectedHareketIds(filteredHareketler.map(h => h.id));
    }
  };

  const handleBulkDelete = async () => {
    for (const id of selectedHareketIds) {
      deleteCariHareket(id);
    }
    toast.success(`${selectedHareketIds.length} hareket başarıyla silindi.`);
    setSelectedHareketIds([]);
  };

  const handleBulkSendToLuca = () => {
    const selected = filteredHareketler.filter(h => selectedHareketIds.includes(h.id));
    // Uzantının anlayacağı formata çevir
    const payload = selected.map(h => {
      const banka = bankaHesaplari.find(b => b.id === h.bankaId);
      const cari = cariler.find(c => c.id === h.cariId);
      const isGiris = (h.islemTuru === 'tahsilat' || h.islemTuru === 'satis_faturasi' ||
        (h.islemTuru === 'transfer' && (h.aciklama || '').toUpperCase().includes('GELEN')));
      return {
        tarih: h.tarih,
        aciklama: h.aciklama,
        tutar: h.tutar,
        tur: isGiris ? 'alacak' : 'borc',
        islemTuru: h.islemTuru,
        banka: banka?.hesapAdi || '',
        cari: cari?.unvan || '',
        muhasebeKodu: (h as any).muhasebeKodu || ''
      };
    });
    window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SEND_BANKA_HAREKETLERI', {
      detail: { hareketler: payload }
    }));
    toast.success(`${selected.length} hareket Luca'ya gönderildi.`, {
      description: 'Luca eklentisi yüklü ve aktifse işlem tamamlanacaktır.'
    });
  };

  return (
    <div className="space-y-6">
      <style>{`
        .bluca-checkbox-injected, 
        [class*="bluca-checkbox"],
        [class*="bluca-button"],
        #bluca-floating-button {
          display: none !important;
        }
      `}</style>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
            Banka Ekstre Listesi
          </h2>
          <p className="text-slate-500 mt-1">Tüm banka hareketlerini buradan inceleyebilir ve yönetebilirsiniz</p>
        </div>
        <Button onClick={exportToExcel} variant="outline" className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
          <FileSpreadsheet className="w-4 h-4" />
          Excel Olarak İndir
        </Button>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Açıklamalarda ara..." 
                className="pl-10 h-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-52">
              <Select value={selectedBanka} onValueChange={setSelectedBanka}>
                <SelectTrigger className="h-10">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-slate-400" />
                    <SelectValue placeholder="Banka Filtrele" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Bankalar</SelectItem>
                  {bankaHesaplari.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.hesapAdi}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Tarih Filtreleri */}
            <div className="flex items-center gap-2">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 h-10" />
              <span className="text-slate-400">-</span>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 h-10" />
            </div>

            {/* Tutar Filtreleri */}
            <div className="flex items-center gap-2">
              <Input type="number" placeholder="Min ₺" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="w-24 h-10" />
              <Input type="number" placeholder="Max ₺" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="w-24 h-10" />
            </div>

            {(searchTerm || selectedBanka !== 'all' || startDate || endDate || minAmount || maxAmount) && (
              <Button variant="ghost" onClick={() => { 
                setSearchTerm(''); 
                setSelectedBanka('all'); 
                setStartDate('');
                setEndDate('');
                setMinAmount('');
                setMaxAmount('');
              }} className="text-slate-500 h-10">
                <FilterX className="w-4 h-4 mr-2" /> Sıfırla
              </Button>
            )}
          </div>
        </CardHeader>
        
        {selectedHareketIds.length > 0 && (
          <div className="flex items-center justify-between bg-indigo-50/80 p-3 px-4 border-b border-indigo-100">
            <span className="text-sm font-medium text-indigo-900">{selectedHareketIds.length} hareket seçildi</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                onClick={handleBulkSendToLuca}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Luca'ya Gönder
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2 h-8">
                    <Trash2 className="w-3.5 h-3.5" /> Seçilenleri Sil
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Seçili Hareketleri Sil</AlertDialogTitle>
                    <AlertDialogDescription>
                      Seçilen {selectedHareketIds.length} hareket kalıcı olarak silinecek ve banka bakiyeleri güncellenecektir. Bu işlem geri alınamaz. Emin misiniz?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
                      Evet, Sil
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-slate-50/50">
                  <TableHead className="w-12 text-center align-middle">
                    <div className="flex justify-center items-center h-full">
                      <Checkbox 
                        checked={filteredHareketler.length > 0 && selectedHareketIds.length === filteredHareketler.length}
                        onCheckedChange={toggleAll}
                        className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-32">Tarih</TableHead>
                  <TableHead>Banka</TableHead>
                  <TableHead className="min-w-[200px]">Açıklama</TableHead>
                  <TableHead>Cari</TableHead>
                  <TableHead>Kategori / Tür</TableHead>
                  <TableHead className="w-[180px]">Luca Kodu</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHareketler.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-slate-400">
                      Hareket bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHareketler.map((h) => {
                    const banka = bankaHesaplari.find(b => b.id === h.bankaId);
                    const cari = cariler.find(c => c.id === h.cariId);
                    const kategori = h.kategoriId ? giderKategorileri.find(k => k.id === h.kategoriId) : null;
                    const isGiris = (h.islemTuru === 'tahsilat' || h.islemTuru === 'satis_faturasi' || (h.islemTuru === 'transfer' && (h.aciklama || '').toUpperCase().includes('GELEN')));

                    return (
                      <TableRow
                        key={h.id}
                        className={cn("group transition-colors", selectedHareketIds.includes(h.id) ? "bg-indigo-50/30" : "")}
                        data-luca-tarih={h.tarih}
                        data-luca-aciklama={h.aciklama || ''}
                        data-luca-tutar={h.tutar}
                        data-luca-tur={isGiris ? 'alacak' : 'borc'}
                        data-luca-islem-turu={h.islemTuru || ''}
                        data-luca-banka={banka?.hesapAdi || ''}
                        data-luca-cari={cari?.unvan || ''}
                        data-luca-cari-vkn={cari?.vknTckn || ''}
                      >
                        <TableCell className="text-center align-middle">
                          <div className="flex justify-center items-center h-full">
                            <Checkbox 
                              checked={selectedHareketIds.includes(h.id)}
                              onCheckedChange={() => toggleSelection(h.id)}
                              className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-slate-600">{h.tarih}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900">{banka?.hesapAdi}</span>
                            <span className="text-[10px] text-slate-400">{banka?.bankaAdi}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isGiris ? (
                              <div className="p-1 rounded bg-green-50 text-green-600">
                                <ArrowDownLeft className="w-3 h-3" />
                              </div>
                            ) : (
                              <div className="p-1 rounded bg-red-50 text-red-600">
                                <ArrowUpRight className="w-3 h-3" />
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-slate-700 truncate max-w-[250px]" title={h.aciklama}>
                                {h.aciklama}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                                {(h.islemTuru || '').replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {cari ? (
                            <span className="font-semibold text-indigo-700 px-2 py-0.5 bg-indigo-50 rounded w-fit max-w-[150px] truncate block" title={cari.unvan}>
                              {cari.unvan}
                            </span>
                          ) : kategori ? (
                            <span className="font-semibold text-rose-700 px-2 py-0.5 bg-rose-50 rounded w-fit max-w-[150px] truncate block" title={kategori.ad}>
                              {kategori.ad} (Masraf)
                            </span>
                          ) : (
                            <span className="text-slate-300 italic">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-col gap-1">
                             {kategori ? (
                              <span className="font-bold text-rose-700 px-2 py-0.5 bg-rose-50 rounded w-fit border border-rose-100 flex items-center gap-1">
                                <Tag className="w-3 h-3" />
                                {kategori.ad}
                              </span>
                            ) : (
                              <Select 
                                value={h.kategoriId || 'none'} 
                                onValueChange={(val) => {
                                  const cat = giderKategorileri.find(k => k.id === val);
                                  updateCariHareket(h.id, { 
                                    kategoriId: val === 'none' ? null : val,
                                    muhasebeKodu: cat?.muhasebeKodu || h.muhasebeKodu
                                  });
                                }}
                              >
                                <SelectTrigger className="h-7 text-[10px] w-32 bg-slate-50 border-slate-200">
                                  <SelectValue placeholder="Kategori Seç" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Seçilmedi</SelectItem>
                                  {giderKategorileri.map(k => (
                                    <SelectItem key={k.id} value={k.id}>{k.ad}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <LucaAccountSelect 
                            value={h.muhasebeKodu || ''} 
                            onChange={(code: string) => updateCariHareket(h.id, { muhasebeKodu: code })}
                            className="h-8 text-[11px]"
                          />
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-bold text-sm tabular-nums",
                          isGiris ? "text-green-600" : "text-slate-900"
                        )}>
                          {isGiris ? '+' : '-'}{formatCurrency(h.tutar)}
                        </TableCell>
                        <TableCell>
                           <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="w-8 h-8 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  setEditingId(h.id);
                                  setEditForm(h);
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Hareketi Sil</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Bu işlem banka bakiyesini de güncelleyecektir. Emin misiniz?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => {
                                      deleteCariHareket(h.id);
                                      toast.success('Hareket silindi ve bakiye güncellendi.');
                                    }} className="bg-red-600 hover:bg-red-700">
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

      {/* Düzenleme Modalı */}
      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Hareketi Düzenle</DialogTitle>
            <DialogDescription>
              İşlem bilgilerini güncelleyin. Bakiye otomatik olarak yeniden hesaplanacaktır.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tarih" className="text-right text-xs">Tarih</Label>
              <Input id="tarih" type="date" className="col-span-3" value={editForm.tarih || ''} onChange={(e) => setEditForm({...editForm, tarih: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tutar" className="text-right text-xs">Tutar</Label>
              <Input id="tutar" type="number" className="col-span-3" value={editForm.tutar || ''} onChange={(e) => setEditForm({...editForm, tutar: parseFloat(e.target.value)})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="aciklama" className="text-right text-xs">Açıklama</Label>
              <Input id="aciklama" className="col-span-3" value={editForm.aciklama || ''} onChange={(e) => setEditForm({...editForm, aciklama: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="banka" className="text-right text-xs">Banka</Label>
              <div className="col-span-3">
                <select 
                  className="w-full h-9 bg-white border border-slate-200 rounded-md px-3 text-sm outline-none focus:border-indigo-500"
                  value={editForm.bankaId || ''} 
                  onChange={(e) => setEditForm({...editForm, bankaId: e.target.value})}
                >
                  <option value="">Banka Seçin</option>
                  {bankaHesaplari.map(b => (
                    <option key={b.id} value={b.id}>{b.hesapAdi}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cari" className="text-right text-xs">Cari</Label>
              <div className="col-span-3">
                <select 
                  className="w-full h-9 bg-white border border-slate-200 rounded-md px-3 text-sm outline-none focus:border-indigo-500"
                  value={editForm.cariId || 'none'} 
                  onChange={(e) => setEditForm({...editForm, cariId: e.target.value === 'none' ? undefined : e.target.value})}
                >
                  <option value="none">Seçilmedi</option>
                  {cariler.map(c => (
                    <option key={c.id} value={c.id}>{c.unvan}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="muhasebeKodu" className="text-right text-xs">Luca Kodu</Label>
              <div className="col-span-3">
                <LucaAccountSelect 
                  value={editForm.muhasebeKodu || ''} 
                  onChange={(code: string) => setEditForm({...editForm, muhasebeKodu: code})}
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="kategori" className="text-right text-xs">Kategori</Label>
              <div className="col-span-3">
                <select 
                  className="w-full h-9 bg-white border border-slate-200 rounded-md px-3 text-sm outline-none focus:border-indigo-500"
                  value={editForm.kategoriId || 'none'} 
                  onChange={(e) => setEditForm({...editForm, kategoriId: e.target.value === 'none' ? null : e.target.value})}
                >
                  <option value="none">Seçilmedi</option>
                  {giderKategorileri.map(k => (
                    <option key={k.id} value={k.id}>{k.ad}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>Vazgeç</Button>
            <Button onClick={() => {
              if (editingId) {
                updateCariHareket(editingId, editForm);
                setEditingId(null);
                toast.success('Haret başarıyla güncellendi.');
              }
            }}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
