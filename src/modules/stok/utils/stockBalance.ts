import type { IStokHareket } from '../types/stok.types';

const INBOUND_TYPES = new Set<IStokHareket['tip']>([
  'GIRIS',
  'TRANSFER_GIRIS',
  'SAYIM_GIRIS',
]);

/**
 * Tek geçişte (O(H)) ürün bazlı stok bakiyelerini hesaplar.
 * İptal edilmiş hareketleri hariç tutar; giriş/transfer-giriş/sayım-giriş pozitif, diğerleri negatif işlenir.
 */
export function buildStockBalanceMap(
  hareketler: IStokHareket[] | undefined,
  selectedDepo: string = 'all'
): Record<string, number> {
  const stockMap: Record<string, number> = {};
  if (!hareketler || hareketler.length === 0) return stockMap;

  const filterByDepo = selectedDepo !== 'all';
  for (let i = 0; i < hareketler.length; i++) {
    const h = hareketler[i];
    if (h.iptal) continue;
    if (filterByDepo && h.depoId !== selectedDepo) continue;

    const miktar = Number(h.miktar) || 0;
    const delta = INBOUND_TYPES.has(h.tip) ? miktar : -miktar;
    stockMap[h.urunId] = (stockMap[h.urunId] || 0) + delta;
  }

  return stockMap;
}
