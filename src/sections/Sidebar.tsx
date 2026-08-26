import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  FilePlus, 
  ShoppingCart, 
  Receipt, 
  Calculator,
  LogOut, 
  FileText,
  Users,
  CreditCard,
  Landmark,
  ChevronDown,
  ChevronUp,
  Briefcase,
  ShieldCheck,
  Building2,
  Package,
  FileSignature,
  ClipboardList,
  Download,
  BrainCircuit
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import type { ViewType } from '@/types';

interface SidebarProps {
  onItemClick?: () => void;
}

export function Sidebar({ onItemClick }: SidebarProps) {
  const { user, currentPersonnel, currentView, setCurrentView, openSatisDrawer, openAlisDrawer, logout, companies, openSirketBilgileri } = useApp();
  const [isPersonnelOpen, setIsPersonnelOpen] = useState(false);
  const [isEntegrasyonOpen, setIsEntegrasyonOpen] = useState(false);

  useEffect(() => {
    const personnelViews: ViewType[] = [
      'personel-liste', 'izin-yonetimi', 'talep-yonetimi', 
      'puantaj-cetveli', 'personel-dashboard', 'personel-izinlerim', 
      'personel-masraflarim', 'kisisel-puantaj'
    ];
    if (personnelViews.includes(currentView)) {
      setIsPersonnelOpen(true);
    }
    
    const entegrasyonViews: ViewType[] = [
      'gelen-efaturalar', 'gelen-uyumsoft-faturalar', 'entegrasyon-ayarlari'
    ];
    if (entegrasyonViews.includes(currentView)) {
      setIsEntegrasyonOpen(true);
    }
  }, [currentView]);

  const isAdmin = user?.role === 'admin';
  const isSuperAdmin = user?.role === 'super_admin';

  interface MenuItem {
    id: string;
    label: string;
    icon: any;
    onClick: () => void;
    view: ViewType | null;
    actionIcon?: any;
    onActionClick?: () => void;
    actionTitle?: string;
    adminOnly?: boolean;
    superAdminOnly?: boolean;
  }

  interface MenuGroup {
    title: string;
    items: MenuItem[];
  }

  const menuGroups: MenuGroup[] = [
    {
      title: 'Genel',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          onClick: () => setCurrentView(isSuperAdmin ? 'super-admin' : (isAdmin ? 'dashboard' : 'personel-dashboard')),
          view: isSuperAdmin ? 'super-admin' : (isAdmin ? 'dashboard' : 'personel-dashboard')
        },
        {
          id: 'super-admin',
          label: 'Süper Admin Paneli',
          icon: ShieldCheck,
          onClick: () => setCurrentView('super-admin'),
          view: 'super-admin',
          superAdminOnly: true
        }
      ]
    },
    {
      title: 'Fatura & Ticaret',
      items: [
        {
          id: 'kesilecek-fatura-liste',
          label: 'Kesilecek Faturalar (GİB)',
          icon: FileText,
          onClick: () => setCurrentView('kesilecek-fatura-liste'),
          view: 'kesilecek-fatura-liste',
          adminOnly: true
        },
        {
          id: 'satis-liste',
          label: 'Satış Faturaları',
          icon: Receipt,
          onClick: () => setCurrentView('satis-liste'),
          view: 'satis-liste',
          actionIcon: FilePlus,
          onActionClick: () => openSatisDrawer(),
          actionTitle: 'Yeni Satış Faturası Ekle',
          adminOnly: true
        },
        {
          id: 'alis-liste',
          label: 'Alış Faturaları',
          icon: ShoppingCart,
          onClick: () => setCurrentView('alis-liste'),
          view: 'alis-liste',
          actionIcon: FilePlus,
          onActionClick: () => openAlisDrawer(),
          actionTitle: 'Yeni Alış Faturası Ekle',
          adminOnly: true
        },
        {
          id: 'teklif-liste',
          label: 'Teklif Yönetimi',
          icon: FileSignature,
          onClick: () => setCurrentView('teklif-liste'),
          view: 'teklif-liste',
          adminOnly: true
        },
        {
          id: 'siparis-liste',
          label: 'Sipariş Yönetimi',
          icon: ClipboardList,
          onClick: () => setCurrentView('siparis-liste'),
          view: 'siparis-liste',
          adminOnly: true
        }
      ]
    },
    {
      title: 'Finans & Muhasebe',
      items: [
        {
          id: 'cari-liste',
          label: 'Cari Kartlar',
          icon: Users,
          onClick: () => setCurrentView('cari-liste'),
          view: 'cari-liste',
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
          label: 'Banka ve Masraflar',
          icon: CreditCard,
          onClick: () => setCurrentView('banka-ekstre-liste'),
          view: 'banka-ekstre-liste',
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
          id: 'mutabakat-yonetimi',
          label: 'Mutabakat Yönetimi',
          icon: FileSignature,
          onClick: () => setCurrentView('mutabakat-yonetimi'),
          view: 'mutabakat-yonetimi',
          adminOnly: true
        },
        {
          id: 'vergi-raporu',
          label: 'Vergi & KDV Raporu',
          icon: Calculator,
          onClick: () => setCurrentView('vergi-raporu'),
          view: 'vergi-raporu',
          adminOnly: true
        }
      ]
    },
    {
      title: 'Luca & Entegrasyon',
      items: [
        {
          id: 'fatura-aktarim',
          label: 'Luca Fatura Aktarım',
          icon: Receipt,
          onClick: () => setCurrentView('fatura-aktarim'),
          view: 'fatura-aktarim',
          adminOnly: true
        },
        {
          id: 'luca-ayarlari',
          label: 'Luca KDV Ayarları',
          icon: Calculator,
          onClick: () => setCurrentView('luca-ayarlari'),
          view: 'luca-ayarlari',
          adminOnly: true
        },
        {
          id: 'akilli-ogrenme',
          label: 'Akıllı Öğrenme (AI)',
          icon: BrainCircuit,
          onClick: () => setCurrentView('akilli-ogrenme' as any),
          view: 'akilli-ogrenme',
          adminOnly: true
        }
      ]
    },
    {
      title: 'Operasyon & Dosyalar',
      items: [
        {
          id: 'stok-yonetimi',
          label: 'Stok Yönetimi',
          icon: Package,
          onClick: () => setCurrentView('stok-yonetimi'),
          view: 'stok-yonetimi',
          adminOnly: true
        },
        {
          id: 'sirket-dosyalari',
          label: 'Şirket Dosyaları',
          icon: Briefcase,
          onClick: () => setCurrentView('sirket-dosyalari'),
          view: 'sirket-dosyalari',
          adminOnly: true
        }
      ]
    }
  ];

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
    <aside className="w-full bg-white flex flex-col h-full border-r border-slate-100">
      {/* Logo */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20">
            <FileText className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm tracking-tight">Fatura Takip v2</h1>
            <p className="text-[11px] text-slate-500 font-medium">Muhasebe & Vergi Portalı</p>
          </div>
        </div>
      </div>

      {/* Menü Grupları */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-4">
        {menuGroups.map((group, groupIdx) => {
          const filteredItems = group.items.filter(item => {
            if (item.superAdminOnly) return isSuperAdmin;
            if (item.adminOnly) return isAdmin || isSuperAdmin;
            return true;
          });

          if (filteredItems.length === 0) return null;

          return (
            <div key={groupIdx} className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.view === currentView;
                  
                  return (
                    <li key={item.id} className="relative group/item">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          item.onClick();
                          onItemClick?.();
                        }}
                        className={cn(
                          "w-full justify-start gap-2.5 h-9 px-3 font-medium text-xs rounded-lg transition-all",
                          isActive 
                            ? "bg-primary/10 text-primary font-semibold hover:bg-primary/15 shadow-sm" 
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}
                      >
                        <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-slate-400 group-hover/item:text-slate-700")} />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        
                        {item.actionIcon && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              item.onActionClick?.();
                              onItemClick?.();
                            }}
                            title={item.actionTitle}
                            className="p-1 rounded hover:bg-primary/20 text-primary hover:text-primary transition-all opacity-70 hover:opacity-100"
                          >
                            <item.actionIcon className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {/* Fatura Entegrasyonları (Açılır Menü) */}
        {(isAdmin || isSuperAdmin) && (
          <div className="space-y-1 pt-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
              Entegratör Servisleri
            </p>
            <Button
              variant="ghost"
              onClick={() => setIsEntegrasyonOpen(!isEntegrasyonOpen)}
              className={cn(
                "w-full justify-start gap-2.5 h-9 px-3 font-medium text-xs rounded-lg transition-all",
                isEntegrasyonOpen ? "text-slate-900 bg-slate-100/70" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Download className="w-4 h-4 shrink-0 text-slate-400" />
              <span className="flex-1 text-left truncate">e-Fatura Entegrasyonları</span>
              {isEntegrasyonOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </Button>
            {isEntegrasyonOpen && (
              <ul className="mt-1 ml-6 pl-2 border-l border-slate-200 space-y-0.5">
                {[
                  { id: 'gelen-efaturalar', label: 'eLogo Gelen Faturalar' },
                  { id: 'gelen-uyumsoft-faturalar', label: 'Uyumsoft Gelen Faturalar' },
                  { id: 'giden-elogo-faturalar', label: 'eLogo Giden Faturalar' },
                  { id: 'giden-uyumsoft-faturalar', label: 'Uyumsoft Giden Faturalar' },
                  { id: 'giden-uyumsoft-esmm', label: 'Uyumsoft Giden e-SMM' },
                  { id: 'entegrasyon-ayarlari', label: 'Entegrasyon Ayarları' }
                ].map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        setCurrentView(item.id as any);
                        onItemClick?.();
                      }}
                      className={cn(
                        "w-full text-left py-1.5 px-2.5 text-xs rounded-md transition-all",
                        currentView === item.id 
                          ? "bg-primary/10 text-primary font-semibold" 
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Personel Modülü (Açılır Menü) */}
        {!isSuperAdmin && (
          <div className="space-y-1 pt-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
              İnsan Kaynakları
            </p>
            <Button
              variant="ghost"
              onClick={() => setIsPersonnelOpen(!isPersonnelOpen)}
              className={cn(
                "w-full justify-start gap-2.5 h-9 px-3 font-medium text-xs rounded-lg transition-all",
                isPersonnelOpen ? "text-slate-900 bg-slate-100/70" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Briefcase className="w-4 h-4 shrink-0 text-slate-400" />
              <span className="flex-1 text-left truncate">Personel Modülü</span>
              {isPersonnelOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </Button>
            {isPersonnelOpen && (
              <ul className="mt-1 ml-6 pl-2 border-l border-slate-200 space-y-0.5">
                {personnelSubItems.map((sub) => (
                  <li key={sub.id}>
                    <button
                      onClick={() => {
                        setCurrentView(sub.view);
                        onItemClick?.();
                      }}
                      className={cn(
                        "w-full text-left py-1.5 px-2.5 text-xs rounded-md transition-all",
                        currentView === sub.view 
                          ? "bg-primary/10 text-primary font-semibold" 
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      {sub.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
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
          <div 
            className="mx-3 mb-4 p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-slate-100 hover:border-slate-200 transition-all group"
            onClick={() => {
              openSirketBilgileri();
              onItemClick?.();
            }}
          >
            <Building2 className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
            <div className="flex-1 min-w-0">
              <span className="block text-[11px] font-bold text-slate-700 truncate group-hover:text-primary transition-colors">
                {companies.find(c => Number(c.id) === Number(user?.companyId))?.name || (companies.length > 0 ? companies[0].name : 'Aktif Şirket')}
              </span>
              <span className="block text-[9px] text-slate-400">Şirket bilgilerini gör</span>
            </div>
          </div>
        )}

        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
          onClick={() => {
            logout();
            onItemClick?.();
          }}
        >
          <LogOut className="w-4 h-4" />
          Çıkış Yap
        </Button>
      </div>
    </aside>
  );
}
