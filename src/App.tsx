import { Suspense } from 'react';
import { AppProvider, useApp } from '@/context/AppContext';
import { LoginPage } from '@/sections/LoginPage';
import { Layout } from '@/sections/Layout';
import { Dashboard } from '@/sections/Dashboard';
import { Toaster } from '@/components/ui/sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

const SatisFaturaListesi = lazyWithRetry(() => import('@/sections/SatisFaturaListesi').then(m => ({ default: m.SatisFaturaListesi })));
const AlisFaturaListesi = lazyWithRetry(() => import('@/sections/AlisFaturaListesi').then(m => ({ default: m.AlisFaturaListesi })));
const VergiRaporu = lazyWithRetry(() => import('./sections/VergiRaporu').then(m => ({ default: m.VergiRaporu })));
const CariListe = lazyWithRetry(() => import('./sections/CariListe').then(m => ({ default: m.CariListe })));
const CekSenetListe = lazyWithRetry(() => import('./sections/CekSenetListe').then(m => ({ default: m.CekSenetListe })));
const BankaListe = lazyWithRetry(() => import('./sections/BankaListe').then(m => ({ default: m.BankaListe })));
const BankaEkstreListesi = lazyWithRetry(() => import('./sections/BankaEkstreListesi').then(m => ({ default: m.BankaEkstreListesi })));
const KesilecekFaturalar = lazyWithRetry(() => import('./sections/KesilecekFaturalar').then(m => ({ default: m.KesilecekFaturalar })));
const PersonelListe = lazyWithRetry(() => import('./sections/PersonelListe'));
const PersonelDashboard = lazyWithRetry(() => import('./sections/PersonelDashboard'));
const IzinYonetimi = lazyWithRetry(() => import('./sections/IzinYonetimi'));
const TalepYonetimi = lazyWithRetry(() => import('./sections/TalepYonetimi'));
const PuantajCetveli = lazyWithRetry(() => import('./sections/PuantajCetveli'));
const PersonelIzinlerim = lazyWithRetry(() => import('./sections/PersonelIzinlerim'));
const PersonelMasraflarim = lazyWithRetry(() => import('./sections/PersonelMasraflarim'));
const KisiselPuantaj = lazyWithRetry(() => import('./sections/KisiselPuantaj'));
const SuperAdminPanel = lazyWithRetry(() => import('./sections/SuperAdminPanel').then(m => ({ default: m.SuperAdminPanel })));
const StokPage = lazyWithRetry(() => import('./modules/stok/pages/StokPage').then(m => ({ default: m.StokPage })));
const LucaAyarlari = lazyWithRetry(() => import('./sections/LucaAyarlari').then(m => ({ default: m.LucaAyarlari })));
const FaturaAktarim = lazyWithRetry(() => import('./sections/FaturaAktarim').then(m => ({ default: m.FaturaAktarim })));
const TeklifListesi = lazyWithRetry(() => import('./sections/TeklifListesi').then(m => ({ default: m.TeklifListesi })));
const SiparisListesi = lazyWithRetry(() => import('./sections/SiparisListesi').then(m => ({ default: m.SiparisListesi })));
const MutabakatYonetimi = lazyWithRetry(() => import('./sections/MutabakatYonetimi').then(m => ({ default: m.MutabakatYonetimi })));
const PublicTeklifView = lazyWithRetry(() => import('./sections/PublicTeklifView').then(m => ({ default: m.PublicTeklifView })));
const PublicMutabakatView = lazyWithRetry(() => import('./sections/PublicMutabakatView').then(m => ({ default: m.PublicMutabakatView })));
const EntegratorAyarlari = lazyWithRetry(() => import('./sections/EntegratorAyarlari'));
const GelenEFaturalar = lazyWithRetry(() => import('./sections/GelenEFaturalar'));
const GidenElogoFaturalar = lazyWithRetry(() => import('./sections/GidenElogoFaturalar'));
const GelenUyumsoftFaturalar = lazyWithRetry(() => import('./sections/GelenUyumsoftFaturalar'));
const UyumsoftGidenFaturalar = lazyWithRetry(() => import('./sections/UyumsoftGidenFaturalar'));
const UyumsoftGidenESMM = lazyWithRetry(() => import('./sections/UyumsoftGidenESMM'));
const SirketDosyalari = lazyWithRetry(() => import('./sections/SirketDosyalari').then(m => ({ default: m.SirketDosyalari })));
const AkilliOgrenme = lazyWithRetry(() => import('./sections/AkilliOgrenme'));
const MuhasebeFisInceleme = lazyWithRetry(() => import('./sections/MuhasebeFisInceleme').then(m => ({ default: m.MuhasebeFisInceleme })));
const NakitAkisiTakvimi = lazyWithRetry(() => import('./sections/NakitAkisiTakvimi'));
const KullaniciYetkiYonetimi = lazyWithRetry(() => import('./sections/KullaniciYetkiYonetimi'));
const DijitalVergiDairesi = lazyWithRetry(() => import('./sections/DijitalVergiDairesi').then(m => ({ default: m.DijitalVergiDairesi })));

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
