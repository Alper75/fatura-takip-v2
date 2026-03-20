import { AppProvider, useApp } from '@/context/AppContext';
import { LoginPage } from '@/sections/LoginPage';
import { Layout } from '@/sections/Layout';
import { Dashboard } from '@/sections/Dashboard';
import { SatisFaturaListesi } from '@/sections/SatisFaturaListesi';
import { AlisFaturaListesi } from '@/sections/AlisFaturaListesi';
import { VergiRaporu } from './sections/VergiRaporu';
import { CariListe } from './sections/CariListe';
import { CekSenetListe } from './sections/CekSenetListe';
import { BankaListe } from './sections/BankaListe';
import { BankaEkstreListesi } from './sections/BankaEkstreListesi';
import { GenelGiderler } from './sections/GenelGiderler';
import { KesilecekFaturalar } from './sections/KesilecekFaturalar';
import { Toaster } from '@/components/ui/sonner';

function AppContent() {
  const { isAuthenticated, currentView } = useApp();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Layout>
      {(() => {
        switch (currentView) {
          case 'dashboard':
            return <Dashboard />;
          case 'satis-liste':
            return <SatisFaturaListesi />;
          case 'alis-liste':
            return <AlisFaturaListesi />;
          case 'vergi-raporu':
            return <VergiRaporu />;
          case 'cari-liste':
            return <CariListe />;
          case 'cek-senet-liste':
            return <CekSenetListe />;
          case 'banka-liste':
            return <BankaListe />;
          case 'banka-ekstre-liste':
            return <BankaEkstreListesi />;
          case 'expense-liste':
            return <GenelGiderler />;
          case 'kesilecek-fatura-liste':
            return <KesilecekFaturalar />;
          default:
            return <Dashboard />; // Default to Dashboard if currentView is not recognized
        }
      })()}
    </Layout>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
      <Toaster position="top-right" />
    </AppProvider>
  );
}

export default App;
