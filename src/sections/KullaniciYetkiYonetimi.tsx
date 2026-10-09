import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  KeyRound, 
  Trash2, 
  Edit3, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  Sparkles,
  Building,
  RotateCcw,
  ShieldAlert,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { User, UserRole, UserPermissions } from '@/types';

// Pre-defined role configurations
const ROLE_CONFIGS: Record<UserRole, { label: string; color: string; desc: string }> = {
  super_admin: { label: 'Süper Admin', color: 'bg-purple-100 text-purple-800 border-purple-200', desc: 'Tam sistem yöneticisi' },
  admin: { label: 'Şirket Yöneticisi', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', desc: 'Tüm şirket modülleri ve kullanıcı yönetimi' },
  muhasebe: { label: 'Muhasebe & Finans', color: 'bg-blue-100 text-blue-800 border-blue-200', desc: 'Faturalar, bankalar, cariler, vergi ve Luca' },
  satis: { label: 'Satış / Ön Muhasebe', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', desc: 'Satış faturaları, teklifler, siparişler ve cariler' },
  depo: { label: 'Depo Sorumlusu', color: 'bg-amber-100 text-amber-800 border-amber-200', desc: 'Stok hareketleri, depolar ve kritik stoklar' },
  personnel: { label: 'Personel', color: 'bg-slate-100 text-slate-800 border-slate-200', desc: 'Yalnızca kendi izin ve masraf talepleri' },
  custom: { label: 'Özel Yetkili', color: 'bg-rose-100 text-rose-800 border-rose-200', desc: 'Özel tanımlanmış modül izinleri' }
};

const PERMISSION_MODULES: { key: keyof UserPermissions; label: string; desc: string }[] = [
  { key: 'satisFaturalari', label: 'Satış Faturaları & GİB', desc: 'Satış faturaları, kesilecek faturalar ve tahsilat' },
  { key: 'alisFaturalari', label: 'Alış Faturaları & XML', desc: 'Gelen alış faturaları ve toplu XML aktarımı' },
  { key: 'teklifSiparis', label: 'Teklif & Sipariş', desc: 'Teklifler, sipariş fişleri ve müşteri onayları' },
  { key: 'cariler', label: 'Cari Kartlar & Mutabakat', desc: 'Müşteri/Tedarikçi carileri ve BA-BS mutabakatları' },
  { key: 'bankaFinans', label: 'Banka, Masraf & Çek/Senet', desc: 'Banka ekstreleri, banka hesapları ve çekler' },
  { key: 'nakitAkisi', label: 'Nakit Akışı & Vade Takvimi', desc: 'Vade takvimi ve nakit projeksiyon raporları' },
  { key: 'stokYonetimi', label: 'Stok & Depo Yönetimi', desc: 'Ürün kartları, depolar, hareketler ve kritik stok' },
  { key: 'muhasebeLuca', label: 'Luca & Muhasebe Entegrasyonu', desc: 'Luca fatura aktarımı, fişler ve vergi raporu' },
  { key: 'entegrator', label: 'e-Fatura Entegratörleri', desc: 'eLogo ve Uyumsoft servisleri ile otomatik tarama' },
  { key: 'personelIK', label: 'Personel & İnsan Kaynakları', desc: 'Personel listesi, izinler ve puantaj cetveli' },
  { key: 'kullaniciYonetimi', label: 'Kullanıcı & Rol Yönetimi', desc: 'Kullanıcı ekleme, yetkilendirme ve roller' }
];

const DEFAULT_ROLE_PERMS: Record<UserRole, UserPermissions> = {
  super_admin: {
    satisFaturalari: true, alisFaturalari: true, teklifSiparis: true,
    cariler: true, bankaFinans: true, nakitAkisi: true,
    stokYonetimi: true, muhasebeLuca: true, entegrator: true,
    personelIK: true, kullaniciYonetimi: true
  },
  admin: {
    satisFaturalari: true, alisFaturalari: true, teklifSiparis: true,
    cariler: true, bankaFinans: true, nakitAkisi: true,
    stokYonetimi: true, muhasebeLuca: true, entegrator: true,
    personelIK: true, kullaniciYonetimi: true
  },
  muhasebe: {
    satisFaturalari: true, alisFaturalari: true, teklifSiparis: false,
    cariler: true, bankaFinans: true, nakitAkisi: true,
    stokYonetimi: true, muhasebeLuca: true, entegrator: true,
    personelIK: false, kullaniciYonetimi: false
  },
  satis: {
    satisFaturalari: true, alisFaturalari: false, teklifSiparis: true,
    cariler: true, bankaFinans: false, nakitAkisi: false,
    stokYonetimi: true, muhasebeLuca: false, entegrator: false,
    personelIK: false, kullaniciYonetimi: false
  },
  depo: {
    satisFaturalari: false, alisFaturalari: false, teklifSiparis: false,
    cariler: false, bankaFinans: false, nakitAkisi: false,
    stokYonetimi: true, muhasebeLuca: false, entegrator: false,
    personelIK: false, kullaniciYonetimi: false
  },
  personnel: {
    satisFaturalari: false, alisFaturalari: false, teklifSiparis: false,
    cariler: false, bankaFinans: false, nakitAkisi: false,
    stokYonetimi: false, muhasebeLuca: false, entegrator: false,
    personelIK: false, kullaniciYonetimi: false
  },
  custom: {
    satisFaturalari: false, alisFaturalari: false, teklifSiparis: false,
    cariler: false, bankaFinans: false, nakitAkisi: false,
    stokYonetimi: false, muhasebeLuca: false, entegrator: false,
    personelIK: false, kullaniciYonetimi: false
  }
};

export default function KullaniciYetkiYonetimi() {
  const { 
    user: currentUser, 
    companyUsers, 
    fetchCompanyUsers, 
    addCompanyUser, 
    updateCompanyUser, 
    deleteCompanyUser, 
    resetUserPassword 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  
  // Dialog States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form States
  const [formData, setFormData] = useState({
    tc: '',
    name: '',
    email: '',
    password: '',
    role: 'muhasebe' as UserRole,
    permissions: { ...DEFAULT_ROLE_PERMS.muhasebe } as UserPermissions,
    status: 'active' as 'active' | 'passive'
  });

  const [newPasswordValue, setNewPasswordValue] = useState('123456');

  useEffect(() => {
    fetchCompanyUsers();
  }, [fetchCompanyUsers]);

  // Role summary metrics
  const stats = useMemo(() => {
    const total = companyUsers.length;
    let admins = 0;
    let muhasebe = 0;
    let satis = 0;
    let depo = 0;
    let personnel = 0;

    companyUsers.forEach(u => {
      if (u.role === 'admin' || u.role === 'super_admin') admins++;
      else if (u.role === 'muhasebe') muhasebe++;
      else if (u.role === 'satis') satis++;
      else if (u.role === 'depo') depo++;
      else personnel++;
    });

    return { total, admins, muhasebe, satis, depo, personnel };
  }, [companyUsers]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return companyUsers.filter(u => {
      const matchSearch = 
        (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.tc || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchRole = selectedRoleFilter === 'all' || u.role === selectedRoleFilter;
      return matchSearch && matchRole;
    });
  }, [companyUsers, searchTerm, selectedRoleFilter]);

  // Open Edit Modal with user data
  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    const resolvedPerms = user.permissions || DEFAULT_ROLE_PERMS[user.role] || DEFAULT_ROLE_PERMS.personnel;
    setFormData({
      tc: user.tc,
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role,
      permissions: { ...resolvedPerms },
      status: user.status || 'active'
    });
    setIsEditModalOpen(true);
  };

  // Open Reset Modal
  const handleOpenReset = (user: User) => {
    setSelectedUser(user);
    setNewPasswordValue('123456');
    setIsResetModalOpen(true);
  };

  // Handle Role Change in Form (auto-populate default permissions)
  const handleRoleSelectChange = (newRole: UserRole) => {
    setFormData(prev => ({
      ...prev,
      role: newRole,
      permissions: { ...(DEFAULT_ROLE_PERMS[newRole] || DEFAULT_ROLE_PERMS.personnel) }
    }));
  };

  // Toggle single permission switch
  const handleTogglePermission = (permKey: keyof UserPermissions) => {
    setFormData(prev => {
      const updated = {
        ...prev.permissions,
        [permKey]: !prev.permissions[permKey]
      };
      return {
        ...prev,
        role: prev.role === 'admin' ? 'admin' : 'custom',
        permissions: updated
      };
    });
  };

  // Submit Add
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tc || !formData.password) {
      toast.error('Kullanıcı adı/TC ve şifre zorunludur.');
      return;
    }

    const res = await addCompanyUser({
      tc: formData.tc,
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      permissions: formData.permissions
    });

    if (res.success) {
      setIsAddModalOpen(false);
      setFormData({
        tc: '',
        name: '',
        email: '',
        password: '',
        role: 'muhasebe',
        permissions: { ...DEFAULT_ROLE_PERMS.muhasebe },
        status: 'active'
      });
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedUser.id) return;

    const res = await updateCompanyUser(selectedUser.id, {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      permissions: formData.permissions,
      status: formData.status
    });

    if (res.success) {
      setIsEditModalOpen(false);
      setSelectedUser(null);
    }
  };

  // Submit Reset
  const handleResetSubmit = async () => {
    if (!selectedUser || !selectedUser.id) return;
    const res = await resetUserPassword(selectedUser.id, newPasswordValue);
    if (res.success) {
      setIsResetModalOpen(false);
      setSelectedUser(null);
    }
  };

  // Delete User
  const handleDeleteUser = async (user: User) => {
    if (!user.id) return;
    if (confirm(`"${user.name || user.tc}" adlı kullanıcıyı silmek istediğinize emin misiniz?`)) {
      await deleteCompanyUser(user.id);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-indigo-600" />
            Kullanıcı Rolleri & Yetkilendirme (RBAC)
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            Şirket çalışanlarınızın ve ön muhasebe ekibinizin sistemdeki modül erişimlerini güvenle yönetin.
          </p>
        </div>

        <Button
          onClick={() => {
            setFormData({
              tc: '',
              name: '',
              email: '',
              password: '',
              role: 'muhasebe',
              permissions: { ...DEFAULT_ROLE_PERMS.muhasebe },
              status: 'active'
            });
            setIsAddModalOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100"
        >
          <UserPlus className="w-4 h-4 mr-2" /> Yeni Kullanıcı Ekle
        </Button>
      </div>

      {/* Role Summary Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-slate-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Toplam Kullanıcı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-800">{stats.total}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Sistemdeki tüm hesaplar</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-indigo-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-indigo-700">Yöneticiler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-indigo-900">{stats.admins}</div>
            <p className="text-[11px] text-indigo-600 mt-0.5">Tam şirket yetkisi</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-700">Muhasebe & Finans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-blue-900">{stats.muhasebe}</div>
            <p className="text-[11px] text-blue-600 mt-0.5">Fatura, banka, vergi</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-700">Satış & Ön Muhasebe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-900">{stats.satis}</div>
            <p className="text-[11px] text-emerald-600 mt-0.5">Satış, teklif, sipariş</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-700">Depo & Personel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-900">{stats.depo + stats.personnel}</div>
            <p className="text-[11px] text-amber-600 mt-0.5">Stok veya self-servis</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="İsim, TC no veya e-posta ile ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 rounded-xl border-slate-200"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedRoleFilter} onValueChange={setSelectedRoleFilter}>
            <SelectTrigger className="w-[180px] rounded-xl border-slate-200 text-xs font-semibold">
              <SelectValue placeholder="Rol Filtresi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Roller</SelectItem>
              <SelectItem value="admin">Yöneticiler</SelectItem>
              <SelectItem value="muhasebe">Muhasebe</SelectItem>
              <SelectItem value="satis">Satış</SelectItem>
              <SelectItem value="depo">Depo</SelectItem>
              <SelectItem value="personnel">Personel</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchCompanyUsers()}
            className="rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Yenile
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Kullanıcı Bilgisi</th>
                <th className="py-3.5 px-4">Rol</th>
                <th className="py-3.5 px-4">Durum</th>
                <th className="py-3.5 px-4">Aktif Modül Yetkileri</th>
                <th className="py-3.5 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                    Kayıtlı kullanıcı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleConfig = ROLE_CONFIGS[u.role] || ROLE_CONFIGS.personnel;
                  const perms = u.permissions || DEFAULT_ROLE_PERMS[u.role] || {};
                  const activePermKeys = Object.keys(perms).filter(k => perms[k] === true);
                  const isCurrent = currentUser?.id === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                            {(u.name?.[0] || u.tc?.[0] || 'U').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-2">
                              <span>{u.name || u.tc}</span>
                              {isCurrent && (
                                <span className="bg-indigo-50 text-indigo-700 text-[10px] px-2 py-0.2 rounded-full font-bold border border-indigo-200">
                                  Siz
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>TC: {u.tc}</span>
                              {u.email && <span>• {u.email}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge className={`${roleConfig.color} border font-bold text-xs px-2.5 py-0.5 rounded-lg`}>
                          {roleConfig.label}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4">
                        {u.status === 'passive' ? (
                          <Badge variant="outline" className="text-rose-600 bg-rose-50 border-rose-200 text-xs">
                            Pasif
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-xs">
                            Aktif
                          </Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-md">
                        {u.role === 'admin' || u.role === 'super_admin' ? (
                          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                            Tüm modüllere tam erişim
                          </span>
                        ) : activePermKeys.length === 0 ? (
                          <span className="text-xs text-slate-400">Yalnızca personel self-servis paneli</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {activePermKeys.slice(0, 4).map(key => {
                              const module = PERMISSION_MODULES.find(m => m.key === key);
                              return (
                                <span key={key} className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/60">
                                  {module?.label || key}
                                </span>
                              );
                            })}
                            {activePermKeys.length > 4 && (
                              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                +{activePermKeys.length - 4} modül
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(u)}
                            className="rounded-lg text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1" /> Yetkiler
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenReset(u)}
                            title="Şifreyi Sıfırla"
                            className="rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>

                          {!isCurrent && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteUser(u)}
                              title="Kullanıcıyı Sil"
                              className="rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD USER MODAL */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              Yeni Kullanıcı ve Rol Tanımla
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="space-y-5 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">TC Kimlik No / Kullanıcı Adı *</Label>
                <Input
                  required
                  placeholder="Örn: 12345678901 veya ahmet_muhasebe"
                  value={formData.tc}
                  onChange={(e) => setFormData(p => ({ ...p, tc: e.target.value }))}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Ad Soyad</Label>
                <Input
                  placeholder="Örn: Ahmet Yılmaz"
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">E-Posta Adresi</Label>
                <Input
                  type="email"
                  placeholder="ahmet@sirket.com"
                  value={formData.email}
                  onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Giriş Şifresi *</Label>
                <Input
                  type="password"
                  required
                  placeholder="En az 6 karakter"
                  value={formData.password}
                  onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Label className="text-xs font-bold text-slate-700">Kullanıcı Rolü</Label>
              <Select 
                value={formData.role} 
                onValueChange={(val) => handleRoleSelectChange(val as UserRole)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Rol Seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Şirket Yöneticisi (Tüm modüller)</SelectItem>
                  <SelectItem value="muhasebe">Muhasebe & Finans (Fatura, Banka, Luca, Vergi)</SelectItem>
                  <SelectItem value="satis">Satış / Ön Muhasebe (Satış faturaları, Teklifler, Cariler)</SelectItem>
                  <SelectItem value="depo">Depo Sorumlusu (Stok ve depolar)</SelectItem>
                  <SelectItem value="personnel">Personel (Sadece personel paneli)</SelectItem>
                  <SelectItem value="custom">Özel Yetkili (Aşağıdan elle seçilecek)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Permissions Matrix */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-800">Modül Yetkilendirme Matrisi</h4>
                  <p className="text-xs text-slate-400">Rolün varsayılan izinlerini inceleyin veya özelleştirin.</p>
                </div>
                {formData.role === 'admin' && (
                  <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">Yönetici: Tam Yetki</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
                {PERMISSION_MODULES.map(m => {
                  const isChecked = formData.role === 'admin' ? true : !!formData.permissions[m.key];

                  return (
                    <div 
                      key={m.key} 
                      className={`flex items-center justify-between p-2.5 rounded-xl border bg-white transition-all ${
                        isChecked ? 'border-indigo-200 shadow-sm' : 'border-slate-200/80 opacity-70'
                      }`}
                    >
                      <div className="flex-1 pr-2">
                        <div className="text-xs font-bold text-slate-800">{m.label}</div>
                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{m.desc}</div>
                      </div>
                      <Switch 
                        disabled={formData.role === 'admin'}
                        checked={isChecked}
                        onCheckedChange={() => handleTogglePermission(m.key)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl">
                Vazgeç
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold">
                Kullanıcıyı Kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT USER MODAL */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
              <Edit3 className="w-5 h-5 text-indigo-600" />
              Kullanıcı Bilgileri & Yetkileri Düzenle
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-5 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">TC Kimlik No (Değiştirilemez)</Label>
                <Input
                  disabled
                  value={formData.tc}
                  className="rounded-xl bg-slate-100 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Ad Soyad</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">E-Posta Adresi</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Hesap Durumu</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(val: any) => setFormData(p => ({ ...p, status: val }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif (Giriş yapabilir)</SelectItem>
                    <SelectItem value="passive">Pasif (Giriş engellendi)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Label className="text-xs font-bold text-slate-700">Kullanıcı Rolü</Label>
              <Select 
                value={formData.role} 
                onValueChange={(val) => handleRoleSelectChange(val as UserRole)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Şirket Yöneticisi (Tüm modüller)</SelectItem>
                  <SelectItem value="muhasebe">Muhasebe & Finans (Fatura, Banka, Luca, Vergi)</SelectItem>
                  <SelectItem value="satis">Satış / Ön Muhasebe (Satış faturaları, Teklifler, Cariler)</SelectItem>
                  <SelectItem value="depo">Depo Sorumlusu (Stok ve depolar)</SelectItem>
                  <SelectItem value="personnel">Personel (Sadece personel paneli)</SelectItem>
                  <SelectItem value="custom">Özel Yetkili (Özelleştirilmiş izinler)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Permissions Matrix */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-800">Modül Yetkilendirme Matrisi</h4>
                  <p className="text-xs text-slate-400">İhtiyaca göre özel izinleri tek tek açıp kapatabilirsiniz.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
                {PERMISSION_MODULES.map(m => {
                  const isChecked = formData.role === 'admin' ? true : !!formData.permissions[m.key];

                  return (
                    <div 
                      key={m.key} 
                      className={`flex items-center justify-between p-2.5 rounded-xl border bg-white transition-all ${
                        isChecked ? 'border-indigo-200 shadow-sm' : 'border-slate-200/80 opacity-70'
                      }`}
                    >
                      <div className="flex-1 pr-2">
                        <div className="text-xs font-bold text-slate-800">{m.label}</div>
                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{m.desc}</div>
                      </div>
                      <Switch 
                        disabled={formData.role === 'admin'}
                        checked={isChecked}
                        onCheckedChange={() => handleTogglePermission(m.key)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} className="rounded-xl">
                Vazgeç
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold">
                Güncellemeleri Kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RESET PASSWORD MODAL */}
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <KeyRound className="w-5 h-5 text-amber-500" />
              Kullanıcı Şifresini Sıfırla
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-600">
              <span className="font-bold text-slate-800">{selectedUser?.name || selectedUser?.tc}</span> kullanıcısının şifresi sıfırlanacaktır.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Yeni Geçici Şifre</Label>
              <Input
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                className="rounded-xl font-mono text-center text-lg tracking-wider"
              />
              <p className="text-[11px] text-slate-400">
                Kullanıcı bu şifre ile ilk girişinde şifresini değiştirmek zorunda olacaktır.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetModalOpen(false)} className="rounded-xl">
              Vazgeç
            </Button>
            <Button onClick={handleResetSubmit} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold">
              Şifreyi Sıfırla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
