import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  FilePlus, 
  ShoppingCart, 
  Receipt, 
  Calculator,
  LogOut, 
  FileText,
  ChevronRight,
  Users,
  CreditCard,
  Landmark,
  ChevronDown,
  ChevronUp,
  Briefcase,
  ShieldCheck,
  Building2,
  Package
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import type { ViewType } from '@/types';

export function Sidebar() {
  const { user, currentPersonnel, currentView, setCurrentView, openSatisDrawer, openAlisDrawer, logout, companies } = useApp();
  const [isPersonnelOpen, setIsPersonnelOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isSuperAdmin = user?.role === 'super_admin';

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      onClick: () => setCurrentView(isSuperAdmin ? 'super-admin' : (isAdmin ? 'dashboard' : 'personel-dashboard')),
      view: isSuperAdmin ? 'super-admin' : (isAdmin ? 'dashboard' : 'personel-dashboard')
    },
    {
      id: 'super-admin',
      label: 'Süper Admin',
      icon: ShieldCheck,
      onClick: () => setCurrentView('super-admin'),
      view: 'super-admin',
      superAdminOnly: true
    },
    // Accounting Items (Admin Only)
    {
      id: 'satis-giris',
      label: 'Satış Faturası Giriş',
      icon: FilePlus,
      onClick: () => openSatisDrawer(),
      view: null,
      adminOnly: true
    },
    {
      id: 'satis-liste',
      label: 'Satış Fatura Listesi',
      icon: Receipt,
      onClick: () => setCurrentView('satis-liste'),
      view: 'satis-liste',
      adminOnly: true
    },
    {
      id: 'alis-giris',
      label: 'Alış Faturası Giriş',
      icon: ShoppingCart,
      onClick: () => openAlisDrawer(),
      view: null,
      adminOnly: true
    },
    {
      id: 'alis-liste',
      label: 'Alış Fatura Listesi',
      icon: Receipt,
      onClick: () => setCurrentView('alis-liste'),
      view: 'alis-liste',
      adminOnly: true
    },
    {
      id: 'vergi-raporu',
      label: 'Vergi Raporu',
      icon: Calculator,
      onClick: () => setCurrentView('vergi-raporu'),
      view: 'vergi-raporu',
      adminOnly: true
    },
    {
      id: 'cari-liste',
      label: 'Cari Kartlar',
      icon: Users,
      onClick: () => setCurrentView('cari-liste'),
      view: 'cari-liste',
      adminOnly: true
    },
    {
      id: 'cek-senet-liste',
      label: 'Çek / Senet',
      icon: CreditCard,
      onClick: () => setCurrentView('cek-senet-liste'),
      view: 'cek-senet-liste',
      adminOnly: true
    },
    {
      id: 'banka-liste',
      label: 'Banka Hesapları',
      icon: Landmark,
      onClick: () => setCurrentView('banka-liste'),
      view: 'banka-liste',
      adminOnly: true
    },
    {
      id: 'banka-ekstre-liste',
      label: 'Banka Ekstresi',
      icon: FileText,
      onClick: () => setCurrentView('banka-ekstre-liste'),
      view: 'banka-ekstre-liste',
      adminOnly: true
    },
    {
      id: 'expense-liste',
      label: 'Genel Giderler',
      icon: Receipt,
      onClick: () => setCurrentView('expense-liste'),
      view: 'expense-liste',
      adminOnly: true
    },
    {
      id: 'kesilecek-fatura-liste',
      label: 'Kesilecek Faturalar',
      icon: FilePlus,
      onClick: () => setCurrentView('kesilecek-fatura-liste'),
      view: 'kesilecek-fatura-liste',
      adminOnly: true
    },
    {
      id: 'stok-yonetimi',
      label: 'Stok Yönetimi',
      icon: Package,
      onClick: () => setCurrentView('stok-yonetimi'),
      view: 'stok-yonetimi',
      adminOnly: true
    }
  ].filter(item => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.adminOnly) return isAdmin || isSuperAdmin;
    return true;
  });

  const personnelSubItems: { id: string; label: string; view: ViewType }[] = (isAdmin || isSuperAdmin) ? [
    { id: 'personel-liste', label: 'Personel Listesi', view: 'personel-liste' },
    { id: 'izin-yonetimi', label: 'İzin Talepleri', view: 'izin-yonetimi' },
    { id: 'talep-yonetimi', label: 'Masraf Talepleri', view: 'talep-yonetimi' },
    { id: 'puantaj-cetveli', label: 'Puantaj Cetveli', view: 'puantaj-cetveli' }
  ] : [
    { id: 'personel-dashboard', label: 'Benim Dashboard', view: 'personel-dashboard' },
    { id: 'personel-izinlerim', label: 'İzinlerim', view: 'personel-izinlerim' },
    { id: 'personel-masraflarim', label: 'Masraflarım', view: 'personel-masraflarim' },
    ...(currentPersonnel?.puantaj_menu_active ? [{ id: 'kisisel-puantaj', label: 'Puantaj Cetvelim', view: 'kisisel-puantaj' as any }] : [])
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <FileText className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm">Fatura Sistemi</h1>
            <p className="text-xs text-slate-500">Vergi Yönetimi</p>
          </div>
        </div>
      </div>

      {/* Menü */}
      <nav className="flex-1 p-4 overflow-y-auto scrollbar-hide">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-3">
          Ana Menü
        </p>
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.view === currentView;
            
            return (
              <li key={item.id}>
                <Button
                  variant="ghost"
                  onClick={item.onClick}
                  className={cn(
                    "w-full justify-start gap-3 h-11 font-medium transition-all",
                    isActive 
                      ? "bg-primary/10 text-primary hover:bg-primary/15" 
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-slate-500")} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.view === null && (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </Button>
              </li>
            );
          })}

          {/* Personnel Collapsible Section */}
          {!isSuperAdmin && (
            <li>
              <Button
                variant="ghost"
                onClick={() => setIsPersonnelOpen(!isPersonnelOpen)}
                className={cn(
                  "w-full justify-start gap-3 h-11 font-medium transition-all",
                  isPersonnelOpen ? "text-slate-900" : "text-slate-600"
                )}
              >
                <Briefcase className="w-4 h-4 text-slate-500" />
                <span className="flex-1 text-left">Personel Modülü</span>
                {isPersonnelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
              {isPersonnelOpen && (
                <ul className="mt-1 ml-9 space-y-1">
                  {personnelSubItems.map((sub) => (
                    <li key={sub.id}>
                      <button
                        onClick={() => setCurrentView(sub.view)}
                        className={cn(
                          "w-full text-left py-2 px-3 text-sm rounded-md transition-all",
                          currentView === sub.view 
                            ? "bg-slate-100 text-primary font-semibold" 
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                        )}
                      >
                        {sub.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )}
        </ul>
      </nav>

      {/* Alt Bilgi */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 mb-4 px-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-medium text-primary uppercase">
              {isSuperAdmin ? 'SA' : (user?.role === 'admin' ? 'A' : (currentPersonnel?.first_name?.[0] || 'P'))}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {isSuperAdmin ? 'Süper Admin' : (user?.role === 'admin' ? 'Admin Kullanıcı' : `${currentPersonnel?.first_name} ${currentPersonnel?.last_name}`)}
            </p>
            <p className="text-[10px] text-slate-400 truncate uppercase tracking-tight">
              {isSuperAdmin ? 'Platform Sahibi' : (user?.role === 'admin' ? 'Şirket Yöneticisi' : currentPersonnel?.position || 'Personel')}
            </p>
          </div>
        </div>

        {/* Company Badge */}
        {!isSuperAdmin && (
          <div className="mx-3 mb-4 p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-600 truncate">
              {companies.find(c => c.id === user?.companyId)?.name || 'Aktif Şirket'}
            </span>
          </div>
        )}

        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
          onClick={logout}
        >
          <LogOut className="w-4 h-4" />
          Çıkış Yap
        </Button>
      </div>
    </aside>
  );
}
