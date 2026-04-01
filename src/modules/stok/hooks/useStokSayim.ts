import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stokApi } from '../services/stokApi';
import { STOK_KEYS } from './useStokQuery';
import { toast } from 'sonner';

export const SAYIM_KEYS = {
  all: ['stok', 'sayimlar'] as const,
  detail: (id: string) => [...SAYIM_KEYS.all, id] as const,
};

/**
 * Hook to fetch all stock take sessions.
 */
export function useSayimListesi() {
  return useQuery({
    queryKey: SAYIM_KEYS.all,
    queryFn: () => stokApi.getSayimlar(),
  });
}

/**
 * Hook to fetch a specific stock take session with items.
 */
export function useSayimDetay(id: string | null) {
  return useQuery({
    queryKey: SAYIM_KEYS.detail(id || ''),
    queryFn: () => stokApi.getSayimDetay(id!),
    enabled: !!id,
  });
}

/**
 * Hook to start a new stock take session.
 */
export function useSayimBaslat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ depoId }: { depoId: string; aciklama?: string }) => 
      stokApi.startSayim(depoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SAYIM_KEYS.all });
      toast.success('Yeni sayım seansı başlatıldı.');
    },
    onError: (error: any) => {
      toast.error('Sayım başlatılamadı: ' + error.message);
    }
  });
}

/**
 * Hook to save actual count for a stock take item.
 */
export function useSayimKalemKaydet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id: _id, kalemId, sayimMiktari }: { id?: string, kalemId: string; sayimMiktari: number }) => 
      stokApi.saveKalem(kalemId, sayimMiktari),
    onSuccess: (_, variables) => {
      if (variables.id) {
        queryClient.invalidateQueries({ queryKey: SAYIM_KEYS.detail(variables.id) });
      }
    },
  });
}

/**
 * Hook to finalize/approve a stock take session.
 */
export function useSayimOnayla() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: string | { id: string; kullanici: string }) => {
      const id = typeof args === 'string' ? args : args.id;
      const kullanici = typeof args === 'string' ? 'Admin' : args.kullanici;
      return stokApi.onaylaSayim(id, kullanici);
    },
    onSuccess: (_, args) => {
      const id = typeof args === 'string' ? args : args.id;
      queryClient.invalidateQueries({ queryKey: SAYIM_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SAYIM_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.all }); 
      toast.success('Sayım onaylandı ve stoklar güncellendi.');
    },
    onError: (error: any) => {
      toast.error('Onaylama işlemi başarısız: ' + error.message);
    }
  });
}
