import type { IUrun, IDepo, IStokHareket } from '../types/stok.types';

/**
 * Common delay function to simulate API calls.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock data storage.
 */
let urunler: IUrun[] = [
  { id: '1', stokKodu: 'STK-001', barkod: '8690000000001', urunAdi: 'Laptop Standı', kategoriId: '1', anaBirim: 'Adet', minimumStok: 5, aktif: true },
  { id: '2', stokKodu: 'STK-002', barkod: '8690000000002', urunAdi: 'Kablosuz Mouse', kategoriId: '1', anaBirim: 'Adet', minimumStok: 10, aktif: true },
  { id: '3', stokKodu: 'STK-003', barkod: '8690000000003', urunAdi: 'USB-C Hub', kategoriId: '1', anaBirim: 'Adet', minimumStok: 2, aktif: true },
];

let depolar: IDepo[] = [
  { id: '1', kod: 'DP-001', ad: 'Ana Depo', varsayilan: true, aktif: true },
];

let stokHareketler: IStokHareket[] = [
  { id: '1', urunId: '1', depoId: '1', tip: 'GIRIS', miktar: 20, tarih: new Date().toISOString(), aciklama: 'Açılış Stoğu' },
  { id: '2', urunId: '2', depoId: '1', tip: 'GIRIS', miktar: 50, tarih: new Date().toISOString(), aciklama: 'Açılış Stoğu' },
];

const kategoriler = [
  { id: '1', ad: 'Ham Madde' },
  { id: '2', ad: 'Mamul' },
  { id: '3', ad: 'Ticari Mal' },
  { id: '4', ad: 'Yarı Mamul' }
];

/**
 * Mock API service for Inventory.
 */
export const mockStokApi = {
  /**
   * Fetches all products.
   */
  getUrunler: async (): Promise<IUrun[]> => {
    await delay(300);
    return [...urunler];
  },

  /**
   * Fetches all warehouses.
   */
  getDepolar: async (): Promise<IDepo[]> => {
    await delay(300);
    return [...depolar];
  },

  /**
   * Fetches all stock movements.
   */
  getStokHareketler: async (): Promise<IStokHareket[]> => {
    await delay(300);
    return [...stokHareketler];
  },

  /**
   * Calculates current stock amount for a product in a warehouse.
   */
  getStokMevcut: async (urunId: string, depoId?: string): Promise<number> => {
    await delay(300);
    let filtered = stokHareketler.filter(h => h.urunId === urunId);
    if (depoId) filtered = filtered.filter(h => h.depoId === depoId);

    return filtered.reduce((total, h) => {
      return h.tip === 'GIRIS' ? total + h.miktar : total - h.miktar;
    }, 0);
  },

  /**
   * Adds a new product.
   */
  addUrun: async (urun: Omit<IUrun, 'id'>): Promise<IUrun> => {
    await delay(300);
    const newUrun = { ...urun, id: Math.random().toString(36).substr(2, 9) };
    urunler.push(newUrun);
    return newUrun;
  },

  /**
   * Updates a product.
   */
  updateUrun: async (id: string, data: Partial<IUrun>): Promise<IUrun> => {
    await delay(300);
    const index = urunler.findIndex(u => u.id === id);
    if (index === -1) throw new Error('Ürün bulunamadı.');
    urunler[index] = { ...urunler[index], ...data };
    return urunler[index];
  },

  /**
   * Deletes a product.
   */
  deleteUrun: async (id: string): Promise<boolean> => {
    await delay(300);
    urunler = urunler.filter(u => u.id !== id);
    return true;
  },

  /**
   * Fetches all categories.
   */
  getKategoriler: async () => {
    await delay(300);
    return [...kategoriler];
  },

  /**
   * Searches for products by code, name, or barcode.
   */
  searchUrunler: async (query: string): Promise<IUrun[]> => {
    await delay(300);
    const lowQuery = query.toLowerCase();
    return urunler.filter(u => 
      u.urunAdi.toLowerCase().includes(lowQuery) || 
      u.stokKodu.toLowerCase().includes(lowQuery) || 
      (u.barkod && u.barkod.toLowerCase().includes(lowQuery))
    );
  },
};
