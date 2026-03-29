import React, { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function PersonelListe() {
  const { personnel, fetchPersonnel, bulkUploadPersonnel, addPersonnel, updatePersonnel, deletePersonnel } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
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
