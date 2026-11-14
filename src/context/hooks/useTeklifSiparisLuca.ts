import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import type { Teklif, Siparis } from '@/types';

export function useTeklifSiparisLuca() {
  const [lucaAccounts, setLucaAccounts] = useState<{ kod: string; ad: string; tur?: string }[]>([]);
  const [teklifler, setTeklifler] = useState<Teklif[]>([]);
  const [siparisler, setSiparisler] = useState<Siparis[]>([]);

  const fetchLucaAccounts = useCallback(async () => {
    try {
      const data = await apiFetch('/api/luca/hesap-plani');
      if (data.success) setLucaAccounts(data.data);
    } catch (e) {
      console.error('Fetch Luca accounts error:', e);
    }
  }, []);

  const syncLucaAccounts = useCallback(() => {
    // Eklentiye sinyal gönder
    window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SYNC_REQUEST'));
  }, []);

  const autoSyncLucaAccounts = useCallback((): Promise<{ success: boolean; message?: string; count?: number }> => {
    return new Promise((resolve) => {
      const handleResponse = (e: any) => {
        window.removeEventListener('FATURA_APP_LUCA_AUTO_SYNC_RESPONSE', handleResponse);
        const res = e.detail;
        if (res && res.status === 'success') {
          resolve({ success: true, count: res.count });
        } else {
          resolve({ success: false, message: res?.message || 'Bilinmeyen hata oluştu.' });
        }
      };
      
      window.addEventListener('FATURA_APP_LUCA_AUTO_SYNC_RESPONSE', handleResponse);
      window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_AUTO_SYNC'));
      
      // Safety timeout
      setTimeout(() => {
        window.removeEventListener('FATURA_APP_LUCA_AUTO_SYNC_RESPONSE', handleResponse);
        resolve({ success: false, message: 'Eklenti yanıt vermedi. Süre aşımı.' });
      }, 15000);
    });
  }, []);

  useEffect(() => {
    const handleLucaResponse = async (e: any) => {
      const response = e.detail;
      console.log("[Luca Sync] Response received in AppContext:", response);
      if (response && response.status === 'success' && response.data) {
        // Gelen veriyi normalize et ve mükerrer kayıtları temizle
        const uniqueMap = new Map();
        (response.data || []).forEach((acc: any) => {
          const kod = (acc.kod || acc.code || '').trim();
          const ad = (acc.ad || acc.name || '').trim();
          const tur = acc.tur || '';
          if (kod && ad) {
            uniqueMap.set(kod, { kod, ad, tur });
          }
        });
        const normalizedData = Array.from(uniqueMap.values());

        toast.success(`${normalizedData.length} hesap Luca'dan alındı. Kaydediliyor...`);
        
        // Önce yerel durumu güncelle ki anında görünsün
        setLucaAccounts(normalizedData);

        // Arka plana senkronize et
        try {
          const res = await apiFetch('/api/luca/hesap-plani/sync', {
            method: 'POST',
            body: JSON.stringify({ accounts: normalizedData })
          });
          if (res.success) {
            toast.success("Hesap planı sunucuya başarıyla kaydedildi.");
          } else {
            toast.error("Sunucu kaydı başarısız: " + (res.message || "Bilinmeyen hata"));
          }
        } catch (err: any) {
          console.error('Sync to backend failed:', err);
          toast.error("Sunucu kaydı sırasında hata oluştu.");
        }
      } else if (response && response.status === 'error') {
        console.error('Extension sync error:', response.message);
        toast.error("Luca Senkronizasyon Hatası: " + response.message);
      }
    };
    window.addEventListener('FATURA_APP_LUCA_ACCOUNTS_RECEIVED', handleLucaResponse);
    return () => window.removeEventListener('FATURA_APP_LUCA_ACCOUNTS_RECEIVED', handleLucaResponse);
  }, [fetchLucaAccounts]);

  // ==================== SİPARİŞ CRUD ====================
  const fetchSiparisler = useCallback(async () => {
    try {
      const res = await apiFetch('/api/siparisler');
      if (res.success) setSiparisler(res.data);
    } catch (e) { console.error('fetchSiparisler error:', e); }
  }, []);

  const updateSiparis = useCallback(async (id: string, data: any) => {
    try {
      const res = await apiFetch(`/api/siparisler/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      if (res.success) {
        toast.success('Sipariş güncellendi.');
        fetchSiparisler();
        return { success: true };
      }
      return { success: false, message: res.message };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }, [fetchSiparisler]);

  const deleteSiparis = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`/api/siparisler/${id}`, { method: 'DELETE' });
      if (res.success) {
        toast.success('Sipariş silindi.');
        setSiparisler(prev => prev.filter(s => s.id !== id));
        return { success: true };
      }
      return { success: false, message: res.message };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }, []);

  // ==================== TEKLİF CRUD ====================
  const fetchTeklifler = useCallback(async () => {
    try {
      const res = await apiFetch('/api/teklifler');
      if (res.success) setTeklifler(res.data);
    } catch (e) { console.error('fetchTeklifler error:', e); }
  }, []);

  const addTeklif = useCallback(async (data: any) => {
    try {
      const res = await apiFetch('/api/teklifler', { method: 'POST', body: JSON.stringify(data) });
      if (res.success) {
        toast.success('Teklif başarıyla oluşturuldu.');
        fetchTeklifler();
        return res;
      }
      toast.error(res.message || 'Teklif oluşturulamadı.');
      return res;
    } catch (e: any) {
      toast.error(e.message);
      return { success: false, message: e.message };
    }
  }, [fetchTeklifler]);

  const updateTeklif = useCallback(async (id: string, data: any) => {
    try {
      const res = await apiFetch(`/api/teklifler/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      if (res.success) {
        toast.success('Teklif durumu güncellendi.');
        fetchTeklifler();
        return { success: true };
      }
      return { success: false, message: res.message };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }, [fetchTeklifler]);

  const deleteTeklif = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`/api/teklifler/${id}`, { method: 'DELETE' });
      if (res.success) {
        toast.success('Teklif silindi.');
        setTeklifler(prev => prev.filter(t => t.id !== id));
        return { success: true };
      }
      return { success: false, message: res.message };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }, []);

  const fetchPublicTeklif = useCallback(async (token: string) => {
    return await apiFetch(`/api/public/teklif/${token}`);
  }, []);

  const approvePublicTeklif = useCallback(async (token: string) => {
    try {
      const res = await apiFetch(`/api/public/teklif/${token}/approve`, { method: 'POST' });
      if (res.success) {
        toast.success(`Teklif onaylandı! Yeni Sipariş No: ${res.siparis_no}`);
        fetchSiparisler();
        fetchTeklifler();
        return res;
      }
      return res;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }, [fetchSiparisler, fetchTeklifler]);

  return {
    lucaAccounts,
    setLucaAccounts,
    fetchLucaAccounts,
    syncLucaAccounts,
    autoSyncLucaAccounts,
    teklifler,
    setTeklifler,
    fetchTeklifler,
    addTeklif,
    updateTeklif,
    deleteTeklif,
    fetchPublicTeklif,
    approvePublicTeklif,
    siparisler,
    setSiparisler,
    fetchSiparisler,
    updateSiparis,
    deleteSiparis,
  };
}
