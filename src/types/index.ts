// Fatura tip tanımlamaları

// ==================== SATIŞ FATURASI ====================
export interface SatisFatura {
  id: string;
  faturaNo?: string;
  tcVkn: string;
  ad: string;
  soyad: string;
  adres: string;
  kdvOrani: number;
  alinanUcret: number; // KDV dahil toplam tutar
  matrah: number; // KDV hariç tutar
  kdvTutari: number;
  tevkifatOrani?: string;
  tevkifatTutari?: number;
  tevkifatKodu?: string;    // Luca tevkifat kodu (örn: 616)
  stopajOrani?: string;
  stopajTutari?: number;
  stopajKodu?: string;      // SMM stopaj kodu (örn: 022)
  muhasebeKodu?: string;    // Luca ana hesap kodu
  // PDF ve Tarih Bilgileri
  pdfDosya?: string | null;
  pdfDosyaAdi?: string;
  faturaTarihi: string; // Fatura düzenleme tarihi
  // Ödeme Bilgileri
  odemeTarihi?: string | null;
  odemeDurumu: 'odenmedi' | 'odendi' | 'bekliyor';
  odemeDekontu?: string | null; // Ödeme dekontu PDF
  odemeDekontuAdi?: string;
  olusturmaTarihi: string;
  // Cari Kart Bağlantısı
  cariId?: string;
  // Vade Takibi
  vadeTarihi?: string | null;
  aciklama?: string;
  stokKalemleri?: any[];
}

export interface SatisFaturaFormData {
  faturaNo?: string;
  tcVkn: string;
  ad: string;
  soyad: string;
  adres: string;
  kdvOrani: string;
  alinanUcret: string;
  faturaTarihi: string;
  tevkifatOrani?: string;
  tevkifatKodu?: string;    // Luca tevkifat kodu (örn: 616)
  stopajOrani?: string;
  stopajKodu?: string;      // SMM stopaj kodu (örn: 022)
  muhasebeKodu?: string;    // Luca ana hesap kodu
  dosyaBase64?: string;
  dosyaAdi?: string;
  cariId?: string;
  vadeTarihi?: string;
  aciklama?: string;
  // Stok Entegrasyonu
  urunId?: string;
  depoId?: string;
}

// ==================== CARİ KART ====================
export type CariTip = 'musteri' | 'tedarikci' | 'ikisi';

export interface Cari {
  id: string;
  tip: CariTip;
  unvan: string; // Ad/Soyad veya Şirket Ünvanı
  vknTckn: string;
  vergiDairesi?: string;
  adres?: string;
  telefon?: string;
  eposta?: string;
  muhasebeKodu?: string;
  olusturmaTarihi: string;
}

export interface CariFormData {
  tip: CariTip;
  unvan: string;
  vknTckn: string;
  vergiDairesi?: string;
  adres?: string;
  telefon?: string;
  eposta?: string;
  muhasebeKodu?: string;
}

// ==================== ALIŞ FATURASI ====================
export interface AlisFatura {
  id: string;
  faturaNo: string;
  faturaTarihi: string;
  tedarikciAdi: string;
  tedarikciVkn: string;
  malHizmetAdi: string;
  toplamTutar: number; // KDV dahil toplam
  kdvOrani: number;
  kdvTutari: number;
  matrah: number; // toplamTutar - kdvTutari
  tevkifatOrani?: string;
  tevkifatTutari?: number;
  stopajOrani?: string;
  stopajTutari?: number;
  tevkifatKodu?: string;
  stopajKodu?: string;
  muhasebeKodu?: string;
  // PDF
  pdfDosya?: string | null;
  pdfDosyaAdi?: string;
  // Ödeme
  odemeTarihi?: string | null;
  odemeDurumu: 'odenmedi' | 'odendi' | 'bekliyor';
  odemeDekontu?: string | null;
  odemeDekontuAdi?: string;
  olusturmaTarihi: string;
  cariId?: string;
  vadeTarihi?: string | null;
  aciklama?: string;
  // Stok Entegrasyonu
  urunId?: string;
  depoId?: string;
  vehiclePlate?: string;
}

