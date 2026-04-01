import type { 
  IUrun, 
  IDepo, 
  IStokHareket, 
  IStokSayim, 
  IStokSayimKalem,
  IStokKategori
} from '../types/stok.types';

const API_BASE = '/api/stok';
const getToken = () => localStorage.getItem('token') || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: any = {
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
    ...(options?.headers || {})
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'Bir hata oluştu');
  }
  return result.data;
}

export const stokApi = {
  // Categories
  getCategoriler: () => request<IStokKategori[]>('/kategoriler'),
  addKategori: (ad: string) => request('/kategoriler', {
    method: 'POST',
    body: JSON.stringify({ ad })
  }),
  deleteKategori: (id: string) => request(`/kategoriler/${id}`, { method: 'DELETE' }),

  // Products
  getUrunler: () => request<IUrun[]>('/urunler'),
  addUrun: (u: Partial<IUrun>) => request('/urunler', {
    method: 'POST',
    body: JSON.stringify(u)
  }),
  updateUrun: (id: string, u: Partial<IUrun>) => request(`/urunler/${id}`, {
    method: 'PUT',
    body: JSON.stringify(u)
  }),
  deleteUrun: (id: string) => request(`/urunler/${id}`, { method: 'DELETE' }),

  // Warehouses
  getDepolar: () => request<IDepo[]>('/depolar'),
  addDepo: (d: Partial<IDepo>) => request('/depolar', {
    method: 'POST',
    body: JSON.stringify(d)
  }),
  updateDepo: (id: string, d: Partial<IDepo>) => request(`/depolar/${id}`, {
    method: 'PUT',
    body: JSON.stringify(d)
  }),
  deleteDepo: (id: string) => request(`/depolar/${id}`, { method: 'DELETE' }),

  // Movements
  getHareketler: () => request<IStokHareket[]>('/hareketler'),
  addHareket: (h: any) => request('/hareketler', {
    method: 'POST',
    body: JSON.stringify(h)
  }),

  // Counting Sessions
  getSayimlar: () => request<IStokSayim[]>('/sayimlar'),
  getSayimDetay: (id: string) => request<{ sayim: IStokSayim; kalemler: IStokSayimKalem[] }>(`/sayimlar/${id}`),
  startSayim: (depoId: string) => request<{ id: string }>('/sayimlar/baslat', {
    method: 'POST',
    body: JSON.stringify({ depoId })
  }),
  saveKalem: (kalemId: string, sayimMiktari: number) => request('/sayimlar/kalem-kaydet', {
    method: 'POST',
    body: JSON.stringify({ kalemId, sayimMiktari })
  }),
  onaylaSayim: (id: string, kullanici: string) => request('/sayimlar/onayla', {
    method: 'POST',
    body: JSON.stringify({ id, kullanici })
  }),

  // Analytics
  getAnalizVerileri: () => request<any>('/analiz')
};
