import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mockStokApi } from '../services/mockStokApi';
import type { IUrun } from '../types/stok.types';

/**
 * Key identifiers for stock queries.
 */
export const STOK_KEYS = {
  urunler: ['stok', 'urunler'] as const,
  kategoriler: ['stok', 'kategoriler'] as const,
  depolar: ['stok', 'depolar'] as const,
  hareketler: ['stok', 'hareketler'] as const,
  stokMevcut: (urunId: string, depoId?: string) => ['stok', 'mevcut', urunId, depoId] as const,
  search: (query: string) => ['stok', 'search', query] as const,
};

/**
 * Hook to fetch all products.
 */
export function useUrunler() {
  return useQuery({
    queryKey: STOK_KEYS.urunler,
    queryFn: () => mockStokApi.getUrunler(),
  });
}

/**
 * Hook to fetch all categories.
 */
export function useKategoriler() {
  return useQuery({
    queryKey: STOK_KEYS.kategoriler,
    queryFn: () => mockStokApi.getKategoriler(),
  });
}

/**
 * Hook to fetch all warehouses.
 */
export function useDepolar() {
  return useQuery({
    queryKey: STOK_KEYS.depolar,
    queryFn: () => mockStokApi.getDepolar(),
  });
}

/**
 * Hook to fetch all stock movements.
 */
export function useStokHareketler() {
  return useQuery({
    queryKey: STOK_KEYS.hareketler,
    queryFn: () => mockStokApi.getStokHareketler(),
  });
}

/**
 * Hook to fetch current stock status for a product.
 */
export function useStokMevcut(urunId: string, depoId?: string) {
  return useQuery({
    queryKey: STOK_KEYS.stokMevcut(urunId, depoId),
    queryFn: () => mockStokApi.getStokMevcut(urunId, depoId),
    enabled: !!urunId, // Only fetch if urunId exists
  });
}

/**
 * Hook to search for products.
 */
export function useSearchUrunler(query: string) {
  return useQuery({
    queryKey: STOK_KEYS.search(query),
    queryFn: () => mockStokApi.searchUrunler(query),
    enabled: query.length >= 2, // Only search if query is 2+ chars
  });
}

/**
 * Hook for product mutations (Add/Update/Delete).
 */
export function useUrunMutations() {
  const queryClient = useQueryClient();

  const addUrun = useMutation({
    mutationFn: (data: Omit<IUrun, 'id'>) => mockStokApi.addUrun(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.urunler });
    },
  });

  const updateUrun = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IUrun> }) => mockStokApi.updateUrun(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.urunler });
    },
  });

  const deleteUrun = useMutation({
    mutationFn: (id: string) => mockStokApi.deleteUrun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.urunler });
    },
  });

  return { addUrun, updateUrun, deleteUrun };
}
