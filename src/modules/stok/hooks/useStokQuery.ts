import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stokApi } from '../services/stokApi';
import type { IUrun, IDepo } from '../types/stok.types';

export const STOK_KEYS = {
  all: ['stok'] as const,
  urunler: () => [...STOK_KEYS.all, 'urunler'] as const,
  depolar: () => [...STOK_KEYS.all, 'depolar'] as const,
  hareketler: () => [...STOK_KEYS.all, 'hareketler'] as const,
  kategoriler: () => [...STOK_KEYS.all, 'kategoriler'] as const,
};

// --- Products Hooks ---
export function useUrunler() {
  return useQuery({
    queryKey: STOK_KEYS.urunler(),
    queryFn: () => stokApi.getUrunler(),
  });
}

// Bulk mutations for products (Expected by UrunForm/UrunListesi)
export function useUrunMutations() {
  const queryClient = useQueryClient();

  const addUrun = useMutation({
    mutationFn: (u: Partial<IUrun>) => stokApi.addUrun(u),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.urunler() });
    },
  });

  const updateUrun = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IUrun> }) => 
      stokApi.updateUrun(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.urunler() });
    },
  });

  const deleteUrun = useMutation({
    mutationFn: (id: string) => stokApi.deleteUrun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.urunler() });
    },
  });

  return { addUrun, updateUrun, deleteUrun };
}

// Low-level individual mutations (for more control)
export function useAddUrun() {
  return useUrunMutations().addUrun;
}

export function useUpdateUrun() {
  return useUrunMutations().updateUrun;
}

export function useDeleteUrun() {
  return useUrunMutations().deleteUrun;
}

// --- Warehouses Hooks ---
export function useDepolar() {
  return useQuery({
    queryKey: STOK_KEYS.depolar(),
    queryFn: () => stokApi.getDepolar(),
  });
}

export function useDepoMutations() {
  const queryClient = useQueryClient();

  const addDepo = useMutation({
    mutationFn: (d: Partial<IDepo>) => stokApi.addDepo(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.depolar() });
    },
  });

  const updateDepo = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IDepo> }) => 
      stokApi.updateDepo(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.depolar() });
    },
  });

  const deleteDepo = useMutation({
    mutationFn: (id: string) => stokApi.deleteDepo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.depolar() });
    },
  });

  return { addDepo, updateDepo, deleteDepo };
}

export function useAddDepo() {
  return useDepoMutations().addDepo;
}

export function useUpdateDepo() {
  return useDepoMutations().updateDepo;
}

export function useDeleteDepo() {
  return useDepoMutations().deleteDepo;
}

// --- Movements Hooks ---
export function useStokHareketler() {
  return useQuery({
    queryKey: STOK_KEYS.hareketler(),
    queryFn: () => stokApi.getHareketler(),
  });
}

export function useAddStokHareket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (h: any) => stokApi.addHareket(h),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.hareketler() });
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.urunler() });
    },
  });
}

// --- Category Hooks ---
export function useStokKategoriler() {
  return useQuery({
    queryKey: STOK_KEYS.kategoriler(),
    queryFn: () => stokApi.getCategoriler(),
  });
}

// Alias for compatibility
export const useKategoriler = useStokKategoriler;

export function useAddStokKategori() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ad: string) => stokApi.addKategori(ad),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.kategoriler() });
    },
  });
}

export function useDeleteStokKategori() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => stokApi.deleteKategori(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.kategoriler() });
    },
  });
}
