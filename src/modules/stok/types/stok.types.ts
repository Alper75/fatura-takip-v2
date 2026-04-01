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
  aktif: boolean;
}

/**
 * Represents a Warehouse (Depo).
 */
export interface IDepo {
  id: string;
  kod: string;
  ad: string;
  varsayilan: boolean;
  aktif: boolean;
}

/**
 * Represents a Stock Movement (Entry or Exit).
 */
export interface IStokHareket {
  id: string;
  urunId: string;
  depoId: string;
  tip: 'GIRIS' | 'CIKIS';
  miktar: number;
  tarih: string; // ISO string
  aciklama?: string;
}

/**
 * Represents current stock levels in a specific warehouse.
 */
export interface IStokMevcut {
  urunId: string;
  depoId: string;
  miktar: number;
}
