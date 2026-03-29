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
import PersonelListe from './sections/PersonelListe';
import PersonelDashboard from './sections/PersonelDashboard';
import IzinYonetimi from './sections/IzinYonetimi';
import TalepYonetimi from './sections/TalepYonetimi';
import PuantajCetveli from './sections/PuantajCetveli';
import PersonelIzinlerim from './sections/PersonelIzinlerim';
import PersonelMasraflarim from './sections/PersonelMasraflarim';
import KisiselPuantaj from './sections/KisiselPuantaj';

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
          case 'personel-liste':
            return <PersonelListe />;
          case 'personel-dashboard':
            return <PersonelDashboard />;
          case 'izin-yonetimi':
            return <IzinYonetimi />;
          case 'talep-yonetimi':
            return <TalepYonetimi />;
          case 'puantaj-cetveli':
            return <PuantajCetveli />;
          case 'personel-izinlerim':
            return <PersonelIzinlerim />;
          case 'personel-masraflarim':
            return <PersonelMasraflarim />;
          case 'kisisel-puantaj':
            return <KisiselPuantaj />;
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