export interface AlisFaturaFormData {
  faturaNo: string;
  faturaTarihi: string;
  tedarikciAdi: string;
  tedarikciVkn: string;
  malHizmetAdi: string;
  toplamTutar: string; // KDV dahil
  kdvOrani: string;
  tevkifatOrani?: string;
  stopajOrani?: string;
  muhasebeKodu?: string;
  dosyaBase64?: string;
  dosyaAdi?: string;
  cariId?: string;
  vadeTarihi?: string;
  aciklama?: string;
  // Stok Entegrasyonu
  urunId?: string;
  depoId?: string;
  vehiclePlate?: string;
}

// ==================== CARİ HAREKET (Bakiye / Ekstre İşlemleri) ====================
export type IslemTuru = 'satis_faturasi' | 'alis_faturasi' | 'tahsilat' | 'odeme' | 'cek_senet_alinan' | 'cek_senet_verilen' | 'vergi_kdv' | 'vergi_muhtasar' | 'vergi_gecici' | 'vergi_damga' | 'maas_odemesi' | 'kira_odemesi' | 'banka_masrafi' | 'ssk_odemesi' | 'genel_gider' | 'kredi_karti_odemesi' | 'transfer';

export interface CariHareket {
  id: string;
  cariId: string;
  tarih: string;
  islemTuru: IslemTuru;
  tutar: number;
  aciklama: string;
  bagliFaturaId?: string | null;
  olusturmaTarihi: string;
  dekontDosya?: string | null;
  bankaId?: string | null;
  kategoriId?: string | null;
  muhasebeKodu?: string;
}

export interface CariBakiyeOzet {
  toplamBorc: number;
  toplamAlacak: number;
  tahsilEdilen: number;
  odenen: number;
  guncelBakiye: number; // Mutlak değer
  bakiyeDurumu: 'borclu' | 'alacakli' | 'kapali';
}

export interface CekSenet {
  id: string;
  tip: 'cek' | 'senet';
  islemTipi: 'alinan' | 'verilen';
  cariId: string;
  belgeNo: string;
  tutar: number;
  vadeTarihi: string;
  verilisTarihi: string;
  durum: 'bekliyor' | 'odendi' | 'karsiliksiz';
  aciklama?: string;
}

export interface CekSenetFormData extends Omit<CekSenet, 'id'> {}

// ==================== BANKA HESAPLARI ====================
export interface BankaHesabi {
  id: string;
  hesapAdi: string;
  bankaAdi: string;
  iban: string;
  hesapNo?: string;
  kartNo?: string;
  dovizTuru: 'TRY' | 'USD' | 'EUR';
  guncelBakiye: number;
}

export interface BankaHesabiFormData extends Omit<BankaHesabi, 'id'> {}

// ==================== KULLANICI ====================
export interface User {
  id?: number;
  tc: string;
  email?: string;
  password?: string;
  role: 'admin' | 'personnel' | 'super_admin';
  token?: string;
  mustChangePassword?: boolean;
  companyId?: number;
}

export interface Vehicle {
  id: number;
  plate: string;
  type: 'passenger' | 'commercial';
  brand_model?: string;
}

export interface Company {
  id: number;
  name: string;
  tax_no?: string;
  address?: string;
  email?: string;
  company_type?: string;
  status: 'active' | 'passive';
  vehicles?: Vehicle[];
}

export interface CompanyFolder {
  id: string;
  company_id: number;
  parent_id?: string | null;
  name: string;
  created_at: string;
}

export interface CompanyFile {
  id: string;
  company_id: number;
  folder_id?: string | null;
  name: string;
  size: number;
  type: string;
  created_at: string;
}

// ==================== PERSONEL MODÜLÜ ====================

export interface Personnel {
  id: number;
  user_id: number;
  tc?: string;
  must_change_password?: boolean;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address?: string;
  start_date?: string;
  end_date?: string;
  position?: string;
  department?: string;
  iban?: string;
  salary?: number;
  annual_leave_days: number;
  status?: 'Active' | 'Inactive';
  created_at?: string;
  puantaj_menu_active?: boolean;
}

export interface Pointage {
  id: number;
  personnel_id: number;
  date: string;
  status: string;
  overtime_hours: number;
  is_locked?: boolean;
}

