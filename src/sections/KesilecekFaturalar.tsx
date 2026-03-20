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
  FilePlus, 
  Search, 
  Trash2, 
  Download, 
  Upload,
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Send, 
  ExternalLink, 
  ShieldCheck, 
  Loader2 
} from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import type { KesilecekFatura } from '@/types';

export function KesilecekFaturalar() {
  const { 
    kesilecekFaturalar, 
    addKesilecekFatura, 
    updateKesilecekFatura, 
    deleteKesilecekFatura,
    openSatisDrawer,
    cariler
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  
  // Yeni Fatura Formu State
  const [form, setForm] = useState({
    ad: '',
    soyad: '',
    vknTckn: '',
    vergiDairesi: '',
    adres: '',
    il: '',
    ilce: '',
    tutar: '',
    kdvOrani: '20',
    faturaTarihi: new Date().toISOString().split('T')[0],
    aciklama: '',
    kdvDahil: true,
    cariId: 'none'
  });

  // GİB States
  const [isGibModalOpen, setIsGibModalOpen] = useState(false);
  const [gibCredentials, setGibCredentials] = useState({ username: '', password: '' });
  const [selectedInvoiceForGib, setSelectedInvoiceForGib] = useState<KesilecekFatura | null>(null);
  const [isGibSending, setIsGibSending] = useState(false);

  const filteredInvoices = useMemo(() => {
    if (!kesilecekFaturalar || !Array.isArray(kesilecekFaturalar)) return [];
    
    return kesilecekFaturalar
      .filter(f => 
        (f.ad || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
        (f.soyad && f.soyad.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.vknTckn || "").includes(searchTerm)
      )
      .sort((a, b) => new Date(b.olusturmaTarihi || 0).getTime() - new Date(a.olusturmaTarihi || 0).getTime());
  }, [kesilecekFaturalar, searchTerm]);

  const handleCariChange = (cariId: string) => {
    if (!cariId || cariId === 'none') {
      setForm(prev => ({ ...prev, cariId: 'none', ad: '', soyad: '', vknTckn: '', vergiDairesi: '', adres: '', il: '', ilce: '' }));
      return;
    }
    const cari = cariler?.find(c => c.id === cariId);
    if (cari) {
      setForm(prev => ({
        ...prev,
        cariId: cari.id,
        ad: cari.unvan,
        soyad: '', // Ünvan genelde tam isimdir
        vknTckn: cari.vknTckn,
        vergiDairesi: cari.vergiDairesi || '',
        adres: cari.adres || '',
      }));
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ad || !form.vknTckn || !form.tutar) {
      toast.error('Lütfen gerekli alanları doldurun (Ad, VKN/TC, Tutar)');
      return;
    }

    addKesilecekFatura({
      ad: form.ad,
      soyad: form.soyad,
      vknTckn: form.vknTckn,
      vergiDairesi: form.vergiDairesi,
      adres: form.adres,
      il: form.il,
      ilce: form.ilce,
      tutar: parseFloat(form.tutar),
      kdvOrani: parseInt(form.kdvOrani),
      faturaTarihi: form.faturaTarihi,
      aciklama: form.aciklama,
      kdvDahil: form.kdvDahil,
      cariId: form.cariId || undefined
    });

    setForm({
      ad: '',
      soyad: '',
      vknTckn: '',
      vergiDairesi: '',
      adres: '',
      il: '',
      ilce: '',
      tutar: '',
      kdvOrani: '20',
      faturaTarihi: new Date().toISOString().split('T')[0],
      aciklama: '',
      kdvDahil: true,
      cariId: 'none'
    });
    toast.success('Kayıt listeye eklendi.');
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Ad (veya Firma)': 'Örnek A.Ş.',
        'Soyad (Şahıs ise)': '',
        'VKN / TCKN': '1234567890',
        'Vergi Dairesi': 'Kadıköy',
        'Adres': 'Kadıköy / İstanbul',
        'İl': 'İstanbul',
        'İlçe': 'Kadıköy',
        'Fatura Tarihi (GG.AA.YYYY)': new Date().toLocaleDateString('tr-TR'),
        'Tutar': '1500.50',
        'KDV Oranı': '20',
        'KDV Dahil mi? (E/H)': 'E',
        'Açıklama': 'Sistem Bakım Ücreti'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
    XLSX.writeFile(wb, 'kesilecek_fatura_sablon.xlsx');
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        data.forEach((row: any) => {
          addKesilecekFatura({
            ad: row['Ad (veya Firma)'] || '',
            soyad: row['Soyad (Şahıs ise)'] || '',
            vknTckn: String(row['VKN / TCKN'] || ''),
            vergiDairesi: row['Vergi Dairesi'] || '',
            adres: row['Adres'] || '',
            il: row['İl'] || '',
            ilce: row['İlçe'] || '',
            tutar: parseFloat(String(row['Tutar'] || '0').replace(',', '.')),
            kdvOrani: parseInt(row['KDV Oranı'] || '20'),
            faturaTarihi: row['Fatura Tarihi (GG.AA.YYYY)'] || new Date().toISOString().split('T')[0],
            aciklama: row['Açıklama'] || '',
            kdvDahil: (row['KDV Dahil mi? (E/H)'] || 'E').toUpperCase() === 'E'
          });
        });
        toast.success(`${data.length} kayıt başarıyla yüklendi.`);
      } catch (err) {
        toast.error('Excel okuma hatası. Lütfen şablonu kullanın.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const convertToRealInvoice = (f: KesilecekFatura) => {
    openSatisDrawer({
      ad: f.ad,
      soyad: f.soyad || '',
      tcVkn: f.vknTckn,
      adres: f.adres,
      alinanUcret: String(f.tutar),
      aciklama: f.aciklama
    });
    
    // Durumu güncelle
    updateKesilecekFatura(f.id, { durum: 'kesildi' });
  };

  const handleGibSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForGib || !gibCredentials.username || !gibCredentials.password) {
      toast.error('Lütfen tüm bilgileri girin.');
      return;
    }

    setIsGibSending(true);
    try {
      const apiUrl = import.meta.env.DEV 
        ? 'http://localhost:5000/api/gib/create-draft' 
        : '/api/gib/create-draft';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentials: gibCredentials,
          invoice: {
            ...selectedInvoiceForGib,
            tarih: selectedInvoiceForGib.faturaTarihi || new Date().toLocaleDateString('tr-TR'),
            // Portal genellikle KDV hariç matrah ve oran bekler
            tutar: selectedInvoiceForGib.kdvDahil 
              ? selectedInvoiceForGib.tutar / (1 + (selectedInvoiceForGib.kdvOrani || 20) / 100)
              : selectedInvoiceForGib.tutar,
            kdvOrani: selectedInvoiceForGib.kdvOrani || 20
          }
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        setIsGibModalOpen(false);
        // Durumu güncelle
        updateKesilecekFatura(selectedInvoiceForGib.id, { durum: 'kesildi' });
      } else {
        toast.error(result.message || 'GİB Gönderim hatası');
      }
    } catch (error) {
      toast.error('Sunucuya bağlanılamadı. Lütfen backend sunucusunun çalıştığından emin olun.');
    } finally {
      setIsGibSending(false);
    }
  };

  const openGibModal = (f: KesilecekFatura) => {
    setSelectedInvoiceForGib(f);
    setIsGibModalOpen(true);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <FilePlus className="w-6 h-6 text-blue-600" />
            </div>
            Kesilecek Faturalar
          </h2>
          <p className="text-slate-500 mt-1">Sıraya alınmış ve toplu kesilecek faturaları yönetin</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTemplate} className="gap-2 h-10">
            <Download className="w-4 h-4" /> Şablon İndir
          </Button>
          <div className="relative">
            <input 
              type="file" 
              id="excel-upload" 
              className="hidden" 
              accept=".xlsx,.xls" 
              onChange={handleExcelUpload}
            />
            <Button onClick={() => document.getElementById('excel-upload')?.click()} className="gap-2 h-10 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Upload className="w-4 h-4" /> Excel Yükle
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Kartı */}
        <Card className="lg:col-span-4 border-0 shadow-sm ring-1 ring-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Fatura Planı Ekle</CardTitle>
            <CardDescription>Müşteri ve tutar bilgilerini girin</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cari">Cari Karttan Seç (Opsiyonel)</Label>
                <Select value={form.cariId} onValueChange={handleCariChange}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Cari kart seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Manuel Giriş --</SelectItem>
                    {cariler?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.unvan}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ad">Firma Ünvanı / Ad</Label>
                  <Input id="ad" value={form.ad} onChange={e => setForm({...form, ad: e.target.value})} placeholder="Ad" className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="soyad">Soyad</Label>
                  <Input id="soyad" value={form.soyad} onChange={e => setForm({...form, soyad: e.target.value})} placeholder="Soyad" className="h-10" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vkn">VKN / TCKN</Label>
                  <Input id="vkn" value={form.vknTckn} onChange={e => setForm({...form, vknTckn: e.target.value})} placeholder="10-11 hane" className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vd">Vergi Dairesi</Label>
                  <Input id="vd" value={form.vergiDairesi} onChange={e => setForm({...form, vergiDairesi: e.target.value})} placeholder="Daire adı" className="h-10" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="faturaTarihi">Fatura Tarihi</Label>
                <Input id="faturaTarihi" type="date" value={form.faturaTarihi} onChange={e => setForm({...form, faturaTarihi: e.target.value})} className="h-10" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adres">Tam Adres</Label>
                <Input id="adres" value={form.adres} onChange={e => setForm({...form, adres: e.target.value})} placeholder="Cadde, sokak, no..." className="h-10" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="il">İl</Label>
                  <Input id="il" value={form.il} onChange={e => setForm({...form, il: e.target.value})} placeholder="İstanbul" className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ilce">İlçe</Label>
                  <Input id="ilce" value={form.ilce} onChange={e => setForm({...form, ilce: e.target.value})} placeholder="Kadıköy" className="h-10" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="aciklama">Fatura Açıklaması</Label>
                <Textarea id="aciklama" value={form.aciklama} onChange={e => setForm({...form, aciklama: e.target.value})} placeholder="Hizmet bedeli vb..." className="resize-none h-16" />
              </div>

              <div className="space-y-2 pt-2">
                <Label>Tutar ve KDV</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input id="tutar" type="number" step="0.01" value={form.tutar} onChange={e => setForm({...form, tutar: e.target.value})} placeholder="0.00" className="h-10 pr-10" />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₺</div>
                  </div>
                  <Select value={form.kdvOrani} onValueChange={val => setForm({...form, kdvOrani: val})}>
                    <SelectTrigger className="w-24 h-10 font-bold">% {form.kdvOrani}</SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">% 20</SelectItem>
                      <SelectItem value="10">% 10</SelectItem>
                      <SelectItem value="1">% 1</SelectItem>
                      <SelectItem value="0">% 0</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 border rounded-md px-3 bg-slate-50/50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase w-8 leading-tight">{form.kdvDahil ? 'Dahil' : 'Hariç'}</span>
                    <Switch checked={form.kdvDahil} onCheckedChange={val => setForm({...form, kdvDahil: val})} />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 gap-2 mt-4 shadow-sm shadow-blue-100 font-semibold">
                <Plus className="w-4 h-4" /> Planla ve Listeye Ekle
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Liste Kartı */}
        <Card className="lg:col-span-8 border-0 shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <CardHeader className="bg-slate-50/30 border-b pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg">Bekleyen Faturalar</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Müşteri veya VKN ara..." 
                  className="pl-10 h-9 bg-white"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 border-0 hover:bg-slate-50/50">
                    <TableHead className="font-semibold text-slate-600">Müşteri Detayları</TableHead>
                    <TableHead className="font-semibold text-slate-600">Planlanan Tutar</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-center">Durum</TableHead>
                    <TableHead className="text-right font-semibold text-slate-600">Aksiyon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                          <AlertCircle className="w-8 h-8 opacity-20" />
                          <p>Kayıtlı fatura planı bulunamadı.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map(f => (
                      <TableRow key={f.id} className="group border-0 border-b last:border-0 hover:bg-blue-50/30 transition-colors">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 leading-tight">{f.ad} {f.soyad}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-slate-500 font-medium">{f.vknTckn}</span>
                              {f.faturaTarihi && (
                                <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-1.5 rounded">{f.faturaTarihi}</span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 mt-0.5">
                              {f.vergiDairesi && `${f.vergiDairesi} VD. • `} 
                              {f.adres || (f.il ? `${f.ilce}/${f.il}` : 'Adres Belirtilmedi')}
                            </span>
                            {f.aciklama && (
                              <p className="text-[10px] text-slate-400 mt-1 italic leading-tight">
                                "{f.aciklama}"
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{formatCurrency(f.tutar)}</span>
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-wider",
                              f.kdvDahil ? "text-emerald-600" : "text-amber-600"
                            )}>
                              KDV {f.kdvDahil ? 'Dahil' : 'Hariç'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            {f.durum === 'bekliyor' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                                <AlertCircle className="w-3 h-3" /> BEKLİYOR
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> KESİLDİ
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                             {f.durum === 'bekliyor' && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => openGibModal(f)}
                                  className="h-7 text-[10px] font-bold bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-600 hover:text-white hover:border-amber-600 gap-1"
                                >
                                  <ExternalLink className="w-3 h-3" /> GİB'E GÖNDER
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => convertToRealInvoice(f)}
                                  className="h-7 text-[10px] font-bold bg-white border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600"
                                >
                                  FATURA KES
                                </Button>
                              </>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => deleteKesilecekFatura(f.id)}
                              className="w-8 h-8 text-slate-300 hover:text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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

      {/* GİB Modal */}
      <Dialog open={isGibModalOpen} onOpenChange={setIsGibModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              GİB e-Arşiv Portal Taslak Gönderimi
            </DialogTitle>
            <DialogDescription>
              Faturayı GİB portalına taslak olarak göndermek için portal giriş bilgilerinizi girin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGibSend} className="space-y-4 py-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="gib_user">Kullanıcı Kodu / VKN</Label>
                <Input 
                  id="gib_user" 
                  value={gibCredentials.username} 
                  onChange={e => setGibCredentials({...gibCredentials, username: e.target.value})}
                  placeholder="Kullanıcı Kodu"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gib_pass">Şifre</Label>
                <Input 
                  id="gib_pass" 
                  type="password"
                  value={gibCredentials.password} 
                  onChange={e => setGibCredentials({...gibCredentials, password: e.target.value})}
                  placeholder="********"
                  required
                />
              </div>
            </div>
            {selectedInvoiceForGib && (
              <div className="bg-slate-50 p-3 rounded-md border text-sm text-slate-600">
                <p><strong>Müşteri:</strong> {selectedInvoiceForGib.ad} {selectedInvoiceForGib.soyad}</p>
                <p><strong>Tutar:</strong> {formatCurrency(selectedInvoiceForGib.tutar)}</p>
              </div>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsGibModalOpen(false)} disabled={isGibSending}>
                İptal
              </Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700 gap-2" disabled={isGibSending}>
                {isGibSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Taslak Olarak Gönder
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
