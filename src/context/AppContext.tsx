import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuthAndCompanies } from './hooks/useAuthAndCompanies';
import { usePersonelIK } from './hooks/usePersonelIK';
import { useCariBanka } from './hooks/useCariBanka';
import { useFaturalar } from './hooks/useFaturalar';
import { useTeklifSiparisLuca } from './hooks/useTeklifSiparisLuca';

import { apiFetch } from '@/lib/api';
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
  Vehicle,
  ViewType,
  OdemeDurumu,
  VergiRaporu,
  MasrafKurali,
  KesilecekFatura,
  Personnel,
  GiderKategorisi,
  Company,
  Teklif,
  Siparis
} from '@/types';


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
  updateCari: (id: string, data: Partial<CariFormData>) => void;
  deleteCari: (id: string) => void;

  // ==================== CARİ HAREKET (LEDGER) ====================
  cariHareketler: CariHareket[];
  addCariHareket: (hareket: Omit<CariHareket, 'id' | 'olusturmaTarihi'>) => void;
  updateCariHareket: (id: string, data: Partial<CariHareket>) => void;
  deleteCariHareket: (id: string) => void;
  hesaplaCariBakiye: (cariId: string) => CariBakiyeOzet;

  // ==================== SATIÅ FATURALARI ====================
  satisFaturalari: SatisFatura[];
  addSatisFatura: (fatura: SatisFaturaFormData) => void;
  updateSatisFatura: (id: string, data: SatisFaturaFormData) => void;
  updateSatisFaturaOdeme: (id: string, odemeTarihi: string, durum: OdemeDurumu, bankaId?: string) => void;
  uploadSatisPdf: (faturaId: string, file: File) => void;
  uploadSatisDekont: (faturaId: string, file: File) => void;
  downloadSatisPdf: (faturaId: string) => void;
  downloadSatisDekont: (faturaId: string) => void;
  deleteSatisFatura: (id: string) => void;

  // ==================== ALIŞ FATURALARI ====================
  alisFaturalari: AlisFatura[];
  addAlisFatura: (fatura: AlisFaturaFormData) => void;
  updateAlisFatura: (id: string, data: AlisFaturaFormData) => void;
  updateAlisFaturaOdeme: (id: string, odemeTarihi: string, durum: OdemeDurumu, bankaId?: string) => void;
  uploadAlisPdf: (faturaId: string, file: File) => void;
  uploadAlisDekont: (faturaId: string, file: File) => void;
  downloadAlisPdf: (faturaId: string) => void;
  downloadAlisDekont: (faturaId: string) => void;
  deleteAlisFatura: (id: string) => void;

  // ==================== XML UPLOAD ====================
  parseInvoiceXml: (file: File) => Promise<{ success: boolean; data?: any; message?: string }>;

  // ==================== VERGI HESAPLAMA ====================
  getVergiRaporu: (yil: number, ay: number) => VergiRaporu;

  // ==================== DRAWER ====================
  isSatisDrawerOpen: boolean;
  isAlisDrawerOpen: boolean;
  isCariDrawerOpen: boolean;
  satisInitialData: Partial<SatisFaturaFormData> | null;
  openSatisDrawer: (initialData?: Partial<SatisFaturaFormData>) => void;
  closeSatisDrawer: () => void;
  alisInitialData: Partial<AlisFaturaFormData> | null;
  openAlisDrawer: (initialData?: Partial<AlisFaturaFormData>) => void;
  closeAlisDrawer: () => void;
  openCariDrawer: (id?: string) => void;
  closeCariDrawer: () => void;
  isCariEkstreDrawerOpen: boolean;
  openCariEkstreDrawer: (id: string) => void;
  closeCariEkstreDrawer: () => void;
  selectedCariId: string | null;

  isSirketBilgileriOpen: boolean;
  openSirketBilgileri: () => void;
  closeSirketBilgileri: () => void;
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
  // ==================== GİDER KATEGORİLERİ ====================
    giderKategorileri: GiderKategorisi[];
    addGiderKategorisi: (ad: string, muhasebeKodu?: string, id?: string, tip?: 'GIDER' | 'GELIR') => void;
    updateGiderKategorisi: (id: string, data: Partial<GiderKategorisi>) => void;
    deleteGiderKategorisi: (id: string) => void;
  // ==================== HESAPLAMALAR ====================
  calculateFaturaHesaplamalari: (tutar: number, kdvStr: string, tevStr?: string, stopajStr?: string) => any;
  
  // ==================== PERSONEL MODÜLÜ ====================
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

  // ==================== SUPER ADMIN & COMPANY ====================
  companies: Company[];
  activeCompany: Company | null;
  isIsletmeDefteri: boolean;
  fetchCompanies: () => Promise<void>;
  addCompany: (data: Omit<Company, 'id'>) => Promise<{ success: boolean; message?: string }>;
  updateCompany: (id: number, data: Partial<Company>) => Promise<{ success: boolean; message?: string }>;
  updateMyCompany: (data: Partial<Company>) => Promise<{ success: boolean; message?: string }>;
  deleteCompany: (id: number) => Promise<{ success: boolean; message?: string }>;
  
  // ==================== ARAÇ YÖNETİMİ ====================
  addVehicle: (data: Omit<Vehicle, 'id'>) => Promise<{ success: boolean; message?: string }>;
  deleteVehicle: (id: number) => Promise<{ success: boolean; message?: string }>;

  // ==================== LUCA ENTEGRASYON ====================
  lucaAccounts: { kod: string; ad: string; tur?: string }[];
  fetchLucaAccounts: () => Promise<void>;
  syncLucaAccounts: () => void;
  autoSyncLucaAccounts: () => Promise<{ success: boolean; message?: string; count?: number }>;

  // ==================== TEKLİFLER ====================
  teklifler: Teklif[];
  addTeklif: (data: any) => Promise<{ success: boolean; data?: any; message?: string }>;
  updateTeklif: (id: string, data: any) => Promise<{ success: boolean; message?: string }>;
  deleteTeklif: (id: string) => Promise<{ success: boolean; message?: string }>;
  fetchPublicTeklif: (token: string) => Promise<{ success: boolean; data?: any; message?: string }>;
  approvePublicTeklif: (token: string) => Promise<{ success: boolean; data?: any; message?: string }>;

  // ==================== SİPARİŞLER ====================
  siparisler: Siparis[];
  updateSiparis: (id: string, data: any) => Promise<{ success: boolean; message?: string }>;
  deleteSiparis: (id: string) => Promise<{ success: boolean; message?: string }>;
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
  fetchCariler: () => Promise<void>;
  fetchCariHareketler: () => Promise<void>;
  fetchAlisFaturalari: () => Promise<void>;
  fetchSatisFaturalari: () => Promise<void>;

  // ==================== RBAC & KULLANICI YÖNETİMİ ====================
  companyUsers: User[];
  fetchCompanyUsers: () => Promise<void>;
  addCompanyUser: (data: any) => Promise<{ success: boolean; message?: string }>;
  updateCompanyUser: (id: number, data: any) => Promise<{ success: boolean; message?: string }>;
  deleteCompanyUser: (id: number) => Promise<{ success: boolean; message?: string }>;
  resetUserPassword: (id: number, newPassword?: string) => Promise<{ success: boolean; message?: string }>;
  canAccess: (permissionKey: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);


