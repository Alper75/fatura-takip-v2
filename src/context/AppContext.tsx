import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const API_BASE = '';
const getToken = () => localStorage.getItem('token') || '';


async function apiFetch(path: string, options?: RequestInit) {
  const isFormData = options?.body instanceof FormData;
  const headers: any = { 
    Authorization: `Bearer ${getToken()}`,
    ...(options?.headers || {})
  };
  if (!isFormData && !headers['Content-Type'] && options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { 
    ...options, 
    headers 
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    try {
      const errorJson = JSON.parse(errorText);
      return { success: false, message: errorJson.message || 'API Hatası' };
    } catch {
      return { success: false, message: `Sunucu Hatası (${res.status}): ${errorText.substring(0, 50)}...` };
    }
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await res.json();
    // Eğer data {success, data} şeklinde değilse ama başarılı ise, sarmallayabiliriz veya olduğu gibi döneriz.
    // Ancak AppContext loadAllData success kontrolü yaptığı için standartlaştırmak daha güvenli:
    if (data && typeof data === 'object' && !Array.isArray(data) && 'success' in data) {
      return data;
    }
    return { success: true, data };
  } else {
    return { success: false, message: 'Sunucudan beklenmeyen bir yanıt formatı alındı.' };
  }
}
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
  GiderKategorisi,
  Company
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

  // ==================== CARÄ°LER ====================
  cariler: Cari[];
  addCari: (data: CariFormData) => void;
  updateCari: (id: string, data: CariFormData) => void;
  deleteCari: (id: string) => void;

  // ==================== CARÄ° HAREKET (LEDGER) ====================
  cariHareketler: CariHareket[];
  addCariHareket: (hareket: Omit<CariHareket, 'id' | 'olusturmaTarihi'>) => void;
  updateCariHareket: (id: string, data: Partial<CariHareket>) => void;
  deleteCariHareket: (id: string) => void;
  hesaplaCariBakiye: (cariId: string) => CariBakiyeOzet;

  // ==================== SATIÅ FATURALARI ====================
  satisFaturalari: SatisFatura[];
  addSatisFatura: (fatura: SatisFaturaFormData) => void;
  updateSatisFaturaOdeme: (id: string, odemeTarihi: string, durum: OdemeDurumu, bankaId?: string) => void;
  uploadSatisPdf: (faturaId: string, file: File) => void;
  uploadSatisDekont: (faturaId: string, file: File) => void;
  downloadSatisPdf: (faturaId: string) => void;
  downloadSatisDekont: (faturaId: string) => void;
  deleteSatisFatura: (id: string) => void;

  // ==================== ALIÅ FATURALARI ====================
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

  // ==================== Ã‡EK / SENET ====================
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
  // ==================== KESÄ°LECEK FATURALAR ====================
  kesilecekFaturalar: KesilecekFatura[];
  addKesilecekFatura: (data: Omit<KesilecekFatura, 'id' | 'olusturmaTarihi' | 'durum'>) => void;
  updateKesilecekFatura: (id: string, data: Partial<KesilecekFatura>) => void;
  deleteKesilecekFatura: (id: string) => void;
  // ==================== GİDER KATEGORİLERİ ====================
  giderKategorileri: GiderKategorisi[];
  addGiderKategorisi: (ad: string) => void;
  deleteGiderKategorisi: (id: string) => void;
  // ==================== HESAPLAMALAR ====================
  calculateFaturaHesaplamalari: (tutar: number, kdvStr: string, tevStr?: string, stopajStr?: string) => any;
  
  // ==================== PERSONEL MODÃœLÃœ ====================
  personnel: Personnel[];
  currentPersonnel: Personnel | null;
  fetchPersonnel: () => Promise<void>;
  fetchMyPersonnel: () => Promise<void>;
  bulkUploadPersonnel: (file: File) => Promise<{ success: boolean; message?: string }>;
  addPersonnel: (data: any) => Promise<{ success: boolean; message?: string }>;
  updatePersonnel: (id: number, data: any) => Promise<{ success: boolean; message?: string }>;
  deletePersonnel: (id: number) => Promise<{ success: boolean; message?: string }>;
  
  leaves: any[];
  fetchLeaves: () => Promise<void>;
  submitLeaveRequest: (data: any) => Promise<{ success: boolean; message?: string }>;
  updateLeaveStatus: (id: number, status: string) => Promise<{ success: boolean; message?: string }>;

  requests: any[];
  fetchRequests: () => Promise<void>;
  updateRequestStatus: (id: number, status: string) => Promise<{ success: boolean; message?: string }>;
  submitExpenseRequest: (data: any) => Promise<any>;
  uploadPersonnelDocument: (file: File, type: string) => Promise<any>;
  submitPointage: (data: any) => Promise<any>;
  bulkLockPointage: (personnelId: number, year: number, month: number, lockStatus: boolean) => Promise<{ success: boolean; message?: string }>;
  bulkLockAllPersonnel: (year: number, month: number, lockStatus: boolean) => Promise<{ success: boolean; message?: string }>;
  pointages: any[];
  fetchPointages: () => Promise<void>;
  downloadPuantajTemplate: () => Promise<void>;
  uploadPuantajExcel: (file: File) => Promise<{ success: boolean; message: string }>;

  // ==================== SUPER ADMIN ====================
  companies: Company[];
  fetchCompanies: () => Promise<void>;
  addCompany: (data: Omit<Company, 'id'>) => Promise<{ success: boolean; message?: string }>;
  updateCompany: (id: number, data: Partial<Company>) => Promise<{ success: boolean; message?: string }>;
  deleteCompany: (id: number) => Promise<{ success: boolean; message?: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);


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

  // ==================== CARÄ° STATE ====================
  const [cariler, setCariler] = useState<Cari[]>([]);
  const [cariHareketler, setCariHareketler] = useState<CariHareket[]>([]);

  // ==================== FATURA STATE ====================
  const [satisFaturalari, setSatisFaturalari] = useState<SatisFatura[]>([]);
  const [alisFaturalari, setAlisFaturalari] = useState<AlisFatura[]>([]);

  // ==================== DRAWER STATE ====================
  const [isSatisDrawerOpen, setIsSatisDrawerOpen] = useState(false);
  const [isAlisDrawerOpen, setIsAlisDrawerOpen] = useState(false);
  const [isCariDrawerOpen, setIsCariDrawerOpen] = useState(false);
  const [isCariEkstreDrawerOpen, setIsCariEkstreDrawerOpen] = useState(false);
  const [selectedCariId, setSelectedCariId] = useState<string | null>(null);
  const [satisInitialData, setSatisInitialData] = useState<Partial<SatisFaturaFormData> | null>(null);

  // ==================== Ã‡EK SENET STATE ====================
  const [cekSenetler, setCekSenetler] = useState<CekSenet[]>([]);
  const [isCekSenetDrawerOpen, setIsCekSenetDrawerOpen] = useState(false);
  const [selectedCekSenetId, setSelectedCekSenetId] = useState<string | null>(null);

  // ==================== BANKA STATE ====================
  const [bankaHesaplari, setBankaHesaplari] = useState<BankaHesabi[]>([]);
  const [masrafKurallari, setMasrafKurallari] = useState<MasrafKurali[]>([]);
  const [kesilecekFaturalar, setKesilecekFaturalar] = useState<KesilecekFatura[]>([]);
  const [giderKategorileri, setGiderKategorileri] = useState<GiderKategorisi[]>([]);
  const [isBankaDrawerOpen, setIsBankaDrawerOpen] = useState(false);
  const [selectedBankaId, setSelectedBankaId] = useState<string | null>(null);

  // ==================== SUPER ADMIN STATE ====================
  const [companies, setCompanies] = useState<Company[]>([]);

  // ==================== VERÄ° YÃœKLEME (API'DAN) ====================

  // ==================== CARÄ° CRUD ====================
  const addCari = useCallback(async (data: CariFormData) => {
    const yeniCari: Cari = { ...data, id: 'c' + Date.now().toString(), olusturmaTarihi: new Date().toISOString().split('T')[0] };
    setCariler(prev => [yeniCari, ...prev]);
    try { await apiFetch('/api/cariler', { method: 'POST', body: JSON.stringify(yeniCari) }); }
    catch (e) { console.error('Cari eklenemedi:', e); }
  }, []);

  const updateCari = useCallback(async (id: string, data: CariFormData) => {
    setCariler(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
    try { await apiFetch(`/api/cariler/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    catch (e) { console.error('Cari gÃ¼ncellenemedi:', e); }
  }, []);

  const deleteCari = useCallback(async (id: string) => {
    setCariler(prev => prev.filter(c => c.id !== id));
    setCariHareketler(prev => prev.filter(h => h.cariId !== id));
    try { await apiFetch(`/api/cariler/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Cari silinemedi:', e); }
  }, []);

  // ==================== CARÄ° HAREKET CRUD ====================
  const addCariHareket = useCallback(async (data: Omit<CariHareket, 'id' | 'olusturmaTarihi'>) => {
    const yeniHareket: CariHareket = {
      ...data,
      id: 'ch' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
      olusturmaTarihi: new Date().toISOString().split('T')[0]
    };
    setCariHareketler(prev => [yeniHareket, ...prev]);
    try { await apiFetch('/api/cari-hareketler', { method: 'POST', body: JSON.stringify(yeniHareket) }); }
    catch (e) { console.error('Cari hareket eklenemedi:', e); }

    // Banka bakiyesini gÃ¼ncelle
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

          // Transfer Ã–zel Durumu: CariHareket metninde "GELEN" veya "GÄ°DEN" aramasÄ±?
          // Åžimdilik transfer'i data iÃ§inde ek bir flag olarak dÃ¼ÅŸÃ¼nelim veya aÃ§Ä±klamaya bakalÄ±m.
          // BasitÃ§e: EÄŸer tutar pozitifse artÄ±ÅŸ, negatifse azalÄ±ÅŸ desek daha mÄ± iyi?
          // Ama addCariHareket tutarÄ± mutlak deÄŸer bekliyor genelde.
          
          let degisim = 0;
          if (ArtisTurleri.includes(data.islemTuru)) {
            degisim = data.tutar;
          } else if (AzalisTurleri.includes(data.islemTuru)) {
            degisim = -data.tutar;
          } else if (data.islemTuru === 'transfer') {
              if (data.aciklama && data.aciklama.toUpperCase().includes('GELEN')) degisim = data.tutar;
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

  const updateCariHareket = useCallback(async (id: string, data: Partial<CariHareket>) => {
    setCariHareketler(prev => {
      const eski = prev.find(h => h.id === id);
      if (!eski) return prev;

      // Banka bakiye dÃ¼zeltmesi
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
            if (eski.aciklama && eski.aciklama.toUpperCase().includes('GELEN')) degisim = -eski.tutar;
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
            if (yeniAciklama && yeniAciklama.toUpperCase().includes('GELEN')) degisim = yeniTutar;
            else degisim = -yeniTutar;
          }
          bakiye += degisim;
        }

        return { ...b, guncelBakiye: Number(bakiye.toFixed(2)) };
      }));

      return prev.map(h => h.id === id ? { ...h, ...data } : h);
    });
    try { await apiFetch(`/api/cari-hareketler/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    catch (e) { console.error('Cari hareket gÃ¼ncellenemedi:', e); }
  }, []);

  const deleteCariHareket = useCallback(async (id: string) => {
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
             degisim = -silinecek.tutar; // Eklenen gelir silinirse bakiye dÃ¼ÅŸer
           } else if (AzalisTurleri.includes(silinecek.islemTuru)) {
             degisim = silinecek.tutar; // Eklenen gider silinirse bakiye artar
           } else if (silinecek.islemTuru === 'transfer') {
              if (silinecek.aciklama && silinecek.aciklama.toUpperCase().includes('GELEN')) degisim = -silinecek.tutar;
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
    try { await apiFetch(`/api/cari-hareketler/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Cari hareket silinemedi:', e); }
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
    
    if (guncelBakiye > 0) bakiyeDurumu = 'borclu'; // MÃ¼ÅŸteri borÃ§lu (Biz alacaklÄ±yÄ±z)
    else if (guncelBakiye < 0) bakiyeDurumu = 'alacakli'; // Biz borÃ§luyuz (TedarikÃ§i alacaklÄ±)

    return { 
      toplamBorc, 
      toplamAlacak, 
      tahsilEdilen, 
      odenen, 
      guncelBakiye: Math.abs(guncelBakiye), 
      bakiyeDurumu 
    };
  }, [cariHareketler]);


  
  const login = useCallback(async (tc: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
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
      const response = await fetch('/api/auth/change-password', {
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
      const data = await apiFetch('/api/admin/personnel');
      if (data.success) setPersonnel(data.personnel);
    } catch (error) {
      console.error('Fetch personnel error:', error);
    }
  }, []);

  const fetchMyPersonnel = useCallback(async () => {
    try {
      const data = await apiFetch('/api/personnel/me');
      if (data.success) setCurrentPersonnel(data.personnel);
    } catch (error) {
      console.error('Fetch my personnel error:', error);
    }
  }, []);

  const bulkUploadPersonnel = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const data = await apiFetch('/api/admin/personnel/bulk-upload', {
        method: 'POST',
        body: formData
      });
      if (data.success) {
        fetchPersonnel();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [fetchPersonnel]);

  const addPersonnel = useCallback(async (data: any) => {
    try {
      const result = await apiFetch('/api/admin/personnel', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (result.success) {
        fetchPersonnel();
        return { success: true, message: result.message };
      }
      return { success: false, message: result.message };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [fetchPersonnel]);

  const updatePersonnel = useCallback(async (id: number, data: any) => {
    try {
      const result = await apiFetch(`/api/admin/personnel/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      if (result.success) {
        fetchPersonnel();
        return { success: true, message: result.message };
      }
      return { success: false, message: result.message };
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchPersonnel]);

  const deletePersonnel = useCallback(async (id: number) => {
    try {
      const result = await apiFetch(`/api/admin/personnel/${id}`, {
        method: 'DELETE'
      });
      if (result.success) {
        fetchPersonnel();
        return { success: true, message: result.message };
      }
      return { success: false, message: result.message };
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchPersonnel]);

  const [leaves, setLeaves] = useState<any[]>([]);
  const fetchLeaves = useCallback(async () => {
    try {
      const endpoint = user?.role === 'admin' ? '/api/admin/leaves' : '/api/personnel/leaves';
      const data = await apiFetch(endpoint);
      if (data.success) setLeaves(data.data);
    } catch (error) { console.error('Fetch leaves error:', error); }
  }, [user]);

  const submitLeaveRequest = useCallback(async (data: any | FormData) => {
    try {
      const result = await apiFetch('/api/personnel/leaves', {
        method: 'POST',
        body: data instanceof FormData ? data : JSON.stringify(data)
      });
      if (result.success) fetchLeaves();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchLeaves]);

  const updateLeaveStatus = useCallback(async (id: number, status: string) => {
    try {
      const data = await apiFetch(`/api/admin/leaves/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      if (data.success) {
        fetchLeaves();
        fetchPersonnel(); 
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message };
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchLeaves, fetchPersonnel]);

  const [pointages, setPointages] = useState<any[]>([]);
  const fetchPointages = useCallback(async () => {
    try {
      const endpoint = user?.role === 'admin' ? '/api/admin/pointage' : '/api/personnel/pointage';
      const data = await apiFetch(endpoint);
      if (data.success) setPointages(data.data);
    } catch (error) { console.error('Fetch pointages error:', error); }
  }, [user]);

  const bulkLockPointage = useCallback(async (personnelId: number, year: number, month: number, lockStatus: boolean) => {
    try {
      const result = await apiFetch('/api/admin/pointage/bulk-lock', {
        method: 'POST',
        body: JSON.stringify({ personnel_id: personnelId, year, month, lock_status: lockStatus })
      });
      if (result.success) {
        fetchPointages();
        return { success: true, message: result.message };
      }
      return { success: false, message: result.message };
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchPointages]);

  const bulkLockAllPersonnel = useCallback(async (year: number, month: number, lockStatus: boolean) => {
    try {
      const result = await apiFetch('/api/admin/pointage/bulk-lock-all', {
        method: 'POST',
        body: JSON.stringify({ year, month, lock_status: lockStatus })
      });
      if (result.success) {
        fetchPointages();
        return { success: true, message: result.message };
      }
      return { success: false, message: result.message };
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchPointages]);

  const downloadPuantajTemplate = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/pointage/template', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'puantaj_sablon.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Template download error:', error);
    }
  }, []);

  const uploadPuantajExcel = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const data = await apiFetch('/api/admin/pointage/bulk-upload', {
        method: 'POST',
        body: formData
      });
      if (data.success) {
        fetchPointages();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [fetchPointages]);

  const [requests, setRequests] = useState<any[]>([]);
  const fetchRequests = useCallback(async () => {
    try {
      const endpoint = user?.role === 'admin' ? '/api/admin/requests' : '/api/personnel/requests';
      const data = await apiFetch(endpoint);
      if (data.success) setRequests(data.data);
    } catch (error) { console.error('Fetch requests error:', error); }
  }, [user]);

  const updateRequestStatus = useCallback(async (id: number, status: string) => {
    try {
      const result = await apiFetch(`/api/admin/requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      if (result.success) fetchRequests();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchRequests]);

  const submitExpenseRequest = useCallback(async (data: any | FormData) => {
    try {
      const result = await apiFetch('/api/personnel/requests', {
        method: 'POST',
        body: data instanceof FormData ? data : JSON.stringify(data)
      });
      if (result.success) fetchRequests();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchRequests]);

  const uploadPersonnelDocument = useCallback(async (file: File, type: string) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      return await apiFetch('/api/personnel/documents', {
        method: 'POST',
        body: formData
      });
    } catch (error: any) { return { success: false, message: error.message }; }
  }, []);


  const submitPointage = useCallback(async (data: any) => {
    try {
      const response = await fetch('/api/pointage', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (result.success) fetchPointages();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchPointages]);

  // ==================== SUPER ADMIN FUNCTIONS ====================
  const fetchCompanies = useCallback(async () => {
    try {
      const data = await apiFetch('/api/super/companies');
      if (data.success) setCompanies(data.data);
    } catch (error) { console.error('Fetch companies error:', error); }
  }, []);

  const addCompany = useCallback(async (data: Omit<Company, 'id'>) => {
    try {
      const result = await apiFetch('/api/super/companies', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (result.success) fetchCompanies();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchCompanies]);

  const updateCompany = useCallback(async (id: number, data: Partial<Company>) => {
    try {
      const result = await apiFetch(`/api/super/companies/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      if (result.success) fetchCompanies();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchCompanies]);

  const deleteCompany = useCallback(async (id: number) => {
    try {
      const result = await apiFetch(`/api/super/companies/${id}`, {
        method: 'DELETE'
      });
      if (result.success) fetchCompanies();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchCompanies]);

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

  // ==================== Ã‡EK SENET CRUD ====================
  const openCekSenetDrawer = useCallback((id?: string) => {
    setSelectedCekSenetId(id || null);
    setIsCekSenetDrawerOpen(true);
  }, []);

  const closeCekSenetDrawer = useCallback(() => {
    setIsCekSenetDrawerOpen(false);
    setTimeout(() => setSelectedCekSenetId(null), 300);
  }, []);

  const addCekSenet = useCallback(async (data: CekSenetFormData) => {
    const yeni: CekSenet = { ...data, id: 'cs' + Date.now().toString() + Math.random().toString(36).substr(2, 5) };
    setCekSenetler(prev => [yeni, ...prev]);
    try { await apiFetch('/api/cek-senetler', { method: 'POST', body: JSON.stringify(yeni) }); }
    catch (e) { console.error('Cek-senet eklenemedi:', e); }
  }, []);

  const updateCekSenet = useCallback(async (id: string, data: CekSenetFormData) => {
    setCekSenetler(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
    try { await apiFetch(`/api/cek-senetler/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    catch (e) { console.error('Cek-senet gÃ¼ncellenemedi:', e); }
  }, []);

  const deleteCekSenet = useCallback(async (id: string) => {
    setCekSenetler(prev => prev.filter(c => c.id !== id));
    try { await apiFetch(`/api/cek-senetler/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Cek-senet silinemedi:', e); }
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
             aciklama: `${c.tip.toUpperCase()} Ã–demesi (${c.belgeNo})`,
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

  const addBankaHesabi = useCallback(async (data: BankaHesabiFormData) => {
    const yeni: BankaHesabi = { ...data, id: 'b' + Date.now().toString() };
    setBankaHesaplari(prev => [yeni, ...prev]);
    try { await apiFetch('/api/banka-hesaplari', { method: 'POST', body: JSON.stringify(yeni) }); }
    catch (e) { console.error('Banka hesabÄ± eklenemedi:', e); }
  }, []);

  const updateBankaHesabi = useCallback(async (id: string, data: BankaHesabiFormData) => {
    setBankaHesaplari(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
    try { await apiFetch(`/api/banka-hesaplari/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    catch (e) { console.error('Banka hesabÄ± gÃ¼ncellenemedi:', e); }
  }, []);

  const deleteBankaHesabi = useCallback(async (id: string) => {
    setBankaHesaplari(prev => prev.filter(b => b.id !== id));
    try { await apiFetch(`/api/banka-hesaplari/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Banka hesabÄ± silinemedi:', e); }
  }, []);

  // ==================== MASRAF KURALLARI CRUD ====================
  const addMasrafKurali = useCallback(async (data: Omit<MasrafKurali, 'id'>) => {
    const yeni: MasrafKurali = {
      ...data,
      id: 'k' + Date.now().toString()
    };
    setMasrafKurallari(prev => [...prev, yeni]);
    try { await apiFetch('/api/masraf-kurallari', { method: 'POST', body: JSON.stringify(yeni) }); }
    catch (e) { console.error('Masraf kuralı eklenemedi:', e); }
  }, []);

  const deleteMasrafKurali = useCallback(async (id: string) => {
    setMasrafKurallari(prev => prev.filter(k => k.id !== id));
    try { await apiFetch(`/api/masraf-kurallari/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Masraf kuralı silinemedi:', e); }
  }, []);

  // ==================== KESÄ°LECEK FATURALAR CRUD ====================
  const addKesilecekFatura = useCallback(async (data: Omit<KesilecekFatura, 'id' | 'olusturmaTarihi' | 'durum'>) => {
    const yeni: KesilecekFatura = { ...data, id: 'kf' + Date.now().toString(), olusturmaTarihi: new Date().toISOString().split('T')[0], durum: 'bekliyor' };
    setKesilecekFaturalar(prev => [yeni, ...prev]);
    try { await apiFetch('/api/kesilecek-faturalar', { method: 'POST', body: JSON.stringify(yeni) }); }
    catch (e) { console.error('Kesilecek fatura eklenemedi:', e); }
  }, []);

  const updateKesilecekFatura = useCallback(async (id: string, data: Partial<KesilecekFatura>) => {
    setKesilecekFaturalar(prev => prev.map(f => f.id === id ? { ...f, ...data } : f));
    try { await apiFetch(`/api/kesilecek-faturalar/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    catch (e) { console.error('Kesilecek fatura gÃ¼ncellenemedi:', e); }
  }, []);

  const deleteKesilecekFatura = useCallback(async (id: string) => {
    setKesilecekFaturalar(prev => prev.filter(f => f.id !== id));
    try { await apiFetch(`/api/kesilecek-faturalar/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Kesilecek fatura silinemedi:', e); }
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

    // FormÃ¼l: Net = Matrah + (Matrah * KDV) - (Matrah * Stopaj) - (Matrah * KDV * Tevkifat)
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

  // ==================== SATIÅ FATURA HESAPLAMA ====================
  const calculateSatisFatura = (formData: SatisFaturaFormData) => {
    const tutar = parseFloat(formData.alinanUcret);
    return calculateFaturaHesaplamalari(tutar, formData.kdvOrani, formData.tevkifatOrani, formData.stopajOrani);
  };

  // ==================== SATIÅ FATURA CRUD ====================
  const addSatisFatura = useCallback(async (formData: SatisFaturaFormData) => {
    const hesaplanan = calculateSatisFatura(formData);
    const yeniFatura: SatisFatura = {
      id: 's' + Date.now().toString(),
      tcVkn: formData.tcVkn, ad: formData.ad, soyad: formData.soyad, adres: formData.adres,
      kdvOrani: parseFloat(formData.kdvOrani), alinanUcret: parseFloat(formData.alinanUcret),
      matrah: hesaplanan.matrah, kdvTutari: hesaplanan.kdvTutari,
      tevkifatOrani: formData.tevkifatOrani, tevkifatTutari: hesaplanan.tevkifatTutari,
      stopajOrani: formData.stopajOrani, stopajTutari: hesaplanan.stopajTutari,
      pdfDosya: formData.dosyaBase64 || null, pdfDosyaAdi: formData.dosyaAdi || undefined,
      faturaTarihi: formData.faturaTarihi, cariId: formData.cariId,
      vadeTarihi: formData.vadeTarihi || null, odemeTarihi: null,
      odemeDurumu: 'odenmedi', odemeDekontu: null,
      olusturmaTarihi: new Date().toISOString().split('T')[0]
    };
    setSatisFaturalari(prev => [yeniFatura, ...prev]);
    try { await apiFetch('/api/satis-faturalari', { method: 'POST', body: JSON.stringify(yeniFatura) }); }
    catch (e) { console.error('SatÄ±ÅŸ fatura eklenemedi:', e); }
    if (formData.cariId) {
      const yeniHareket: CariHareket = {
        id: 'ch' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
        cariId: formData.cariId, tarih: formData.faturaTarihi, islemTuru: 'satis_faturasi',
        tutar: parseFloat(formData.alinanUcret),
        aciklama: `SatÄ±ÅŸ FaturasÄ± (${formData.ad || ''} ${formData.soyad || ''})`.trim(),
        bagliFaturaId: yeniFatura.id, olusturmaTarihi: new Date().toISOString().split('T')[0], dekontDosya: null
      };
      setCariHareketler(prev => [yeniHareket, ...prev]);
      try { await apiFetch('/api/cari-hareketler', { method: 'POST', body: JSON.stringify(yeniHareket) }); }
      catch (e) { console.error('Cari hareket eklenemedi:', e); }
    }
  }, []);

  const updateSatisFaturaOdeme = useCallback(async (id: string, odemeTarihi: string, odemeDurumu: 'odenmedi' | 'odendi' | 'bekliyor') => {
    setSatisFaturalari(prev => prev.map(f => f.id === id ? { ...f, odemeTarihi, odemeDurumu } : f));
    try { await apiFetch(`/api/satis-faturalari/${id}`, { method: 'PUT', body: JSON.stringify({ odemeTarihi, odemeDurumu }) }); }
    catch (e) { console.error('SatÄ±ÅŸ Ã¶deme gÃ¼ncellenemedi:', e); }
  }, []);

  const deleteSatisFatura = useCallback(async (id: string) => {
    setSatisFaturalari(prev => prev.filter(f => f.id !== id));
    setCariHareketler(prev => prev.filter(h => h.bagliFaturaId !== id));
    try { await apiFetch(`/api/satis-faturalari/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('SatÄ±ÅŸ fatura silinemedi:', e); }
  }, []);

  const calculateAlisFatura = (formData: AlisFaturaFormData) => {
    const tutar = parseFloat(formData.toplamTutar);
    return calculateFaturaHesaplamalari(tutar, formData.kdvOrani, formData.tevkifatOrani, formData.stopajOrani);
  };

  // ==================== ALIÅ FATURA CRUD ====================
  const addAlisFatura = useCallback(async (formData: AlisFaturaFormData) => {
    const hesaplanan = calculateAlisFatura(formData);
    const yeniFatura: AlisFatura = {
      id: 'a' + Date.now().toString(),
      faturaNo: formData.faturaNo, faturaTarihi: formData.faturaTarihi,
      tedarikciAdi: formData.tedarikciAdi, tedarikciVkn: formData.tedarikciVkn,
      malHizmetAdi: formData.malHizmetAdi, toplamTutar: parseFloat(formData.toplamTutar),
      kdvOrani: parseFloat(formData.kdvOrani), kdvTutari: hesaplanan.kdvTutari, matrah: hesaplanan.matrah,
      tevkifatOrani: formData.tevkifatOrani, tevkifatTutari: hesaplanan.tevkifatTutari,
      stopajOrani: formData.stopajOrani, stopajTutari: hesaplanan.stopajTutari,
      pdfDosya: formData.dosyaBase64 || null, pdfDosyaAdi: formData.dosyaAdi || undefined,
      cariId: formData.cariId, vadeTarihi: formData.vadeTarihi || null,
      odemeTarihi: null, odemeDurumu: 'odenmedi',
      olusturmaTarihi: new Date().toISOString().split('T')[0]
    };
    setAlisFaturalari(prev => [yeniFatura, ...prev]);
    try { await apiFetch('/api/alis-faturalari', { method: 'POST', body: JSON.stringify(yeniFatura) }); }
    catch (e) { console.error('AlÄ±ÅŸ fatura eklenemedi:', e); }
    if (formData.cariId) {
      const yeniHareket: CariHareket = {
        id: 'ch' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
        cariId: formData.cariId, tarih: formData.faturaTarihi, islemTuru: 'alis_faturasi',
        tutar: parseFloat(formData.toplamTutar),
        aciklama: `AlÄ±ÅŸ FaturasÄ± (${formData.tedarikciAdi})`,
        bagliFaturaId: yeniFatura.id, olusturmaTarihi: new Date().toISOString().split('T')[0], dekontDosya: null
      };
      setCariHareketler(prev => [yeniHareket, ...prev]);
      try { await apiFetch('/api/cari-hareketler', { method: 'POST', body: JSON.stringify(yeniHareket) }); }
      catch (e) { console.error('Cari hareket eklenemedi:', e); }
    }
    return yeniFatura.id;
  }, []);

  const updateAlisFaturaOdeme = useCallback(async (id: string, odemeTarihi: string, odemeDurumu: 'odenmedi' | 'odendi' | 'bekliyor') => {
    setAlisFaturalari(prev => prev.map(f => f.id === id ? { ...f, odemeTarihi, odemeDurumu } : f));
    try { await apiFetch(`/api/alis-faturalari/${id}`, { method: 'PUT', body: JSON.stringify({ odemeTarihi, odemeDurumu }) }); }
    catch (e) { console.error('AlÄ±ÅŸ odeme gÃ¼ncellenemedi:', e); }
  }, []);

  const deleteAlisFatura = useCallback(async (id: string) => {
    setAlisFaturalari(prev => prev.filter(f => f.id !== id));
    setCariHareketler(prev => prev.filter(h => h.bagliFaturaId !== id));
    try { await apiFetch(`/api/alis-faturalari/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('AlÄ±ÅŸ fatura silinemedi:', e); }
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

    // Ä°lgili ay ve yÄ±ldaki satÄ±ÅŸ faturalarÄ±
    const aylikSatislar = satisFaturalari.filter(f => {
      const faturaTarihi = new Date(f.faturaTarihi);
      return faturaTarihi.getFullYear() === yil && faturaTarihi.getMonth() + 1 === ay;
    });

    // Ä°lgili ay ve yÄ±ldaki alÄ±ÅŸ faturalarÄ±
    const aylikAlislar = alisFaturalari.filter(f => {
      const faturaTarihi = new Date(f.faturaTarihi);
      return faturaTarihi.getFullYear() === yil && faturaTarihi.getMonth() + 1 === ay;
    });

    // KDV HesaplamalarÄ±
    const hesaplananKDV = aylikSatislar.reduce((acc, f) => acc + f.kdvTutari, 0);
    const indirilecekKDV = aylikAlislar.reduce((acc, f) => acc + f.kdvTutari, 0);
    const odenecekKDV = Math.max(0, hesaplananKDV - indirilecekKDV);

    const toplamSatisTevkifat = aylikSatislar.reduce((acc, f) => acc + (f.tevkifatTutari || 0), 0);
    const toplamAlisTevkifat = aylikAlislar.reduce((acc, f) => acc + (f.tevkifatTutari || 0), 0);
    const toplamSatisStopaj = aylikSatislar.reduce((acc, f) => acc + (f.stopajTutari || 0), 0);
    const toplamAlisStopaj = aylikAlislar.reduce((acc, f) => acc + (f.stopajTutari || 0), 0);

    // Gelir Vergisi HesaplamasÄ± (KÃ¼mÃ¼latif - yÄ±lbaÅŸÄ±ndan itibaren)
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

  const addGiderKategorisi = useCallback(async (ad: string) => {
    const yeni: GiderKategorisi = { id: 'cat' + Date.now().toString(), ad };
    setGiderKategorileri(prev => [...prev, yeni]);
    try { await apiFetch('/api/gider-kategorileri', { method: 'POST', body: JSON.stringify(yeni) }); }
    catch (e) { console.error('Kategori eklenemedi:', e); }
  }, []);

  const deleteGiderKategorisi = useCallback(async (id: string) => {
    setGiderKategorileri(prev => prev.filter(c => c.id !== id));
    try { await apiFetch(`/api/gider-kategorileri/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Kategori silinemedi:', e); }
  }, []);


  const loadAllData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const endpoints = [
        '/api/cariler', '/api/cari-hareketler', '/api/satis-faturalari',
        '/api/alis-faturalari', '/api/cek-senetler', '/api/banka-hesaplari',
        '/api/masraf-kurallari', '/api/kesilecek-faturalar', '/api/gider-kategorileri'
      ];
      const resData = await Promise.all(endpoints.map(ep => apiFetch(ep)));
      
      resData.forEach((res, index) => {
        if (res?.success) {
          const data = Array.isArray(res.data) 
            ? (res.data as any[]).filter(item => item && item.id !== undefined && item.id !== null && String(item.id).trim() !== '') 
            : [];
          switch (index) {
            case 0: setCariler(data); break;
            case 1: setCariHareketler(data); break;
            case 2: setSatisFaturalari(data); break;
            case 3: setAlisFaturalari(data); break;
            case 4: setCekSenetler(data); break;
            case 5: setBankaHesaplari(data); break;
            case 6: setMasrafKurallari(data); break;
            case 7: setKesilecekFaturalar(data); break;
            case 8: setGiderKategorileri(data); break;
          }
        }
      });
      if (user?.role === 'admin' || user?.role === 'super_admin') {
        fetchPersonnel();
        fetchLeaves();
        fetchRequests();
        fetchPointages();
      }
      if (user?.role === 'super_admin') {
        fetchCompanies();
      }
      if (user?.role === 'personnel') {
        fetchMyPersonnel();
        fetchLeaves();
        fetchRequests();
        fetchPointages();
      }
    } catch (e) { console.error('Veri yükleme hatası:', e); }
  }, [isAuthenticated, user?.role, fetchPersonnel, fetchLeaves, fetchRequests, fetchPointages, fetchMyPersonnel, fetchCompanies]);

  useEffect(() => {
    if (isAuthenticated) loadAllData();
  }, [isAuthenticated, loadAllData]);

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
        giderKategorileri,
        addGiderKategorisi,
        deleteGiderKategorisi,
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
        bulkUploadPersonnel,
        addPersonnel,
        updatePersonnel,
        deletePersonnel,
        leaves,
        fetchLeaves,
        submitLeaveRequest,
        updateLeaveStatus,
        requests,
        fetchRequests,
        updateRequestStatus,
        submitExpenseRequest,
        uploadPersonnelDocument,
        submitPointage,
        bulkLockPointage,
        bulkLockAllPersonnel,
        pointages,
        fetchPointages,
        downloadPuantajTemplate,
        uploadPuantajExcel,
        companies,
        fetchCompanies,
        addCompany,
        updateCompany,
        deleteCompany
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

