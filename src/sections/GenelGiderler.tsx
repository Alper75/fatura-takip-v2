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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Receipt, 
  Search, 
  Trash2, 
  Plus,
  Zap,
  Tag,
  Pencil
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { CariHareket } from '@/types';

export function GenelGiderler() {
  const { 
    cariHareketler, 
    addCariHareket, 
    deleteCariHareket, 
    bankaHesaplari,
    masrafKurallari,
    addMasrafKurali,
    deleteMasrafKurali,
    updateCariHareket,
    cariler,
    giderKategorileri,
    addGiderKategorisi,
    deleteGiderKategorisi
  } = useApp();

  // Filtreler
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTur, setSelectedTur] = useState<string>('all');

  // Yeni Gider Formu
  const [giderForm, setGiderForm] = useState({
    tarih: new Date().toISOString().split('T')[0],
    tutar: '',
    aciklama: '',
    islemTuru: 'genel_gider',
    kategoriId: '',
    bankaId: ''
  });

  // Yeni Kural Formu
  const [kuralForm, setKuralForm] = useState({
    anahtarKelime: '',
    islemTuru: 'genel_gider',
    aciklama: ''
  });

  // Düzenleme State'leri
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CariHareket>>({});

  // Kategori Yönetimi Modal
  const [isCategoryManageOpen, setIsCategoryManageOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const giderListesi = useMemo(() => {
    // CariId'si olmayan ve gider türünde olan hareketler "Genel Gider"dir
    const giderTurleri = [
      'genel_gider', 'kira_odemesi', 'maas_odemesi', 'banka_masrafi', 
      'vergi_kdv', 'vergi_muhtasar', 'vergi_gecici', 'vergi_damga', 'ssk_odemesi'
    ];
    
    return cariHareketler
      .filter(h => (!h.cariId || h.cariId === 'sistem' || h.cariId === 'genel-cari') && (giderTurleri.includes(h.islemTuru) || h.kategoriId))
      .filter(h => {
        const matchesSearch = (h.aciklama || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTur = selectedTur === 'all' || h.islemTuru === selectedTur;
        return matchesSearch && matchesTur;
      })
      .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
  }, [cariHareketler, searchTerm, selectedTur]);

  const handleGiderEkle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!giderForm.tutar || !giderForm.aciklama || !giderForm.bankaId) {
      toast.error('Lütfen tüm alanları doldurun.');
      return;
    }

    addCariHareket({
      cariId: '', // Genel gider olduğu için cari boş
      tarih: giderForm.tarih,
      tutar: parseFloat(giderForm.tutar),
      aciklama: giderForm.aciklama,
      islemTuru: giderForm.islemTuru as any,
      kategoriId: giderForm.kategoriId || null,
      bankaId: giderForm.bankaId,
      dekontDosya: null
    });

    setGiderForm({
      ...giderForm,
      tutar: '',
      aciklama: ''
    });
    toast.success('Gider başarıyla eklendi.');
  };

  const handleKuralEkle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kuralForm.anahtarKelime) {
      toast.error('Lütfen anahtar kelime girin.');
      return;
    }

    addMasrafKurali({
      anahtarKelime: kuralForm.anahtarKelime,
      islemTuru: kuralForm.islemTuru as any,
      aciklama: kuralForm.aciklama
    });

    setKuralForm({
      anahtarKelime: '',
      islemTuru: 'genel_gider',
      aciklama: ''
    });
    toast.success('Masraf kuralı eklendi.');
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-10 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-rose-600" />
            Genel Masraflar ve Giderler
          </h2>
          <p className="text-slate-500 mt-1">Sabit giderler, vergiler ve operasyonel masrafların yönetimi</p>
        </div>
        <Button 
          variant="outline" 
          className="gap-2 border-slate-200 hover:bg-slate-50"
          onClick={() => setIsCategoryManageOpen(true)}
        >
          <Tag className="w-4 h-4 text-rose-500" />
          Kategorileri Yönet
        </Button>
      </div>

      <Tabs defaultValue="giderler" className="w-full">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="giderler" className="gap-2">
            <Receipt className="w-4 h-4" /> Masraflar
          </TabsTrigger>
          <TabsTrigger value="kurallar" className="gap-2">
            <Zap className="w-4 h-4" /> Otomatik Atama
          </TabsTrigger>
        </TabsList>

        <TabsContent value="giderler" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Hızlı Gider Giriş Formu */}
            <Card className="lg:col-span-1 border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Yeni Gider Ekle</CardTitle>
                <CardDescription>Hızlıca yeni bir masraf girişi yapın</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGiderEkle} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tarih">İşlem Tarihi</Label>
                    <Input 
                      id="tarih" 
                      type="date" 
                      value={giderForm.tarih}
                      onChange={(e) => setGiderForm({...giderForm, tarih: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tutar">Tutar</Label>
                    <Input 
                      id="tutar" 
                      type="number" 
                      placeholder="0.00"
                      value={giderForm.tutar}
                      onChange={(e) => setGiderForm({...giderForm, tutar: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="banka">Ödeme Yapılan Banka</Label>
                    <Select value={String(giderForm.bankaId || '')} onValueChange={(val) => setGiderForm({...giderForm, bankaId: val})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Banka Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {(bankaHesaplari || []).map(b => (
                          <SelectItem key={b.id} value={String(b.id || '')}>{b.hesapAdi}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tur">Kategori</Label>
                    <Select value={giderForm.kategoriId || giderForm.islemTuru} onValueChange={(val) => {
                      const isDynamic = giderKategorileri.some(k => k.id === val);
                      if (isDynamic) {
                        setGiderForm({...giderForm, kategoriId: val, islemTuru: 'genel_gider'});
                      } else {
                        setGiderForm({...giderForm, kategoriId: '', islemTuru: val});
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Kategori Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="genel_gider" disabled className="text-[10px] font-bold text-slate-400">SİSTEM KATEGORİLERİ</SelectItem>
                        <SelectItem value="genel_gider">Genel Gider</SelectItem>
                        <SelectItem value="kira_odemesi">Kira Ödemesi</SelectItem>
                        <SelectItem value="maas_odemesi">Maaş Ödemesi</SelectItem>
                        <SelectItem value="ssk_odemesi">SSK/Bağkur Ödemesi</SelectItem>
                        <SelectItem value="vergi_kdv">KDV Ödemesi</SelectItem>
                        <SelectItem value="banka_masrafi">Banka Masrafı</SelectItem>
                        
                        {giderKategorileri.length > 0 && (
                          <>
                            <SelectItem value="separator" disabled className="text-[10px] font-bold text-slate-400 border-t mt-2 pt-2">OZEL KATEGORİLER</SelectItem>
                            {giderKategorileri.map(k => (
                              <SelectItem key={k.id} value={k.id}>{k.ad}</SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aciklama">Açıklama</Label>
                    <Input 
                      id="aciklama" 
                      placeholder="Örn: Mart ayı telefon faturası"
                      value={giderForm.aciklama}
                      onChange={(e) => setGiderForm({...giderForm, aciklama: e.target.value})}
                    />
                  </div>
                  <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 gap-2">
                    <Plus className="w-4 h-4" /> Masrafı Kaydet
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Tablo Kartı */}
            <div className="lg:col-span-3">
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        placeholder="Masraflarda ara..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="w-full md:w-48">
                      <Select value={selectedTur} onValueChange={setSelectedTur}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tür Filtrele" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tüm Türler</SelectItem>
                          <SelectItem value="genel_gider">Genel Gider</SelectItem>
                          <SelectItem value="kira_odemesi">Kira</SelectItem>
                          <SelectItem value="maas_odemesi">Maaş</SelectItem>
                          <SelectItem value="vergi_kdv">Vergi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent bg-slate-50/50">
                          <TableHead>Tarih</TableHead>
                          <TableHead>Açıklama</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead className="text-right">Tutar</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {giderListesi.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                              Masraf bulunamadı.
                            </TableCell>
                          </TableRow>
                        ) : (
                          giderListesi.map((h) => (
                            <TableRow key={h.id} className="group hover:bg-rose-50/30 transition-colors">
                              <TableCell className="text-sm text-slate-600 tabular-nums">{h.tarih}</TableCell>
                              <TableCell className="font-medium text-slate-700 max-w-[200px] truncate" title={h.aciklama || ''}>
                                {h.aciklama || ''}
                              </TableCell>
                              <TableCell>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                  h.kategoriId ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {h.kategoriId 
                                    ? (giderKategorileri.find(k => k.id === h.kategoriId)?.ad || 'Bilinmiyor')
                                    : (h.islemTuru || '').replace(/_/g, ' ')
                                  }
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-bold text-rose-600">
                                {formatCurrency(h.tutar)}
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
                                        <AlertDialogTitle>Masrafı Sil</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Bu işlem kalıcıdır ve banka bakiyesini de etkileyecektir. Emin misiniz?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => {
                                          deleteCariHareket(h.id);
                                          toast.success('Masraf silindi.');
                                        }} className="bg-red-600 hover:bg-red-700">Sil</AlertDialogAction>
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
          </div>
        </TabsContent>

        <TabsContent value="kurallar" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <CardTitle className="text-lg">Yeni Akıllı Kural</CardTitle>
                </div>
                <CardDescription>Banka ekstresi yüklerken açıklamaya göre otomatik kategori atayın</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleKuralEkle} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="kelime">Açıklamada Geçen Kelime</Label>
                    <Input 
                      id="kelime" 
                      placeholder="Örn: TURKCELL"
                      value={kuralForm.anahtarKelime}
                      onChange={(e) => setKuralForm({...kuralForm, anahtarKelime: e.target.value})}
                    />
                    <p className="text-[10px] text-slate-400">Bu kelime (küçük/büyük harf duyarlı değil) banka açıklamasında geçerse kural çalışır.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="k-tur">Atanacak Kategori</Label>
                    <Select value={kuralForm.islemTuru} onValueChange={(val) => setKuralForm({...kuralForm, islemTuru: val})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="genel_gider">Genel Gider</SelectItem>
                        <SelectItem value="kira_odemesi">Kira Ödemesi</SelectItem>
                        <SelectItem value="maas_odemesi">Maaş Ödemesi</SelectItem>
                        <SelectItem value="ssk_odemesi">SSK/Bağkur Ödemesi</SelectItem>
                        <SelectItem value="vergi_kdv">KDV Ödemesi</SelectItem>
                        <SelectItem value="banka_masrafi">Banka Masrafı</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="k-acik">Ek Açıklama (Opsiyonel)</Label>
                    <Input 
                      id="k-acik" 
                      placeholder="Kural açıklaması"
                      value={kuralForm.aciklama}
                      onChange={(e) => setKuralForm({...kuralForm, aciklama: e.target.value})}
                    />
                  </div>
                  <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 gap-2">
                    <Plus className="w-4 h-4" /> Kuralı Ekle
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-0 shadow-sm overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Tanımlı Atama Kuralları</CardTitle>
                <CardDescription>Banka entegrasyonunda ilk bu kurallar kontrol edilir</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead>Anahtar Kelime</TableHead>
                      <TableHead>Hedef Kategori</TableHead>
                      <TableHead>Notlar</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masrafKurallari.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-slate-400">Kural tanımlanmamış.</TableCell>
                      </TableRow>
                    ) : (
                      masrafKurallari.map((k) => (
                        <TableRow key={k.id}>
                          <TableCell className="font-bold text-amber-700 bg-amber-50/30">"{k.anahtarKelime}"</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 capitalize text-xs font-semibold">
                              <Tag className="w-3 h-3 text-slate-400" />
                              {(k.islemTuru || '').replace(/_/g, ' ')}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">{k.aciklama || '-'}</TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-8 h-8 text-slate-300 hover:text-red-500"
                              onClick={() => deleteMasrafKurali(k.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Düzenleme Modalı */}
      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Gideri Düzenle</DialogTitle>
            <DialogDescription>
              Masraf bilgilerini güncelleyin. Bakiye otomatik olarak yeniden hesaplanacaktır.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="e-tarih" className="text-right text-xs">Tarih</Label>
              <Input id="e-tarih" type="date" className="col-span-3" value={editForm.tarih || ''} onChange={(e) => setEditForm({...editForm, tarih: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="e-tutar" className="text-right text-xs">Tutar</Label>
              <Input id="e-tutar" type="number" className="col-span-3" value={editForm.tutar || ''} onChange={(e) => setEditForm({...editForm, tutar: parseFloat(e.target.value)})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="e-aciklama" className="text-right text-xs">Açıklama</Label>
              <Input id="e-aciklama" className="col-span-3" value={editForm.aciklama || ''} onChange={(e) => setEditForm({...editForm, aciklama: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="e-banka" className="text-right text-xs">Banka</Label>
              <div className="col-span-3">
                <Select value={String(editForm.bankaId ?? '')} onValueChange={(val) => setEditForm({...editForm, bankaId: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Banka Seç" />
                  </SelectTrigger>
                  <SelectContent>
                    {(bankaHesaplari || []).map((b, idx) => (
                      <SelectItem key={b.id !== undefined && b.id !== null ? String(b.id) : `banka-${idx}`} value={String(b.id ?? '')}>{String(b.hesapAdi ?? '')} ({String(b.bankaAdi ?? '')})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="e-tur" className="text-right text-xs">Kategori</Label>
              <div className="col-span-3">
                <Select value={editForm.kategoriId || editForm.islemTuru || ''} onValueChange={(val) => {
                  const isDynamic = giderKategorileri.some(k => k.id === val);
                  if (isDynamic) {
                    setEditForm({...editForm, kategoriId: val, islemTuru: 'genel_gider'});
                  } else {
                    setEditForm({...editForm, kategoriId: '', islemTuru: val as any});
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="genel_gider" disabled className="text-[10px] font-bold text-slate-400">SİSTEM KATEGORİLERİ</SelectItem>
                    <SelectItem value="genel_gider">Genel Gider</SelectItem>
                    <SelectItem value="kira_odemesi">Kira Ödemesi</SelectItem>
                    <SelectItem value="maas_odemesi">Maaş Ödemesi</SelectItem>
                    <SelectItem value="ssk_odemesi">SSK/Bağkur Ödemesi</SelectItem>
                    <SelectItem value="vergi_kdv">KDV Ödemesi</SelectItem>
                    <SelectItem value="banka_masrafi">Banka Masrafı</SelectItem>
                    
                    {giderKategorileri.length > 0 && (
                      <>
                        <SelectItem value="separator" disabled className="text-[10px] font-bold text-slate-400 border-t mt-2 pt-2">OZEL KATEGORİLER</SelectItem>
                        {giderKategorileri.map(k => (
                          <SelectItem key={k.id} value={k.id}>{k.ad}</SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="e-cari" className="text-right text-xs">Cari</Label>
              <div className="col-span-3">
                <Select value={String(editForm.cariId || 'none')} onValueChange={(val) => setEditForm({...editForm, cariId: val === 'none' ? undefined : val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cari Seç (Opsiyonel)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Genel (Cari Yok)</SelectItem>
                    {(cariler || []).filter(c => c && c.id !== undefined && c.id !== null && String(c.id).trim() !== '').map((c, idx) => (
                      <SelectItem key={c.id !== undefined && c.id !== null ? String(c.id) : `cari-${idx}`} value={String(c.id ?? '')}>{String(c.unvan ?? 'Bilinmiyor')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>Vazgeç</Button>
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => {
              if (editingId) {
                updateCariHareket(editingId, editForm);
                setEditingId(null);
                toast.success('Gider başarıyla güncellendi.');
              }
            }}>Değişiklikleri Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kategori Yönetimi Dialog */}
      <Dialog open={isCategoryManageOpen} onOpenChange={setIsCategoryManageOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-rose-500" />
              Gider Kategorilerini Yönet
            </DialogTitle>
            <DialogDescription>
              Harcamalarınızı gruplandırmak için yeni kategoriler ekleyebilir veya mevcutları silebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Yeni kategori adı... (Örn: Kırtasiye)" 
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const trimmed = String(newCatName || '').trim();
                    if (trimmed) {
                      addGiderKategorisi(trimmed);
                      setNewCatName('');
                      toast.success('Kategori eklendi.');
                    }
                  }
                }}
              />
              <Button 
                className="bg-rose-600 hover:bg-rose-700"
                onClick={() => {
                  const trimmed = String(newCatName || '').trim();
                  if (trimmed) {
                    addGiderKategorisi(trimmed);
                    setNewCatName('');
                    toast.success('Kategori eklendi.');
                  }
                }}
              >
                Ekle
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b text-xs font-bold text-slate-500">
                MEVCUT KATEGORİLER
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {giderKategorileri.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm italic">
                    Henüz özel kategori eklenmemiş.
                  </div>
                ) : (
                  <div className="divide-y">
                    {giderKategorileri.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                        <span className="font-medium text-slate-700">{cat.ad}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50"
                          onClick={() => {
                            deleteGiderKategorisi(cat.id);
                            toast.success('Kategori silindi.');
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <p className="text-[10px] text-amber-700 leading-relaxed italic">
                <strong>Not:</strong> Sistem ana kategorileri (Maaş, Kira vb.) silinemez. Özel kategoriler silindiğinde o kategoriye ait eski harcamalar listede "Bilinmiyor" olarak görünebilir.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setIsCategoryManageOpen(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
