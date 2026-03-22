import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  SatisFatura,
  SatisFaturaFormData,
  AlisFatura,
  AlisFaturaFormData,
  Cari,
  CariFormData,
  CariHareket,
  CariBakiyeOzet,
  CekSenet,
  CekSenetFormData,
  BankaHesabi,
  BankaHesabiFormData,
  User,
  ViewType,
  IslemTuru,
  OdemeDurumu,
  VergiRaporu,
  MasrafKurali,
  KesilecekFatura,
  Personnel,
  Pointage,
  Leave,
  Document,
  Asset,
  Training,
  Payroll,
  PersonnelRequest,
  Announcement
} from '@/types';
import { AYLAR, GELIR_VERGISI_DILIMLERI } from '@/types';

interface AppContextType {
  // ==================== AUTH ====================
  isAuthenticated: boolean;
  user: User | null;
  login: (tc: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  changePassword: (newPassword: string) => Promise<{ success: boolean; message?: string }>;

  // ==================== VIEW ====================
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;

  // ==================== CARİLER ====================
  cariler: Cari[];
  addCari: (data: CariFormData) => void;
  updateCari: (id: string, data: CariFormData) => void;
  deleteCari: (id: string) => void;

  // ==================== CARİ HAREKET (LEDGER) ====================
  cariHareketler: CariHareket[];
  addCariHareket: (hareket: Omit<CariHareket, 'id' | 'olusturmaTarihi'>) => void;
  updateCariHareket: (id: string, data: Partial<CariHareket>) => void;
  deleteCariHareket: (id: string) => void;
  hesaplaCariBakiye: (cariId: string) => CariBakiyeOzet;

  // ==================== SATIŞ FATURALARI ====================
  satisFaturalari: SatisFatura[];
  addSatisFatura: (fatura: SatisFaturaFormData) => void;
  updateSatisFaturaOdeme: (id: string, odemeTarihi: string, durum: OdemeDurumu, bankaId?: string) => void;
  uploadSatisPdf: (faturaId: string, file: File) => void;
  uploadSatisDekont: (faturaId: string, file: File) => void;
  downloadSatisPdf: (faturaId: string) => void;
  downloadSatisDekont: (faturaId: string) => void;
  deleteSatisFatura: (id: string) => void;

  // ==================== ALIŞ FATURALARI ====================
  alisFaturalari: AlisFatura[];
  addAlisFatura: (fatura: AlisFaturaFormData) => void;
  updateAlisFaturaOdeme: (id: string, odemeTarihi: string, durum: OdemeDurumu, bankaId?: string) => void;
  uploadAlisPdf: (faturaId: string, file: File) => void;
  uploadAlisDekont: (faturaId: string, file: File) => void;
  downloadAlisPdf: (faturaId: string) => void;
  downloadAlisDekont: (faturaId: string) => void;
  deleteAlisFatura: (id: string) => void;

  // ==================== VERGI HESAPLAMA ====================
  getVergiRaporu: (yil: number, ay: number) => VergiRaporu;

  // ==================== DRAWER ====================
  isSatisDrawerOpen: boolean;
  isAlisDrawerOpen: boolean;
  isCariDrawerOpen: boolean;
  satisInitialData: Partial<SatisFaturaFormData> | null;
  openSatisDrawer: (initialData?: Partial<SatisFaturaFormData>) => void;
  closeSatisDrawer: () => void;
  openAlisDrawer: () => void;
  closeAlisDrawer: () => void;
  openCariDrawer: (id?: string) => void;
  closeCariDrawer: () => void;
  isCariEkstreDrawerOpen: boolean;
  openCariEkstreDrawer: (id: string) => void;
  closeCariEkstreDrawer: () => void;
  selectedCariId: string | null;
  setSelectedCariId: (id: string | null) => void;

  // ==================== ÇEK / SENET ====================
  cekSenetler: CekSenet[];
  addCekSenet: (data: CekSenetFormData) => void;
  updateCekSenet: (id: string, data: CekSenetFormData) => void;
  deleteCekSenet: (id: string) => void;
  updateCekSenetDurum: (id: string, durum: 'bekliyor' | 'odendi' | 'karsiliksiz') => void;
  isCekSenetDrawerOpen: boolean;
  openCekSenetDrawer: (id?: string) => void;
  closeCekSenetDrawer: () => void;
  selectedCekSenetId: string | null;

  // ==================== BANKA HESAPLARI ====================
  bankaHesaplari: BankaHesabi[];
  addBankaHesabi: (data: BankaHesabiFormData) => void;
  updateBankaHesabi: (id: string, data: BankaHesabiFormData) => void;
  deleteBankaHesabi: (id: string) => void;
  isBankaDrawerOpen: boolean;
  openBankaDrawer: (id?: string) => void;
  closeBankaDrawer: () => void;
  selectedBankaId: string | null;
  // ==================== MASRAF KURALLARI ====================
  masrafKurallari: MasrafKurali[];
  addMasrafKurali: (data: Omit<MasrafKurali, 'id'>) => void;
  deleteMasrafKurali: (id: string) => void;
  // ==================== KESİLECEK FATURALAR ====================
  kesilecekFaturalar: KesilecekFatura[];
  addKesilecekFatura: (data: Omit<KesilecekFatura, 'id' | 'olusturmaTarihi' | 'durum'>) => void;
  updateKesilecekFatura: (id: string, data: Partial<KesilecekFatura>) => void;
  deleteKesilecekFatura: (id: string) => void;
  // ==================== HESAPLAMALAR ====================
  calculateFaturaHesaplamalari: (tutar: number, kdvStr: string, tevStr?: string, stopajStr?: string) => any;
  
  // ==================== PERSONEL MODÜLÜ ====================
  personnel: Personnel[];
  currentPersonnel: Personnel | null;
  fetchPersonnel: () => Promise<void>;
  fetchMyPersonnel: () => Promise<void>;
  bulkUploadPersonnel: (file: File) => Promise<{ success: boolean; message?: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Demo Kullanıcı (Artık veritabanından gelecek, ama tip hatası olmasın diye güncelliyoruz)
const DEMO_USER: User = {
  tc: '00000000000',
  role: 'admin'
};

// Demo Cariler
const DEMO_CARILER: Cari[] = [
  {
    id: 'c1',
    tip: 'musteri',
    unvan: 'Ahmet Yılmaz',
    vknTckn: '12345678901',
    vergiDairesi: 'Kadıköy',
    adres: 'İstanbul, Kadıköy',
    telefon: '0532 111 2233',
    eposta: 'ahmet@example.com',
    olusturmaTarihi: '2024-01-01'
  },
  {
    id: 'c2',
    tip: 'tedarikci',
    unvan: 'ABC Tedarik Ltd. Şti.',
    vknTckn: '1234567890',
    vergiDairesi: 'Şişli',
    adres: 'İstanbul, Şişli',
    telefon: '0212 999 8877',
    olusturmaTarihi: '2024-01-02'
  }
];

// Demo Cari Hareketler
const DEMO_CARI_HAREKETLER: CariHareket[] = [
  {
    id: 'ch1',
    cariId: 'c1',
    tarih: '2024-01-15',
    islemTuru: 'satis_faturasi',
    tutar: 12000,
    aciklama: 'Satış Faturası (s1)',
    bagliFaturaId: 's1',
    olusturmaTarihi: '2024-01-15'
  },
  {
    id: 'ch2',
    cariId: 'c2',
    tarih: '2024-01-05',
    islemTuru: 'alis_faturasi',
    tutar: 6000,
    aciklama: 'Alış Faturası (ALIS-2024-001)',
    bagliFaturaId: 'a1',
    olusturmaTarihi: '2024-01-05'
  },
  {
    id: 'ch3',
    cariId: 'c2',
    tarih: '2024-01-15',
    islemTuru: 'odeme',
    tutar: 6000,
    aciklama: 'Banka Havalesi',
    bagliFaturaId: 'a1',
    olusturmaTarihi: '2024-01-15'
  }
];

// Demo Çek Senetler
const DEMO_CEK_SENETLER: CekSenet[] = [
  {
    id: 'cs1',
    tip: 'cek',
    islemTipi: 'alinan',
    cariId: 'c1',
    belgeNo: 'CEK-2024-001',
    tutar: 15000,
    vadeTarihi: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0],
    verilisTarihi: '2024-01-10',
    durum: 'bekliyor',
    aciklama: 'Satış Karşılığı Alınan Çek'
  },
  {
    id: 'cs2',
    tip: 'senet',
    islemTipi: 'verilen',
    cariId: 'c2',
    belgeNo: 'SNT-2024-001',
    tutar: 8000,
    vadeTarihi: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString().split('T')[0],
    verilisTarihi: '2024-01-05',
    durum: 'bekliyor',
    aciklama: 'Mal Alımı Karşılığı Verilen Senet'
  }
];

const DEMO_KURALLAR: MasrafKurali[] = [
  { id: 'k1', anahtarKelime: 'TURKCELL', islemTuru: 'genel_gider', aciklama: 'Telefon Faturası' },
  { id: 'k2', anahtarKelime: 'ENERJISA', islemTuru: 'genel_gider', aciklama: 'Elektrik Faturası' },
  { id: 'k3', anahtarKelime: 'KIRA', islemTuru: 'kira_odemesi', aciklama: 'Dükkan Kirası' },
  { id: 'k4', anahtarKelime: 'MAAS', islemTuru: 'maas_odemesi', aciklama: 'Personel Maaşı' },
];

const DEMO_KESILECEK_FATURALAR: KesilecekFatura[] = [
  {
    id: 'kf1',
    ad: 'Teknoloji Market',
    vknTckn: '1234567890',
    adres: 'Ankara',
    tutar: 15000,
    kdvDahil: true,
    aciklama: 'Yazılım destek hizmeti',
    olusturmaTarihi: '2024-03-01',
    durum: 'bekliyor'
  },
  {
    id: 'kf2',
    ad: 'Mehmet Öz',
    soyad: 'Yılmaz',
    vknTckn: '11122233344',
    adres: 'İstanbul',
    tutar: 5000,
    kdvDahil: false,
    aciklama: 'Danışmanlık ücreti',
    olusturmaTarihi: '2024-03-05',
    durum: 'bekliyor'
  }
];

// Demo Banka Hesapları
const DEMO_BANKA_HESAPLARI: BankaHesabi[] = [
  {
    id: 'b1',
    hesapAdi: 'Ziraat Ticari',
    bankaAdi: 'Ziraat Bankası',
    iban: 'TR00 0000 0000 0000 0000 0000 01',
    dovizTuru: 'TRY',
    guncelBakiye: 250000
  },
  {
    id: 'b2',
    hesapAdi: 'İş Bankası Şahsi',
    bankaAdi: 'Türkiye İş Bankası',
    iban: 'TR00 0000 0000 0000 0000 0000 02',
    dovizTuru: 'TRY',
    guncelBakiye: 50000
  }
];

// Demo Satış Faturaları
const DEMO_SATIS_FATURALARI: SatisFatura[] = [
  {
    id: 's1',
    tcVkn: '12345678901',
    ad: 'Ahmet',
    soyad: 'Yılmaz',
    adres: 'İstanbul, Kadıköy',
    cariId: 'c1',
    kdvOrani: 20,
    alinanUcret: 12000,
    matrah: 10000,
    kdvTutari: 2000,
    pdfDosya: null,
    faturaTarihi: '2024-01-15',
    odemeTarihi: null,
    odemeDurumu: 'odenmedi',
    odemeDekontu: null,
    aciklama: 'Ocak ayı ürün satış bedeli',
    olusturmaTarihi: '2024-01-15'
  },
  {
    id: 's2',
    tcVkn: '98765432109',
    ad: 'Ayşe',
    soyad: 'Demir',
    adres: 'Ankara, Çankaya',
    kdvOrani: 10,
    alinanUcret: 5500,
    matrah: 5000,
    kdvTutari: 500,
    pdfDosya: 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsO8CjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgovRmlsdGVyIC9GbGF0ZURlY29kZQo+PgpzdHJlYW0KeJzLSMxLLUmNzNFLzs8rzi9KycxLt4IDAIvJBw4KZW5kc3RyZWFtCmVuZG9iago=',
    pdfDosyaAdi: 'fatura_ayse_demir.pdf',
    faturaTarihi: '2024-01-10',
    odemeTarihi: '2024-01-20',
    odemeDurumu: 'odendi',
    odemeDekontu: null,
    olusturmaTarihi: '2024-01-10'
  },
  {
    id: 's3',
    tcVkn: '11111111111',
    ad: 'Mehmet',
    soyad: 'Kaya',
    adres: 'İzmir, Konak',
    kdvOrani: 20,
    alinanUcret: 24000,
    matrah: 20000,
    kdvTutari: 4000,
    pdfDosya: null,
    faturaTarihi: '2024-02-05',
    odemeTarihi: null,
    odemeDurumu: 'bekliyor',
    odemeDekontu: null,
    olusturmaTarihi: '2024-02-05'
  }
];

// Demo Alış Faturaları
const DEMO_ALIS_FATURALARI: AlisFatura[] = [
  {
    id: 'a1',
    faturaNo: 'ALIS-2024-001',
    faturaTarihi: '2024-01-05',
    tedarikciAdi: 'ABC Tedarik Ltd. Şti.',
    tedarikciVkn: '1234567890',
    cariId: 'c2',
    malHizmetAdi: 'Ofis Malzemeleri',
    toplamTutar: 6000,
    kdvOrani: 20,
    kdvTutari: 1000,
    matrah: 5000,
    pdfDosya: null,
    odemeTarihi: '2024-01-15',
    odemeDurumu: 'odendi',
    aciklama: 'Kırtasiye malzemeleri alımı',
    olusturmaTarihi: '2024-01-05'
  },
  {
    id: 'a2',
    faturaNo: 'ALIS-2024-002',
    faturaTarihi: '2024-01-20',
    tedarikciAdi: 'XYZ Hizmet A.Ş.',
    tedarikciVkn: '9876543210',
    malHizmetAdi: 'Danışmanlık Hizmeti',
    toplamTutar: 11000,
    kdvOrani: 10,
    kdvTutari: 1000,
    matrah: 10000,
    pdfDosya: null,
    odemeTarihi: null,
    odemeDurumu: 'odenmedi',
    olusturmaTarihi: '2024-01-20'
  },
  {
    id: 'a3',
    faturaNo: 'ALIS-2024-003',
    faturaTarihi: '2024-02-10',
    tedarikciAdi: 'Tekno Market',
    tedarikciVkn: '5555555555',
    malHizmetAdi: 'Bilgisayar ve Ekipmanları',
    toplamTutar: 36000,
    kdvOrani: 20,
    kdvTutari: 6000,
    matrah: 30000,
    pdfDosya: null,
    odemeTarihi: null,
    odemeDurumu: 'bekliyor',
    olusturmaTarihi: '2024-02-10'
  }
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  // ==================== AUTH STATE ====================
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  // ==================== PERSONEL STATE ====================
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [currentPersonnel, setCurrentPersonnel] = useState<Personnel | null>(null);

  // ==================== VIEW STATE ====================
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  // ==================== CARİ STATE ====================
  const [cariler, setCariler] = useState<Cari[]>(DEMO_CARILER);
  const [cariHareketler, setCariHareketler] = useState<CariHareket[]>(DEMO_CARI_HAREKETLER);

  // ==================== FATURA STATE ====================
  const [satisFaturalari, setSatisFaturalari] = useState<SatisFatura[]>(DEMO_SATIS_FATURALARI);
  const [alisFaturalari, setAlisFaturalari] = useState<AlisFatura[]>(DEMO_ALIS_FATURALARI);

  // ==================== DRAWER STATE ====================
  const [isSatisDrawerOpen, setIsSatisDrawerOpen] = useState(false);
  const [isAlisDrawerOpen, setIsAlisDrawerOpen] = useState(false);
  const [isCariDrawerOpen, setIsCariDrawerOpen] = useState(false);
  const [isCariEkstreDrawerOpen, setIsCariEkstreDrawerOpen] = useState(false);
  const [selectedCariId, setSelectedCariId] = useState<string | null>(null);
  const [satisInitialData, setSatisInitialData] = useState<Partial<SatisFaturaFormData> | null>(null);

  // ==================== ÇEK SENET STATE ====================
  const [cekSenetler, setCekSenetler] = useState<CekSenet[]>(DEMO_CEK_SENETLER);
  const [isCekSenetDrawerOpen, setIsCekSenetDrawerOpen] = useState(false);
  const [selectedCekSenetId, setSelectedCekSenetId] = useState<string | null>(null);

  // ==================== BANKA STATE ====================
  const [bankaHesaplari, setBankaHesaplari] = useState<BankaHesabi[]>(DEMO_BANKA_HESAPLARI);
  const [masrafKurallari, setMasrafKurallari] = useState<MasrafKurali[]>(DEMO_KURALLAR);
  const [kesilecekFaturalar, setKesilecekFaturalar] = useState<KesilecekFatura[]>(DEMO_KESILECEK_FATURALAR);
  const [isBankaDrawerOpen, setIsBankaDrawerOpen] = useState(false);
  const [selectedBankaId, setSelectedBankaId] = useState<string | null>(null);

  // ==================== CARİ CRUD ====================
  const addCari = useCallback((data: CariFormData) => {
    const yeniCari: Cari = {
      ...data,
      id: 'c' + Date.now().toString(),
      olusturmaTarihi: new Date().toISOString().split('T')[0]
    };
    setCariler(prev => [yeniCari, ...prev]);
  }, []);

  const updateCari = useCallback((id: string, data: CariFormData) => {
    setCariler(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const deleteCari = useCallback((id: string) => {
    setCariler(prev => prev.filter(c => c.id !== id));
    // Opsiyonel: Cari silindiğinde hareketlerini de silebilirsiniz
    setCariHareketler(prev => prev.filter(h => h.cariId !== id));
  }, []);

  // ==================== CARİ HAREKET CRUD ====================
  const addCariHareket = useCallback((data: Omit<CariHareket, 'id' | 'olusturmaTarihi'>) => {
    const yeniHareket: CariHareket = {
      ...data,
      id: 'ch' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
      olusturmaTarihi: new Date().toISOString().split('T')[0]
    };
    setCariHareketler(prev => [yeniHareket, ...prev]);

    // Banka bakiyesini güncelle
    if (data.bankaId) {
      setBankaHesaplari(prev => prev.map(b => {
        if (b.id === data.bankaId) {
          // ARTALACAKLAR (+)
          const ArtisTurleri: IslemTuru[] = [
            'tahsilat', 
            'satis_faturasi', 
            'cek_senet_alinan'
          ];
          
          // AZALACAKLAR (-)
          const AzalisTurleri: IslemTuru[] = [
            'odeme', 
            'alis_faturasi', 
            'vergi_kdv', 
            'vergi_muhtasar', 
            'vergi_gecici', 
            'vergi_damga', 
            'maas_odemesi', 
            'kira_odemesi', 
            'banka_masrafi', 
            'ssk_odemesi', 
            'genel_gider', 
            'kredi_karti_odemesi',
            'cek_senet_verilen'
          ];

          // Transfer Özel Durumu: CariHareket metninde "GELEN" veya "GİDEN" araması?
          // Şimdilik transfer'i data içinde ek bir flag olarak düşünelim veya açıklamaya bakalım.
          // Basitçe: Eğer tutar pozitifse artış, negatifse azalış desek daha mı iyi?
          // Ama addCariHareket tutarı mutlak değer bekliyor genelde.
          
          let degisim = 0;
          if (ArtisTurleri.includes(data.islemTuru)) {
            degisim = data.tutar;
          } else if (AzalisTurleri.includes(data.islemTuru)) {
            degisim = -data.tutar;
          } else if (data.islemTuru === 'transfer') {
             // Transferde açıklama kontrolü
             if (data.aciklama.toUpperCase().includes('GELEN')) degisim = data.tutar;
             else degisim = -data.tutar;
          }

          if (degisim !== 0) {
            return { ...b, guncelBakiye: Number((b.guncelBakiye + degisim).toFixed(2)) };
          }
        }
        return b;
      }));
    }
  }, []);

  const updateCariHareket = useCallback((id: string, data: Partial<CariHareket>) => {
    setCariHareketler(prev => {
      const eski = prev.find(h => h.id === id);
      if (!eski) return prev;

      // Banka bakiye düzeltmesi
      const ArtisTurleri: IslemTuru[] = ['tahsilat', 'satis_faturasi', 'cek_senet_alinan'];
      const AzalisTurleri: IslemTuru[] = [
        'odeme', 'alis_faturasi', 'vergi_kdv', 'vergi_muhtasar', 'vergi_gecici', 
        'vergi_damga', 'maas_odemesi', 'kira_odemesi', 'banka_masrafi', 
        'ssk_odemesi', 'genel_gider', 'kredi_karti_odemesi', 'cek_senet_verilen'
      ];

      setBankaHesaplari(bankalar => bankalar.map(b => {
        let bakiye = b.guncelBakiye;
        
        // Eskinin etkisini geri al
        if (b.id === eski.bankaId) {
          let degisim = 0;
          if (ArtisTurleri.includes(eski.islemTuru)) degisim = -eski.tutar;
          else if (AzalisTurleri.includes(eski.islemTuru)) degisim = eski.tutar;
          else if (eski.islemTuru === 'transfer') {
            if (eski.aciklama.toUpperCase().includes('GELEN')) degisim = -eski.tutar;
            else degisim = eski.tutar;
          }
          bakiye += degisim;
        }

        // Yeninin etkisini uygula
        const yeniTutar = data.tutar !== undefined ? data.tutar : eski.tutar;
        const yeniTur = data.islemTuru !== undefined ? data.islemTuru : eski.islemTuru;
        const yeniAciklama = data.aciklama !== undefined ? data.aciklama : eski.aciklama;
        const yeniBankaId = data.bankaId !== undefined ? data.bankaId : (eski.bankaId || null);

        if (b.id === yeniBankaId) {
          let degisim = 0;
          if (ArtisTurleri.includes(yeniTur)) degisim = yeniTutar;
          else if (AzalisTurleri.includes(yeniTur)) degisim = -yeniTutar;
          else if (yeniTur === 'transfer') {
            if (yeniAciklama.toUpperCase().includes('GELEN')) degisim = yeniTutar;
            else degisim = -yeniTutar;
          }
          bakiye += degisim;
        }

        return { ...b, guncelBakiye: Number(bakiye.toFixed(2)) };
      }));

      return prev.map(h => h.id === id ? { ...h, ...data } : h);
    });
  }, []);

  const deleteCariHareket = useCallback((id: string) => {
    const silinecek = cariHareketler.find(h => h.id === id);
    if (silinecek && silinecek.bankaId) {
       setBankaHesaplari(prev => prev.map(b => {
         if (b.id === silinecek.bankaId) {
           const ArtisTurleri: IslemTuru[] = ['tahsilat', 'satis_faturasi', 'cek_senet_alinan'];
           const AzalisTurleri: IslemTuru[] = [
             'odeme', 'alis_faturasi', 'vergi_kdv', 'vergi_muhtasar', 
             'vergi_gecici', 'vergi_damga', 'maas_odemesi', 'kira_odemesi', 
             'banka_masrafi', 'ssk_odemesi', 'genel_gider', 'kredi_karti_odemesi',
             'cek_senet_verilen'
           ];

           let degisim = 0;
           if (ArtisTurleri.includes(silinecek.islemTuru)) {
             degisim = -silinecek.tutar; // Eklenen gelir silinirse bakiye düşer
           } else if (AzalisTurleri.includes(silinecek.islemTuru)) {
             degisim = silinecek.tutar; // Eklenen gider silinirse bakiye artar
           } else if (silinecek.islemTuru === 'transfer') {
              if (silinecek.aciklama.toUpperCase().includes('GELEN')) degisim = -silinecek.tutar;
              else degisim = silinecek.tutar;
           }

           if (degisim !== 0) {
             return { ...b, guncelBakiye: Number((b.guncelBakiye + degisim).toFixed(2)) };
           }
         }
         return b;
       }));
    }
    setCariHareketler(prev => prev.filter(h => h.id !== id));
  }, [cariHareketler]);

  const hesaplaCariBakiye = useCallback((cariId: string): CariBakiyeOzet => {
    const hareketler = cariHareketler.filter(h => h.cariId === cariId);
    let toplamBorc = 0;
    let toplamAlacak = 0;
    let tahsilEdilen = 0;
    let odenen = 0;

    hareketler.forEach(h => {
      if (h.islemTuru === 'satis_faturasi') toplamBorc += h.tutar;
      else if (h.islemTuru === 'alis_faturasi') toplamAlacak += h.tutar;
      else if (h.islemTuru === 'tahsilat') tahsilEdilen += h.tutar;
      else if (h.islemTuru === 'odeme') odenen += h.tutar;
    });

    const guncelBakiye = (toplamBorc - tahsilEdilen) - (toplamAlacak - odenen);
    let bakiyeDurumu: 'borclu' | 'alacakli' | 'kapali' = 'kapali';
    
    if (guncelBakiye > 0) bakiyeDurumu = 'borclu'; // Müşteri borçlu (Biz alacaklıyız)
    else if (guncelBakiye < 0) bakiyeDurumu = 'alacakli'; // Biz borçluyuz (Tedarikçi alacaklı)

    return { 
      toplamBorc, 
      toplamAlacak, 
      tahsilEdilen, 
      odenen, 
      guncelBakiye: Math.abs(guncelBakiye), 
      bakiyeDurumu 
    };
  }, [cariHareketler]);

  // ==================== AUTH FUNCTIONS ====================
  const login = useCallback(async (tc: string, password: string) => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tc, password })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setIsAuthenticated(true);
        setUser(data.user);
        if (data.user.role === 'personnel') {
          setCurrentView('personel-dashboard');
          fetchMyPersonnel();
        } else {
          setCurrentView('dashboard');
        }
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setPersonnel([]);
    setCurrentPersonnel(null);
    setCurrentView('dashboard');
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ newPassword })
      });
      const data = await response.json();
      if (data.success) {
        if (user) {
          const updatedUser = { ...user, mustChangePassword: false };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [user]);

  // ==================== PERSONEL FUNCTIONS ====================
  const fetchPersonnel = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/personnel', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) setPersonnel(data.personnel);
    } catch (error) {
      console.error('Fetch personnel error:', error);
    }
  }, []);

  const fetchMyPersonnel = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/personnel/me', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) setCurrentPersonnel(data.personnel);
    } catch (error) {
      console.error('Fetch my personnel error:', error);
    }
  }, []);

  const bulkUploadPersonnel = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('http://localhost:5000/api/admin/personnel/bulk-upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        fetchPersonnel();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [fetchPersonnel]);

  // ==================== DRAWER FUNCTIONS ====================
  const openSatisDrawer = useCallback((initialData?: Partial<SatisFaturaFormData>) => {
    setSatisInitialData(initialData || null);
    setIsSatisDrawerOpen(true);
  }, []);
  const closeSatisDrawer = useCallback(() => {
    setIsSatisDrawerOpen(false);
    setTimeout(() => setSatisInitialData(null), 300);
  }, []);
  const openAlisDrawer = useCallback(() => setIsAlisDrawerOpen(true), []);
  const closeAlisDrawer = useCallback(() => setIsAlisDrawerOpen(false), []);
  const openCariDrawer = useCallback((id?: string) => {
    setSelectedCariId(id || null);
    setIsCariDrawerOpen(true);
  }, []);
  const closeCariDrawer = useCallback(() => {
    setIsCariDrawerOpen(false);
    setTimeout(() => setSelectedCariId(null), 300);
  }, []);
  const openCariEkstreDrawer = useCallback((id?: string) => {
    setSelectedCariId(id || null);
    setIsCariEkstreDrawerOpen(true);
  }, []);
  const closeCariEkstreDrawer = useCallback(() => {
    setIsCariEkstreDrawerOpen(false);
    setTimeout(() => setSelectedCariId(null), 300);
  }, []);

  // ==================== ÇEK SENET CRUD ====================
  const openCekSenetDrawer = useCallback((id?: string) => {
    setSelectedCekSenetId(id || null);
    setIsCekSenetDrawerOpen(true);
  }, []);

  const closeCekSenetDrawer = useCallback(() => {
    setIsCekSenetDrawerOpen(false);
    setTimeout(() => setSelectedCekSenetId(null), 300);
  }, []);

  const addCekSenet = useCallback((data: CekSenetFormData) => {
    const yeni: CekSenet = {
      ...data,
      id: 'cs' + Date.now().toString() + Math.random().toString(36).substr(2, 5)
    };
    setCekSenetler(prev => [yeni, ...prev]);
  }, []);

  const updateCekSenet = useCallback((id: string, data: CekSenetFormData) => {
    setCekSenetler(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const deleteCekSenet = useCallback((id: string) => {
    setCekSenetler(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateCekSenetDurum = useCallback((id: string, durum: 'bekliyor' | 'odendi' | 'karsiliksiz', bankaId?: string) => {
    setCekSenetler(prev => prev.map(c => {
      if (c.id === id) {
        if (durum === 'odendi' && c.durum !== 'odendi') {
           const hTuru = c.islemTipi === 'alinan' ? 'tahsilat' : 'odeme';
           addCariHareket({
             cariId: c.cariId,
             tarih: new Date().toISOString().split('T')[0],
             islemTuru: hTuru,
             tutar: c.tutar,
             aciklama: `${c.tip.toUpperCase()} Ödemesi (${c.belgeNo})`,
             bagliFaturaId: c.id,
             bankaId: bankaId || null
           });
        }
        return { ...c, durum };
      }
      return c;
    }));
  }, [addCariHareket]);

  // ==================== BANKA CRUD ====================
  const openBankaDrawer = useCallback((id?: string) => {
    setSelectedBankaId(id || null);
    setIsBankaDrawerOpen(true);
  }, []);

  const closeBankaDrawer = useCallback(() => {
    setIsBankaDrawerOpen(false);
    setTimeout(() => setSelectedBankaId(null), 300);
  }, []);

  const addBankaHesabi = useCallback((data: BankaHesabiFormData) => {
    const yeni: BankaHesabi = {
      ...data,
      id: 'b' + Date.now().toString()
    };
    setBankaHesaplari(prev => [yeni, ...prev]);
  }, []);

  const updateBankaHesabi = useCallback((id: string, data: BankaHesabiFormData) => {
    setBankaHesaplari(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
  }, []);

  const deleteBankaHesabi = useCallback((id: string) => {
    setBankaHesaplari(prev => prev.filter(b => b.id !== id));
  }, []);

  // ==================== MASRAF KURALLARI CRUD ====================
  const addMasrafKurali = useCallback((data: Omit<MasrafKurali, 'id'>) => {
    const yeni: MasrafKurali = {
      ...data,
      id: 'k' + Date.now().toString()
    };
    setMasrafKurallari(prev => [...prev, yeni]);
  }, []);

  const deleteMasrafKurali = useCallback((id: string) => {
    setMasrafKurallari(prev => prev.filter(k => k.id !== id));
  }, []);

  // ==================== KESİLECEK FATURALAR CRUD ====================
  const addKesilecekFatura = useCallback((data: Omit<KesilecekFatura, 'id' | 'olusturmaTarihi' | 'durum'>) => {
    const yeni: KesilecekFatura = {
      ...data,
      id: 'kf' + Date.now().toString(),
      olusturmaTarihi: new Date().toISOString().split('T')[0],
      durum: 'bekliyor'
    };
    setKesilecekFaturalar(prev => [yeni, ...prev]);
  }, []);

  const updateKesilecekFatura = useCallback((id: string, data: Partial<KesilecekFatura>) => {
    setKesilecekFaturalar(prev => prev.map(f => f.id === id ? { ...f, ...data } : f));
  }, []);

  const deleteKesilecekFatura = useCallback((id: string) => {
    setKesilecekFaturalar(prev => prev.filter(f => f.id !== id));
  }, []);

  // ==================== HESAPLAMA YARDIMCILARI ====================
  const parseTevkifat = (oran?: string) => {
    if (!oran || oran === '0' || !oran.includes('/')) return 0;
    const [pay, payda] = oran.split('/').map(Number);
    return payda > 0 ? (pay / payda) : 0;
  };

  const calculateFaturaHesaplamalari = (tutar: number, kdvStr: string, tevStr?: string, stopajStr?: string) => {
    const kdvOrani = parseFloat(kdvStr) / 100;
    const stopajOrani = parseFloat(stopajStr || '0') / 100;
    const tevkifatCarpani = parseTevkifat(tevStr);

    // Formül: Net = Matrah + (Matrah * KDV) - (Matrah * Stopaj) - (Matrah * KDV * Tevkifat)
    // Matrah = Net / (1 + KDV - Stopaj - (KDV * Tevkifat))
    const carpan = 1 + kdvOrani - stopajOrani - (kdvOrani * tevkifatCarpani);
    const matrah = carpan > 0 ? tutar / carpan : 0;

    const kdvTutari = matrah * kdvOrani;
    const stopajTutari = matrah * stopajOrani;
    const tevkifatTutari = kdvTutari * tevkifatCarpani;

    return {
      matrah: Math.round(matrah * 100) / 100,
      kdvTutari: Math.round(kdvTutari * 100) / 100,
      stopajTutari: Math.round(stopajTutari * 100) / 100,
      tevkifatTutari: Math.round(tevkifatTutari * 100) / 100,
      toplamNet: Math.round(tutar * 100) / 100
    };
  };

  // ==================== SATIŞ FATURA HESAPLAMA ====================
  const calculateSatisFatura = (formData: SatisFaturaFormData) => {
    const tutar = parseFloat(formData.alinanUcret);
    return calculateFaturaHesaplamalari(tutar, formData.kdvOrani, formData.tevkifatOrani, formData.stopajOrani);
  };

  // ==================== ALIŞ FATURA HESAPLAMA ====================
  const calculateAlisFatura = (formData: AlisFaturaFormData) => {
    const tutar = parseFloat(formData.toplamTutar);
    return calculateFaturaHesaplamalari(tutar, formData.kdvOrani, formData.tevkifatOrani, formData.stopajOrani);
  };

  // ==================== SATIŞ FATURA CRUD ====================
  const addSatisFatura = useCallback((formData: SatisFaturaFormData) => {
    const hesaplanan = calculateSatisFatura(formData);

    const yeniFatura: SatisFatura = {
      id: 's' + Date.now().toString(),
      tcVkn: formData.tcVkn,
      ad: formData.ad,
      soyad: formData.soyad,
      adres: formData.adres,
      kdvOrani: parseFloat(formData.kdvOrani),
      alinanUcret: parseFloat(formData.alinanUcret),
      matrah: hesaplanan.matrah,
      kdvTutari: hesaplanan.kdvTutari,
      tevkifatOrani: formData.tevkifatOrani,
      tevkifatTutari: hesaplanan.tevkifatTutari,
      stopajOrani: formData.stopajOrani,
      stopajTutari: hesaplanan.stopajTutari,
      pdfDosya: formData.dosyaBase64 || null,
      pdfDosyaAdi: formData.dosyaAdi || undefined,
      faturaTarihi: formData.faturaTarihi,
      cariId: formData.cariId,
      vadeTarihi: formData.vadeTarihi || null,
      odemeTarihi: null,
      odemeDurumu: 'odenmedi',
      odemeDekontu: null,
      olusturmaTarihi: new Date().toISOString().split('T')[0]
    };

    setSatisFaturalari(prev => [yeniFatura, ...prev]);

    if (formData.cariId) {
      const yeniHareket: CariHareket = {
        id: 'ch' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
        cariId: formData.cariId,
        tarih: formData.faturaTarihi,
        islemTuru: 'satis_faturasi',
        tutar: parseFloat(formData.alinanUcret),
        aciklama: `Satış Faturası (${formData.ad || ''} ${formData.soyad || ''})`.trim(),
        bagliFaturaId: yeniFatura.id,
        olusturmaTarihi: new Date().toISOString().split('T')[0],
        dekontDosya: null
      };
      setCariHareketler(prev => [yeniHareket, ...prev]);
    }
  }, []);

  const updateSatisFaturaOdeme = useCallback((id: string, odemeTarihi: string, odemeDurumu: 'odenmedi' | 'odendi' | 'bekliyor') => {
    setSatisFaturalari(prev =>
      prev.map(f =>
        f.id === id
          ? { ...f, odemeTarihi, odemeDurumu }
          : f
      )
    );
  }, []);

  const deleteSatisFatura = useCallback((id: string) => {
    setSatisFaturalari(prev => prev.filter(f => f.id !== id));
    setCariHareketler(prev => prev.filter(h => h.bagliFaturaId !== id));
  }, []);

  // ==================== ALIŞ FATURA CRUD ====================
  const addAlisFatura = useCallback((formData: AlisFaturaFormData) => {
    const hesaplanan = calculateAlisFatura(formData);

    const yeniFatura: AlisFatura = {
      id: 'a' + Date.now().toString(),
      faturaNo: formData.faturaNo,
      faturaTarihi: formData.faturaTarihi,
      tedarikciAdi: formData.tedarikciAdi,
      tedarikciVkn: formData.tedarikciVkn,
      malHizmetAdi: formData.malHizmetAdi,
      toplamTutar: parseFloat(formData.toplamTutar),
      kdvOrani: parseFloat(formData.kdvOrani),
      kdvTutari: hesaplanan.kdvTutari,
      matrah: hesaplanan.matrah,
      tevkifatOrani: formData.tevkifatOrani,
      tevkifatTutari: hesaplanan.tevkifatTutari,
      stopajOrani: formData.stopajOrani,
      stopajTutari: hesaplanan.stopajTutari,
      pdfDosya: formData.dosyaBase64 || null,
      pdfDosyaAdi: formData.dosyaAdi || undefined,
      cariId: formData.cariId,
      vadeTarihi: formData.vadeTarihi || null,
      odemeTarihi: null,
      odemeDurumu: 'odenmedi',
      olusturmaTarihi: new Date().toISOString().split('T')[0]
    };

    setAlisFaturalari(prev => [yeniFatura, ...prev]);

    if (formData.cariId) {
      const yeniHareket: CariHareket = {
        id: 'ch' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
        cariId: formData.cariId,
        tarih: formData.faturaTarihi,
        islemTuru: 'alis_faturasi',
        tutar: parseFloat(formData.toplamTutar),
        aciklama: `Alış Faturası (${formData.tedarikciAdi})`,
        bagliFaturaId: yeniFatura.id,
        olusturmaTarihi: new Date().toISOString().split('T')[0],
        dekontDosya: null
      };
      setCariHareketler(prev => [yeniHareket, ...prev]);
    }
  }, []);

  const updateAlisFaturaOdeme = useCallback((id: string, odemeTarihi: string, odemeDurumu: 'odenmedi' | 'odendi' | 'bekliyor') => {
    setAlisFaturalari(prev =>
      prev.map(f =>
        f.id === id
          ? { ...f, odemeTarihi, odemeDurumu }
          : f
      )
    );
  }, []);

  const deleteAlisFatura = useCallback((id: string) => {
    setAlisFaturalari(prev => prev.filter(f => f.id !== id));
    setCariHareketler(prev => prev.filter(h => h.bagliFaturaId !== id));
  }, []);

  // ==================== PDF/DEKONT UPLOAD/DOWNLOAD ====================
  const uploadFile = (setter: React.Dispatch<React.SetStateAction<any[]>>, faturaId: string, file: File, field: string) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setter(prev =>
        prev.map(f =>
          f.id === faturaId
            ? { ...f, [field]: base64, [`${field}Adi`]: file.name }
            : f
        )
      );
    };
    reader.readAsDataURL(file);
  };

  const uploadSatisPdf = useCallback((faturaId: string, file: File) => {
    uploadFile(setSatisFaturalari, faturaId, file, 'pdfDosya');
  }, []);

  const uploadSatisDekont = useCallback((faturaId: string, file: File) => {
    uploadFile(setSatisFaturalari, faturaId, file, 'odemeDekontu');
  }, []);

  const uploadAlisPdf = useCallback((faturaId: string, file: File) => {
    uploadFile(setAlisFaturalari, faturaId, file, 'pdfDosya');
  }, []);

  const uploadAlisDekont = useCallback((faturaId: string, file: File) => {
    uploadFile(setAlisFaturalari, faturaId, file, 'odemeDekontu');
  }, []);

  const downloadFile = (faturalar: any[], faturaId: string, field: string, defaultName: string) => {
    const fatura = faturalar.find(f => f.id === faturaId);
    if (fatura?.[field]) {
      const link = document.createElement('a');
      link.href = fatura[field];
      link.download = fatura[`${field}Adi`] || defaultName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const downloadSatisPdf = useCallback((faturaId: string) => {
    downloadFile(satisFaturalari, faturaId, 'pdfDosya', `satis_fatura_${faturaId}.pdf`);
  }, [satisFaturalari]);

  const downloadSatisDekont = useCallback((faturaId: string) => {
    downloadFile(satisFaturalari, faturaId, 'odemeDekontu', `dekont_${faturaId}.pdf`);
  }, [satisFaturalari]);

  const downloadAlisPdf = useCallback((faturaId: string) => {
    downloadFile(alisFaturalari, faturaId, 'pdfDosya', `alis_fatura_${faturaId}.pdf`);
  }, [alisFaturalari]);

  const downloadAlisDekont = useCallback((faturaId: string) => {
    downloadFile(alisFaturalari, faturaId, 'odemeDekontu', `dekont_${faturaId}.pdf`);
  }, [alisFaturalari]);

  // ==================== VERGI HESAPLAMA ====================
  const hesaplaGelirVergisi = (toplamMatrah: number): { oran: number; vergi: number } => {
    let kalanMatrah = toplamMatrah;
    let toplamVergi = 0;
    let uygulananOran = 15;

    for (const dilim of GELIR_VERGISI_DILIMLERI) {
      if (kalanMatrah <= 0) break;

      const dilimMatrah = Math.min(kalanMatrah, dilim.limit === Infinity ? kalanMatrah : dilim.limit);
      toplamVergi += dilimMatrah * (dilim.oran / 100);
      uygulananOran = dilim.oran;

      if (dilim.limit !== Infinity) {
        kalanMatrah -= dilim.limit;
      }
    }

    return {
      oran: uygulananOran,
      vergi: Math.round(toplamVergi * 100) / 100
    };
  };

  const getVergiRaporu = useCallback((yil: number, ay: number): VergiRaporu => {
    const ayAdi = AYLAR.find(a => a.value === ay)?.label || '';

    // İlgili ay ve yıldaki satış faturaları
    const aylikSatislar = satisFaturalari.filter(f => {
      const faturaTarihi = new Date(f.faturaTarihi);
      return faturaTarihi.getFullYear() === yil && faturaTarihi.getMonth() + 1 === ay;
    });

    // İlgili ay ve yıldaki alış faturaları
    const aylikAlislar = alisFaturalari.filter(f => {
      const faturaTarihi = new Date(f.faturaTarihi);
      return faturaTarihi.getFullYear() === yil && faturaTarihi.getMonth() + 1 === ay;
    });

    // KDV Hesaplamaları
    const hesaplananKDV = aylikSatislar.reduce((acc, f) => acc + f.kdvTutari, 0);
    const indirilecekKDV = aylikAlislar.reduce((acc, f) => acc + f.kdvTutari, 0);
    const odenecekKDV = Math.max(0, hesaplananKDV - indirilecekKDV);

    const toplamSatisTevkifat = aylikSatislar.reduce((acc, f) => acc + (f.tevkifatTutari || 0), 0);
    const toplamAlisTevkifat = aylikAlislar.reduce((acc, f) => acc + (f.tevkifatTutari || 0), 0);
    const toplamSatisStopaj = aylikSatislar.reduce((acc, f) => acc + (f.stopajTutari || 0), 0);
    const toplamAlisStopaj = aylikAlislar.reduce((acc, f) => acc + (f.stopajTutari || 0), 0);

    // Gelir Vergisi Hesaplaması (Kümülatif - yılbaşından itibaren)
    const yilBasiSatislar = satisFaturalari.filter(f => {
      const faturaTarihi = new Date(f.faturaTarihi);
      return faturaTarihi.getFullYear() === yil && faturaTarihi.getMonth() + 1 <= ay;
    });

    const toplamMatrah = yilBasiSatislar.reduce((acc, f) => acc + f.matrah, 0);
    const gelirVergisiHesabi = hesaplaGelirVergisi(toplamMatrah);

    return {
      ay,
      ayAdi,
      yil,
      hesaplananKDV: Math.round(hesaplananKDV * 100) / 100,
      indirilecekKDV: Math.round(indirilecekKDV * 100) / 100,
      odenecekKDV: Math.round(odenecekKDV * 100) / 100,
      toplamSatisTevkifat: Math.round(toplamSatisTevkifat * 100) / 100,
      toplamAlisTevkifat: Math.round(toplamAlisTevkifat * 100) / 100,
      toplamSatisStopaj: Math.round(toplamSatisStopaj * 100) / 100,
      toplamAlisStopaj: Math.round(toplamAlisStopaj * 100) / 100,
      toplamMatrah: Math.round(toplamMatrah * 100) / 100,
      gelirVergisiOrani: gelirVergisiHesabi.oran,
      hesaplananGelirVergisi: gelirVergisiHesabi.vergi,
      satisAdet: aylikSatislar.length,
      alisAdet: aylikAlislar.length
    };
  }, [satisFaturalari, alisFaturalari]);

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        logout,
        changePassword,
        currentView,
        setCurrentView,
        cariler,
        addCari,
        updateCari,
        deleteCari,
        cariHareketler,
        addCariHareket,
        updateCariHareket,
        deleteCariHareket,
        hesaplaCariBakiye,
        satisFaturalari,
        addSatisFatura,
        updateSatisFaturaOdeme,
        uploadSatisPdf,
        uploadSatisDekont,
        downloadSatisPdf,
        downloadSatisDekont,
        deleteSatisFatura,
        alisFaturalari,
        addAlisFatura,
        updateAlisFaturaOdeme,
        uploadAlisPdf,
        uploadAlisDekont,
        downloadAlisPdf,
        downloadAlisDekont,
        deleteAlisFatura,
        bankaHesaplari,
        addBankaHesabi,
        updateBankaHesabi,
        deleteBankaHesabi,
        isBankaDrawerOpen,
        openBankaDrawer,
        closeBankaDrawer,
        selectedBankaId,
        cekSenetler,
        addCekSenet,
        updateCekSenet,
        deleteCekSenet,
        updateCekSenetDurum,
        isCekSenetDrawerOpen,
        openCekSenetDrawer,
        closeCekSenetDrawer,
        selectedCekSenetId,
        isSatisDrawerOpen,
        isAlisDrawerOpen,
        isCariDrawerOpen,
        satisInitialData,
        openSatisDrawer,
        closeSatisDrawer,
        openAlisDrawer,
        closeAlisDrawer,
        openCariDrawer,
        closeCariDrawer,
        isCariEkstreDrawerOpen,
        openCariEkstreDrawer,
        closeCariEkstreDrawer,
        selectedCariId,
        setSelectedCariId,
        getVergiRaporu,
        masrafKurallari,
        addMasrafKurali,
        deleteMasrafKurali,
        kesilecekFaturalar,
        addKesilecekFatura,
        updateKesilecekFatura,
        deleteKesilecekFatura,
        calculateFaturaHesaplamalari,
        personnel,
        currentPersonnel,
        fetchPersonnel,
        fetchMyPersonnel,
        bulkUploadPersonnel
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
