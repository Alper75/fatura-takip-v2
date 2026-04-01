import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stokApi } from '../services/stokApi';
import { STOK_KEYS } from './useStokQuery';
import type { IStokHareket } from '../types/stok.types';
import { toast } from 'sonner';

/**
 * Hook for stock entry (GİRİŞ) mutation using real API.
 */
export function useStokGiris() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<IStokHareket, 'id' | 'iptal'>) => 
      stokApi.addHareket({ ...data, tip: 'GIRIS' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.all });
      toast.success('Stok girişi başarıyla kaydedildi.');
    },
    onError: (error: any) => {
      toast.error('Giriş işlemi başarısız: ' + (error.message || 'Bilinmeyen hata'));
    },
  });
}

/**
 * Hook for stock exit (ÇIKIŞ) mutation using real API.
 */
export function useStokCikis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<IStokHareket, 'id' | 'iptal'>) => 
      stokApi.addHareket({ ...data, tip: 'CIKIS' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.all });
      toast.success('Stok çıkışı başarıyla kaydedildi.');
    },
    onError: (error: any) => {
      toast.error('Çıkış işlemi başarısız: ' + (error.message || 'Bilinmeyen hata'));
    },
  });
}

/**
 * Hook for stock transfer (TRANSFER) mutation using real API.
 */
export function useStokTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sourceDepoId, targetDepoId, itemData }: { 
      sourceDepoId: string, 
      targetDepoId: string, 
      itemData: { urunId: string, miktar: number, birimFiyat: number } 
    }) => stokApi.addHareket({
      urunId: itemData.urunId,
      depoId: sourceDepoId,
      hedefDepoId: targetDepoId,
      tip: 'TRANSFER',
      miktar: itemData.miktar,
      birimFiyat: itemData.birimFiyat,
      tarih: new Date().toISOString(),
      aciklama: 'Depolar Arası Transfer'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.all });
      toast.success('Depolar arası transfer başarıyla gerçekleştirildi.');
    },
    onError: (error: any) => {
      toast.error('Transfer işlemi başarısız: ' + (error.message || 'Bilinmeyen hata'));
    },
  });
}

/**
 * Hook for cancelling/undoing a stock movement.
 */
export function useStokHareketIptal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Placeholder: Real API endpoint needed for cancel
      console.warn('Iptal işlemi henüz API tarafında desteklenmiyor:', id);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOK_KEYS.all });
      toast.success('Hareket başarıyla iptal edildi (Simüle).');
    },
    onError: (error: any) => {
      toast.error('İptal işlemi başarısız: ' + error.message);
    },
  });
}
