import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { SatisFaturaDrawer } from './SatisFaturaDrawer';
import { AlisFaturaDrawer } from './AlisFaturaDrawer';
import { CariDrawer } from './CariDrawer';
import { CariEkstreDrawer } from './CariEkstreDrawer';
import { CekSenetDrawer } from './CekSenetDrawer';
import { BankaDrawer } from './BankaDrawer';
import { BildirimWidget } from './BildirimWidget';
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetTitle,
  SheetHeader,
  SheetDescription
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, FileText } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 border-r border-slate-200">
        <Sidebar />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-slate-900 text-sm">Fatura Takip</span>
        </div>
        
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 border-r-0 w-64">
            <SheetHeader className="sr-only">
              <SheetTitle>Yan Menü</SheetTitle>
              <SheetDescription>Uygulama Navigasyonu</SheetDescription>
            </SheetHeader>
            <Sidebar onItemClick={() => setIsMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Ana İçerik */}
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Desktop Header (Hidden on Mobile) */}
        <header className="hidden lg:block bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 transition-all">
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
        <div className="flex-1 p-3 sm:p-4 md:p-6 transition-all">
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
