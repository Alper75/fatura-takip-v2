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
  Landmark
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { user, currentPersonnel, currentView, setCurrentView, openSatisDrawer, openAlisDrawer, logout } = useApp();

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      onClick: () => setCurrentView(user?.role === 'admin' ? 'dashboard' : 'personel-dashboard'),
      view: user?.role === 'admin' ? 'dashboard' : 'personel-dashboard'
    },
    {
      id: 'satis-giris',
      label: 'Satış Faturası Giriş',
      icon: FilePlus,
      onClick: () => openSatisDrawer(),
      view: null
    },
    {
      id: 'satis-liste',
      label: 'Satış Fatura Listesi',
      icon: Receipt,
      onClick: () => setCurrentView('satis-liste'),
      view: 'satis-liste'
    },
    {
      id: 'alis-giris',
      label: 'Alış Faturası Giriş',
      icon: ShoppingCart,
      onClick: () => openAlisDrawer(),
      view: null
    },
    {
      id: 'alis-liste',
      label: 'Alış Fatura Listesi',
      icon: Receipt,
      onClick: () => setCurrentView('alis-liste'),
      view: 'alis-liste'
    },
    {
      id: 'vergi-raporu',
      label: 'Vergi Raporu',
      icon: Calculator,
      onClick: () => setCurrentView('vergi-raporu'),
      view: 'vergi-raporu'
    },
    {
      id: 'cari-liste',
      label: 'Cari Kartlar',
      icon: Users,
      onClick: () => setCurrentView('cari-liste'),
      view: 'cari-liste'
    },
    {
      id: 'cek-senet-liste',
      label: 'Çek / Senet',
      icon: CreditCard,
      onClick: () => setCurrentView('cek-senet-liste'),
      view: 'cek-senet-liste'
    },
    {
      id: 'banka-liste',
      label: 'Banka Hesapları',
      icon: Landmark,
      onClick: () => setCurrentView('banka-liste'),
      view: 'banka-liste'
    },
    {
      id: 'banka-ekstre-liste',
      label: 'Banka Ekstresi',
      icon: FileText,
      onClick: () => setCurrentView('banka-ekstre-liste'),
      view: 'banka-ekstre-liste'
    },
    {
      id: 'expense-liste',
      label: 'Genel Giderler',
      icon: Receipt,
      onClick: () => setCurrentView('expense-liste'),
      view: 'expense-liste'
    },
    {
      id: 'kesilecek-fatura-liste',
      label: 'Kesilecek Faturalar',
      icon: FilePlus,
      onClick: () => setCurrentView('kesilecek-fatura-liste'),
      view: 'kesilecek-fatura-liste'
    },
    {
      id: 'personel-liste',
      label: 'Personel Yönetimi',
      icon: Users,
      onClick: () => setCurrentView('personel-liste'),
      view: 'personel-liste',
      adminOnly: true
    }
  ].filter(item => !item.adminOnly || user?.role === 'admin');

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
        </ul>
      </nav>

      {/* Alt Bilgi */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 mb-4 px-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-medium text-primary uppercase">
              {user?.role === 'admin' ? 'A' : (currentPersonnel?.first_name?.[0] || 'P')}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user?.role === 'admin' ? 'Admin Kullanıcı' : `${currentPersonnel?.first_name} ${currentPersonnel?.last_name}`}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {user?.role === 'admin' ? 'Yönetici' : currentPersonnel?.position || 'Personel'}
            </p>
          </div>
        </div>
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
