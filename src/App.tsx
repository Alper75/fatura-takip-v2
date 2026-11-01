import { lazy, Suspense } from 'react';
import { AppProvider, useApp } from '@/context/AppContext';
import { LoginPage } from '@/sections/LoginPage';
import { Layout } from '@/sections/Layout';
import { Dashboard } from '@/sections/Dashboard';
import { Toaster } from '@/components/ui/sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

const SatisFaturaListesi = lazy(() => import('@/sections/SatisFaturaListesi').then(m => ({ default: m.SatisFaturaListesi })));
const AlisFaturaListesi = lazy(() => import('@/sections/AlisFaturaListesi').then(m => ({ default: m.AlisFaturaListesi })));
const VergiRaporu = lazy(() => import('./sections/VergiRaporu').then(m => ({ default: m.VergiRaporu })));
const CariListe = lazy(() => import('./sections/CariListe').then(m => ({ default: m.CariListe })));
const CekSenetListe = lazy(() => import('./sections/CekSenetListe').then(m => ({ default: m.CekSenetListe })));
const BankaListe = lazy(() => import('./sections/BankaListe').then(m => ({ default: m.BankaListe })));
const BankaEkstreListesi = lazy(() => import('./sections/BankaEkstreListesi').then(m => ({ default: m.BankaEkstreListesi })));
const KesilecekFaturalar = lazy(() => import('./sections/KesilecekFaturalar').then(m => ({ default: m.KesilecekFaturalar })));
const PersonelListe = lazy(() => import('./sections/PersonelListe'));
const PersonelDashboard = lazy(() => import('./sections/PersonelDashboard'));
const IzinYonetimi = lazy(() => import('./sections/IzinYonetimi'));
const TalepYonetimi = lazy(() => import('./sections/TalepYonetimi'));
const PuantajCetveli = lazy(() => import('./sections/PuantajCetveli'));
const PersonelIzinlerim = lazy(() => import('./sections/PersonelIzinlerim'));
const PersonelMasraflarim = lazy(() => import('./sections/PersonelMasraflarim'));
const KisiselPuantaj = lazy(() => import('./sections/KisiselPuantaj'));
const SuperAdminPanel = lazy(() => import('./sections/SuperAdminPanel').then(m => ({ default: m.SuperAdminPanel })));
const StokPage = lazy(() => import('./modules/stok/pages/StokPage').then(m => ({ default: m.StokPage })));
const LucaAyarlari = lazy(() => import('./sections/LucaAyarlari').then(m => ({ default: m.LucaAyarlari })));
const FaturaAktarim = lazy(() => import('./sections/FaturaAktarim').then(m => ({ default: m.FaturaAktarim })));
const TeklifListesi = lazy(() => import('./sections/TeklifListesi').then(m => ({ default: m.TeklifListesi })));
const SiparisListesi = lazy(() => import('./sections/SiparisListesi').then(m => ({ default: m.SiparisListesi })));
const MutabakatYonetimi = lazy(() => import('./sections/MutabakatYonetimi').then(m => ({ default: m.MutabakatYonetimi })));
const PublicTeklifView = lazy(() => import('./sections/PublicTeklifView').then(m => ({ default: m.PublicTeklifView })));
const PublicMutabakatView = lazy(() => import('./sections/PublicMutabakatView').then(m => ({ default: m.PublicMutabakatView })));
const EntegratorAyarlari = lazy(() => import('./sections/EntegratorAyarlari'));
const GelenEFaturalar = lazy(() => import('./sections/GelenEFaturalar'));
const GidenElogoFaturalar = lazy(() => import('./sections/GidenElogoFaturalar'));
const GelenUyumsoftFaturalar = lazy(() => import('./sections/GelenUyumsoftFaturalar'));
const UyumsoftGidenFaturalar = lazy(() => import('./sections/UyumsoftGidenFaturalar'));
const UyumsoftGidenESMM = lazy(() => import('./sections/UyumsoftGidenESMM'));
const SirketDosyalari = lazy(() => import('./sections/SirketDosyalari').then(m => ({ default: m.SirketDosyalari })));
const AkilliOgrenme = lazy(() => import('./sections/AkilliOgrenme'));
const MuhasebeFisInceleme = lazy(() => import('./sections/MuhasebeFisInceleme').then(m => ({ default: m.MuhasebeFisInceleme })));
const NakitAkisiTakvimi = lazy(() => import('./sections/NakitAkisiTakvimi'));
const KullaniciYetkiYonetimi = lazy(() => import('./sections/KullaniciYetkiYonetimi'));
const DijitalVergiDairesi = lazy(() => import('./sections/DijitalVergiDairesi').then(m => ({ default: m.DijitalVergiDairesi })));

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 text-slate-500">
    <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
    <span className="text-xs font-medium">Modül yükleniyor...</span>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function AppContent() {
  const { isAuthenticated, currentView } = useApp();

  // Public route check for Quotation Approval - Must run for both authenticated and guest users!
  const params = new URLSearchParams(window.location.search);
  const teklifToken = params.get('teklif');
  const mutabakatToken = params.get('mutabakat');
  
  if (teklifToken) {
    return (
      <Suspense fallback={<PageLoader />}>
        <PublicTeklifView token={teklifToken} />
      </Suspense>
    );
  }

  if (mutabakatToken) {
    return (
      <Suspense fallback={<PageLoader />}>
        <PublicMutabakatView token={mutabakatToken} />
      </Suspense>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
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
          case 'nakit-akisi':
            return <NakitAkisiTakvimi />;
          case 'banka-liste':
            return <BankaListe />;
          case 'banka-ekstre-liste':
            return <BankaEkstreListesi />;
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
          case 'stok-yonetimi':
            return <StokPage />;
          case 'super-admin':
            return <SuperAdminPanel />;
          case 'luca-ayarlari':
            return <LucaAyarlari />;
          case 'fatura-aktarim':
            return <FaturaAktarim />;
          case 'entegrasyon-ayarlari':
            return <EntegratorAyarlari />;
          case 'gelen-efaturalar':
            return <GelenEFaturalar />;
          case 'giden-elogo-faturalar':
            return <GidenElogoFaturalar />;
          case 'gelen-uyumsoft-faturalar':
            return <GelenUyumsoftFaturalar />;
          case 'giden-uyumsoft-faturalar':
            return <UyumsoftGidenFaturalar />;
          case 'giden-uyumsoft-esmm':
            return <UyumsoftGidenESMM />;
          case 'teklif-liste':
            return <TeklifListesi />;
          case 'siparis-liste':
            return <SiparisListesi />;
          case 'mutabakat-yonetimi':
            return <MutabakatYonetimi />;
          case 'sirket-dosyalari':
            return <SirketDosyalari />;
          case 'akilli-ogrenme':
            return <AkilliOgrenme />;
          case 'muhasebe-fis-inceleme':
            return <MuhasebeFisInceleme />;
          case 'kullanici-yonetimi':
            return <KullaniciYetkiYonetimi />;
          case 'dijital-vergi-dairesi':
            return <DijitalVergiDairesi />;
          default:
            return <Dashboard />; // Default to Dashboard if currentView is not recognized
        }
      })()}
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <AppContent />
        <Toaster position="top-right" />
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
