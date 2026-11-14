import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import type {
  Cari,
  CariFormData,
  CariHareket,
  CariBakiyeOzet,
  CekSenet,
  CekSenetFormData,
  BankaHesabi,
  BankaHesabiFormData,
  MasrafKurali,
  KesilecekFatura,
  GiderKategorisi,
  IslemTuru,
} from '@/types';

export function useCariBanka({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [cariler, setCariler] = useState<Cari[]>([]);
  const [cariHareketler, setCariHareketler] = useState<CariHareket[]>([]);
  const [cekSenetler, setCekSenetler] = useState<CekSenet[]>([]);
  const [bankaHesaplari, setBankaHesaplari] = useState<BankaHesabi[]>([]);
  const [masrafKurallari, setMasrafKurallari] = useState<MasrafKurali[]>([]);
  const [kesilecekFaturalar, setKesilecekFaturalar] = useState<KesilecekFatura[]>([]);
  const [giderKategorileri, setGiderKategorileri] = useState<GiderKategorisi[]>([]);

  // ==================== CARÄ° CRUD ====================
  const addCari = useCallback(async (data: CariFormData) => {
    const yeniCari: Cari = { ...data, id: 'c' + Date.now().toString() + Math.random().toString(36).substr(2, 5), olusturmaTarihi: new Date().toISOString().split('T')[0] };
    setCariler(prev => [yeniCari, ...prev]);
    try { 
      const res = await apiFetch('/api/cariler', { method: 'POST', body: JSON.stringify(yeniCari) }); 
      if (!res.success) toast.error("Cari sunucuya kaydedilemedi: " + res.message);
    }
    catch (e) { console.error('Cari eklenemedi:', e); }
  }, []);

  const updateCari = useCallback(async (id: string, data: Partial<CariFormData>) => {
    setCariler(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
    try { 
      const res = await apiFetch(`/api/cariler/${id}`, { method: 'PUT', body: JSON.stringify(data) }); 
      if (!res.success) toast.error("Güncelleme sunucuya kaydedilemedi.");
    }
    catch (e) { console.error('Cari güncellenemedi:', e); }
  }, []);

  const deleteCari = useCallback(async (id: string) => {
    setCariler(prev => prev.filter(c => c.id !== id));
    setCariHareketler(prev => prev.filter(h => h.cariId !== id));
    try { await apiFetch(`/api/cariler/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Cari silinemedi:', e); }
  }, []);

  // ==================== CARÄ° HAREKET CRUD ====================
  const addCariHareket = useCallback(async (data: Omit<CariHareket, 'id' | 'olusturmaTarihi'>) => {
    const yeniHareket: CariHareket = {
      ...data,
      id: 'ch' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
      olusturmaTarihi: new Date().toISOString().split('T')[0]
    };
    setCariHareketler(prev => [yeniHareket, ...prev]);
    try { await apiFetch('/api/cari-hareketler', { method: 'POST', body: JSON.stringify(yeniHareket) }); }
    catch (e) { console.error('Cari hareket eklenemedi:', e); }

    // Banka bakiyesini gÃ¼ncelle
    if (data.bankaId) {
      setBankaHesaplari(prev => prev.map(b => {
        if (b.id === data.bankaId) {
          // ARTALACAKLAR (+)
          const ArtisTurleri: IslemTuru[] = [
            'tahsilat', 
            'satis_faturasi', 
            'cek_senet_alinan',
            'diger_gelir'
          ];
          
          // AZALACAKLAR (-)
          const AzalisTurleri: IslemTuru[] = [
            'odeme', 
            'alis_faturasi', 
            'vergi_kdv', 
            'vergi_muhtasar', 
            'vergi_gecici', 
            'vergi_damga', 
            'maas_odemesi', 
            'kira_odemesi', 
            'banka_masrafi', 
            'ssk_odemesi', 
            'genel_gider', 
            'kredi_karti_odemesi',
            'cek_senet_verilen'
          ];

          // Transfer Ã–zel Durumu: CariHareket metninde "GELEN" veya "GÄ°DEN" aramasÄ±?
          // Åžimdilik transfer'i data iÃ§inde ek bir flag olarak dÃ¼ÅŸÃ¼nelim veya aÃ§Ä±klamaya bakalÄ±m.
          // BasitÃ§e: EÄŸer tutar pozitifse artÄ±ÅŸ, negatifse azalÄ±ÅŸ desek daha mÄ± iyi?
          // Ama addCariHareket tutarÄ± mutlak deÄŸer bekliyor genelde.
          
          let degisim = 0;
          const amount = data.dovizTutar ? data.dovizTutar : data.tutar;
          if (ArtisTurleri.includes(data.islemTuru)) {
            degisim = amount;
          } else if (AzalisTurleri.includes(data.islemTuru)) {
            degisim = -amount;
          } else if (data.islemTuru === 'transfer') {
              if (data.aciklama && data.aciklama.toUpperCase().includes('GELEN')) degisim = amount;
              else degisim = -amount;
          }

          if (degisim !== 0) {
            return { 
              ...b, 
              guncelBakiye: Number(( (Number(b.guncelBakiye) || 0) + degisim).toFixed(2)) 
            };
          }
        }
        return b;
      }));
    }
  }, []);

  const updateCariHareket = useCallback(async (id: string, data: Partial<CariHareket>) => {
    setCariHareketler(prev => {
      const eski = prev.find(h => h.id === id);
      if (!eski) return prev;

      // Banka bakiye dÃ¼zeltmesi
      const ArtisTurleri: IslemTuru[] = ['tahsilat', 'satis_faturasi', 'cek_senet_alinan', 'diger_gelir'];
      const AzalisTurleri: IslemTuru[] = [
        'odeme', 'alis_faturasi', 'vergi_kdv', 'vergi_muhtasar', 'vergi_gecici', 
        'vergi_damga', 'maas_odemesi', 'kira_odemesi', 'banka_masrafi', 
        'ssk_odemesi', 'genel_gider', 'kredi_karti_odemesi', 'cek_senet_verilen'
      ];

      setBankaHesaplari(bankalar => bankalar.map(b => {
        let bakiye = b.guncelBakiye;
        
        // Eskinin etkisini geri al
        if (b.id === eski.bankaId) {
          let degisim = 0;
          const amount = eski.dovizTutar ? eski.dovizTutar : eski.tutar;
          if (ArtisTurleri.includes(eski.islemTuru)) degisim = -amount;
          else if (AzalisTurleri.includes(eski.islemTuru)) degisim = amount;
          else if (eski.islemTuru === 'transfer') {
            if (eski.aciklama && eski.aciklama.toUpperCase().includes('GELEN')) degisim = -amount;
            else degisim = amount;
          }
          bakiye += degisim;
        }

        // Yeninin etkisini uygula
        const yeniTutar = data.tutar !== undefined ? data.tutar : eski.tutar;
        const yeniTur = data.islemTuru !== undefined ? data.islemTuru : eski.islemTuru;
        const yeniAciklama = data.aciklama !== undefined ? data.aciklama : eski.aciklama;
        const yeniBankaId = data.bankaId !== undefined ? data.bankaId : (eski.bankaId || null);

        if (b.id === yeniBankaId) {
          let degisim = 0;
          const yeniDovizTutar = data.dovizTutar !== undefined ? data.dovizTutar : eski.dovizTutar;
          const newAmount = yeniDovizTutar ? yeniDovizTutar : yeniTutar;
          if (ArtisTurleri.includes(yeniTur)) degisim = newAmount;
          else if (AzalisTurleri.includes(yeniTur)) degisim = -newAmount;
          else if (yeniTur === 'transfer') {
            if (yeniAciklama && yeniAciklama.toUpperCase().includes('GELEN')) degisim = newAmount;
            else degisim = -newAmount;
          }
          bakiye += degisim;
        }

        return { ...b, guncelBakiye: Number(bakiye.toFixed(2)) };
      }));

      return prev.map(h => h.id === id ? { ...h, ...data } : h);
    });
    try { await apiFetch(`/api/cari-hareketler/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    catch (e) { console.error('Cari hareket gÃ¼ncellenemedi:', e); }
  }, []);

  const deleteCariHareket = useCallback(async (id: string) => {
    const silinecek = cariHareketler.find(h => h.id === id);
    if (silinecek && silinecek.bankaId) {
       setBankaHesaplari(prev => prev.map(b => {
         if (b.id === silinecek.bankaId) {
           const ArtisTurleri: IslemTuru[] = ['tahsilat', 'satis_faturasi', 'cek_senet_alinan', 'diger_gelir'];
           const AzalisTurleri: IslemTuru[] = [
             'odeme', 'alis_faturasi', 'vergi_kdv', 'vergi_muhtasar', 
             'vergi_gecici', 'vergi_damga', 'maas_odemesi', 'kira_odemesi', 
             'banka_masrafi', 'ssk_odemesi', 'genel_gider', 'kredi_karti_odemesi',
             'cek_senet_verilen'
           ];

           let degisim = 0;
           const amount = silinecek.dovizTutar ? silinecek.dovizTutar : silinecek.tutar;
           if (ArtisTurleri.includes(silinecek.islemTuru)) {
             degisim = -amount; // Eklenen gelir silinirse bakiye dÃ¼ÅŸer
           } else if (AzalisTurleri.includes(silinecek.islemTuru)) {
             degisim = amount; // Eklenen gider silinirse bakiye artar
           } else if (silinecek.islemTuru === 'transfer') {
              if (silinecek.aciklama && silinecek.aciklama.toUpperCase().includes('GELEN')) degisim = -amount;
              else degisim = amount;
           }

           if (degisim !== 0) {
             return { ...b, guncelBakiye: Number((b.guncelBakiye + degisim).toFixed(2)) };
           }
         }
         return b;
       }));
    }
    setCariHareketler(prev => prev.filter(h => h.id !== id));
    try { await apiFetch(`/api/cari-hareketler/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Cari hareket silinemedi:', e); }
  }, [cariHareketler]);

  const hesaplaCariBakiye = useCallback((cariId: string): CariBakiyeOzet => {
    const hareketler = cariHareketler.filter(h => h.cariId === cariId);
    let toplamBorc = 0;
    let toplamAlacak = 0;
    let tahsilEdilen = 0;
    let odenen = 0;

    hareketler.forEach(h => {
      const val = Number(h.tutar) || 0;
      if (h.islemTuru === 'satis_faturasi') {
        toplamBorc += val;
      } else if (h.islemTuru === 'alis_faturasi') {
        toplamAlacak += val;
      } else if (['tahsilat', 'cek_senet_alinan', 'diger_gelir'].includes(h.islemTuru)) {
        tahsilEdilen += val;
      } else if (['odeme', 'cek_senet_verilen', 'genel_gider', 'banka_masrafi', 'vergi_kdv', 'vergi_muhtasar', 'vergi_gecici', 'vergi_damga', 'maas_odemesi', 'kira_odemesi', 'ssk_odemesi', 'kredi_karti_odemesi'].includes(h.islemTuru)) {
        odenen += val;
      } else if (h.islemTuru === 'transfer') {
        if (h.aciklama && h.aciklama.toUpperCase().includes('GELEN')) {
          tahsilEdilen += val;
        } else {
          odenen += val;
        }
      }
    });

    const guncelBakiye = (toplamBorc - tahsilEdilen) - (toplamAlacak - odenen);
    let bakiyeDurumu: 'borclu' | 'alacakli' | 'kapali' = 'kapali';
    
    if (guncelBakiye > 0) bakiyeDurumu = 'borclu'; // MÃ¼ÅŸteri borÃ§lu (Biz alacaklÄ±yÄ±z)
    else if (guncelBakiye < 0) bakiyeDurumu = 'alacakli'; // Biz borÃ§luyuz (TedarikÃ§i alacaklÄ±)

    return { 
      toplamBorc, 
      toplamAlacak, 
      tahsilEdilen, 
      odenen, 
      guncelBakiye: Math.abs(guncelBakiye), 
      bakiyeDurumu 
    };
  }, [cariHareketler]);



  const addCekSenet = useCallback(async (data: CekSenetFormData) => {
    const yeni: CekSenet = { ...data, id: 'cs' + Date.now().toString() + Math.random().toString(36).substr(2, 5) };
    setCekSenetler(prev => [yeni, ...prev]);
    try { await apiFetch('/api/cek-senetler', { method: 'POST', body: JSON.stringify(yeni) }); }
    catch (e) { console.error('Cek-senet eklenemedi:', e); }
  }, []);

  const updateCekSenet = useCallback(async (id: string, data: CekSenetFormData) => {
    setCekSenetler(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
    try { await apiFetch(`/api/cek-senetler/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    catch (e) { console.error('Cek-senet gÃ¼ncellenemedi:', e); }
  }, []);

  const deleteCekSenet = useCallback(async (id: string) => {
    setCekSenetler(prev => prev.filter(c => c.id !== id));
    try { await apiFetch(`/api/cek-senetler/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Cek-senet silinemedi:', e); }
  }, []);

  const updateCekSenetDurum = useCallback((id: string, durum: 'bekliyor' | 'odendi' | 'karsiliksiz', bankaId?: string) => {
    setCekSenetler(prev => prev.map(c => {
      if (c.id === id) {
        if (durum === 'odendi' && c.durum !== 'odendi') {
           const hTuru = c.islemTipi === 'alinan' ? 'tahsilat' : 'odeme';
           addCariHareket({
             cariId: c.cariId,
             tarih: new Date().toISOString().split('T')[0],
             islemTuru: hTuru,
             tutar: c.tutar,
             aciklama: `${c.tip.toUpperCase()} Ã–demesi (${c.belgeNo})`,
             bagliFaturaId: c.id,
             bankaId: bankaId || null
           });
        }
        return { ...c, durum };
      }
      return c;
    }));
  }, [addCariHareket]);

  // ==================== BANKA CRUD ====================

  const addBankaHesabi = useCallback(async (data: BankaHesabiFormData) => {
    const acilis = data.acilisBakiyesi || 0;
    const yeni: BankaHesabi = { ...data, guncelBakiye: acilis, acilisBakiyesi: acilis, id: 'b' + Date.now().toString() + Math.random().toString(36).substr(2, 5) };
    setBankaHesaplari(prev => [yeni, ...prev]);
    try { await apiFetch('/api/banka-hesaplari', { method: 'POST', body: JSON.stringify(yeni) }); }
    catch (e) { console.error('Banka hesabÄ± eklenemedi:', e); }
  }, []);

  const updateBankaHesabi = useCallback(async (id: string, data: BankaHesabiFormData) => {
    let finalDataToAPI = data;
    setBankaHesaplari(prev => prev.map(b => {
      if (b.id === id) {
        const acilisFarki = (data.acilisBakiyesi || 0) - (b.acilisBakiyesi || 0);
        const yeniGuncel = b.guncelBakiye + acilisFarki;
        finalDataToAPI = { ...data, guncelBakiye: yeniGuncel };
        return { ...b, ...data, guncelBakiye: yeniGuncel };
      }
      return b;
    }));
    try { await apiFetch(`/api/banka-hesaplari/${id}`, { method: 'PUT', body: JSON.stringify(finalDataToAPI) }); }
    catch (e) { console.error('Banka hesabÄ± gÃ¼ncellenemedi:', e); }
  }, []);

  const deleteBankaHesabi = useCallback(async (id: string) => {
    setBankaHesaplari(prev => prev.filter(b => b.id !== id));
    try { await apiFetch(`/api/banka-hesaplari/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Banka hesabÄ± silinemedi:', e); }
  }, []);

  // ==================== MASRAF KURALLARI CRUD ====================
  const addMasrafKurali = useCallback(async (data: Omit<MasrafKurali, 'id'>) => {
    const yeni: MasrafKurali = {
      ...data,
      id: 'k' + Date.now().toString()
    };
    setMasrafKurallari(prev => [...prev, yeni]);
    try { await apiFetch('/api/masraf-kurallari', { method: 'POST', body: JSON.stringify(yeni) }); }
    catch (e) { console.error('Masraf kuralı eklenemedi:', e); }
  }, []);

  const deleteMasrafKurali = useCallback(async (id: string) => {
    setMasrafKurallari(prev => prev.filter(k => k.id !== id));
    try { await apiFetch(`/api/masraf-kurallari/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Masraf kuralı silinemedi:', e); }
  }, []);

  // ==================== KESÄ°LECEK FATURALAR CRUD ====================
  const addKesilecekFatura = useCallback(async (data: Omit<KesilecekFatura, 'id' | 'olusturmaTarihi' | 'durum'>) => {
    const yeni: KesilecekFatura = { ...data, id: 'kf' + Date.now().toString() + Math.random().toString(36).substr(2, 5), olusturmaTarihi: new Date().toISOString().split('T')[0], durum: 'bekliyor' };
    setKesilecekFaturalar(prev => [yeni, ...prev]);
    try { await apiFetch('/api/kesilecek-faturalar', { method: 'POST', body: JSON.stringify(yeni) }); }
    catch (e) { console.error('Kesilecek fatura eklenemedi:', e); }
  }, []);

  const updateKesilecekFatura = useCallback(async (id: string, data: Partial<KesilecekFatura>) => {
    const existingFatura = kesilecekFaturalar.find(f => f.id === id);
    if (!existingFatura) return;
    const fullData = { ...existingFatura, ...data };

    setKesilecekFaturalar(prev => prev.map(f => f.id === id ? fullData : f));
    try { 
      await apiFetch(`/api/kesilecek-faturalar/${id}`, { method: 'PUT', body: JSON.stringify(fullData) }); 
      
      // Eğer durum 'kesildi' yapıldıysa, cariId varsa bir CariHareket ekle!
      if (data.durum === 'kesildi') {
        if (existingFatura.cariId) {
          const yeniHareket: CariHareket = {
            id: 'ch' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
            cariId: existingFatura.cariId, 
            tarih: data.faturaTarihi || existingFatura.faturaTarihi || new Date().toISOString().split('T')[0], 
            islemTuru: 'satis_faturasi',
            tutar: data.tutar || existingFatura.tutar,
            aciklama: `Satış Faturası (Plan - GİB Gönderim: ${existingFatura.ad || ''})`.trim(),
            bagliFaturaId: id, 
            olusturmaTarihi: new Date().toISOString().split('T')[0], 
            dekontDosya: null
          };
          setCariHareketler(prev => [yeniHareket, ...prev]);
          await apiFetch('/api/cari-hareketler', { method: 'POST', body: JSON.stringify(yeniHareket) });
        }
      }
    }
    catch (e) { console.error('Kesilecek fatura güncellenemedi:', e); }
  }, [kesilecekFaturalar, cariHareketler]);

  const deleteKesilecekFatura = useCallback(async (id: string) => {
    setKesilecekFaturalar(prev => prev.filter(f => f.id !== id));
    try { await apiFetch(`/api/kesilecek-faturalar/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Kesilecek fatura silinemedi:', e); }
  }, []);


  const addGiderKategorisi = useCallback(async (ad: string, muhasebeKodu?: string, id?: string, tip?: 'GIDER' | 'GELIR') => {
    const yeni: GiderKategorisi = { id: id || ('cat' + Date.now().toString()), ad, muhasebeKodu, tip: tip || 'GIDER' };
    setGiderKategorileri(prev => [...prev, yeni]);
    try { await apiFetch('/api/gider-kategorileri', { method: 'POST', body: JSON.stringify(yeni) }); }
    catch (e) { console.error('Kategori eklenemedi:', e); }
  }, []);

  const updateGiderKategorisi = useCallback(async (id: string, data: Partial<GiderKategorisi>) => {
    setGiderKategorileri(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
    try { await apiFetch(`/api/gider-kategorileri/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    catch (e) { console.error('Kategori gÃ¼ncellenemedi:', e); }
  }, []);

  const deleteGiderKategorisi = useCallback(async (id: string) => {
    setGiderKategorileri(prev => prev.filter(c => c.id !== id));
    try { await apiFetch(`/api/gider-kategorileri/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Kategori silinemedi:', e); }
  }, []);

  const fetchCariler = useCallback(async () => {
    try {
      const res = await apiFetch('/api/cariler');
      if (res.success) {
        setCariler(Array.isArray(res.data) ? res.data : []);
      }
    } catch (e) {
      console.error("fetchCariler error:", e);
    }
  }, []);

  const fetchCariHareketler = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch('/api/cari-hareketler');
      if (res?.success) setCariHareketler(res.data || []);
    } catch (e) { console.error("fetchCariHareketler error:", e); }
  }, [isAuthenticated]);


  return {
    cariler,
    setCariler,
    cariHareketler,
    setCariHareketler,
    cekSenetler,
    setCekSenetler,
    bankaHesaplari,
    setBankaHesaplari,
    masrafKurallari,
    setMasrafKurallari,
    kesilecekFaturalar,
    setKesilecekFaturalar,
    giderKategorileri,
    setGiderKategorileri,
    fetchCariler,
    fetchCariHareketler,
    addCari,
    updateCari,
    deleteCari,
    addCariHareket,
    updateCariHareket,
    deleteCariHareket,
    hesaplaCariBakiye,
    addCekSenet,
    updateCekSenet,
    deleteCekSenet,
    updateCekSenetDurum,
    addBankaHesabi,
    updateBankaHesabi,
    deleteBankaHesabi,
    addMasrafKurali,
    deleteMasrafKurali,
    addKesilecekFatura,
    updateKesilecekFatura,
    deleteKesilecekFatura,
    addGiderKategorisi,
    updateGiderKategorisi,
    deleteGiderKategorisi,
  };
}
