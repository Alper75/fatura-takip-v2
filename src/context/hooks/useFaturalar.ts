import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type {
  SatisFatura,
  SatisFaturaFormData,
  AlisFatura,
  AlisFaturaFormData,
  CariHareket,
  OdemeDurumu,
  VergiRaporu,
} from '@/types';
import { AYLAR, GELIR_VERGISI_DILIMLERI } from '@/types';

interface UseFaturalarDeps {
  isAuthenticated: boolean;
  setCariHareketler: React.Dispatch<React.SetStateAction<CariHareket[]>>;
}

export function useFaturalar({
  isAuthenticated,
  setCariHareketler,
}: UseFaturalarDeps) {
  const [satisFaturalari, setSatisFaturalari] = useState<SatisFatura[]>([]);
  const [alisFaturalari, setAlisFaturalari] = useState<AlisFatura[]>([]);

  // ==================== HESAPLAMA YARDIMCILARI ====================
  const parseTevkifat = (oran?: string) => {
    if (!oran || oran === '0' || !oran.includes('/')) return 0;
    const [pay, payda] = oran.split('/').map(Number);
    return payda > 0 ? (pay / payda) : 0;
  };

  const calculateFaturaHesaplamalari = (tutar: number, kdvStr: string, tevStr?: string, stopajStr?: string, tutarTuru: 'dahil' | 'haric' = 'dahil') => {
    const kdvOrani = parseFloat(kdvStr) / 100;
    const stopajOrani = parseFloat(stopajStr || '0') / 100;
    const tevkifatCarpani = parseTevkifat(tevStr);

    let matrah = 0;
    if (tutarTuru === 'haric') {
      // Tutar zaten matrah (KDV hariç)
      matrah = !isNaN(tutar) ? tutar : 0;
    } else {
      // Tutar KDV dahil net ödenecek tutar
      // Formül: Net = Matrah + (Matrah * KDV) - (Matrah * Stopaj) - (Matrah * KDV * Tevkifat)
      // Matrah = Net / (1 + KDV - Stopaj - (KDV * Tevkifat))
      const carpan = 1 + kdvOrani - stopajOrani - (kdvOrani * tevkifatCarpani);
      matrah = (carpan > 0 && !isNaN(tutar)) ? tutar / carpan : 0;
    }

    const kdvTutari = matrah * kdvOrani || 0;
    const stopajTutari = matrah * stopajOrani || 0;
    const tevkifatTutari = kdvTutari * tevkifatCarpani || 0;
    const toplamNet = matrah + kdvTutari - stopajTutari - tevkifatTutari;

    return {
      matrah: Math.round(matrah * 100) / 100,
      kdvTutari: Math.round(kdvTutari * 100) / 100,
      stopajTutari: Math.round(stopajTutari * 100) / 100,
      tevkifatTutari: Math.round(tevkifatTutari * 100) / 100,
      toplamNet: Math.round(toplamNet * 100) / 100
    };
  };

  // ==================== SATIŞ FATURA HESAPLAMA ====================
  const calculateSatisFatura = (formData: SatisFaturaFormData) => {
    const tutar = parseFloat(formData.alinanUcret) || 0;
    const tutarTuru = (formData as any).tutarTuru || 'dahil';
    return calculateFaturaHesaplamalari(tutar, formData.kdvOrani, formData.tevkifatOrani, formData.stopajOrani, tutarTuru);
  };

  // ==================== SATIŞ FATURA CRUD ====================
  const addSatisFatura = useCallback(async (formData: SatisFaturaFormData) => {
    // Drawer'dan gelen pre-calculated değerleri öncelikle kullan
    const pre = formData as any;
    const hesaplanan = (pre.matrah !== undefined && pre.matrah !== null && pre.matrah > 0)
      ? { matrah: pre.matrah, kdvTutari: pre.kdvTutari, tevkifatTutari: pre.tevkifatTutari, stopajTutari: pre.stopajTutari }
      : calculateSatisFatura(formData);

    // alinanUcret = net ödenecek tutar (toplamNet)
    const alinanUcretFinal = pre.alinanUcretNet > 0 ? pre.alinanUcretNet : hesaplanan.matrah + hesaplanan.kdvTutari - (hesaplanan.stopajTutari || 0) - (hesaplanan.tevkifatTutari || 0);

    const yeniFatura: SatisFatura = {
      id: pre.id || ('s' + Date.now().toString() + Math.random().toString(36).substr(2, 5)),
      faturaNo: formData.faturaNo,
      tcVkn: formData.tcVkn, ad: formData.ad, soyad: formData.soyad, adres: formData.adres,
      kdvOrani: parseFloat(formData.kdvOrani) || 0,
      alinanUcret: Math.round(alinanUcretFinal * 100) / 100,
      matrah: hesaplanan.matrah || 0, kdvTutari: hesaplanan.kdvTutari || 0,
      tevkifatOrani: formData.tevkifatOrani || '0', tevkifatTutari: hesaplanan.tevkifatTutari || 0,
      tevkifatKodu: formData.tevkifatKodu || '',
      stopajOrani: formData.stopajOrani || '0', stopajTutari: hesaplanan.stopajTutari || 0,
      stopajKodu: formData.stopajKodu || '',
      muhasebeKodu: formData.muhasebeKodu || pre.muhasebeKodu || '',
      pdfDosya: formData.dosyaBase64 || null, pdfDosyaAdi: formData.dosyaAdi || undefined,
      faturaTarihi: formData.faturaTarihi, cariId: formData.cariId,
      vadeTarihi: formData.vadeTarihi || null, odemeTarihi: null,
      odemeDurumu: 'odenmedi', odemeDekontu: null,
      olusturmaTarihi: new Date().toISOString().split('T')[0],
      aciklama: formData.aciklama || '',
      stokKalemleri: pre.stokKalemleri || [],
      gibUuid: pre.gibUuid || undefined
    };
    setSatisFaturalari(prev => [yeniFatura, ...prev]);

    // Fatura ve varsa PDF dosyasını tek seferde POST ile kaydet (backend diske yazıp URL'yi DB'ye koyar)
    try {
      const bodyToSend = {
        ...yeniFatura,
        stokKalemleri: pre.stokKalemleri || [],
        urunId: formData.urunId,
        depoId: formData.depoId
      };
      const res = await apiFetch('/api/satis-faturalari', { method: 'POST', body: JSON.stringify(bodyToSend) });
      if (!res || res.success === false) {
        throw new Error(res?.message || 'Satış faturası kaydedilemedi');
      }
    } catch (e) {
      console.error('Satış fatura eklenemedi:', e);
      setSatisFaturalari(prev => prev.filter(f => f.id !== yeniFatura.id));
      throw e;
    }

    if (formData.cariId) {
      const yeniHareket: CariHareket = {
        id: 'ch' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
        cariId: formData.cariId, tarih: formData.faturaTarihi, islemTuru: 'satis_faturasi',
        tutar: yeniFatura.alinanUcret,
        aciklama: `Satış Faturası (${formData.ad || ''} ${formData.soyad || ''})`.trim(),
        bagliFaturaId: yeniFatura.id, olusturmaTarihi: new Date().toISOString().split('T')[0], dekontDosya: null
      };
      setCariHareketler(prev => [yeniHareket, ...prev]);
      try { await apiFetch('/api/cari-hareketler', { method: 'POST', body: JSON.stringify(yeniHareket) }); }
      catch (e) { console.error('Cari hareket eklenemedi:', e); }
    }
  }, []);

  const updateSatisFatura = useCallback(async (id: string, formData: SatisFaturaFormData) => {
    const hesaplanan = calculateSatisFatura(formData);
    setSatisFaturalari(prev => prev.map(f => f.id === id ? { 
      ...f, 
      faturaNo: formData.faturaNo,
      tcVkn: formData.tcVkn, ad: formData.ad, soyad: formData.soyad, adres: formData.adres,
      kdvOrani: parseFloat(formData.kdvOrani) || 0, alinanUcret: parseFloat(formData.alinanUcret) || 0,
      matrah: hesaplanan.matrah || 0, kdvTutari: hesaplanan.kdvTutari || 0,
      tevkifatOrani: formData.tevkifatOrani || '0', tevkifatTutari: hesaplanan.tevkifatTutari || 0,
      tevkifatKodu: formData.tevkifatKodu || '',
      stopajOrani: formData.stopajOrani || '0', stopajTutari: hesaplanan.stopajTutari || 0,
      stopajKodu: formData.stopajKodu || '',
      muhasebeKodu: formData.muhasebeKodu || '',
      faturaTarihi: formData.faturaTarihi, cariId: formData.cariId,
      vadeTarihi: formData.vadeTarihi || null,
      aciklama: formData.aciklama,
      stokKalemleri: (formData as any).stokKalemleri || f.stokKalemleri
    } : f));

    try {
      await apiFetch(`/api/satis-faturalari/${id}`, { 
        method: 'PUT', 
        body: JSON.stringify({
          faturaNo: formData.faturaNo,
          tcVkn: formData.tcVkn, ad: formData.ad, soyad: formData.soyad, adres: formData.adres,
          kdvOrani: parseFloat(formData.kdvOrani), alinanUcret: parseFloat(formData.alinanUcret),
          matrah: hesaplanan.matrah, kdvTutari: hesaplanan.kdvTutari,
          tevkifatOrani: formData.tevkifatOrani, tevkifatTutari: hesaplanan.tevkifatTutari,
          tevkifatKodu: formData.tevkifatKodu,
          stopajOrani: formData.stopajOrani, stopajTutari: hesaplanan.stopajTutari,
          stopajKodu: formData.stopajKodu,
          muhasebeKodu: formData.muhasebeKodu,
          faturaTarihi: formData.faturaTarihi, cariId: formData.cariId,
          vadeTarihi: formData.vadeTarihi, aciklama: formData.aciklama,
          stokKalemleri: (formData as any).stokKalemleri || [],
          urunId: formData.urunId,
          depoId: formData.depoId
        }) 
      });
    } catch (e) {
      console.error('Satış fatura güncellenemedi:', e);
    }
  }, []);

  const updateSatisFaturaOdeme = useCallback(async (id: string, odemeTarihi: string, odemeDurumu: OdemeDurumu, bankaId?: string) => {
    setSatisFaturalari(prev => prev.map(f => f.id === id ? { ...f, odemeTarihi, odemeDurumu } : f));
    try { await apiFetch(`/api/satis-faturalari/${id}`, { method: 'PUT', body: JSON.stringify({ odemeTarihi, odemeDurumu, bankaId }) }); }
    catch (e) { console.error('Satış ödeme güncellenemedi:', e); }
  }, []);

  const deleteSatisFatura = useCallback(async (id: string) => {
    setSatisFaturalari(prev => prev.filter(f => f.id !== id));
    setCariHareketler(prev => prev.filter(h => h.bagliFaturaId !== id));
    try { await apiFetch(`/api/satis-faturalari/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Satış fatura silinemedi:', e); }
  }, []);

  const calculateAlisFatura = (formData: AlisFaturaFormData) => {
    const tutar = parseFloat(formData.toplamTutar) || 0;
    const tutarTuru = (formData as any).tutarTuru || 'dahil';
    return calculateFaturaHesaplamalari(tutar, formData.kdvOrani, formData.tevkifatOrani, formData.stopajOrani, tutarTuru);
  };

  // ==================== ALIŞ FATURA CRUD ====================
  const addAlisFatura = useCallback(async (formData: AlisFaturaFormData) => {
    const pre = formData as any;
    const hesaplanan = (pre.matrah !== undefined && pre.matrah !== null && pre.matrah > 0)
      ? { matrah: pre.matrah, kdvTutari: pre.kdvTutari, tevkifatTutari: pre.tevkifatTutari, stopajTutari: pre.stopajTutari }
      : calculateAlisFatura(formData);

    const toplamTutarFinal = pre.toplamTutarNet > 0 ? pre.toplamTutarNet : hesaplanan.matrah + hesaplanan.kdvTutari - (hesaplanan.stopajTutari || 0) - (hesaplanan.tevkifatTutari || 0);

    const yeniFatura: AlisFatura = {
      id: 'a' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
      faturaNo: formData.faturaNo, faturaTarihi: formData.faturaTarihi,
      tedarikciAdi: formData.tedarikciAdi, tedarikciVkn: formData.tedarikciVkn,
      malHizmetAdi: formData.malHizmetAdi,
      toplamTutar: Math.round(toplamTutarFinal * 100) / 100,
      kdvOrani: parseFloat(formData.kdvOrani) || 0, kdvTutari: hesaplanan.kdvTutari || 0, matrah: hesaplanan.matrah || 0,
      kdv1: pre.kdv1 || 0, kdv10: pre.kdv10 || 0, kdv20: pre.kdv20 || 0,
      tevkifatOrani: formData.tevkifatOrani || '0', tevkifatTutari: hesaplanan.tevkifatTutari || 0,
      stopajOrani: formData.stopajOrani || '0', stopajTutari: hesaplanan.stopajTutari || 0,
      muhasebeKodu: pre.muhasebeKodu || '',
      karsiHesapKodu: pre.karsiHesapKodu || '',
      aciklama: pre.aciklama || '',
      vehiclePlate: pre.vehiclePlate || null,
      pdfDosya: formData.dosyaBase64 || null, pdfDosyaAdi: formData.dosyaAdi || undefined,
      cariId: formData.cariId, vadeTarihi: formData.vadeTarihi || null,
      odemeTarihi: null, odemeDurumu: 'odenmedi',
      olusturmaTarihi: new Date().toISOString().split('T')[0]
    };
    setAlisFaturalari(prev => [yeniFatura, ...prev]);

    // Fatura ve varsa PDF görselini tek seferde POST ile kaydet (backend diske yazıp URL'yi DB'ye koyar)
    try {
      const res = await apiFetch('/api/alis-faturalari', {
        method: 'POST',
        body: JSON.stringify({
          ...yeniFatura,
          muhasebeKodu: pre.muhasebeKodu || '',
          karsiHesapKodu: pre.karsiHesapKodu || '',
          vehiclePlate: pre.vehiclePlate,
          aciklama: pre.aciklama,
          urunId: formData.urunId,
          depoId: formData.depoId
        })
      });
      if (!res || res.success === false) {
        throw new Error(res?.message || 'Alış faturası kaydedilemedi');
      }
    } catch (e) {
      console.error('Alış fatura eklenemedi:', e);
      setAlisFaturalari(prev => prev.filter(f => f.id !== yeniFatura.id));
      throw e;
    }

    if (formData.cariId) {
      const yeniHareket: CariHareket = {
        id: 'ch' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
        cariId: formData.cariId, tarih: formData.faturaTarihi, islemTuru: 'alis_faturasi',
        tutar: yeniFatura.toplamTutar,
        aciklama: `Alış Faturası (${formData.tedarikciAdi})`,
        bagliFaturaId: yeniFatura.id, olusturmaTarihi: new Date().toISOString().split('T')[0], dekontDosya: null
      };
      setCariHareketler(prev => [yeniHareket, ...prev]);
      try { await apiFetch('/api/cari-hareketler', { method: 'POST', body: JSON.stringify(yeniHareket) }); }
      catch (e) { console.error('Cari hareket eklenemedi:', e); }
    }
    return yeniFatura.id;
  }, []);

  const updateAlisFatura = useCallback(async (id: string, formData: AlisFaturaFormData) => {
    const pre = formData as any;
    const existing = alisFaturalari.find(f => f.id === id);

    const hesaplanan = (pre.matrah !== undefined && pre.matrah !== null && pre.matrah > 0)
      ? { matrah: pre.matrah, kdvTutari: pre.kdvTutari, tevkifatTutari: pre.tevkifatTutari, stopajTutari: pre.stopajTutari }
      : (formData.toplamTutar !== undefined ? calculateAlisFatura(formData) : {
          matrah: existing?.matrah || 0,
          kdvTutari: existing?.kdvTutari || 0,
          tevkifatTutari: existing?.tevkifatTutari || 0,
          stopajTutari: existing?.stopajTutari || 0
        });

    const toplamTutarFinal = pre.toplamTutarNet > 0 
      ? pre.toplamTutarNet 
      : (formData.toplamTutar !== undefined ? (parseFloat(formData.toplamTutar) || 0) : (existing?.toplamTutar || 0));

    const mergedFatura = {
      faturaNo: formData.faturaNo !== undefined ? formData.faturaNo : (existing?.faturaNo || ''),
      faturaTarihi: formData.faturaTarihi !== undefined ? formData.faturaTarihi : (existing?.faturaTarihi || ''),
      tedarikciAdi: formData.tedarikciAdi !== undefined ? formData.tedarikciAdi : (existing?.tedarikciAdi || ''),
      tedarikciVkn: formData.tedarikciVkn !== undefined ? formData.tedarikciVkn : (existing?.tedarikciVkn || ''),
      malHizmetAdi: formData.malHizmetAdi !== undefined ? formData.malHizmetAdi : (existing?.malHizmetAdi || ''),
      toplamTutar: Math.round(toplamTutarFinal * 100) / 100,
      kdvOrani: formData.kdvOrani !== undefined ? (parseFloat(formData.kdvOrani) || 0) : (existing?.kdvOrani || 0),
      kdvTutari: hesaplanan.kdvTutari || 0,
      matrah: hesaplanan.matrah || 0,
      tevkifatOrani: formData.tevkifatOrani !== undefined ? formData.tevkifatOrani : (existing?.tevkifatOrani || '0'),
      tevkifatTutari: hesaplanan.tevkifatTutari || 0,
      stopajOrani: formData.stopajOrani !== undefined ? formData.stopajOrani : (existing?.stopajOrani || '0'),
      stopajTutari: hesaplanan.stopajTutari || 0,
      oivTutari: pre.oivTutari !== undefined ? (parseFloat(String(pre.oivTutari)) || 0) : (existing?.oivTutari || 0),
      kdv1: pre.kdv1 !== undefined ? (Number(pre.kdv1) || 0) : (existing?.kdv1 || 0),
      kdv10: pre.kdv10 !== undefined ? (Number(pre.kdv10) || 0) : (existing?.kdv10 || 0),
      kdv20: pre.kdv20 !== undefined ? (Number(pre.kdv20) || 0) : (existing?.kdv20 || 0),
      muhasebeKodu: pre.muhasebeKodu !== undefined ? pre.muhasebeKodu : ((existing as any)?.muhasebeKodu || ''),
      karsiHesapKodu: pre.karsiHesapKodu !== undefined ? pre.karsiHesapKodu : ((existing as any)?.karsiHesapKodu || ''),
      kdvHesapKodu: pre.kdvHesapKodu !== undefined ? pre.kdvHesapKodu : ((existing as any)?.kdvHesapKodu || ''),
      mahsupSatirlari: pre.mahsupSatirlari !== undefined ? pre.mahsupSatirlari : ((existing as any)?.mahsupSatirlari || null),
      hasKkeg: pre.hasKkeg !== undefined ? pre.hasKkeg : ((existing as any)?.hasKkeg || false),
      aciklama: pre.aciklama !== undefined ? pre.aciklama : ((existing as any)?.aciklama || ''),
      cariId: formData.cariId !== undefined ? formData.cariId : existing?.cariId,
      vadeTarihi: formData.vadeTarihi !== undefined ? formData.vadeTarihi : (existing?.vadeTarihi || null),
      vehiclePlate: pre.vehiclePlate !== undefined ? pre.vehiclePlate : ((existing as any)?.vehiclePlate || null),
      pdfDosya: pre.pdfDosya !== undefined ? pre.pdfDosya : existing?.pdfDosya,
      pdfDosyaAdi: pre.pdfDosyaAdi !== undefined ? pre.pdfDosyaAdi : existing?.pdfDosyaAdi,
      stokKalemleri: (formData as any).stokKalemleri || (existing as any)?.stokKalemleri || []
    };

    setAlisFaturalari(prev => prev.map(f => f.id === id ? { ...f, ...mergedFatura } : f));

    try {
      const res = await apiFetch(`/api/alis-faturalari/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...mergedFatura,
          mahsupSatirlari: mergedFatura.mahsupSatirlari,
          hasKkeg: mergedFatura.hasKkeg,
          kdvHesapKodu: mergedFatura.kdvHesapKodu,
          urunId: formData.urunId,
          depoId: formData.depoId
        })
      });
      if (res && res.success === false) {
        throw new Error(res.message || 'Fatura güncellenirken sunucu hatası oluştu');
      }
    } catch (e) {
      console.error('Alış fatura güncellenemedi:', e);
      throw e;
    }
  }, [alisFaturalari]);

  const updateAlisFaturaOdeme = useCallback(async (id: string, odemeTarihi: string, odemeDurumu: OdemeDurumu) => {
    setAlisFaturalari(prev => prev.map(f => f.id === id ? { ...f, odemeTarihi, odemeDurumu } : f));
    try { await apiFetch(`/api/alis-faturalari/${id}`, { method: 'PUT', body: JSON.stringify({ odemeTarihi, odemeDurumu }) }); }
    catch (e) { console.error('Alış odeme güncellenemedi:', e); }
  }, []);

  const deleteAlisFatura = useCallback(async (id: string) => {
    setAlisFaturalari(prev => prev.filter(f => f.id !== id));
    setCariHareketler(prev => prev.filter(h => h.bagliFaturaId !== id));
    try { await apiFetch(`/api/alis-faturalari/${id}`, { method: 'DELETE' }); }
    catch (e) { console.error('Alış fatura silinemedi:', e); }
  }, []);

  const parseInvoiceXml = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const data = await apiFetch('/api/invoices/parse-xml', {
        method: 'POST',
        body: formData
      });
      return data;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, []);



  // ==================== PDF/DEKONT UPLOAD/DOWNLOAD ====================
  const uploadFile = (
    setter: React.Dispatch<React.SetStateAction<any[]>>,
    faturaId: string,
    file: File,
    field: string,
    apiEndpoint: string,
    fieldNameInApi: string
  ) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setter(prev =>
        prev.map(f =>
          f.id === faturaId
            ? { ...f, [field]: base64, [`${field}Adi`]: file.name }
            : f
        )
      );
      // Backend'e kaydet
      try {
        await apiFetch(`${apiEndpoint}/${faturaId}`, {
          method: 'PUT',
          body: JSON.stringify({
            [fieldNameInApi]: base64,
            [`${fieldNameInApi}Adi`]: file.name,
          }),
        });
      } catch (e) {
        console.error('Dosya backend\'e kaydedilemedi:', e);
      }
    };
    reader.readAsDataURL(file);
  };

  const uploadSatisPdf = useCallback((faturaId: string, file: File) => {
    uploadFile(setSatisFaturalari, faturaId, file, 'pdfDosya', '/api/satis-faturalari', 'pdfDosya');
  }, []);

  const uploadSatisDekont = useCallback((faturaId: string, file: File) => {
    uploadFile(setSatisFaturalari, faturaId, file, 'odemeDekontu', '/api/satis-faturalari', 'odemeDekontu');
  }, []);

  const uploadAlisPdf = useCallback((faturaId: string, file: File) => {
    uploadFile(setAlisFaturalari, faturaId, file, 'pdfDosya', '/api/alis-faturalari', 'pdfDosya');
  }, []);

  const uploadAlisDekont = useCallback((faturaId: string, file: File) => {
    uploadFile(setAlisFaturalari, faturaId, file, 'odemeDekontu', '/api/alis-faturalari', 'odemeDekontu');
  }, []);

  const downloadFile = (faturalar: any[], faturaId: string, field: string, defaultName: string) => {
    const fatura = faturalar.find(f => f.id === faturaId);
    if (fatura?.[field]) {
      const fileUrl = fatura[field];
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fatura[`${field}Adi`] || defaultName;
      if (fileUrl.startsWith('http') || fileUrl.startsWith('/uploads/')) {
        link.target = '_blank';
      }
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const downloadSatisPdf = useCallback((faturaId: string) => {
    downloadFile(satisFaturalari, faturaId, 'pdfDosya', `satis_fatura_${faturaId}.pdf`);
  }, [satisFaturalari]);

  const downloadSatisDekont = useCallback((faturaId: string) => {
    downloadFile(satisFaturalari, faturaId, 'odemeDekontu', `dekont_${faturaId}.pdf`);
  }, [satisFaturalari]);

  const downloadAlisPdf = useCallback((faturaId: string) => {
    downloadFile(alisFaturalari, faturaId, 'pdfDosya', `alis_fatura_${faturaId}.pdf`);
  }, [alisFaturalari]);

  const downloadAlisDekont = useCallback((faturaId: string) => {
    downloadFile(alisFaturalari, faturaId, 'odemeDekontu', `dekont_${faturaId}.pdf`);
  }, [alisFaturalari]);

  // ==================== VERGI HESAPLAMA ====================
  const hesaplaGelirVergisi = (toplamMatrah: number): { oran: number; vergi: number } => {
    let kalanMatrah = toplamMatrah;
    let toplamVergi = 0;
    let uygulananOran = 15;

    for (const dilim of GELIR_VERGISI_DILIMLERI) {
      if (kalanMatrah <= 0) break;

      const dilimMatrah = Math.min(kalanMatrah, dilim.limit === Infinity ? kalanMatrah : dilim.limit);
      toplamVergi += dilimMatrah * (dilim.oran / 100);
      uygulananOran = dilim.oran;

      if (dilim.limit !== Infinity) {
        kalanMatrah -= dilim.limit;
      }
    }

    return {
      oran: uygulananOran,
      vergi: Math.round(toplamVergi * 100) / 100
    };
  };

  const getVergiRaporu = useCallback((yil: number, ay: number): VergiRaporu => {
    const ayAdi = AYLAR.find(a => a.value === ay)?.label || '';

    // İlgili ay ve yıldaki satış faturaları
    const aylikSatislar = satisFaturalari.filter(f => {
      if (!f.faturaTarihi) return false;
      const parts = f.faturaTarihi.split('-');
      if (parts.length < 2) return false;
      return parseInt(parts[0], 10) === yil && parseInt(parts[1], 10) === ay;
    });

    // İlgili ay ve yıldaki alış faturaları
    const aylikAlislar = alisFaturalari.filter(f => {
      if (!f.faturaTarihi) return false;
      const parts = f.faturaTarihi.split('-');
      if (parts.length < 2) return false;
      return parseInt(parts[0], 10) === yil && parseInt(parts[1], 10) === ay;
    });

    const toplamSatisTevkifat = aylikSatislar.reduce((acc, f) => acc + (Number(f.tevkifatTutari) || 0), 0);
    const toplamAlisTevkifat = aylikAlislar.reduce((acc, f) => acc + (Number(f.tevkifatTutari) || 0), 0);
    const toplamSatisStopaj = aylikSatislar.reduce((acc, f) => acc + (Number(f.stopajTutari) || 0), 0);
    const toplamAlisStopaj = aylikAlislar.reduce((acc, f) => acc + (Number(f.stopajTutari) || 0), 0);
    const toplamOivTutari = aylikAlislar.reduce((acc, f) => acc + (Number(f.oivTutari) || 0), 0);
    const aylikSatisMatrah = aylikSatislar.reduce((acc, f) => acc + (Number(f.matrah) || 0), 0);
    const aylikAlisMatrah = aylikAlislar.reduce((acc, f) => acc + (Number(f.matrah) || 0), 0);

    // Oran Bazlı (%1, %10, %20) KDV-1 Beyanname Mutabakat Dağılımı
    const buckets: Record<number, { satisMatrah: number; satisKdv: number; alisMatrah: number; alisKdv: number }> = {
      1: { satisMatrah: 0, satisKdv: 0, alisMatrah: 0, alisKdv: 0 },
      10: { satisMatrah: 0, satisKdv: 0, alisMatrah: 0, alisKdv: 0 },
      20: { satisMatrah: 0, satisKdv: 0, alisMatrah: 0, alisKdv: 0 }
    };

    aylikSatislar.forEach(f => {
      const oranRaw = Number(f.kdvOrani) || 20;
      const key = oranRaw === 1 ? 1 : (oranRaw === 8 || oranRaw === 10 ? 10 : 20);
      buckets[key].satisMatrah += Number(f.matrah) || 0;
      buckets[key].satisKdv += Number(f.kdvTutari) || 0;
    });

    aylikAlislar.forEach(f => {
      const k1 = Number(f.kdv1) || 0;
      const k10 = Number(f.kdv10) || 0;
      const k20 = Number(f.kdv20) || 0;
      const nonZeroCount = [k1 > 0.009, k10 > 0.009, k20 > 0.009].filter(Boolean).length;

      if (nonZeroCount > 1) {
        if (k1 > 0) {
          buckets[1].alisKdv += k1;
          buckets[1].alisMatrah += k1 / 0.01;
        }
        if (k10 > 0) {
          buckets[10].alisKdv += k10;
          buckets[10].alisMatrah += k10 / 0.10;
        }
        if (k20 > 0) {
          buckets[20].alisKdv += k20;
          buckets[20].alisMatrah += k20 / 0.20;
        }
      } else {
        const oranRaw = Number(f.kdvOrani) || 20;
        const key = oranRaw === 1 ? 1 : (oranRaw === 8 || oranRaw === 10 ? 10 : 20);
        buckets[key].alisMatrah += Number(f.matrah) || 0;
        buckets[key].alisKdv += Number(f.kdvTutari) || 0;
      }
    });

    const kdvDagilimi = [1, 10, 20].map(oran => ({
      oran,
      satisMatrah: Math.round(buckets[oran].satisMatrah * 100) / 100,
      satisKdv: Math.round(buckets[oran].satisKdv * 100) / 100,
      alisMatrah: Math.round(buckets[oran].alisMatrah * 100) / 100,
      alisKdv: Math.round(buckets[oran].alisKdv * 100) / 100,
    }));

    // KDV Hesaplamaları (Tevkifat düşülmüş Net Hesaplanan KDV = Satıcının Tahsil Ettiği / Beyan Ettiği KDV)
    const hesaplananKDV = aylikSatislar.reduce((acc, f) => acc + (Number(f.kdvTutari) || 0), 0);
    const netHesaplananKDV = Math.max(0, hesaplananKDV - toplamSatisTevkifat);
    const indirilecekKDV = aylikAlislar.reduce((acc, f) => acc + (Number(f.kdvTutari) || 0), 0);
    const odenecekKDV = Math.max(0, netHesaplananKDV - indirilecekKDV);

    // Gelir Vergisi Hesaplaması (Kümülatif - yılbaşından itibaren)
    const yilBasiSatislar = satisFaturalari.filter(f => {
      if (!f.faturaTarihi) return false;
      const parts = f.faturaTarihi.split('-');
      if (parts.length < 2) return false;
      return parseInt(parts[0], 10) === yil && parseInt(parts[1], 10) <= ay;
    });

    const toplamMatrah = yilBasiSatislar.reduce((acc, f) => acc + (Number(f.matrah) || 0), 0);
    const gelirVergisiHesabi = hesaplaGelirVergisi(toplamMatrah);

    return {
      ay,
      ayAdi,
      yil,
      hesaplananKDV: Math.round(hesaplananKDV * 100) / 100,
      netHesaplananKDV: Math.round(netHesaplananKDV * 100) / 100,
      indirilecekKDV: Math.round(indirilecekKDV * 100) / 100,
      odenecekKDV: Math.round(odenecekKDV * 100) / 100,
      toplamSatisTevkifat: Math.round(toplamSatisTevkifat * 100) / 100,
      toplamAlisTevkifat: Math.round(toplamAlisTevkifat * 100) / 100,
      toplamSatisStopaj: Math.round(toplamSatisStopaj * 100) / 100,
      toplamAlisStopaj: Math.round(toplamAlisStopaj * 100) / 100,
      toplamOivTutari: Math.round(toplamOivTutari * 100) / 100,
      aylikSatisMatrah: Math.round(aylikSatisMatrah * 100) / 100,
      aylikAlisMatrah: Math.round(aylikAlisMatrah * 100) / 100,
      kdvDagilimi,
      toplamMatrah: Math.round(toplamMatrah * 100) / 100,
      gelirVergisiOrani: gelirVergisiHesabi.oran,
      hesaplananGelirVergisi: gelirVergisiHesabi.vergi,
      satisAdet: aylikSatislar.length,
      alisAdet: aylikAlislar.length
    };
  }, [satisFaturalari, alisFaturalari]);

  const fetchAlisFaturalari = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch('/api/alis-faturalari');
      if (res?.success) setAlisFaturalari(res.data || []);
    } catch (e) { console.error("fetchAlisFaturalari error:", e); }
  }, [isAuthenticated]);

  const fetchSatisFaturalari = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch('/api/satis-faturalari');
      if (res?.success) setSatisFaturalari(res.data || []);
    } catch (e) { console.error("fetchSatisFaturalari error:", e); }
  }, [isAuthenticated]);


  return {
    satisFaturalari,
    setSatisFaturalari,
    alisFaturalari,
    setAlisFaturalari,
    fetchSatisFaturalari,
    fetchAlisFaturalari,
    parseInvoiceXml,
    calculateFaturaHesaplamalari,
    calculateSatisFatura,
    calculateAlisFatura,
    addSatisFatura,
    updateSatisFatura,
    updateSatisFaturaOdeme,
    deleteSatisFatura,
    addAlisFatura,
    updateAlisFatura,
    updateAlisFaturaOdeme,
    deleteAlisFatura,
    uploadSatisPdf,
    uploadSatisDekont,
    uploadAlisPdf,
    uploadAlisDekont,
    downloadSatisPdf,
    downloadSatisDekont,
    downloadAlisPdf,
    downloadAlisDekont,
    getVergiRaporu,
  };
}
