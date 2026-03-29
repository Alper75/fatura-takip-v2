import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  FileText, 
  Bell, 
  Clock, 
  AlertCircle,
  CheckCircle2
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function PersonelDashboard() {
  const { 
    user, 
    currentPersonnel, 
    fetchMyPersonnel, 
    changePassword, 
    submitLeaveRequest, 
    submitExpenseRequest, 
    submitPointage,
    leaves,
    fetchLeaves,
    pointages,
    fetchPointages,
    requests,
    fetchRequests
  } = useApp();

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
    fetchLeaves();
    fetchPointages();
    fetchRequests();
  }, [fetchMyPersonnel, fetchLeaves, fetchPointages, fetchRequests]);

  const myLeaves = leaves.filter(l => l.personnel_id == currentPersonnel?.id);
  const myRequests = requests.filter(r => r.personnel_id == currentPersonnel?.id);
  const myPointagesThisMonth = pointages.filter(p => {
    if (p.personnel_id != currentPersonnel?.id) return false;
    const pDate = new Date(p.date);
    const now = new Date();
    return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
  });

  const pendingCount = myLeaves.filter(l => l.status === 'PENDING').length + 
                       myRequests.filter(r => r.status === 'PENDING').length;

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

  if (!currentPersonnel) return <div className="p-8 text-center">Yükleniyor...</div>;

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
      toast.success(result.message || 'Puantaj kaydedildi.');
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
          <p className="text-muted-foreground">Bugün neler yapmak istersin?</p>
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
            <div className="text-2xl font-bold">{myPointagesThisMonth.filter(p => p.status === 'Work').length} Gün</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bekleyen Talepler</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onaylanan Talepler</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {myLeaves.filter(l => l.status === 'APPROVED').length + myRequests.filter(r => r.status === 'APPROVED').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Son Taleplerim</CardTitle>
                <CardDescription>Başvurularınızın güncel durumunu buradan takip edebilirsiniz.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setIsLeaveDialogOpen(true)} variant="outline">İzin İste</Button>
                <Button size="sm" onClick={() => setIsExpenseDialogOpen(true)}>Masraf İste</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...myLeaves, ...myRequests].sort((a, b) => b.id - a.id).slice(0, 5).map(item => (
                <div key={`${'type' in item ? 'req' : 'leave'}-${item.id}`} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {'amount' in item ? `${item.amount} ₺ - Masraf/Avans` : `${item.type} İzni`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {'date' in item ? item.date : `${item.start_date} - ${item.end_date}`}
                    </p>
                  </div>
                  <Badge variant="outline" className={
                    item.status === 'APPROVED' ? 'bg-green-100 text-green-800 border-green-200' :
                    item.status === 'REJECTED' ? 'bg-red-100 text-red-800 border-red-200' : 
                    'bg-yellow-100 text-yellow-800 border-yellow-200'
                  }>
                    {item.status === 'PENDING' ? 'Beklemede' : item.status === 'APPROVED' ? 'Onaylandı' : 'Reddedildi'}
                  </Badge>
                </div>
              ))}
              {[...myLeaves, ...myRequests].length === 0 && (
                <p className="text-center py-4 text-sm text-muted-foreground italic">Henüz bir talebiniz bulunmuyor.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Hızlı İşlemler</CardTitle>
            <CardDescription>Sık kullanılan işlemler.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {currentPersonnel.puantaj_menu_active ? (
              <Button variant="outline" className="justify-start px-4 h-11 border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50" onClick={() => setIsPointageDialogOpen(true)}>
                <Clock className="mr-2 h-4 w-4 text-indigo-600" />
                Günlük Puantaj Girişi
              </Button>
            ) : null}
            <Button variant="outline" className="justify-start px-4 h-11" onClick={() => setIsExpenseDialogOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Masraf / Avans Bildir
            </Button>
            <Button variant="outline" className="justify-start px-4 h-11" onClick={() => setIsLeaveDialogOpen(true)}>
              <Calendar className="mr-2 h-4 w-4" />
              İzin Talebi Oluştur
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Onaylanan Taleplerim</CardTitle>
          <CardDescription>Yönetici tarafından onaylanmış tüm taleplerinizin özeti.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                Onaylı İzinler
              </h4>
              <div className="space-y-2">
                {myLeaves.filter(l => l.status === 'APPROVED').length > 0 ? (
                  myLeaves.filter(l => l.status === 'APPROVED').slice(0, 3).map(l => (
                    <div key={l.id} className="text-sm p-3 bg-green-50/30 rounded-lg border border-green-100 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="font-medium">{l.type} İzni</span>
                        <span className="text-xs text-muted-foreground">{l.start_date} - {l.end_date}</span>
                      </div>
                      <Badge className="bg-green-600">Onaylı</Badge>
                    </div>
                  ))
                ) : <p className="text-xs text-muted-foreground italic">Onaylı izin bulunamadı.</p>}
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                Onaylı Masraflar / Avanslar
              </h4>
              <div className="space-y-2">
                {myRequests.filter(r => r.status === 'APPROVED').length > 0 ? (
                  myRequests.filter(r => r.status === 'APPROVED').slice(0, 3).map(r => (
                    <div key={r.id} className="text-sm p-3 bg-green-50/30 rounded-lg border border-green-100 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">{r.amount} ₺</span>
                        <span className="text-xs text-muted-foreground">{r.type} - {r.date}</span>
                      </div>
                      <Badge className="bg-green-600">Onaylı</Badge>
                    </div>
                  ))
                ) : <p className="text-xs text-muted-foreground italic">Onaylı masraf bulunamadı.</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <CardDescription>İlk girişiniz olduğu için lütfen yeni bir şifre belirleyin.</CardDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">Yeni Şifre</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Şifre Tekrar</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
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

      {/* Pointage Entry Dialog */}
      <Dialog open={isPointageDialogOpen} onOpenChange={setIsPointageDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Puantaj Girişi Yap</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pt-date" className="text-right">Tarih</Label>
              <Input id="pt-date" type="date" className="col-span-3" value={pointageForm.date} onChange={(e) => setPointageForm({ ...pointageForm, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pt-status" className="text-right">Durum</Label>
              <select id="pt-status" className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={pointageForm.status} onChange={(e) => setPointageForm({ ...pointageForm, status: e.target.value })}>
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
              <Input id="pt-mesai" type="number" step="0.5" min="0" className="col-span-3" value={pointageForm.overtime_hours} onChange={(e) => setPointageForm({ ...pointageForm, overtime_hours: parseFloat(e.target.value) || 0 })} />
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
