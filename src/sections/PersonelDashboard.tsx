import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  FileText, 
  Upload, 
  Bell, 
  Clock, 
  AlertCircle,
  Plus
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function PersonelDashboard() {
  const { user, currentPersonnel, fetchMyPersonnel, changePassword, submitLeaveRequest, submitExpenseRequest, submitPointage } = useApp();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(!!user?.mustChangePassword);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [leaveData, setLeaveData] = useState({ type: 'Annual', start_date: '', end_date: '', description: '' });

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [expenseData, setExpenseData] = useState({ type: 'Expense', amount: '', date: '', description: '' });

  const [isPointageDialogOpen, setIsPointageDialogOpen] = useState(false);
  const [pointageForm, setPointageForm] = useState({
    date: new Date().toISOString().split('T')[0],
    status: 'Work',
    overtime_hours: 0
  });

  useEffect(() => {
    fetchMyPersonnel();
  }, [fetchMyPersonnel]);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Şifreler uyuşmuyor.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    const result = await changePassword(newPassword);
    if (result.success) {
      toast.success('Şifreniz başarıyla güncellendi.');
      setIsPasswordModalOpen(false);
    } else {
      toast.error(result.message);
    }
  };

  if (!currentPersonnel) return <div className="p-8">Yükleniyor...</div>;
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await submitLeaveRequest(leaveData);
    if (result.success) {
      toast.success(result.message);
      setIsLeaveDialogOpen(false);
    } else {
      toast.error(result.message);
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await submitExpenseRequest(expenseData);
    if (result.success) {
      toast.success(result.message);
      setIsExpenseDialogOpen(false);
    } else {
      toast.error(result.message);
    }
  };

  const handlePointageSubmit = async () => {
    const result = await submitPointage(pointageForm);
    if (result.success) {
      toast.success(result.message);
      setIsPointageDialogOpen(false);
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Merhaba, {currentPersonnel.first_name}!</h2>
          <p className="text-muted-foreground">
            Bugün neler yapmak istersin?
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Bell className="mr-2 h-4 w-4" />
            Duyurular
          </Button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kalan Yıllık İzin</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentPersonnel.annual_leave_days} Gün</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bu Ayki Puantaj</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">22 / 30 Gün</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bekleyen Talepler</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Son Maaş</CardTitle>
            {/* Currency placeholder */}
            <span className="text-muted-foreground text-xs">₺</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentPersonnel.salary?.toLocaleString('tr-TR')}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>İzin Taleplerim</CardTitle>
                <CardDescription>Son izin başvurularınızın durumu.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsLeaveDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                İzin İste
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Dummy data for now */}
              <div className="flex items-center justify-between border-b pb-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Yıllık İzin</p>
                  <p className="text-xs text-muted-foreground">15 Nisan - 20 Nisan (5 Gün)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                    Beklemede
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between border-b pb-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Rapor</p>
                  <p className="text-xs text-muted-foreground">2 Mart - 3 Mart (2 Gün)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    Onaylandı
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Hızlı İşlemler</CardTitle>
            <CardDescription>Dosya yükle veya talepte bulun.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-start" onClick={() => toast.info('Evrak yükleme özelliği yakında eklenecek.')}>
              <Upload className="mr-2 h-4 w-4" />
              Evrak Yükle (Özlük)
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => setIsExpenseDialogOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Avans / Masraf Talebi
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => setIsPointageDialogOpen(true)}>
              <Clock className="mr-2 h-4 w-4" />
              Puantaj Girişi Yap
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Announcements */}
      <Card>
        <CardHeader>
          <CardTitle>Duyurular</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-blue-50/50">
              <h4 className="font-semibold text-blue-900">Ramazan Bayramı Tatili</h4>
              <p className="text-sm text-blue-800 mt-1">Bayram tatili 9 Nisan - 12 Nisan tarihleri arasındadır.</p>
              <p className="text-xs text-blue-600 mt-2">22 Mart 2026</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Force Password Change Dialog */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Şifre Belirleme</DialogTitle>
            <CardDescription>
              İlk girişiniz olduğu için lütfen yeni bir şifre belirleyin.
            </CardDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">Yeni Şifre</Label>
              <Input 
                id="new-password" 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Şifre Tekrar</Label>
              <Input 
                id="confirm-password" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handlePasswordChange}>Şifreyi Güncelle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Request Dialog */}
      <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>İzin Talebi Oluştur</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLeaveSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="leave-type">İzin Türü</Label>
              <select 
                id="leave-type"
                className="w-full p-2 border rounded-md"
                value={leaveData.type}
                onChange={(e) => setLeaveData({...leaveData, type: e.target.value as any})}
              >
                <option value="Annual">Yıllık İzin</option>
                <option value="Unpaid">Ücretsiz İzin</option>
                <option value="Maternity">Doğum İzni</option>
                <option value="Sickness">Hastalık / Rapor</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Başlangıç</Label>
                <Input id="start-date" type="date" value={leaveData.start_date} onChange={(e) => setLeaveData({...leaveData, start_date: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">Bitiş</Label>
                <Input id="end-date" type="date" value={leaveData.end_date} onChange={(e) => setLeaveData({...leaveData, end_date: e.target.value})} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Açıklama</Label>
              <Input id="desc" value={leaveData.description} onChange={(e) => setLeaveData({...leaveData, description: e.target.value})} />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">Talep Gönder</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Expense Request Dialog */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avans / Masraf Talebi</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleExpenseSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="exp-type">Tür</Label>
              <select 
                id="exp-type"
                className="w-full p-2 border rounded-md"
                value={expenseData.type}
                onChange={(e) => setExpenseData({...expenseData, type: e.target.value as any})}
              >
                <option value="Expense">Masraf (Harcama)</option>
                <option value="Advance">Avans (Önden Ödeme)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-amount">Tutar</Label>
                <Input id="exp-amount" type="number" value={expenseData.amount} onChange={(e) => setExpenseData({...expenseData, amount: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-date">Tarih</Label>
                <Input id="exp-date" type="date" value={expenseData.date} onChange={(e) => setExpenseData({...expenseData, date: e.target.value})} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-desc">Açıklama</Label>
              <Input id="exp-desc" value={expenseData.description} onChange={(e) => setExpenseData({...expenseData, description: e.target.value})} />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">Talep Gönder</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPointageDialogOpen} onOpenChange={setIsPointageDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Puantaj Girişi Yap</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pt-date" className="text-right">Tarih</Label>
              <Input
                id="pt-date"
                type="date"
                className="col-span-3"
                value={pointageForm.date}
                onChange={(e) => setPointageForm({ ...pointageForm, date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pt-status" className="text-right">Durum</Label>
              <select
                id="pt-status"
                className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={pointageForm.status}
                onChange={(e) => setPointageForm({ ...pointageForm, status: e.target.value })}
              >
                <option value="Work">Çalıştı</option>
                <option value="Weekend">Hafta Sonu</option>
                <option value="Holiday">Resmi Tatil</option>
                <option value="Annual Leave">Yıllık İzin</option>
                <option value="Unpaid Leave">Ücretsiz İzin</option>
                <option value="Sickness">Raporlu</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pt-mesai" className="text-right">Mesai (Saat)</Label>
              <Input
                id="pt-mesai"
                type="number"
                step="0.5"
                min="0"
                className="col-span-3"
                value={pointageForm.overtime_hours}
                onChange={(e) => setPointageForm({ ...pointageForm, overtime_hours: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPointageDialogOpen(false)}>İptal</Button>
            <Button onClick={handlePointageSubmit}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
