import { Sidebar } from './Sidebar';
import { SatisFaturaDrawer } from './SatisFaturaDrawer';
import { AlisFaturaDrawer } from './AlisFaturaDrawer';
import { CariDrawer } from './CariDrawer';
import { CariEkstreDrawer } from './CariEkstreDrawer';
import { CekSenetDrawer } from './CekSenetDrawer';
import { BankaDrawer } from './BankaDrawer';
import { BildirimWidget } from './BildirimWidget';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Ana İçerik */}
      <main className="flex-1 flex flex-col min-h-screen overflow-auto">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Fatura ve Vergi Yönetim Sistemi</h2>
              <p className="text-sm text-slate-500">Satış, alış ve vergi takibi</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                v2.0.0
              </span>
            </div>
          </div>
        </header>
        
        {/* İçerik Alanı */}
        <div className="flex-1 p-6">
          {children}
        </div>
      </main>

      {/* Drawers */}
      <SatisFaturaDrawer />
      <AlisFaturaDrawer />
      <CariDrawer />
      <CariEkstreDrawer />
      <CekSenetDrawer />
      <BankaDrawer />
      <BildirimWidget />
    </div>
  );
}
