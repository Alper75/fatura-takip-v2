import { useQuery } from '@tanstack/react-query';
import { stokApi } from '../services/stokApi';

export const ANALIZ_KEYS = {
  all: ['stok', 'analiz'] as const,
};

/**
 * Hook to fetch stock analytics data from the real database.
 */
export function useStokAnaliz() {
  return useQuery({
    queryKey: ANALIZ_KEYS.all,
    queryFn: () => stokApi.getAnalizVerileri(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
}
