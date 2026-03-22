// Fatura tip tanımlamaları

// ==================== SATIŞ FATURASI ====================
export interface SatisFatura {
  id: string;
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
  stopajOrani?: string;
  stopajTutari?: number;
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
}

export interface SatisFaturaFormData {
  tcVkn: string;
  ad: string;
  soyad: string;
  adres: string;
  kdvOrani: string;
  alinanUcret: string;
  faturaTarihi: string;
  tevkifatOrani?: string;
  stopajOrani?: string;
  dosyaBase64?: string;
  dosyaAdi?: string;
  cariId?: string;
  vadeTarihi?: string;
  aciklama?: string;
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
  dosyaBase64?: string;
  dosyaAdi?: string;
  cariId?: string;
  vadeTarihi?: string;
  aciklama?: string;
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
  role: 'admin' | 'personnel';
  token?: string;
  mustChangePassword?: boolean;
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
  position?: string;
  department?: string;
  iban?: string;
  salary?: number;
  annual_leave_days: number;
  created_at?: string;
}

export interface Pointage {
  id: number;
  personnel_id: number;
  date: string;
  status: string;
  overtime_hours: number;
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

// ==================== KESİLECEK FATURALAR ====================
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
  olusturmaTarihi: string;
  durum: 'bekliyor' | 'kesildi';
  cariId?: string;
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
  | 'personel-masraflarim';

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
  { value: 8, label: 'Ağustos' },
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
