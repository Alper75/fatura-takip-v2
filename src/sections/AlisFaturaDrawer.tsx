import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useApp } from '@/context/AppContext';
import { Save, ShoppingCart, Sparkles, Loader2, Plus, AlertTriangle, RotateCcw, Filter, Columns } from 'lucide-react';
import type { AlisFaturaFormData } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUrunler, useDepolar } from '../modules/stok/hooks/useStokQuery';
import { UrunForm } from '../modules/stok/components/UrunForm';
import { getDraftData, setDraftData, removeDraftData } from '@/lib/draftStorage';
import {
  INITIAL_FORM,
  getHesaplanan,
  type FormEntry,
  type SaveProgress,
  type DuplicateMatch,
} from './alis-fatura/alisFaturaHelpers';
import { useAlisFaturaAiScanner } from './alis-fatura/useAlisFaturaAiScanner';
import { AlisFaturaFormCard } from './alis-fatura/AlisFaturaFormCard';
import { AlisFaturaPreviewModal } from './alis-fatura/AlisFaturaPreviewModal';
import { AlisFaturaUploadPanel } from './alis-fatura/AlisFaturaUploadPanel';
import { AlisFaturaSplitPreview } from './alis-fatura/AlisFaturaSplitPreview';

export function AlisFaturaDrawer() {
  const { isAlisDrawerOpen, closeAlisDrawer, addAlisFatura, updateAlisFatura, alisFaturalari, cariler, alisInitialData, lucaAccounts, isIsletmeDefteri, companies, user, apiFetch } = useApp();
  const activeCompany = companies.find(c => c.id === (user?.companyId || 1));
  const hasCommercialVehicle = activeCompany?.vehicles?.some(v => v.type === 'commercial');
  const { data: urunler } = useUrunler();
  const { data: depolar } = useDepolar();

  const [forms, setForms] = useState<FormEntry[]>([]);
  const [isUrunFormOpen, setIsUrunFormOpen] = useState(false);
  const [kurallar, setKurallar] = useState<any[]>([]);
  const [splitViewMode, setSplitViewMode] = useState(true);
  const [activeFormId, setActiveFormId] = useState<number | null>(null);
  const [splitZoom, setSplitZoom] = useState(1);

  // Tedarikçi Hafızası: Geçmiş faturalardan veya AI kurallarından muhasebe kodunu otomatik bul
  const findRememberedAccountCode = (vkn?: string, unvan?: string, malHizmet?: string): string => {
    const cleanVkn = (vkn || '').trim();
    const cleanUnvan = (unvan || '').trim().toLowerCase();
    const text = `${unvan || ''} ${malHizmet || ''}`.toLowerCase();

    // 1. Önce tanımlı kurallara bak
    if (kurallar.length > 0 && text.trim()) {
      for (const rule of kurallar) {
        if (rule.anahtar_kelime && text.includes(String(rule.anahtar_kelime).toLowerCase())) {
          return rule.muhasebe_kodu;
        }
      }
    }

    // 2. Geçmiş alış faturalarında aynı VKN veya Firma Adı için kullanılan en son muhasebe koduna bak
    if (Array.isArray(alisFaturalari) && alisFaturalari.length > 0) {
      if (cleanVkn.length >= 10) {
        const pastByVkn = alisFaturalari.find(f => String(f.tedarikciVkn || '').trim() === cleanVkn && f.muhasebeKodu);
        if (pastByVkn?.muhasebeKodu) return pastByVkn.muhasebeKodu;
      }
      if (cleanUnvan.length >= 3) {
        const pastByName = alisFaturalari.find(f => {
          const exName = String(f.tedarikciAdi || '').trim().toLowerCase();
          return exName.length >= 3 && (exName === cleanUnvan || exName.includes(cleanUnvan) || cleanUnvan.includes(exName)) && f.muhasebeKodu;
        });
        if (pastByName?.muhasebeKodu) return pastByName.muhasebeKodu;
      }
    }

    return '';
  };

  // Mükerrer Fiş / Fatura Yakalayıcı
  const findDuplicateForForm = (form: FormEntry): DuplicateMatch | null => {
    if (!Array.isArray(alisFaturalari) || alisFaturalari.length === 0) return null;
    const d = form.data;
    const currentId = (d as any).id;
    const fNo = String(d.faturaNo || '').trim().toLowerCase();
    const vkn = String(d.tedarikciVkn || '').trim();
    const unvan = String(d.tedarikciAdi || '').trim().toLowerCase();
    const tarih = String(d.faturaTarihi || '').trim();
    const tutar = parseFloat(String(d.toplamTutar || '0')) || 0;
    const kdvOrani = String(d.kdvOrani || '20').trim();

    if (!fNo && tutar <= 0) return null;

    const match = alisFaturalari.find(ex => {
      if (currentId && String(ex.id) === String(currentId)) return false;
      const exNo = String(ex.faturaNo || '').trim().toLowerCase();
      const exVkn = String(ex.tedarikciVkn || '').trim();
      const exUnvan = String(ex.tedarikciAdi || '').trim().toLowerCase();
      const exTarih = String(ex.faturaTarihi || '').trim();
      const exTutar = parseFloat(String(ex.toplamTutar || '0')) || 0;
      const exKdv = String(ex.kdvOrani || '20').trim();

      const sameSupplier = (vkn.length >= 10 && exVkn === vkn) ||
                           (unvan.length >= 3 && exUnvan.length >= 3 && (exUnvan === unvan || exUnvan.includes(unvan) || unvan.includes(exUnvan)));

      // 1. Birebir aynı Fatura/Fiş No + Aynı Tedarikçi + Aynı KDV Oranı (Çoklu KDV satırlarını mükerrer saymamak için KDV oranını da kontrol et)
      if (fNo.length >= 3 && exNo === fNo && sameSupplier && exKdv === kdvOrani) {
        return true;
      }

      // 2. Aynı Tarih + Aynı Tedarikçi + Aynı KDV + Aynı Tutar (±0.50 TL tolerans)
      if (tarih && exTarih === tarih && sameSupplier && tutar > 0 && Math.abs(exTutar - tutar) <= 0.50 && exKdv === kdvOrani) {
        return true;
      }

      return false;
    });

    if (!match) return null;
    return {
      type: 'existing',
      reason: 'Sistemde aynı fatura/tutar kaydı tespit edildi',
      invoice: match,
    };
  };

  // Kuralları Çek
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/yapay-zeka-kurallari', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success) setKurallar(data.kurallar.filter((k: any) => k.kural_tipi === 'fatura'));
      })
      .catch(console.error);
  }, []);

  // Form başlatma ve güncelleme (Düzenleme veya yeni giriş)
  useEffect(() => {
    if (!isAlisDrawerOpen) {
      // Çekmece kapandığında formu ve yüklenen dosyaları temizle
      setForms([]);
      setUploadedFiles([]);
      setScanProgress(null);
      setAiAddedCount(0);
      setIsScanning(false);
      setPreviewImage(null);
      setFormFilter('all');
      return;
    }

    if (alisInitialData) {
      // Düzenleme veya aktarım modu: Her seferinde gelen veriyle formu doldur
      let aiKodu = alisInitialData.muhasebeKodu;
      if (!aiKodu && kurallar.length > 0) {
        const text = `${alisInitialData.tedarikciAdi || ''} ${alisInitialData.malHizmetAdi || ''}`.toLowerCase();
        for (const rule of kurallar) {
          if (text.includes(rule.anahtar_kelime.toLowerCase())) {
            aiKodu = rule.muhasebe_kodu;
            break;
          }
        }
      }
      setForms([{
        id: Date.now(),
        data: { ...INITIAL_FORM, ...alisInitialData, muhasebeKodu: aiKodu },
        tutarTuru: (alisInitialData as any).tutarTuru || 'dahil',
        errors: {}
      }]);
    } else {
      // Yeni alış faturası/fişi ekleme modu: Eğer form boşsa tek boş formla başlat
      setForms(prev => (prev.length === 0 ? [{ id: Date.now(), data: INITIAL_FORM, tutarTuru: 'dahil', errors: {} }] : prev));
    }
  }, [isAlisDrawerOpen, alisInitialData, kurallar]);

  const varsayilanDepoId = depolar?.find(d => d.varsayilan)?.id || depolar?.[0]?.id || '';

  // AI States
  const [formFilter, setFormFilter] = useState<'all' | 'errors'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<SaveProgress | null>(null);
  const [hasPendingDraft, setHasPendingDraft] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  const {
    isDragging,
    setIsDragging,
    uploadedFiles,
    setUploadedFiles,
    scanProgress,
    setScanProgress,
    isScanning,
    setIsScanning,
    aiAddedCount,
    setAiAddedCount,
    fileInputRef,
    handleFileChange,
    processFiles,
    scanImage,
    retryFailedScans,
  } = useAlisFaturaAiScanner({
    apiFetch,
    forms,
    setForms,
    cariler,
    lucaAccounts,
    varsayilanDepoId,
    findRememberedAccountCode,
  });

  useEffect(() => {
    if (isAlisDrawerOpen && !alisInitialData) {
      let isCancelled = false;
      (async () => {
        try {
          const idbData = await getDraftData<any[]>('alis_fatura_draft_forms_v2');
          const cleanIdb = Array.isArray(idbData) ? idbData.filter(d => !d?.data?.id) : [];
          if (!isCancelled && cleanIdb.length > 0) {
            setHasPendingDraft(true);
            return;
          }
          const raw = localStorage.getItem('alis_fatura_draft_forms_v2');
          if (raw) {
            const parsed = JSON.parse(raw);
            const cleanLocal = Array.isArray(parsed) ? parsed.filter((d: any) => !d?.data?.id) : [];
            if (!isCancelled && cleanLocal.length > 0) {
              setHasPendingDraft(true);
            }
          }
        } catch (e) {}
      })();
      return () => { isCancelled = true; };
    } else {
      setHasPendingDraft(false);
    }
  }, [isAlisDrawerOpen, alisInitialData]);

  // Forms değiştikçe otomatik taslak kaydı (Düzenleme modunda KESİNLİKLE taslak kaydetmez)
  useEffect(() => {
    if (!isAlisDrawerOpen || isSaving) return;

    // Düzenleme modunda olan (id'si olan) veya alisInitialData olan faturaları taslak olarak kaydetme!
    const isEditMode = Boolean(alisInitialData || forms.some(f => Boolean((f.data as any)?.id)));
    if (isEditMode) return;

    const isMeaningful = forms.length > 1 || (forms.length === 1 && (forms[0]?.data?.faturaNo || forms[0]?.data?.tedarikciAdi || forms[0]?.data?.toplamTutar || forms[0]?.data?.malHizmetAdi || forms[0]?.data?.dosyaBase64));
    if (isMeaningful) {
      // 1. IndexedDB: Tam form verisi (görseller / base64 dahil)
      setDraftData('alis_fatura_draft_forms_v2', forms).catch(() => {});
      
      // 2. localStorage: Hızlı durum göstergesi
      try {
        const lightweightForms = forms.map(f => ({
          ...f,
          data: {
            ...f.data,
            dosyaBase64: undefined
          }
        }));
        localStorage.setItem('alis_fatura_draft_forms_v2', JSON.stringify(lightweightForms));
      } catch (e) {}
    }
  }, [forms, isAlisDrawerOpen, isSaving, alisInitialData]);

  const loadDraft = async () => {
    try {
      // Önce IndexedDB'den tam veriyi (görselleriyle birlikte) almayı dene
      const idbData = await getDraftData<any[]>('alis_fatura_draft_forms_v2');
      const cleanIdb = Array.isArray(idbData) ? idbData.filter(d => !d?.data?.id) : [];
      if (cleanIdb.length > 0) {
        setForms(cleanIdb);
        setHasPendingDraft(false);
        const withImgCount = cleanIdb.filter(d => !!d.data?.dosyaBase64).length;
        toast.success(`${cleanIdb.length} adet taslak fiş görselleriyle birlikte geri yüklendi! (${withImgCount} görselli)`);
        return;
      }

      // Fallback: localStorage
      const raw = localStorage.getItem('alis_fatura_draft_forms_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        const cleanLocal = Array.isArray(parsed) ? parsed.filter((d: any) => !d?.data?.id) : [];
        if (cleanLocal.length > 0) {
          setForms(cleanLocal);
          setHasPendingDraft(false);
          toast.success(`${cleanLocal.length} adet taslak fiş geri yüklendi!`);
        }
      }
    } catch (e) {
      toast.error('Taslak yüklenirken hata oluştu.');
    }
  };

  const clearDraft = async () => {
    await removeDraftData('alis_fatura_draft_forms_v2');
    localStorage.removeItem('alis_fatura_draft_forms_v2');
    setHasPendingDraft(false);
    toast.info('Taslak temizlendi.');
  };

  const updateForm = (id: number, field: keyof AlisFaturaFormData | 'tutarTuru', value: string) => {
    setForms(prev => prev.map(f => {
      if (f.id === id) {
        if (field === 'tutarTuru') return { ...f, tutarTuru: value as 'dahil' | 'haric' };

        const newErrors = { ...f.errors };
        delete newErrors[field as keyof AlisFaturaFormData];

        const newData = { ...f.data, [field]: value };
        
        // Akıllı Öğrenme & Tedarikçi Hafızası: Açıklama, VKN veya Satıcı değiştiğinde geçmişten/kuraldan hesap kodu ata
        if ((field === 'malHizmetAdi' || field === 'tedarikciAdi' || field === 'tedarikciVkn') && !newData.muhasebeKodu) {
          const remembered = findRememberedAccountCode(newData.tedarikciVkn, newData.tedarikciAdi, newData.malHizmetAdi);
          if (remembered) {
            newData.muhasebeKodu = remembered;
            toast.success(`Tedarikçi hafızasından hesap kodu atandı: ${remembered}`, { id: `mem-${id}` });
          }
        }

        return { ...f, data: newData, errors: newErrors };
      }
      return f;
    }));
  };

  const addNewForm = () => {
    setForms(prev => [...prev, { id: Date.now(), data: { ...INITIAL_FORM, faturaTarihi: prev[0]?.data.faturaTarihi || INITIAL_FORM.faturaTarihi }, tutarTuru: 'dahil', errors: {} }]);
  };

  const removeForm = (id: number) => {
    setForms(prev => prev.filter(f => f.id !== id));
  };

  const focusAndScrollToForm = (targetFormId: number, focusFieldKey?: string) => {
    setActiveFormId(targetFormId);
    setFormFilter('all');
    setTimeout(() => {
      const cardEl = document.getElementById(`alis-form-card-${targetFormId}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (focusFieldKey) {
          const inputEl = cardEl.querySelector<HTMLInputElement>(`[data-field="${focusFieldKey}"]`);
          if (inputEl) {
            setTimeout(() => {
              inputEl.focus();
              inputEl.select?.();
            }, 250);
          }
        }
      }
    }, 60);
  };

  const validateAll = (): {
    isValid: boolean;
    firstInvalidForm?: FormEntry;
    firstInvalidIndex?: number;
    firstErrorField?: keyof AlisFaturaFormData;
    missingLabels?: string[];
  } => {
    let isValid = true;
    let firstInvalidForm: FormEntry | undefined;
    let firstInvalidIndex: number | undefined;
    let firstErrorField: keyof AlisFaturaFormData | undefined;
    let missingLabels: string[] = [];

    const fieldLabelMap: Partial<Record<keyof AlisFaturaFormData, string>> = {
      faturaNo: 'Belge/Fatura No',
      faturaTarihi: 'Fatura Tarihi',
      tedarikciAdi: 'Firma / Tedarikçi',
      tedarikciVkn: 'VKN / T.C.',
      malHizmetAdi: 'Hizmet/Ürün Açıklaması',
      toplamTutar: 'Tutar Değeri'
    };

    const nextForms = forms.map((f, idx) => {
      const e: Partial<Record<keyof AlisFaturaFormData, string>> = {};
      const d = f.data;
      if (!String(d.faturaNo || '').trim()) e.faturaNo = 'Zorunlu';
      if (!d.faturaTarihi) e.faturaTarihi = 'Zorunlu';
      if (!String(d.tedarikciAdi || '').trim()) e.tedarikciAdi = 'Zorunlu';
      if (!String(d.tedarikciVkn || '').trim()) e.tedarikciVkn = 'Zorunlu';
      if (!String(d.malHizmetAdi || '').trim()) e.malHizmetAdi = 'Zorunlu';
      if (!d.toplamTutar || parseFloat(d.toplamTutar) <= 0) e.toplamTutar = 'Geçersiz';

      const errKeys = Object.keys(e) as Array<keyof AlisFaturaFormData>;
      if (errKeys.length > 0) {
        isValid = false;
        if (!firstInvalidForm) {
          firstInvalidForm = f;
          firstInvalidIndex = idx;
          firstErrorField = errKeys[0];
          missingLabels = errKeys.map(k => fieldLabelMap[k] || String(k));
        }
      }
      return { ...f, errors: e };
    });

    setForms(nextForms);
    return { isValid, firstInvalidForm, firstInvalidIndex, firstErrorField, missingLabels };
  };

  const handleClose = () => {
    setForms([]);
    setUploadedFiles([]);
    setScanProgress(null);
    setAiAddedCount(0);
    setIsScanning(false);
    setPreviewImage(null);
    setFormFilter('all');
    closeAlisDrawer();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (forms.length === 0) {
      toast.error('Lütfen en az bir belge ekleyin.');
      return;
    }

    const validation = validateAll();
    if (!validation.isValid) {
      if (validation.firstInvalidForm) {
        if (validation.firstInvalidForm.data.dosyaBase64) {
          setSplitViewMode(true);
        }
        focusAndScrollToForm(validation.firstInvalidForm.id, validation.firstErrorField);
        const rowNum = (validation.firstInvalidIndex ?? 0) + 1;
        const fileName = validation.firstInvalidForm.data.dosyaAdi ? ` (${validation.firstInvalidForm.data.dosyaAdi})` : '';
        const fieldsText = validation.missingLabels?.length ? `: ${validation.missingLabels.join(', ')}` : '';
        toast.error(`Satır #${rowNum}${fileName} üzerinde eksik alanlar var${fieldsText}. İlgili satıra ve fiş görseline yönlendirildiniz.`);
      } else {
        toast.error('Lütfen formdaki eksik alanları doldurun.');
      }
      return;
    }

    setIsSaving(true);
    const totalToSave = forms.length;
    let savedCount = 0;
    const initialFormsList = [...forms];

    try {
      for (let i = 0; i < initialFormsList.length; i++) {
        const f = initialFormsList[i];
        const hes = getHesaplanan(f);

        setSaveProgress({
          current: savedCount + 1,
          total: totalToSave,
          remaining: totalToSave - savedCount,
          percent: Math.round(((savedCount + 1) / totalToSave) * 100),
          currentInvoice: f.data.tedarikciAdi || f.data.faturaNo || `Belge #${i + 1}`
        });

        // Gider Kısıtlaması Mantığı (70/30)
        let finalData = { ...f.data };
        const isFuel = /akaryakıt|yakıt|benzin|motorin/i.test(f.data.malHizmetAdi);
        const isOtherVehicleExpense = /bakım|onarım|otopark|yıkama/i.test(f.data.malHizmetAdi);
        
        let applySplit = false;
        
        if (f.data.vehiclePlate) {
          const matchedVehicle = activeCompany?.vehicles?.find(v => v.plate.replace(/\s+/g, '') === f.data.vehiclePlate?.replace(/\s+/g, ''));
          if (matchedVehicle && matchedVehicle.type === 'passenger') {
            applySplit = true;
          }
        } else if (isFuel || isOtherVehicleExpense) {
          if (!hasCommercialVehicle) {
            applySplit = true;
          }
        }

        if (applySplit) {
          const matrah = hes.matrah;
          const kdv = hes.kdvTutari;
          const giderPayi = Math.round(matrah * 0.7 * 100) / 100;
          const kkegPayi = Math.round((matrah - giderPayi) * 100) / 100;
          const kdvGiderPayi = Math.round(kdv * 0.7 * 100) / 100;
          const kdvKkegPayi = Math.round((kdv - kdvGiderPayi) * 100) / 100;

          finalData.aciklama = (finalData.aciklama || '') + ` [%70 Gider: ${Math.round((giderPayi + kdvGiderPayi) * 100) / 100} TL, %30 KKEG: ${Math.round((kkegPayi + kdvKkegPayi) * 100) / 100} TL]`;
        }

        const isEditMode = !!(f.data as any).id;
        const invoicePayload = {
          ...finalData,
          toplamTutar: f.data.toplamTutar,
          toplamTutarNet: hes.toplamNet,
          tutarTuru: f.tutarTuru,
          matrah: hes.matrah,
          kdvTutari: hes.kdvTutari,
          tevkifatTutari: hes.tevkifatTutari,
          stopajTutari: hes.stopajTutari,
          oivTutari: hes.oivTutari,
          muhasebeKodu: f.data.muhasebeKodu,
          karsiHesapKodu: f.data.karsiHesapKodu,
          dosyaBase64: f.data.dosyaBase64 || '',
          dosyaAdi: f.data.dosyaAdi || ''
        } as any;

        if (isEditMode) {
          await updateAlisFatura((f.data as any).id, invoicePayload);
        } else {
          await addAlisFatura(invoicePayload);
        }

        // Kendi Kendine Öğrenen Tedarikçi Hafızası: Seçilen muhasebe kodunu firma/tedarikçi adıyla kurallara otomatik kaydet
        if (f.data.muhasebeKodu && f.data.tedarikciAdi && f.data.tedarikciAdi.trim().length >= 3) {
          const cleanVendor = f.data.tedarikciAdi.trim();
          apiFetch('/api/yapay-zeka-kurallari', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              anahtar_kelime: cleanVendor,
              kategori: f.data.malHizmetAdi || 'Tedarikçi Otomatik Hafıza',
              muhasebe_kodu: f.data.muhasebeKodu.trim(),
              kdv_orani: Number(f.data.kdvOrani || 20),
              upsert: true
            })
          }).catch(() => {});
        }

        // Başarıyla kaydedilen fişi listeden ve taslaktan anında çıkar:
        savedCount++;
        setForms(prev => {
          const nextForms = prev.filter(item => item.id !== f.id);
          if (nextForms.length > 0) {
            setDraftData('alis_fatura_draft_forms_v2', nextForms).catch(() => {});
            try { localStorage.setItem('alis_fatura_draft_forms_v2', JSON.stringify(nextForms)); } catch (e) {}
          } else {
            removeDraftData('alis_fatura_draft_forms_v2').catch(() => {});
            localStorage.removeItem('alis_fatura_draft_forms_v2');
          }
          return nextForms;
        });
      }

      await removeDraftData('alis_fatura_draft_forms_v2');
      localStorage.removeItem('alis_fatura_draft_forms_v2');
      toast.success(`${savedCount} adet alış faturası başarıyla sisteme kaydedildi.`);
      handleClose();
    } catch (error: any) {
      console.error('Kayıt hatası:', error);
      toast.error(`İşlem sırasında hata: ${error.message || 'Bilinmeyen hata'}. Başarıyla aktarılan: ${savedCount} adet. Kalan ${totalToSave - savedCount} adet fiş arka planda korundu, tekrar deneyebilirsiniz.`);
    } finally {
      setIsSaving(false);
      setSaveProgress(null);
    }
  };

  const handleVknChange = (formId: number, val: string) => {
    updateForm(formId, 'tedarikciVkn', val);
    
    if (val.length >= 10) {
      const matched = (cariler || []).find(c => c && c.vknTckn === val && c.tip !== 'musteri');
      if (matched) {
        setForms(prev => prev.map(f => {
          if (f.id === formId) {
            const remembered = findRememberedAccountCode(val, matched.unvan, f.data.malHizmetAdi);
            return {
              ...f,
              data: {
                ...f.data,
                cariId: matched.id,
                tedarikciAdi: matched.unvan || '',
                muhasebeKodu: f.data.muhasebeKodu || remembered
              },
              errors: {}
            };
          }
          return f;
        }));
        toast.success(`${matched.unvan} otomatik eşleşti!`, { id: `match-${formId}` });
      }
    }
  };
  const errorFormsCount = forms.filter(f => !!f.aiError).length;
  const filteredForms = formFilter === 'errors' ? forms.filter(f => !!f.aiError) : forms;
  const hasAnyImage = forms.some(f => !!f.data.dosyaBase64);
  const activeFormForPreview = forms.find(f => f.id === activeFormId && !!f.data.dosyaBase64) || forms.find(f => !!f.data.dosyaBase64) || null;
  const activePreviewIndex = activeFormForPreview ? forms.findIndex(f => f.id === activeFormForPreview.id) : -1;

  return (
    <Sheet open={isAlisDrawerOpen} onOpenChange={handleClose}>
      <SheetContent className={cn("w-full overflow-y-auto transition-all duration-300", hasAnyImage && splitViewMode ? "sm:max-w-[95vw] xl:max-w-7xl" : "sm:max-w-2xl")} side="right">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between pr-8 gap-2 flex-wrap">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Yeni Alış Faturası Girişi
            </SheetTitle>
            {hasAnyImage && (
              <Button
                type="button"
                size="sm"
                variant={splitViewMode ? "default" : "outline"}
                onClick={() => setSplitViewMode(prev => !prev)}
                className={cn("h-8 text-xs gap-1.5 font-semibold", splitViewMode ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-indigo-700 border-indigo-200")}
              >
                <Columns className="w-3.5 h-3.5" />
                {splitViewMode ? 'Yan Yana Hızlı Doğrulama: Açık' : 'Yan Yana Hızlı Doğrulama Modu'}
              </Button>
            )}
          </div>
          <SheetDescription>
            PDF dosyalarını veya resimleri yükleyerek yapay zekanın tüm bilgileri çekmesini ve belgeyi kaydetmesini sağlayabilirsiniz.
          </SheetDescription>
        </SheetHeader>

        {/* Kurtarılmış Taslak Bildirimi */}
        {hasPendingDraft && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mt-4 flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900">Arka Planda Kayıtlı Taslak Bulundu!</h4>
                <p className="text-xs text-amber-700">Önceki oturumdan kalan fişler tarayıcınızda güvenle saklandı.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={loadDraft} className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm">
                Taslağı Yükle
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={clearDraft} className="text-amber-800 hover:bg-amber-100">
                Temizle
              </Button>
            </div>
          </div>
        )}

        <div className="py-6 space-y-6">
          <AlisFaturaUploadPanel
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
            setForms={setForms}
            fileInputRef={fileInputRef}
            handleFileChange={handleFileChange}
            processFiles={processFiles}
            scanImage={() => scanImage()}
            isScanning={isScanning}
            scanProgress={scanProgress}
            isSaving={isSaving}
            saveProgress={saveProgress}
            aiAddedCount={aiAddedCount}
            setPreviewImage={setPreviewImage}
          />
          <form onSubmit={handleSubmit} className="space-y-6">
                {/* Hata Veren Fişler Bildirim ve Filtre Paneli */}
                {errorFormsCount > 0 && (
                  <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs shadow-sm animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 font-bold flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <h5 className="font-bold text-red-950 text-sm">
                          {errorFormsCount} Adet Fiş Okunamadı (Kırmızı Çerçeve ile Belirtildi)
                        </h5>
                        <p className="text-red-700 text-[11px] mt-0.5">
                          Kırmızı çerçeveli fişleri "Fişi Gör" butonuna basarak inceleyebilir ve eksik bilgileri elle yazabilir veya tekrar taratabilirsiniz.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setFormFilter(prev => prev === 'errors' ? 'all' : 'errors')}
                        className={cn(
                          "text-xs font-semibold h-8 border",
                          formFilter === 'errors' 
                            ? "bg-red-600 text-white hover:bg-red-700 border-red-600" 
                            : "text-red-700 border-red-300 hover:bg-red-100 bg-white"
                        )}
                      >
                        <Filter className="w-3.5 h-3.5 mr-1" />
                        {formFilter === 'errors' ? 'Tüm Fişleri Göster' : `Sadece Hatalıları Göster (${errorFormsCount})`}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={retryFailedScans}
                        disabled={isScanning}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs h-8 shadow-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Hataları Tekrar Tara
                      </Button>
                    </div>
                  </div>
                )}

                {/* Çoklu Belge Durum ve İlerleme Özeti */}
                {forms.length > 1 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center">
                        {forms.length}
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-800">Hazır Fişler / Faturalar</h5>
                        <p className="text-[11px] text-slate-500">
                          {errorFormsCount > 0 
                            ? `${forms.length - errorFormsCount} fiş hazır, ${errorFormsCount} fiş manuel inceleme bekliyor.` 
                            : 'Kayıt sırasında her fiş tek tek işlenir, yarıda kalma riski yoktur.'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      {errorFormsCount > 0 && (
                        <span className="text-xs font-bold text-red-700 bg-red-100 border border-red-300 px-2.5 py-1 rounded-full">
                          {errorFormsCount} Hatalı
                        </span>
                      )}
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                        {forms.length} Belge Bekliyor
                      </span>
                    </div>
                  </div>
                )}

                <div className={cn("gap-6 items-start", hasAnyImage && splitViewMode ? "grid grid-cols-1 lg:grid-cols-12" : "space-y-8")}>
                  {hasAnyImage && splitViewMode && activeFormForPreview && (
                    <AlisFaturaSplitPreview
                      activeFormForPreview={activeFormForPreview}
                      activePreviewIndex={activePreviewIndex}
                      forms={forms}
                      splitZoom={splitZoom}
                      setSplitZoom={setSplitZoom}
                      focusAndScrollToForm={focusAndScrollToForm}
                      onOpenFullPreview={setPreviewImage}
                    />
                  )}

                  <div className={cn("space-y-8", hasAnyImage && splitViewMode ? "lg:col-span-7" : "")}>
                  {filteredForms.map((form) => {
                    const actualIndex = forms.findIndex(f => f.id === form.id);
                    const hes = getHesaplanan(form);
                    const isMultiple = forms.length > 1;
                    const duplicateMatch = findDuplicateForForm(form);
                    const isFocusedCard = hasAnyImage && splitViewMode && activeFormForPreview?.id === form.id;
                    const hasValidationErrors = Object.keys(form.errors || {}).length > 0;

                    return (
                      <AlisFaturaFormCard
                        key={form.id}
                        form={form}
                        actualIndex={actualIndex}
                        hes={hes}
                        isMultiple={isMultiple}
                        duplicateMatch={duplicateMatch}
                        isFocusedCard={isFocusedCard}
                        hasValidationErrors={hasValidationErrors}
                        isIsletmeDefteri={isIsletmeDefteri}
                        activeCompany={activeCompany}
                        cariler={cariler}
                        urunler={urunler}
                        depolar={depolar}
                        varsayilanDepoId={varsayilanDepoId}
                        setActiveFormId={setActiveFormId}
                        setForms={setForms}
                        updateForm={updateForm}
                        handleVknChange={handleVknChange}
                        removeForm={removeForm}
                        setPreviewImage={setPreviewImage}
                        setIsUrunFormOpen={setIsUrunFormOpen}
                      />
                    );
                  })}
              </div>
            </div>

            <Button type="button" variant="outline" onClick={addNewForm} className="border-dashed border-2 w-full h-12 text-slate-500 border-slate-300 bg-slate-50 hover:bg-slate-100 hover:text-primary transition-all">
              <Plus className="w-4 h-4 mr-2" /> Yeni Satır / Belge Ekle
            </Button>

            <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white pb-6 mt-6 z-10">
              <Button type="button" variant="outline" className="flex-1 h-12" onClick={handleClose}>İptal</Button>
              <Button type="submit" disabled={isSaving || isScanning} className={cn("flex-1 h-12 shadow-sm font-semibold transition-all", aiAddedCount > 0 ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-primary hover:bg-primary/90 text-primary-foreground")}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Aktarılıyor ({saveProgress ? `${saveProgress.current}/${saveProgress.total}` : '...'})
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    {forms.length > 1 ? `Tümünü Kaydet ve Sisteme Aktar (${forms.length} Fiş)` : 'Kaydet ve Ekle'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
        <UrunForm 
          isOpen={isUrunFormOpen} 
          onClose={() => setIsUrunFormOpen(false)} 
        />

        {/* Fiş / Belge Büyütme ve İnceleme Modalı */}
        <AlisFaturaPreviewModal previewImage={previewImage} onClose={() => setPreviewImage(null)} />
      </SheetContent>
    </Sheet>
  );
}