export interface Leave {
  id: number;
  personnel_id: number;
  first_name?: string;
  last_name?: string;
  type: 'Annual' | 'Unpaid' | 'Maternity' | 'Sickness';
  start_date: string;
  end_date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  description?: string;
  created_at: string;
}

export interface Document {
  id: number;
  personnel_id: number;
  type: string;
  file_name: string;
  file_path: string;
  upload_date: string;
}

export interface Asset {
  id: number;
  personnel_id: number;
  name: string;
  serial_number?: string;
  given_date?: string;
  return_date?: string;
}

export interface Training {
  id: number;
  personnel_id: number;
  name: string;
  date?: string;
  expiry_date?: string;
  certificate_path?: string;
}

export interface Payroll {
  id: number;
  personnel_id: number;
  month: number;
  year: number;
  base_salary: number;
  bonuses: number;
  deductions: number;
  net_salary: number;
}

export interface PersonnelRequest {
  id: number;
  personnel_id: number;
  first_name?: string;
  last_name?: string;
  type: 'Advance' | 'Expense';
  amount: number;
  date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  description?: string;
  receipt_path?: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

// ==================== VERGI HESAPLAMA ====================
export interface VergiRaporu {
  ay: number;
  ayAdi: string;
  yil: number;
  // KDV
  hesaplananKDV: number; // Satışlardan hesaplanan KDV
  indirilecekKDV: number; // Alışlardan indirilecek KDV
  odenecekKDV: number; // hesaplananKDV - indirilecekKDV
  toplamSatisTevkifat: number;
  toplamAlisTevkifat: number;
  toplamSatisStopaj: number;
  toplamAlisStopaj: number;
  // Gelir Vergisi (Kümülatif)
  toplamMatrah: number;
  gelirVergisiOrani: number;
  hesaplananGelirVergisi: number;
  // Detaylar
  satisAdet: number;
  alisAdet: number;
}

// ==================== MASRAF KURALLARI ====================
export interface MasrafKurali {
  id: string;
  anahtarKelime: string;
  islemTuru: IslemTuru;
  aciklama?: string;
}

// ==================== GİDER KATEGORİSİ ====================
export interface GiderKategorisi {
  id: string;
  ad: string;
}

// ==================== KESİLECEK FATURALAR ====================
export interface FaturaKalemi {
  id: string;
  urunId?: string;
  ad: string;
  miktar: number;
  birim: string;          // GİB kodu: 'C62'=Adet, 'HUR'=Saat, 'KGM'=kg vb.
  birimFiyat: number;
  kdvOrani: number;
  tevkifatOrani: number;  // % olarak: 30 = %30 = 3/10 (sayı)
  tevkifatKodu?: string;  // GİB kodu: '616', '802' vb.
}

export interface KesilecekFatura {
  id: string;
  ad: string;
  soyad?: string;
  vknTckn: string;
  vergiDairesi?: string;
  adres: string;
  il?: string;
  ilce?: string;
  tutar: number;
  kdvDahil: boolean;
  kdvOrani?: number;
  faturaTarihi?: string;
  aciklama?: string;
  kalemler?: FaturaKalemi[];
  faturaTipi?: string;    // GİB portal değeri: SATIS, TEVKIFAT, IADE vb.
  stopajTipi?: string;    // 'V0011' (KV) | 'V0003' (GV)
  stopajOrani?: string;   // % Stopaj oranı
  olusturmaTarihi: string;
  durum: 'bekliyor' | 'kesildi';
  cariId?: string;
}

// ==================== TEKLİFLER ====================
export interface TeklifKalemi {
  id?: string;
  teklif_id?: string;
  urun_id?: string;
  urun_adi: string;
  miktar: number;
  birim: string;
  birim_fiyat: number;
  kdv_orani: number;
  toplam_tutar: number;
}

export interface Teklif {
  id: string;
  teklif_no: string;
  tarih: string;
  vade_tarihi?: string | null;
  cari_id?: string | null;
  musteri_adi?: string | null;
  musteri_vkn?: string | null;
  musteri_vergi_dairesi?: string | null;
  musteri_adres?: string | null;
  musteri_eposta?: string | null;
  musteri_telefon?: string | null;
  toplam_tutar: number;
  durum: string;
  notlar?: string | null;
  onay_token: string;
  company_id: number;
  created_at: string;
  kalemler?: TeklifKalemi[];
}

// ==================== SİPARİŞLER ====================
export interface SiparisKalemi {
  id?: string;
  siparis_id?: string;
  urun_id?: string;
  urun_adi: string;
  miktar: number;
  birim: string;
  birim_fiyat: number;
  kdv_orani: number;
  toplam_tutar: number;
}

export interface Siparis {
  id: string;
  siparis_no: string;
  teklif_id?: string | null;
  tarih: string;
  cari_id?: string | null;
  musteri_adi?: string | null;
  toplam_tutar: number;
  durum: string;
  company_id: number;
  created_at: string;
  kalemler?: SiparisKalemi[];
}

// ==================== VIEW TYPES ====================
export type ViewType = 
  | 'dashboard' 
  | 'cari-liste' 
  | 'satis-liste' 
  | 'alis-liste' 
  | 'cek-senet-liste' 
  | 'banka-liste' 
  | 'vergi-raporu' 
  | 'ayarlar' 
  | 'banka-ekstre-liste' 
  | 'expense-liste'
  | 'kesilecek-fatura-liste'
  | 'personel-liste'
  | 'personel-dashboard'
  | 'izin-yonetimi'
  | 'talep-yonetimi'
  | 'puantaj-cetveli'
  | 'personel-izinlerim'
  | 'personel-masraflarim'
  | 'kisisel-puantaj'
  | 'stok-yonetimi'
  | 'super-admin'
  | 'luca-ayarlari'
  | 'teklif-liste'
  | 'siparis-liste'
  | 'mutabakat-yonetimi'
  | 'sirket-dosyalari';

// ==================== FATURA DURUMU ====================
export type OdemeDurumu = 'odenmedi' | 'odendi' | 'bekliyor';

export const ODEME_DURUMU_LABELS: Record<OdemeDurumu, string> = {
  'odenmedi': 'Ödenmedi',
  'odendi': 'Ödendi',
  'bekliyor': 'Bekliyor'
};

export const ODEME_DURUMU_COLORS: Record<OdemeDurumu, string> = {
  'odenmedi': 'bg-red-100 text-red-700',
  'odendi': 'bg-green-100 text-green-700',
  'bekliyor': 'bg-yellow-100 text-yellow-700'
};

// ==================== AY LISTESI ====================
export const AYLAR = [
  { value: 1, label: 'Ocak' },
  { value: 2, label: 'Şubat' },
  { value: 3, label: 'Mart' },
  { value: 4, label: 'Nisan' },
  { value: 5, label: 'Mayıs' },
  { value: 6, label: 'Haziran' },
  { value: 7, label: 'Temmuz' },
  { value: 8, label: 'Aralık' },
  { value: 9, label: 'Eylül' },
  { value: 10, label: 'Ekim' },
  { value: 11, label: 'Kasım' },
  { value: 12, label: 'Aralık' },
];

// Gelir Vergisi Dilimleri (2024)
export const GELIR_VERGISI_DILIMLERI = [
  { limit: 110000, oran: 15 },
  { limit: 230000, oran: 20 },
  { limit: 580000, oran: 27 },
  { limit: 3000000, oran: 35 },
  { limit: Infinity, oran: 40 },
];

// ==================== MUTABAKAT ====================
export type MutabakatDurum = 'Bekliyor' | 'Mutabık' | 'Onaysız';

export interface Mutabakat {
  id: string;
  cariId?: string;
  donem: string;
  tip: 'CARI';
  borc: number;
  alacak: number;
  bakiye: number;
  durum: MutabakatDurum;
  token: string;
  gonderimTarihi: string;
  yanitTarihi?: string;
  aciklama?: string;
  kullaniciMuavinPath?: string;
  karsiMuavinPath?: string;
  aiAnalizSonucu?: string;
  olusturmaTarihi: string;
  
  // Joins (UI representation)
  cariUnvan?: string;
  cariVkn?: string;
  cariEposta?: string;
}
