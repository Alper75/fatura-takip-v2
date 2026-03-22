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
  const { personnel, fetchPersonnel, bulkUploadPersonnel, addPersonnel } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPerson, setNewPerson] = useState({
    tc: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    salary: ''
  });

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
        salary: ''
      });
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
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full">Kaydet</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
                      {p.must_change_password ? (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                          Şifre Değişimi Bekleniyor
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Aktif
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
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
    </div>
  );
}