export function AppProvider({ children }: { children: React.ReactNode }) {
  // ==================== VIEW & DRAWER STATE ====================
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isSatisDrawerOpen, setIsSatisDrawerOpen] = useState(false);
  const [isAlisDrawerOpen, setIsAlisDrawerOpen] = useState(false);
  const [isCariDrawerOpen, setIsCariDrawerOpen] = useState(false);
  const [isCariEkstreDrawerOpen, setIsCariEkstreDrawerOpen] = useState(false);
  const [isSirketBilgileriOpen, setIsSirketBilgileriOpen] = useState(false);
  const [selectedCariId, setSelectedCariId] = useState<string | null>(null);
  const [satisInitialData, setSatisInitialData] = useState<Partial<SatisFaturaFormData> | null>(null);
  const [alisInitialData, setAlisInitialData] = useState<Partial<AlisFaturaFormData> | null>(null);
  const [isCekSenetDrawerOpen, setIsCekSenetDrawerOpen] = useState(false);
  const [selectedCekSenetId, setSelectedCekSenetId] = useState<string | null>(null);
  const [isBankaDrawerOpen, setIsBankaDrawerOpen] = useState(false);
  const [selectedBankaId, setSelectedBankaId] = useState<string | null>(null);

  const fetchMyPersonnelRef = useRef<() => void>(() => {});
  const resetAllRef = useRef<() => void>(() => {});

  const authHook = useAuthAndCompanies({
    onNavigate: setCurrentView,
    onFetchMyPersonnel: () => fetchMyPersonnelRef.current(),
    onReset: () => resetAllRef.current(),
  });

  const personelHook = usePersonelIK({ user: authHook.user });
  fetchMyPersonnelRef.current = personelHook.fetchMyPersonnel;

  const cariBankaHook = useCariBanka({
    isAuthenticated: authHook.isAuthenticated,
  });

  const faturaHook = useFaturalar({
    isAuthenticated: authHook.isAuthenticated,
    setCariHareketler: cariBankaHook.setCariHareketler,
  });

  const teklifLucaHook = useTeklifSiparisLuca();

  resetAllRef.current = () => {
    personelHook.setPersonnel([]);
    personelHook.setCurrentPersonnel(null);
    cariBankaHook.setCariler([]);
    cariBankaHook.setCariHareketler([]);
    faturaHook.setSatisFaturalari([]);
    faturaHook.setAlisFaturalari([]);
    cariBankaHook.setCekSenetler([]);
    cariBankaHook.setBankaHesaplari([]);
    cariBankaHook.setMasrafKurallari([]);
    cariBankaHook.setKesilecekFaturalar([]);
    cariBankaHook.setGiderKategorileri([]);
    teklifLucaHook.setLucaAccounts([]);
    teklifLucaHook.setTeklifler([]);
    teklifLucaHook.setSiparisler([]);
    setCurrentView('dashboard');
  };

  // ==================== DRAWER FUNCTIONS ====================
  const openSatisDrawer = useCallback((initialData?: Partial<SatisFaturaFormData>) => {
    setSatisInitialData(initialData || null);
    setIsSatisDrawerOpen(true);
  }, []);
  const closeSatisDrawer = useCallback(() => {
    setIsSatisDrawerOpen(false);
    setSatisInitialData(null);
  }, []);
  const openAlisDrawer = useCallback((initialData?: Partial<AlisFaturaFormData>) => {
    setAlisInitialData(initialData || null);
    setIsAlisDrawerOpen(true);
  }, []);
  const closeAlisDrawer = useCallback(() => {
    setIsAlisDrawerOpen(false);
    setAlisInitialData(null);
  }, []);
  const openCariDrawer = useCallback((id?: string) => {
    setSelectedCariId(id || null);
    setIsCariDrawerOpen(true);
  }, []);
  const closeCariDrawer = useCallback(() => {
    setIsCariDrawerOpen(false);
    setSelectedCariId(null);
  }, []);
  const openCariEkstreDrawer = useCallback((id?: string) => {
    setSelectedCariId(id || null);
    setIsCariEkstreDrawerOpen(true);
  }, []);
  const closeCariEkstreDrawer = useCallback(() => {
    setIsCariEkstreDrawerOpen(false);
    setSelectedCariId(null);
  }, []);
  const openSirketBilgileri = () => setIsSirketBilgileriOpen(true);
  const closeSirketBilgileri = () => setIsSirketBilgileriOpen(false);

  const openCekSenetDrawer = useCallback((id?: string) => {
    setSelectedCekSenetId(id || null);
    setIsCekSenetDrawerOpen(true);
  }, []);
  const closeCekSenetDrawer = useCallback(() => {
    setIsCekSenetDrawerOpen(false);
    setSelectedCekSenetId(null);
  }, []);

  const openBankaDrawer = useCallback((id?: string) => {
    setSelectedBankaId(id || null);
    setIsBankaDrawerOpen(true);
  }, []);
  const closeBankaDrawer = useCallback(() => {
    setIsBankaDrawerOpen(false);
    setSelectedBankaId(null);
  }, []);

  const loadAllData = useCallback(async () => {
    if (!authHook.isAuthenticated) return;
    try {
      const endpoints = [
        '/api/cariler', '/api/cari-hareketler', '/api/satis-faturalari',
        '/api/alis-faturalari', '/api/cek-senetler', '/api/banka-hesaplari',
        '/api/masraf-kurallari', '/api/kesilecek-faturalar', '/api/gider-kategorileri',
        '/api/luca/hesap-plani', '/api/teklifler', '/api/siparisler'
      ];
      const resData = await Promise.all(endpoints.map(ep => apiFetch(ep)));

      resData.forEach((res, index) => {
        if (res?.success) {
          const data = Array.isArray(res.data)
            ? (res.data as any[]).filter(item => {
                if (!item) return false;
                if (index === 9) {
                  return item.kod !== undefined && item.kod !== null && String(item.kod).trim() !== '';
                }
                return item.id !== undefined && item.id !== null && String(item.id).trim() !== '';
              })
            : [];
          switch (index) {
            case 0: cariBankaHook.setCariler(data); break;
            case 1: cariBankaHook.setCariHareketler(data); break;
            case 2: faturaHook.setSatisFaturalari(data); break;
            case 3: faturaHook.setAlisFaturalari(data); break;
            case 4: cariBankaHook.setCekSenetler(data); break;
            case 5: cariBankaHook.setBankaHesaplari(data); break;
            case 6: cariBankaHook.setMasrafKurallari(data); break;
            case 7: cariBankaHook.setKesilecekFaturalar(data); break;
            case 8: cariBankaHook.setGiderKategorileri(data); break;
            case 9: teklifLucaHook.setLucaAccounts(data); break;
            case 10: teklifLucaHook.setTeklifler(data); break;
            case 11: teklifLucaHook.setSiparisler(data); break;
          }
        }
      });
      if (authHook.user?.role === 'admin' || authHook.user?.role === 'super_admin') {
        personelHook.fetchPersonnel();
        personelHook.fetchLeaves();
        personelHook.fetchRequests();
        personelHook.fetchPointages();
      }
      authHook.fetchCompanies();
      if (authHook.user?.role === 'personnel') {
        personelHook.fetchMyPersonnel();
        personelHook.fetchLeaves();
        personelHook.fetchRequests();
        personelHook.fetchPointages();
      }
      teklifLucaHook.fetchLucaAccounts();
    } catch (e) {
      console.error('Veri yükleme hatası:', e);
    }
  }, [
    authHook.isAuthenticated,
    authHook.user?.role,
    personelHook.fetchPersonnel,
    personelHook.fetchLeaves,
    personelHook.fetchRequests,
    personelHook.fetchPointages,
    personelHook.fetchMyPersonnel,
    authHook.fetchCompanies,
    teklifLucaHook.fetchLucaAccounts,
    teklifLucaHook.fetchTeklifler,
    teklifLucaHook.fetchSiparisler,
  ]);

  useEffect(() => {
    if (authHook.isAuthenticated) {
      authHook.fetchCompanies();
      loadAllData();
    }
  }, [authHook.isAuthenticated, authHook.fetchCompanies, loadAllData]);

  return (
    <AppContext.Provider
      value={{
        ...authHook,
        ...personelHook,
        ...cariBankaHook,
        ...faturaHook,
        ...teklifLucaHook,
        currentView,
        setCurrentView,
        isSatisDrawerOpen,
        openSatisDrawer,
        closeSatisDrawer,
        satisInitialData,
        isAlisDrawerOpen,
        openAlisDrawer,
        closeAlisDrawer,
        alisInitialData,
        isCariDrawerOpen,
        openCariDrawer,
        closeCariDrawer,
        isCariEkstreDrawerOpen,
        openCariEkstreDrawer,
        closeCariEkstreDrawer,
        selectedCariId,
        setSelectedCariId,
        isSirketBilgileriOpen,
        openSirketBilgileri,
        closeSirketBilgileri,
        isCekSenetDrawerOpen,
        openCekSenetDrawer,
        closeCekSenetDrawer,
        selectedCekSenetId,
        isBankaDrawerOpen,
        openBankaDrawer,
        closeBankaDrawer,
        selectedBankaId,
        apiFetch,
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
