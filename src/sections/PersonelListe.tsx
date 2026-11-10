import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search,
  UserPlus,
  FileSpreadsheet,
  ChevronRight,
  Edit,
  Trash2,
  Calculator,
  Send
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { LucaYevmiyePreviewModal, type PreviewYevmiyeRow } from '@/components/LucaYevmiyePreviewModal';

export default function PersonelListe() {
  const { personnel, fetchPersonnel, bulkUploadPersonnel, addPersonnel, updatePersonnel, deletePersonnel } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [isYevmiyePreviewOpen, setIsYevmiyePreviewOpen] = useState(false);
  const [yevmiyeLines, setYevmiyeLines] = useState<PreviewYevmiyeRow[]>([]);
  const [payrollPeriod, setPayrollPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payrollSplitByPerson, setPayrollSplitByPerson] = useState(true);
  const [payrollOverrides, setPayrollOverrides] = useState<Record<number, { net?: number; avans?: number; gv?: number; dv?: number }>>({});
  const [newPerson, setNewPerson] = useState({
    tc: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    salary: '',
    annual_leave_days: 14,
    status: 'Active' as 'Active' | 'Inactive',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    puantaj_menu_active: false
  });

  const [editPerson, setEditPerson] = useState<any>(null);
  const [selectedPersonForDetail, setSelectedPersonForDetail] = useState<any>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchPersonnel();
  }, [fetchPersonnel]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const result = await bulkUploadPersonnel(file);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    }
  };
  const handleAddPersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addPersonnel(newPerson);
    if (result.success) {
      toast.success(result.message);
      setIsAddDialogOpen(false);
      setNewPerson({
        tc: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        position: '',
        department: '',
        salary: '',
        annual_leave_days: 14,
        status: 'Active',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        puantaj_menu_active: false
      });
    } else {
      toast.error(result.message);
    }
  };

  const handleEditPersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPerson) return;
    const result = await updatePersonnel(editPerson.id, editPerson);
    if (result.success) {
      toast.success(result.message);
      setIsEditDialogOpen(false);
    } else {
      toast.error(result.message);
    }
  };

  const handleDeletePersonnel = async (id: number) => {
    if (!confirm('Bu personeli silmek istediğinizden emin misiniz?')) return;
    const result = await deletePersonnel(id);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const filteredPersonnel = personnel.filter(p => 
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.tc?.includes(searchTerm) ||
    p.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Aktif personeller için Maaş & SGK Tahakkuk Hesaplaması
  const payrollRows = useMemo(() => {
    return personnel
      .filter(p => p.status === 'Active')
      .map((p, idx) => {
        const ov = payrollOverrides[p.id] || {};
        const net = ov.net !== undefined ? ov.net : (Number(p.salary) || 0);
        const avans = ov.avans !== undefined ? ov.avans : 0;
        const gv = ov.gv !== undefined ? ov.gv : 0;
        const dv = ov.dv !== undefined ? ov.dv : 0;
        // Brüt Maaş: (Net + GV + DV) / 0.85 (SGK İşçi %14 + İşsizlik %1 = %15)
        const brut = Math.round(((net + gv + dv) / 0.85) * 100) / 100;
        const sgkIsci = Math.round(brut * 0.14 * 100) / 100;
        const issizlikIsci = Math.round(brut * 0.01 * 100) / 100;
        // 5510 sayılı kanun %5 indirimli SGK İşveren Payı (%15.5) + İşsizlik İşveren (%2)
        const sgkIsveren = Math.round(brut * 0.155 * 100) / 100;
        const issizlikIsveren = Math.round(brut * 0.02 * 100) / 100;
        const odenecekNet = Math.max(0, Math.round((net - avans) * 100) / 100);
        const hesapKodu = `335.01.${String(idx + 1).padStart(3, '0')}`;
        return {
          id: p.id,
          adSoyad: `${p.first_name} ${p.last_name}`.trim(),
          tc: p.tc || '',
          departman: p.department || 'Genel Yönetim',
          hesapKodu,
          net,
          avans,
          gv,
          dv,
          brut,
          sgkIsci,
          issizlikIsci,
          sgkIsveren,
          issizlikIsveren,
          odenecekNet,
          toplamMaliyet: Math.round((brut + sgkIsveren + issizlikIsveren) * 100) / 100
        };
      });
  }, [personnel, payrollOverrides]);

  const buildPayrollYevmiyeLines = (): PreviewYevmiyeRow[] => {
    const valid = payrollRows.filter(r => r.net > 0);
    if (valid.length === 0) return [];
    const lines: PreviewYevmiyeRow[] = [];
    const fisNo = `MAAS-${payrollPeriod}`;
    const [y, m] = payrollPeriod.split('-');
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    const tarih = `${String(lastDay).padStart(2, '0')}.${m}.${y}`;

    const topBrut = Math.round(valid.reduce((s, r) => s + r.brut, 0) * 100) / 100;
    const topSgkIsveren = Math.round(valid.reduce((s, r) => s + r.sgkIsveren, 0) * 100) / 100;
    const topIssizlikIsveren = Math.round(valid.reduce((s, r) => s + r.issizlikIsveren, 0) * 100) / 100;
    const topSgkPrimi = Math.round(valid.reduce((s, r) => s + r.sgkIsci + r.sgkIsveren, 0) * 100) / 100;
    const topIssizlikPrimi = Math.round(valid.reduce((s, r) => s + r.issizlikIsci + r.issizlikIsveren, 0) * 100) / 100;
    const topGv = Math.round(valid.reduce((s, r) => s + r.gv, 0) * 100) / 100;
    const topDv = Math.round(valid.reduce((s, r) => s + r.dv, 0) * 100) / 100;
    const topAvans = Math.round(valid.reduce((s, r) => s + r.avans, 0) * 100) / 100;
    const topOdenecekNet = Math.round(valid.reduce((s, r) => s + r.odenecekNet, 0) * 100) / 100;

    // BORÇ SATIRLARI (770)
    lines.push({
      id: '770_brut',
      tarih,
      evrakNo: fisNo,
      belgeTuru: 'M',
      muhasebeKodu: '770.01.001',
      cariUnvan: 'Brüt Ücret Giderleri',
      aciklama: `${payrollPeriod} Dönemi Personel Brüt Ücret Tahakkuku (${valid.length} Personel)`,
      borc: topBrut,
      alacak: 0
    });
    lines.push({
      id: '770_sgk',
      tarih,
      evrakNo: fisNo,
      belgeTuru: 'M',
      muhasebeKodu: '770.01.002',
      cariUnvan: 'SGK İşveren Payı Giderleri',
      aciklama: `${payrollPeriod} Dönemi SGK İşveren Hissesi Tahakkuku`,
      borc: topSgkIsveren,
      alacak: 0
    });
    lines.push({
      id: '770_issizlik',
      tarih,
      evrakNo: fisNo,
      belgeTuru: 'M',
      muhasebeKodu: '770.01.003',
      cariUnvan: 'İşsizlik Sigortası İşveren Payı',
      aciklama: `${payrollPeriod} Dönemi İşsizlik İşveren Hissesi Tahakkuku`,
      borc: topIssizlikIsveren,
      alacak: 0
    });

    // ALACAK SATIRLARI (335, 196, 360, 361)
    if (payrollSplitByPerson) {
      valid.forEach((r, i) => {
        if (r.odenecekNet > 0) {
          lines.push({
            id: `335_${r.id}_${i}`,
            tarih,
            evrakNo: fisNo,
            belgeTuru: 'M',
            muhasebeKodu: r.hesapKodu,
            cariUnvan: `Personele Borçlar - ${r.adSoyad}`,
            vknTckn: r.tc,
            aciklama: `${payrollPeriod} Net Maaş Tahakkuku - ${r.adSoyad} (TC: ${r.tc})`,
            borc: 0,
            alacak: r.odenecekNet
          });
        }
      });
    } else if (topOdenecekNet > 0) {
      lines.push({
        id: '335_toplu',
        tarih,
        evrakNo: fisNo,
        belgeTuru: 'M',
        muhasebeKodu: '335.01.001',
        cariUnvan: 'Personele Borçlar (Net Ücretler)',
        aciklama: `${payrollPeriod} Dönemi Net Maaş Tahakkuku (${valid.length} Personel)`,
        borc: 0,
        alacak: topOdenecekNet
      });
    }

    if (topAvans > 0) {
      lines.push({
        id: '196_avans',
        tarih,
        evrakNo: fisNo,
        belgeTuru: 'M',
        muhasebeKodu: '196.01.001',
        cariUnvan: 'Personel Maaş Avansları Mahsubu',
        aciklama: `${payrollPeriod} Dönemi Personel Avans Kesintisi`,
        borc: 0,
        alacak: topAvans
      });
    }

    if (topGv > 0) {
      lines.push({
        id: '360_gv',
        tarih,
        evrakNo: fisNo,
        belgeTuru: 'M',
        muhasebeKodu: '360.01.001',
        cariUnvan: 'Ödenecek Gelir Vergisi (Muhtasar)',
        aciklama: `${payrollPeriod} Dönemi Ücret Gelir Vergisi Kesintisi`,
        borc: 0,
        alacak: topGv
      });
    }

    if (topDv > 0) {
      lines.push({
        id: '360_dv',
        tarih,
        evrakNo: fisNo,
        belgeTuru: 'M',
        muhasebeKodu: '360.01.002',
        cariUnvan: 'Ödenecek Damga Vergisi',
        aciklama: `${payrollPeriod} Dönemi Ücret Damga Vergisi Kesintisi`,
        borc: 0,
        alacak: topDv
      });
    }

    lines.push({
      id: '361_sgk',
      tarih,
      evrakNo: fisNo,
      belgeTuru: 'M',
      muhasebeKodu: '361.01.001',
      cariUnvan: 'Ödenecek SGK Primleri (İşçi + İşveren)',
      aciklama: `${payrollPeriod} Dönemi Ödenecek SGK Primleri`,
      borc: 0,
      alacak: topSgkPrimi
    });

    lines.push({
      id: '361_issizlik',
      tarih,
      evrakNo: fisNo,
      belgeTuru: 'M',
      muhasebeKodu: '361.01.002',
      cariUnvan: 'Ödenecek İşsizlik Sigortası Primleri',
      aciklama: `${payrollPeriod} Dönemi Ödenecek İşsizlik Primleri`,
      borc: 0,
      alacak: topIssizlikPrimi
    });

    // Kuruş farkı dengelemesi
    const totalB = lines.reduce((s, l) => s + l.borc, 0);
    const totalA = lines.reduce((s, l) => s + l.alacak, 0);
    const diff = Math.round((totalB - totalA) * 100) / 100;
    if (Math.abs(diff) > 0 && Math.abs(diff) <= 0.5 && lines.length > 0) {
      const sgkLine = lines.find(l => l.id === '361_sgk');
      if (sgkLine) sgkLine.alacak = Math.round((sgkLine.alacak + diff) * 100) / 100;
    }

    return lines;
  };

  const handleOpenPayrollYevmiyePreview = () => {
    const lines = buildPayrollYevmiyeLines();
    if (lines.length === 0) {
      toast.warning('Maaş tutarı tanımlı aktif personel bulunamadı.');
      return;
    }
    setYevmiyeLines(lines);
    setIsYevmiyePreviewOpen(true);
  };

  const handleSendPayrollToLuca = (editedLines: PreviewYevmiyeRow[]) => {
    const first = editedLines[0];
    const fisPayload = [{
      tarih: first?.tarih || new Date().toLocaleDateString('tr-TR'),
      aciklama: `${payrollPeriod} Dönemi Personel Maaş ve SGK Tahakkuk Fişi`,
      satirlar: editedLines.map(l => ({
        hesapKodu: l.muhasebeKodu,
        evrakTarihi: l.tarih,
        evrakNo: l.evrakNo,
        aciklama: l.aciklama,
        borc: l.borc,
        alacak: l.alacak
      }))
    }];

    let responded = false;
    const listener = (event: MessageEvent) => {
      if (event.data?.type === 'LUCA_MAHSUP_FISI_RESULT') {
        responded = true;
        window.removeEventListener('message', listener);
        setIsYevmiyePreviewOpen(false);
        if (event.data.success) {
          toast.success(`${payrollPeriod} maaş tahakkuk fişi doğrudan Luca'ya aktarıldı!`);
        } else {
          toast.error(event.data.message || 'Luca aktarımı sırasında hata oluştu.');
        }
      }
    };
    window.addEventListener('message', listener);
    window.postMessage({ type: 'LUCA_CREATE_MAHSUP_FISI', fisList: fisPayload }, '*');

    setTimeout(() => {
      if (!responded) {
        window.removeEventListener('message', listener);
        toast.info('Maaş tahakkuk fişi Luca Eklentisine iletildi. Sağ üstteki Luca Eklenti panelini kontrol edin.');
      }
    }, 3500);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Personel Yönetimi</h2>
          <p className="text-muted-foreground">
            Şirket çalışanlarını görüntüleyin, ekleyin ve yönetin.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsPayrollModalOpen(true)}
            className="border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-semibold"
          >
            <Calculator className="mr-2 h-4 w-4" />
            💼 Maaş Tahakkuk Fişi & Luca Aktarım
          </Button>
          <div className="relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              id="bulk-upload"
              onChange={handleFileUpload}
            />
            <Button variant="outline" onClick={() => document.getElementById('bulk-upload')?.click()}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel ile Yükle
            </Button>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Yeni Personel
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Yeni Personel Ekle</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddPersonnel} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tc">TC Kimlik No</Label>
                    <Input 
                      id="tc" 
                      value={newPerson.tc} 
                      onChange={(e) => setNewPerson({...newPerson, tc: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-posta</Label>
                    <Input 
                      id="email" 
                      type="email"
                      value={newPerson.email} 
                      onChange={(e) => setNewPerson({...newPerson, email: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Ad</Label>
                    <Input 
                      id="first_name" 
                      value={newPerson.first_name} 
                      onChange={(e) => setNewPerson({...newPerson, first_name: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Soyad</Label>
                    <Input 
                      id="last_name" 
                      value={newPerson.last_name} 
                      onChange={(e) => setNewPerson({...newPerson, last_name: e.target.value})}
                      required 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Departman</Label>
                    <Input 
                      id="department" 
                      value={newPerson.department} 
                      onChange={(e) => setNewPerson({...newPerson, department: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">Pozisyon</Label>
                    <Input 
                      id="position" 
                      value={newPerson.position} 
                      onChange={(e) => setNewPerson({...newPerson, position: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input 
                      id="phone" 
                      value={newPerson.phone} 
                      onChange={(e) => setNewPerson({...newPerson, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salary">Maaş (Aylık Net)</Label>
                    <Input 
                      id="salary" 
                      type="number"
                      value={newPerson.salary} 
                      onChange={(e) => setNewPerson({...newPerson, salary: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Durum</Label>
                    <select 
                      id="status"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={newPerson.status}
                      onChange={(e) => setNewPerson({...newPerson, status: e.target.value as any})}
                    >
                      <option value="Active">Aktif</option>
                      <option value="Inactive">Ayrıldı</option>
                    </select>
                  </div>
                  <div className="space-y-2 flex flex-col justify-end pb-1">
                    <Label htmlFor="puantaj-menu" className="mb-2">Puantaj Menüsü</Label>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="puantaj-menu"
                        className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                        checked={newPerson.puantaj_menu_active}
                        onChange={(e) => setNewPerson({...newPerson, puantaj_menu_active: e.target.checked})}
                      />
                      <span className="text-sm text-slate-600">Aktif Edilsin</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">İşe Giriş Tarihi</Label>
                    <Input id="start_date" type="date" value={newPerson.start_date} onChange={(e) => setNewPerson({...newPerson, start_date: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">İşten Çıkış Tarihi</Label>
                    <Input id="end_date" type="date" value={newPerson.end_date} onChange={(e) => setNewPerson({...newPerson, end_date: e.target.value})} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full">Kaydet</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Personel Düzenle</DialogTitle>
          </DialogHeader>
          {editPerson && (
            <form onSubmit={handleEditPersonnel} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>TC Kimlik No (Değiştirilemez)</Label>
                  <Input value={editPerson.tc} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">E-posta</Label>
                  <Input 
                    id="edit-email" 
                    type="email"
                    value={editPerson.email || ''} 
                    onChange={(e) => setEditPerson({...editPerson, email: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-first_name">Ad</Label>
                  <Input 
                    id="edit-first_name" 
                    value={editPerson.first_name} 
                    onChange={(e) => setEditPerson({...editPerson, first_name: e.target.value})}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-last_name">Soyad</Label>
                  <Input 
                    id="edit-last_name" 
                    value={editPerson.last_name} 
                    onChange={(e) => setEditPerson({...editPerson, last_name: e.target.value})}
                    required 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-department">Departman</Label>
                  <Input 
                    id="edit-department" 
                    value={editPerson.department || ''} 
                    onChange={(e) => setEditPerson({...editPerson, department: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-position">Pozisyon</Label>
                  <Input 
                    id="edit-position" 
                    value={editPerson.position || ''} 
                    onChange={(e) => setEditPerson({...editPerson, position: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-salary">Maaş</Label>
                  <Input 
                    id="edit-salary" 
                    type="number"
                    value={editPerson.salary || ''} 
                    onChange={(e) => setEditPerson({...editPerson, salary: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-leave">Yıllık İzin Hakkı</Label>
                  <Input 
                    id="edit-leave" 
                    type="number"
                    value={editPerson.annual_leave_days || 0} 
                    onChange={(e) => setEditPerson({...editPerson, annual_leave_days: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Durum</Label>
                  <select 
                    id="edit-status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={editPerson.status || 'Active'}
                    onChange={(e) => setEditPerson({...editPerson, status: e.target.value as any})}
                  >
                    <option value="Active">Aktif</option>
                    <option value="Inactive">Ayrıldı</option>
                  </select>
                </div>
                <div className="space-y-2 flex flex-col justify-end pb-1">
                  <Label htmlFor="edit-puantaj-menu" className="mb-2">Puantaj Menüsü</Label>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox" 
                      id="edit-puantaj-menu"
                      className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                      checked={editPerson.puantaj_menu_active == 1 || editPerson.puantaj_menu_active === true}
                      onChange={(e) => setEditPerson({...editPerson, puantaj_menu_active: e.target.checked})}
                    />
                    <span className="text-sm text-slate-600">Aktif Edilsin</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start_date">İşe Giriş Tarihi</Label>
                  <Input id="edit-start_date" type="date" value={editPerson.start_date || ''} onChange={(e) => setEditPerson({...editPerson, start_date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end_date">İşten Çıkış Tarihi</Label>
                  <Input id="edit-end_date" type="date" value={editPerson.end_date || ''} onChange={(e) => setEditPerson({...editPerson, end_date: e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full">Güncelle</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Personel Listesi</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="İsim, TC veya Departman ara..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TC No</TableHead>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Departman</TableHead>
                <TableHead>Pozisyon</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPersonnel.length > 0 ? (
                filteredPersonnel.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                    // Navigate to details if needed
                  }}>
                    <TableCell className="font-medium">{p.tc}</TableCell>
                    <TableCell>{p.first_name} {p.last_name}</TableCell>
                    <TableCell>{p.department}</TableCell>
                    <TableCell>{p.position}</TableCell>
                    <TableCell>{p.phone}</TableCell>
                    <TableCell>
                      {p.status === 'Inactive' ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                          Ayrıldı
                        </span>
                      ) : p.must_change_password ? (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                          Şifre Bekliyor
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Aktif
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={(e) => {
                          e.stopPropagation();
                          setEditPerson({...p});
                          setIsEditDialogOpen(true);
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePersonnel(p.id);
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPersonForDetail(p);
                          setIsDetailDialogOpen(true);
                        }}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Personel bulunamadı.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedPersonForDetail && (
        <PersonelDetayDrawer 
          person={selectedPersonForDetail} 
          open={isDetailDialogOpen} 
          onOpenChange={setIsDetailDialogOpen} 
        />
      )}

      {/* Aylık Maaş & SGK Tahakkuk Fişi Modalı */}
      <Dialog open={isPayrollModalOpen} onOpenChange={setIsPayrollModalOpen}>
        <DialogContent className="sm:max-w-[960px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-900">
              <Calculator className="w-5 h-5 text-indigo-600" />
              Aylık Personel Maaş, Avans ve SGK Tahakkuk Fişi (Luca)
            </DialogTitle>
            <DialogDescription>
              Aktif personellerin net maaşlarından 770 Brüt Ücret / SGK İşveren ve 335 Personele Borçlar / 196 Avans / 360 Vergi / 361 SGK tahakkuk yevmiye fişini otomatik oluşturur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border">
              <div className="flex items-center gap-3">
                <Label className="text-xs font-bold">Tahakkuk Dönemi:</Label>
                <Input
                  type="month"
                  value={payrollPeriod}
                  onChange={(e) => setPayrollPeriod(e.target.value)}
                  className="h-8 w-40 text-xs font-mono bg-white"
                />
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer ml-2">
                  <input
                    type="checkbox"
                    checked={payrollSplitByPerson}
                    onChange={(e) => setPayrollSplitByPerson(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  335 Personele Borçlar hesabını kişi bazlı ayrı aç (335.01.001, 002...)
                </label>
              </div>
              <div className="text-xs text-slate-600">
                Toplam Net Ödenecek: <b className="text-emerald-700">{payrollRows.reduce((s, r) => s + r.odenecekNet, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</b>
                {' • '}
                Toplam İşveren Maliyeti: <b className="text-indigo-700">{payrollRows.reduce((s, r) => s + r.toplamMaliyet, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</b>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-slate-100">
                  <TableRow>
                    <TableHead className="text-xs">Personel & 335 Kodu</TableHead>
                    <TableHead className="text-xs text-right">Net Maaş (₺)</TableHead>
                    <TableHead className="text-xs text-right">Avans (196)</TableHead>
                    <TableHead className="text-xs text-right">GV / DV (360)</TableHead>
                    <TableHead className="text-xs text-right">Brüt Ücret (770)</TableHead>
                    <TableHead className="text-xs text-right">SGK+İşs. Toplam (361)</TableHead>
                    <TableHead className="text-xs text-right">Ödenecek Net (335)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-500">
                        Aktif personel bulunamadı.
                      </TableCell>
                    </TableRow>
                  ) : payrollRows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="py-2">
                        <div className="font-semibold text-xs text-slate-800">{r.adSoyad}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.hesapKodu} • TC: {r.tc || '-'}</div>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Input
                          type="number"
                          value={r.net}
                          onChange={(e) => setPayrollOverrides(prev => ({
                            ...prev,
                            [r.id]: { ...prev[r.id], net: parseFloat(e.target.value) || 0 }
                          }))}
                          className="h-7 w-28 text-xs text-right font-mono ml-auto"
                        />
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Input
                          type="number"
                          value={r.avans}
                          onChange={(e) => setPayrollOverrides(prev => ({
                            ...prev,
                            [r.id]: { ...prev[r.id], avans: parseFloat(e.target.value) || 0 }
                          }))}
                          placeholder="0"
                          className="h-7 w-24 text-xs text-right font-mono ml-auto"
                        />
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            value={r.gv}
                            onChange={(e) => setPayrollOverrides(prev => ({
                              ...prev,
                              [r.id]: { ...prev[r.id], gv: parseFloat(e.target.value) || 0 }
                            }))}
                            placeholder="GV"
                            title="Gelir Vergisi"
                            className="h-7 w-16 text-xs text-right font-mono"
                          />
                          <Input
                            type="number"
                            value={r.dv}
                            onChange={(e) => setPayrollOverrides(prev => ({
                              ...prev,
                              [r.id]: { ...prev[r.id], dv: parseFloat(e.target.value) || 0 }
                            }))}
                            placeholder="DV"
                            title="Damga Vergisi"
                            className="h-7 w-16 text-xs text-right font-mono"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs font-mono text-slate-700">
                        {r.brut.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs font-mono text-slate-600">
                        {(r.sgkIsci + r.sgkIsveren + r.issizlikIsci + r.issizlikIsveren).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs font-bold font-mono text-emerald-700">
                        {r.odenecekNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsPayrollModalOpen(false)}>Kapat</Button>
            <Button
              onClick={handleOpenPayrollYevmiyePreview}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              <Send className="w-4 h-4 mr-2" />
              🔍 Yevmiye Fişini Önizle & Luca'ya Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LucaYevmiyePreviewModal
        isOpen={isYevmiyePreviewOpen}
        onClose={() => setIsYevmiyePreviewOpen(false)}
        title={`${payrollPeriod} Dönemi Personel Maaş & SGK Tahakkuk Fişi`}
        subtitle="770 Brüt Ücret & SGK İşveren / 335 Personele Borçlar / 196 Avans / 360 Vergi / 361 SGK Yevmiye Önizlemesi"
        documentCount={payrollRows.filter(r => r.net > 0).length}
        initialRows={yevmiyeLines}
        onConfirmSend={handleSendPayrollToLuca}
      />
    </div>
  );
}

// Alt Bileşen: Personel Detay Paneli
function PersonelDetayDrawer({ person, open, onOpenChange }: { person: any, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { leaves, pointages } = useApp();
  
  const personLeaves = leaves.filter(l => l.personnel_id === person.id);
  const personPointages = pointages.filter(p => p.personnel_id === person.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{person.first_name} {person.last_name} - Personel Detayı</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-slate-50 border-0 shadow-none">
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500 uppercase font-bold">Kalan İzin</p>
                <p className="text-2xl font-bold">{person.annual_leave_days} Gün</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-0 shadow-none">
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500 uppercase font-bold">Pozisyon</p>
                <p className="text-sm font-semibold">{person.position || '-'}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-0 shadow-none">
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500 uppercase font-bold">Maaş</p>
                <p className="text-sm font-semibold">{person.salary ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(person.salary) : '-'}</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              İzin Geçmişi
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="py-2 h-auto text-[10px]">Tarih</TableHead>
                    <TableHead className="py-2 h-auto text-[10px]">Tür</TableHead>
                    <TableHead className="py-2 h-auto text-[10px]">Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personLeaves.length > 0 ? personLeaves.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="py-2 text-xs">{l.start_date} / {l.end_date}</TableCell>
                      <TableCell className="py-2 text-xs">{l.type}</TableCell>
                      <TableCell className="py-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                          l.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 
                          l.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {l.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={3} className="text-center py-4 text-xs italic">Kayıt yok.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              Son Puantaj Kayıtları
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="py-2 h-auto text-[10px]">Tarih</TableHead>
                    <TableHead className="py-2 h-auto text-[10px]">Durum</TableHead>
                    <TableHead className="py-2 h-auto text-[10px]">Mesai</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personPointages.slice(0, 10).map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="py-2 text-xs">{p.date}</TableCell>
                      <TableCell className="py-2 text-xs">{p.status}</TableCell>
                      <TableCell className="py-2 text-xs">{p.overtime_hours}s</TableCell>
                    </TableRow>
                  ))}
                  {personPointages.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center py-4 text-xs italic">Kayıt yok.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
