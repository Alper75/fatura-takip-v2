/**
 * @file Interface definitions for the Stock (Inventory) module.
 */

/**
 * Represents a Product in the inventory.
 */
export interface IUrun {
  id: string;
  stokKodu: string;
  barkod?: string;
  urunAdi: string;
  kategoriId?: string | null;
  anaBirim: string; // e.g., 'Adet', 'Kg', 'Metre'
  minimumStok: number;
  maksimumStok?: number;
  lotTakibi?: boolean;
  sonKullanmaTarihli?: boolean;
  aktif: boolean;
  birimFiyat: number; // Default/Latest base cost for valuation
  aciklama?: string;
}

/**
 * Represents a Warehouse (Depo).
 */
export interface IDepo {
  id: string;
  kod: string;
  ad: string;
  adres?: string;
  varsayilan: boolean;
  aktif: boolean;
}

/**
 * Represents a Stock Movement (Entry, Exit, or Transfer).
 */
export interface IStokHareket {
  id: string;
  urunId: string;
  depoId: string;
  tip: 'GIRIS' | 'CIKIS' | 'TRANSFER_GIRIS' | 'TRANSFER_CIKIS' | 'SAYIM_GIRIS' | 'SAYIM_CIKIS';
  miktar: number;
  birimFiyat: number;
  tutar: number;
  tarih: string; // ISO string
  aciklama?: string;
  referans?: string; // Fatura No / İrsaliye No
  cariId?: string; // Tedarikçi veya Müşteri
  lotNo?: string;
  sonKullanmaTarihi?: string;
  transferNo?: string; // Gruplanmış transfer ID
  iptal?: boolean; // Soft delete
}

/**
 * Represents a Stock Taking Session (Sayım Seansı).
 */
export interface IStokSayim {
  id: string;
  depoId: string;
  tarih: string;
  durum: 'TASLAK' | 'ONAYLANDI';
  aciklama?: string;
  onaylayanKullanici?: string;
}

/**
 * Represents an item in a Stock Taking Session.
 */
export interface IStokSayimKalem {
  id: string;
  sayimId: string;
  urunId: string;
  sistemMiktari: number;
  sayimMiktari: number;
  fark: number;
}

export interface IStokMevcut {
  urunId: string;
  depoId: string;
  miktar: number;
}

/**
 * Represents a Stock Category.
 */
export interface IStokKategori {
  id: string;
  ad: string;
}
