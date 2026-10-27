import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LucaAccountSelect } from '@/components/LucaAccountSelect';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  Maximize2, 
  Download, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  Scale, 
  FileText, 
  Building2, 
  Calendar, 
  CreditCard, 
  Sparkles, 
  RefreshCw, 
  Trash2, 
  Save, 
  FileCheck, 
  Layers, 
  ExternalLink,
  Info,
  Car,
  Tag,
  Upload,
  UploadCloud,
  FileUp,
  Image as ImageIcon,
  Loader2,
  Plus,
  Scissors
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { AlisFatura } from '@/types';
import { MuhasebeTopluGorselEsleModal } from './MuhasebeTopluGorselEsleModal';

export interface MahsupSatir {
  id: string;
  maddeNo: number;
  kod: string;
  ad: string;
  borc: number;
  alacak: number;
  aciklama: string;
}

export function MuhasebeFisInceleme() {
  const { 
    alisFaturalari, 
    updateAlisFatura, 
    deleteAlisFatura, 
    lucaAccounts, 
    companies, 
    user, 
    apiFetch, 
    cariler 
  } = useApp();

  const activeCompany = companies.find(c => c.id === (user?.companyId || 1));

  // Filtreler & Sıralama
  const [filterType, setFilterType] = useState<'all' | 'with-doc' | 'without-doc' | 'missing-code' | 'vehicle'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Görsel / Belge Durumu
  const [docLoading, setDocLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [currentDocBase64, setCurrentDocBase64] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Görseli eksik olan faturaların listesi
  const missingDocInvoices = useMemo(() => {
    return (alisFaturalari || []).filter(f => !f.pdfDosya && !f.pdfDosyaAdi);
  }, [alisFaturalari]);

  // Düzenleme Modu
  const [editMuhasebeKodu, setEditMuhasebeKodu] = useState('');
  const [editKarsiHesapKodu, setEditKarsiHesapKodu] = useState('');
  const [editKdvHesapKodu, setEditKdvHesapKodu] = useState('');
  const [editAciklama, setEditAciklama] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [mahsupSatirlari, setMahsupSatirlari] = useState<MahsupSatir[]>([]);
  const [kdvSettings, setKdvSettings] = useState<any>(null);

  // Fatura KDV ve Muhasebe Bağlantıları Ayarlarını Yükle
  useEffect(() => {
    apiFetch('/api/settings/luca_kdv_ayarlari')
      .then(res => {
        if (res?.success && res.value) {
          try {
            setKdvSettings(JSON.parse(res.value));
          } catch (e) {}
        }
      })
      .catch(err => console.warn('KDV ayarları çekilemedi:', err));
  }, []);

  // Hesap Planı İsim Yardımcısı
  const getAccountName = (code: string) => {
    if (!code) return 'Hesap Seçilmedi';
    const found = (lucaAccounts || []).find(a => a.kod === code);
    if (found) return found.ad;
    // Varsayılan Muhasebe İsimleri
    if (code.startsWith('770')) return 'Genel Yönetim Giderleri';
    if (code.startsWith('760')) return 'Pazarlama Satış Dağıtım Giderleri';
    if (code.startsWith('740')) return 'Hizmet Üretim Maliyeti';
    if (code.startsWith('153')) return 'Ticari Mallar';
    if (code.startsWith('191')) return 'İndirilecek KDV';
    if (code.startsWith('391')) return 'Hesaplanan KDV';
    if (code.startsWith('100')) return 'Kasa Hesabı';
    if (code.startsWith('102')) return 'Bankalar Hesabı';
    if (code.startsWith('108')) return 'Diğer Hazır Değerler (Kredi Kartı Slipleri)';
    if (code.startsWith('300') || code.startsWith('309')) return 'Kredi Kartı Borçları';
    if (code.startsWith('320')) return 'Satıcılar Cari Hesabı';
    if (code.startsWith('329')) return 'Diğer Ticari Borçlar';
    if (code.startsWith('331')) return 'Ortaklara Borçlar Hesabı';
    if (code.startsWith('689')) return 'Kanunen Kabul Edilmeyen Giderler (KKEG)';
    if (code.startsWith('360')) return 'Ödenecek Vergi ve Fonlar (Stopaj/Tevkifat)';
    return 'Tanımlı Hesap';
  };

  // KDV Oranına göre 191/391 alt hesabı belirleme (Öncelik: Fatura KDV ve Muhasebe Bağlantıları)
  const getKdvAccountCode = (rate: number | string) => {
    const r = String(rate).replace(/[^0-9]/g, '');
    if (kdvSettings?.alis?.[r]) {
      return kdvSettings.alis[r];
    }
    if (r === '8' && kdvSettings?.alis?.['10']) return kdvSettings.alis['10'];
    if (r === '18' && kdvSettings?.alis?.['20']) return kdvSettings.alis['20'];

    if (r === '1') return '191.01';
    if (r === '8' || r === '10') return '191.10';
    if (r === '18' || r === '20') return '191.20';
    return '191.20';
  };

  // Varsayılan Mahsup Fişi Maddelerini Hesaplama Fonksiyonu
  const generateDefaultMahsupRows = (fatura: AlisFatura, giderKoduParam?: string, karsiKoduParam?: string, kdvKoduParam?: string): MahsupSatir[] => {
    const toplamTutar = parseFloat(String(fatura.toplamTutar || 0)) || 0;
    const kdvOrani = parseFloat(String(fatura.kdvOrani || 20)) || 0;
    const matrah = parseFloat(String(fatura.matrah || 0)) || Math.round((toplamTutar / (1 + kdvOrani / 100)) * 100) / 100;
    const kdvTutari = parseFloat(String(fatura.kdvTutari || 0)) || Math.round((toplamTutar - matrah) * 100) / 100;
    const stopajTutari = parseFloat(String(fatura.stopajTutari || 0)) || 0;
    const tevkifatTutari = parseFloat(String(fatura.tevkifatTutari || 0)) || 0;

    const isVehicleExpense = !!fatura.vehiclePlate || 
      /akaryakıt|yakıt|benzin|motorin|bakım|onarım/i.test(fatura.malHizmetAdi || '') ||
      (fatura.aciklama || '').includes('%70 Gider') ||
      !!fatura.hasKkeg;

    const giderKodu = giderKoduParam || fatura.muhasebeKodu || (isVehicleExpense ? '770.02.001' : '770.01.001');
    const kdvKodu = kdvKoduParam || fatura.kdvHesapKodu || getKdvAccountCode(kdvOrani);
    const karsiKodu = karsiKoduParam || fatura.karsiHesapKodu || (fatura.cariId ? '320.01' : '100.01');
    const kkegKodu = kdvSettings?.aracGiderKkegKodu || '689.01.001';

    const rows: MahsupSatir[] = [];
    let mNo = 1;

    if (isVehicleExpense) {
      const giderMatrah = Math.round(matrah * 0.7 * 100) / 100;
      rows.push({
        id: `row_${Date.now()}_${mNo}`,
        maddeNo: mNo++,
        kod: giderKodu,
        ad: getAccountName(giderKodu),
        borc: giderMatrah,
        alacak: 0,
        aciklama: `${fatura.malHizmetAdi || 'Mal/Hizmet'} (%70 Gider Payı)`
      });

      const giderKdv = Math.round(kdvTutari * 0.7 * 100) / 100;
      if (giderKdv > 0) {
        rows.push({
          id: `row_${Date.now()}_${mNo}`,
          maddeNo: mNo++,
          kod: kdvKodu,
          ad: `${getAccountName(kdvKodu)} (%${kdvOrani})`,
          borc: giderKdv,
          alacak: 0,
          aciklama: `İndirilecek KDV %${kdvOrani} (%70 Pay)`
        });
      }

      const kkegMatrah = Math.round(matrah * 0.3 * 100) / 100;
      const kkegKdv = Math.round(kdvTutari * 0.3 * 100) / 100;
      const toplamKkeg = Math.round((kkegMatrah + kkegKdv) * 100) / 100;

      if (toplamKkeg > 0) {
        rows.push({
          id: `row_${Date.now()}_${mNo}`,
          maddeNo: mNo++,
          kod: kkegKodu,
          ad: getAccountName(kkegKodu) || 'Kanunen Kabul Edilmeyen Giderler (KKEG)',
          borc: toplamKkeg,
          alacak: 0,
          aciklama: `Binek Araç Kısıtı (%30 KKEG: Matrah ${kkegMatrah} TL + KDV ${kkegKdv} TL)`
        });
      }
    } else {
      rows.push({
        id: `row_${Date.now()}_${mNo}`,
        maddeNo: mNo++,
        kod: giderKodu,
        ad: getAccountName(giderKodu),
        borc: matrah,
        alacak: 0,
        aciklama: fatura.malHizmetAdi || 'Mal ve Hizmet Alımı'
      });

      if (kdvTutari > 0) {
        rows.push({
          id: `row_${Date.now()}_${mNo}`,
          maddeNo: mNo++,
          kod: kdvKodu,
          ad: `${getAccountName(kdvKodu)} (%${kdvOrani})`,
          borc: kdvTutari,
          alacak: 0,
          aciklama: `İndirilecek KDV %${kdvOrani}`
        });
      }
    }

    if (tevkifatTutari > 0) {
      rows.push({
        id: `row_${Date.now()}_${mNo}`,
        maddeNo: mNo++,
        kod: '360.01.001',
        ad: 'Tevkifat KDV Kesintisi',
        borc: 0,
        alacak: tevkifatTutari,
        aciklama: `KDV Tevkifatı (${fatura.tevkifatOrani})`
      });
    }

    if (stopajTutari > 0) {
      rows.push({
        id: `row_${Date.now()}_${mNo}`,
        maddeNo: mNo++,
        kod: '360.02.001',
        ad: 'Ödenecek Stopaj Vergisi',
        borc: 0,
        alacak: stopajTutari,
        aciklama: `Stopaj Kesintisi (%${fatura.stopajOrani})`
      });
    }

    const netKarsiAlacak = Math.round((toplamTutar - stopajTutari - tevkifatTutari) * 100) / 100;
    rows.push({
      id: `row_${Date.now()}_${mNo}`,
      maddeNo: mNo++,
      kod: karsiKodu,
      ad: getAccountName(karsiKodu),
      borc: 0,
      alacak: netKarsiAlacak,
      aciklama: `${fatura.tedarikciAdi} - Belge No: ${fatura.faturaNo}`
    });

    return rows;
  };

  // Filtrelenmiş Faturalar
  const filteredFaturalar = useMemo(() => {
    return (alisFaturalari || []).filter(f => {
      // Metin Arama
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTitle = (f.tedarikciAdi || '').toLowerCase().includes(term);
        const matchNo = (f.faturaNo || '').toLowerCase().includes(term);
        const matchVkn = (f.tedarikciVkn || '').toLowerCase().includes(term);
        const matchNote = (f.aciklama || '').toLowerCase().includes(term);
        if (!matchTitle && !matchNo && !matchVkn && !matchNote) return false;
      }

      // Tip Filtresi
      if (filterType === 'with-doc') {
        return !!(f.pdfDosya || f.pdfDosyaAdi);
      }
      if (filterType === 'without-doc') {
        return !f.pdfDosya && !f.pdfDosyaAdi;
      }
      if (filterType === 'missing-code') {
        return !f.muhasebeKodu || f.muhasebeKodu.trim() === '';
      }
      if (filterType === 'vehicle') {
        return !!f.vehiclePlate || /akaryakıt|yakıt|benzin|motorin|bakım|onarım/i.test(f.malHizmetAdi || '');
      }

      return true;
    });
  }, [alisFaturalari, filterType, searchTerm]);

  // Geçerli Fatura
  const currentFatura: AlisFatura | undefined = filteredFaturalar[selectedIndex];

  // Index sınırları koruma
  useEffect(() => {
    if (selectedIndex >= filteredFaturalar.length && filteredFaturalar.length > 0) {
      setSelectedIndex(0);
    }
  }, [filteredFaturalar.length, selectedIndex]);

  // Fatura değiştikçe düzenleme alanlarını ve görseli sıfırla/çek
  useEffect(() => {
    if (!currentFatura) {
      setCurrentDocBase64(null);
      setMahsupSatirlari([]);
      return;
    }

    setEditMuhasebeKodu(currentFatura.muhasebeKodu || '');
    setEditKarsiHesapKodu(currentFatura.karsiHesapKodu || (currentFatura.cariId ? '320.01' : '100.01'));
    setEditAciklama(currentFatura.aciklama || `${currentFatura.tedarikciAdi} - ${currentFatura.faturaNo}`);

    // KDV Kodunu belirle (Öncelik: faturada kayıtlı -> satırlardaki -> Fatura KDV ve Muhasebe Bağlantıları)
    let initialKdv = currentFatura.kdvHesapKodu || '';
    if (!initialKdv && currentFatura.mahsupSatirlari && Array.isArray(currentFatura.mahsupSatirlari)) {
      const kdvRow = currentFatura.mahsupSatirlari.find((r: any) => (r.kod || '').startsWith('191') || (r.kod || '').startsWith('391'));
      if (kdvRow) initialKdv = kdvRow.kod;
    }
    if (!initialKdv) {
      initialKdv = getKdvAccountCode(currentFatura.kdvOrani || 20);
    }
    setEditKdvHesapKodu(initialKdv);

    setZoomLevel(1);
    setRotation(0);

    // Mahsup Satırlarını Yükle (Varsa kaydedilmiş özel kalemler, yoksa otomatik hesapla)
    if (currentFatura.mahsupSatirlari && Array.isArray(currentFatura.mahsupSatirlari) && currentFatura.mahsupSatirlari.length > 0) {
      setMahsupSatirlari(currentFatura.mahsupSatirlari.map((m: any, idx: number) => ({
        id: m.id || `row_${idx + 1}_${Date.now()}`,
        maddeNo: m.maddeNo || (idx + 1),
        kod: m.kod || '',
        ad: m.ad || getAccountName(m.kod || ''),
        borc: typeof m.borc === 'number' ? m.borc : (parseFloat(m.borc) || 0),
        alacak: typeof m.alacak === 'number' ? m.alacak : (parseFloat(m.alacak) || 0),
        aciklama: m.aciklama || ''
      })));
    } else {
      setMahsupSatirlari(generateDefaultMahsupRows(currentFatura, currentFatura.muhasebeKodu, currentFatura.karsiHesapKodu, initialKdv));
    }
    setZoomLevel(1);
    setRotation(0);

    // Görsel çekme: Eğer faturada pdfDosya zaten varsa doğrudan al
    if (currentFatura.pdfDosya) {
      setCurrentDocBase64(currentFatura.pdfDosya);
      return;
    }

    // Yoksa backend'den tekil çek (id bazlı)
    if (currentFatura.id) {
      setDocLoading(true);
      apiFetch(`/api/alis-faturalari/${currentFatura.id}`)
        .then(res => {
          if (res?.success && res.data?.pdfDosya) {
            setCurrentDocBase64(res.data.pdfDosya);
          } else {
            setCurrentDocBase64(null);
          }
        })
        .catch(err => {
          console.warn('Fatura görseli alınamadı:', err);
          setCurrentDocBase64(null);
        })
        .finally(() => {
          setDocLoading(false);
        });
    } else {
      setCurrentDocBase64(null);
    }
  }, [currentFatura?.id]);

  // Tekil Görsel Yükleme (Dosya Seçildiğinde veya Sürüklenip Bırakıldığında)
  const handleSingleFileUpload = async (file: File) => {
    if (!currentFatura) {
      toast.error('Görsel yüklenecek geçerli bir fiş bulunamadı.');
      return;
    }
    setUploadingDoc(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          // Backend'e kaydet
          await apiFetch(`/api/alis-faturalari/${currentFatura.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              pdfDosya: base64Data,
              pdfDosyaAdi: file.name
            })
          });

          // Arayüz state'ini ve context'i anında güncelle
          setCurrentDocBase64(base64Data);
          updateAlisFatura(currentFatura.id, {
            ...currentFatura,
            pdfDosya: base64Data,
            pdfDosyaAdi: file.name
          } as any);

          toast.success('Fiş görseli başarıyla yüklendi ve sunucuya kaydedildi!');
        } catch (err: any) {
          toast.error('Görsel sunucuya kaydedilemedi: ' + err.message);
        } finally {
          setUploadingDoc(false);
        }
      };
      reader.onerror = () => {
        toast.error('Dosya okunamadı.');
        setUploadingDoc(false);
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      toast.error('Hata: ' + e.message);
      setUploadingDoc(false);
    }
  };

  // Panodan Görsel Yapıştırma (Ctrl + V) Desteği
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (!currentFatura) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            const namedFile = new File([file], `yapistirilan_fis_${currentFatura.faturaNo || Date.now()}.jpg`, { type: file.type });
            handleSingleFileUpload(namedFile);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [currentFatura?.id]);

  // Klavye ok tuşları ile önceki / sonraki fişe geçiş
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Eğer input odaklıysa gezinme yapma
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, filteredFaturalar.length]);

  const goPrev = () => {
    if (selectedIndex > 0) {
      setSelectedIndex(prev => prev - 1);
    }
  };

  const goNext = () => {
    if (selectedIndex < filteredFaturalar.length - 1) {
      setSelectedIndex(prev => prev + 1);
    }
  };

  // Mahsup Fişi Dip Toplam & Denklik Hesaplamaları (Dinamik Satırlardan)
  const mahsupDetay = useMemo(() => {
    if (!currentFatura) return null;

    const toplamTutar = parseFloat(String(currentFatura.toplamTutar || 0)) || 0;
    const kdvOrani = parseFloat(String(currentFatura.kdvOrani || 20)) || 0;
    const matrah = parseFloat(String(currentFatura.matrah || 0)) || Math.round((toplamTutar / (1 + kdvOrani / 100)) * 100) / 100;
    const kdvTutari = parseFloat(String(currentFatura.kdvTutari || 0)) || Math.round((toplamTutar - matrah) * 100) / 100;
    const stopajTutari = parseFloat(String(currentFatura.stopajTutari || 0)) || 0;
    const tevkifatTutari = parseFloat(String(currentFatura.tevkifatTutari || 0)) || 0;

    const toplamBorc = Math.round(mahsupSatirlari.reduce((acc, m) => acc + (Number(m.borc) || 0), 0) * 100) / 100;
    const toplamAlacak = Math.round(mahsupSatirlari.reduce((acc, m) => acc + (Number(m.alacak) || 0), 0) * 100) / 100;
    const fark = Math.round((toplamBorc - toplamAlacak) * 100) / 100;
    const isDengeli = Math.abs(fark) < 0.05;
    const hasKkeg = mahsupSatirlari.some(r => (r.kod || '').startsWith('689'));

    return {
      toplamTutar,
      matrah,
      kdvOrani,
      kdvTutari,
      stopajTutari,
      tevkifatTutari,
      hasKkeg,
      maddeler: mahsupSatirlari,
      toplamBorc,
      toplamAlacak,
      fark,
      isDengeli
    };
  }, [currentFatura, mahsupSatirlari]);

  // %70 GİDER / %30 KKEG AYIRMA BUTONU
  const handleKkegAyir = () => {
    if (!currentFatura) return;
    const toplamTutar = parseFloat(String(currentFatura.toplamTutar || 0)) || 0;
    const kdvOrani = parseFloat(String(currentFatura.kdvOrani || 20)) || 0;
    const matrah = parseFloat(String(currentFatura.matrah || 0)) || Math.round((toplamTutar / (1 + kdvOrani / 100)) * 100) / 100;
    const kdvTutari = parseFloat(String(currentFatura.kdvTutari || 0)) || Math.round((toplamTutar - matrah) * 100) / 100;

    const giderMatrah = Math.round(matrah * 0.7 * 100) / 100;
    const giderKdv = Math.round(kdvTutari * 0.7 * 100) / 100;
    const kkegMatrah = Math.round(matrah * 0.3 * 100) / 100;
    const kkegKdv = Math.round(kdvTutari * 0.3 * 100) / 100;
    const toplamKkeg = Math.round((kkegMatrah + kkegKdv) * 100) / 100;

    const giderKodu = editMuhasebeKodu || currentFatura.muhasebeKodu || '770.02.001';
    const kdvKodu = editKdvHesapKodu || currentFatura.kdvHesapKodu || getKdvAccountCode(kdvOrani);
    const karsiKodu = editKarsiHesapKodu || currentFatura.karsiHesapKodu || (currentFatura.cariId ? '320.01' : '100.01');
    const kkegKodu = kdvSettings?.aracGiderKkegKodu || '689.01.001';

    const splitRows: MahsupSatir[] = [
      {
        id: 'row_' + Date.now() + '_1',
        maddeNo: 1,
        kod: giderKodu,
        ad: getAccountName(giderKodu),
        borc: giderMatrah,
        alacak: 0,
        aciklama: `${currentFatura.malHizmetAdi || 'Mal/Hizmet'} (%70 Gider Payı)`
      },
      {
        id: 'row_' + Date.now() + '_2',
        maddeNo: 2,
        kod: kdvKodu,
        ad: `${getAccountName(kdvKodu)} (%${kdvOrani})`,
        borc: giderKdv,
        alacak: 0,
        aciklama: `İndirilecek KDV %${kdvOrani} (%70 Pay)`
      },
      {
        id: 'row_' + Date.now() + '_3',
        maddeNo: 3,
        kod: kkegKodu,
        ad: getAccountName(kkegKodu) || 'Kanunen Kabul Edilmeyen Giderler (KKEG)',
        borc: toplamKkeg,
        alacak: 0,
        aciklama: `Binek Araç Kısıtı (%30 KKEG: Matrah ${kkegMatrah} TL + KDV ${kkegKdv} TL)`
      },
      {
        id: 'row_' + Date.now() + '_4',
        maddeNo: 4,
        kod: karsiKodu,
        ad: getAccountName(karsiKodu),
        borc: 0,
        alacak: toplamTutar,
        aciklama: `${currentFatura.tedarikciAdi} - Belge No: ${currentFatura.faturaNo}`
      }
    ];

    setMahsupSatirlari(splitRows);
    if (!editAciklama.includes('%70 Gider') && !editAciklama.includes('KKEG')) {
      setEditAciklama(prev => prev ? `${prev} [Binek Araç %70 Gider / %30 KKEG]` : '[Binek Araç %70 Gider / %30 KKEG]');
    }
    toast.success('Fiş tutarları %70 Gider ve %30 KKEG olarak ayrıldı!');
  };

  // YENİ BORÇ / GİDER SATIRI EKLE
  const handleAddBorcRow = () => {
    const newId = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const nextMaddeNo = mahsupSatirlari.length + 1;
    const defaultKod = editMuhasebeKodu || '770.01.001';

    const currentBorc = mahsupSatirlari.reduce((acc, m) => acc + (Number(m.borc) || 0), 0);
    const currentAlacak = mahsupSatirlari.reduce((acc, m) => acc + (Number(m.alacak) || 0), 0);
    const rem = Math.max(0, Math.round((currentAlacak - currentBorc) * 100) / 100);

    const newRow: MahsupSatir = {
      id: newId,
      maddeNo: nextMaddeNo,
      kod: defaultKod,
      ad: getAccountName(defaultKod),
      borc: rem,
      alacak: 0,
      aciklama: currentFatura ? `${currentFatura.malHizmetAdi || 'Ek Gider Kalemi'}` : 'Gider Kalemi'
    };
    setMahsupSatirlari(prev => [...prev, newRow]);
    toast.success('Yeni Gider / Borç satırı eklendi.');
  };

  // YENİ KDV (191 / 391) SATIRI EKLE
  const handleAddKdvRow = () => {
    const newId = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const nextMaddeNo = mahsupSatirlari.length + 1;
    const defaultKod = editKdvHesapKodu || getKdvAccountCode(currentFatura?.kdvOrani || 20);

    const currentBorc = mahsupSatirlari.reduce((acc, m) => acc + (Number(m.borc) || 0), 0);
    const currentAlacak = mahsupSatirlari.reduce((acc, m) => acc + (Number(m.alacak) || 0), 0);
    const rem = Math.max(0, Math.round((currentAlacak - currentBorc) * 100) / 100);

    const newRow: MahsupSatir = {
      id: newId,
      maddeNo: nextMaddeNo,
      kod: defaultKod,
      ad: `${getAccountName(defaultKod)} (%${currentFatura?.kdvOrani || 20})`,
      borc: rem,
      alacak: 0,
      aciklama: `İndirilecek KDV Kalemi`
    };
    setMahsupSatirlari(prev => [...prev, newRow]);
    toast.success('Yeni KDV satırı eklendi.');
  };

  // YENİ ALACAK / KARŞI HESAP (ÖDEME) SATIRI EKLE
  const handleAddAlacakRow = () => {
    const newId = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const nextMaddeNo = mahsupSatirlari.length + 1;
    const defaultKod = editKarsiHesapKodu || '108.01';

    const currentBorc = mahsupSatirlari.reduce((acc, m) => acc + (Number(m.borc) || 0), 0);
    const currentAlacak = mahsupSatirlari.reduce((acc, m) => acc + (Number(m.alacak) || 0), 0);
    const rem = Math.max(0, Math.round((currentBorc - currentAlacak) * 100) / 100);

    const newRow: MahsupSatir = {
      id: newId,
      maddeNo: nextMaddeNo,
      kod: defaultKod,
      ad: getAccountName(defaultKod),
      borc: 0,
      alacak: rem,
      aciklama: 'Kredi Kartı / Ortak / Kasa Ödemesi'
    };
    setMahsupSatirlari(prev => [...prev, newRow]);
    toast.success('Yeni Karşı Hesap / Alacak satırı eklendi.');
  };

  // SATIR DÜZENLEME
  const handleUpdateRow = (id: string, updates: Partial<MahsupSatir>) => {
    setMahsupSatirlari(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  // SATIR SİLME
  const handleDeleteRow = (id: string) => {
    if (mahsupSatirlari.length <= 1) {
      toast.error('Fişte en az bir satır bulunmalıdır.');
      return;
    }
    setMahsupSatirlari(prev => {
      const filtered = prev.filter(r => r.id !== id);
      return filtered.map((r, idx) => ({ ...r, maddeNo: idx + 1 }));
    });
    toast.info('Satır silindi.');
  };

  // VARSAYILANA DÖN
  const handleResetToDefault = () => {
    if (!currentFatura) return;
    const defaultRows = generateDefaultMahsupRows(currentFatura, editMuhasebeKodu, editKarsiHesapKodu, editKdvHesapKodu);
    setMahsupSatirlari(defaultRows);
    toast.info('Fiş satırları orijinal değerlerine sıfırlandı.');
  };

  // FARK EŞİTLEME (DENKLİK SAĞLAMA)
  const handleBalanceDifference = () => {
    if (!mahsupSatirlari.length) return;
    const currentBorc = Math.round(mahsupSatirlari.reduce((acc, m) => acc + (Number(m.borc) || 0), 0) * 100) / 100;
    const currentAlacak = Math.round(mahsupSatirlari.reduce((acc, m) => acc + (Number(m.alacak) || 0), 0) * 100) / 100;
    const diff = Math.round((currentBorc - currentAlacak) * 100) / 100;

    if (Math.abs(diff) < 0.01) {
      toast.success('Fiş zaten dengede!');
      return;
    }

    if (diff > 0) {
      // Borç fazla -> Son Alacak satırına farkı ekle
      const lastAlacakIdx = mahsupSatirlari.map(r => r.alacak > 0).lastIndexOf(true);
      if (lastAlacakIdx >= 0) {
        setMahsupSatirlari(prev => prev.map((r, i) => i === lastAlacakIdx ? { ...r, alacak: Math.round((r.alacak + diff) * 100) / 100 } : r));
      } else {
        handleAddAlacakRow();
      }
    } else {
      // Alacak fazla -> İlk Borç satırına farkı ekle
      const firstBorcIdx = mahsupSatirlari.findIndex(r => r.borc > 0 && !r.kod.startsWith('191'));
      if (firstBorcIdx >= 0) {
        setMahsupSatirlari(prev => prev.map((r, i) => i === firstBorcIdx ? { ...r, borc: Math.round((r.borc + Math.abs(diff)) * 100) / 100 } : r));
      } else {
        handleAddBorcRow();
      }
    }
    toast.success('Fark eşitlendi ve fiş dengelendi.');
  };

  // Üst Başlıktaki Gider Kodu değişirse ilk gider satırını güncelle
  const handleMainGiderCodeChange = (newKod: string) => {
    setEditMuhasebeKodu(newKod);
    setMahsupSatirlari(prev => {
      const firstBorcIdx = prev.findIndex(r => r.borc > 0 && !r.kod.startsWith('191') && !r.kod.startsWith('689'));
      if (firstBorcIdx >= 0) {
        return prev.map((r, i) => i === firstBorcIdx ? { ...r, kod: newKod, ad: getAccountName(newKod) } : r);
      }
      return prev;
    });
  };

  // Üst Başlıktaki KDV Kodu (191 / 391) değişirse KDV satırlarını güncelle
  const handleMainKdvCodeChange = (newKod: string) => {
    setEditKdvHesapKodu(newKod);
    setMahsupSatirlari(prev => {
      const kdvIndices = prev
        .map((r, i) => (r.kod.startsWith('191') || r.kod.startsWith('391')) ? i : -1)
        .filter(i => i >= 0);
      if (kdvIndices.length > 0) {
        return prev.map((r, i) => kdvIndices.includes(i) ? { ...r, kod: newKod, ad: `${getAccountName(newKod)} (%${currentFatura?.kdvOrani || 20})` } : r);
      }
      return prev;
    });
  };

  // Üst Başlıktaki Karşı Hesap değişirse ilk karşı satırını güncelle
  const handleMainKarsiCodeChange = (newKod: string) => {
    setEditKarsiHesapKodu(newKod);
    setMahsupSatirlari(prev => {
      const firstAlacakIdx = prev.findIndex(r => r.alacak > 0 && !r.kod.startsWith('360'));
      if (firstAlacakIdx >= 0) {
        return prev.map((r, i) => i === firstAlacakIdx ? { ...r, kod: newKod, ad: getAccountName(newKod) } : r);
      }
      return prev;
    });
  };

  // Mahsup Fişi Güncellemelerini Kaydet
  const handleSaveAccounting = async () => {
    if (!currentFatura) return;
    setIsUpdating(true);
    try {
      const hasKkeg = mahsupSatirlari.some(r => (r.kod || '').startsWith('689'));
      await updateAlisFatura(currentFatura.id, {
        ...currentFatura,
        muhasebeKodu: editMuhasebeKodu,
        karsiHesapKodu: editKarsiHesapKodu,
        kdvHesapKodu: editKdvHesapKodu,
        aciklama: editAciklama,
        mahsupSatirlari,
        hasKkeg
      } as any);

      toast.success('Muhasebe mahsup fişi ve kalemleri başarıyla kaydedildi!');
    } catch (e: any) {
      toast.error('Güncelleme hatası: ' + e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Fişi ve Bağlı Tüm Kayıtları Tamamen Sil (Her Yerden)
  const handleDeleteFatura = async () => {
    if (!currentFatura) return;
    const unvan = currentFatura.tedarikciAdi || 'Fatura';
    const no = currentFatura.faturaNo || currentFatura.id;
    if (!window.confirm(`"${unvan}" (${no}) fişini tamamen silmek istediğinizden emin misiniz?\n\n⚠️ Bu işlem fişi, görselini, varsa stok ve cari hareketlerini kalıcı olarak HER YERDEN silecektir.`)) {
      return;
    }

    setIsUpdating(true);
    try {
      await deleteAlisFatura(currentFatura.id);
      toast.success('Fiş ve bağlı tüm kayıtlar her yerden kalıcı olarak silindi.');
      if (selectedIndex >= filteredFaturalar.length - 1 && selectedIndex > 0) {
        setSelectedIndex(prev => prev - 1);
      }
    } catch (e: any) {
      toast.error('Fiş silinemedi: ' + e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Mahsup Fişini Yazdırma / Önizleme
  const handlePrint = () => {
    window.print();
  };

  // Görsel Zoom / Döndürme
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleResetZoom = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  // Görsel İndir
  const handleDownloadDoc = () => {
    if (!currentDocBase64 || !currentFatura) return;
    const link = document.createElement('a');
    link.href = currentDocBase64;
    link.download = currentFatura.pdfDosyaAdi || `Fatura_${currentFatura.faturaNo || currentFatura.id}.pdf`;
    link.click();
  };

  // Belge Tipi Belirleme (PDF mi resim mi?)
  const isPdf = useMemo(() => {
    if (!currentDocBase64) return false;
    return currentDocBase64.startsWith('data:application/pdf') || 
           currentDocBase64.toLowerCase().endsWith('.pdf') ||
           currentDocBase64.toLowerCase().includes('.pdf') ||
           (currentFatura?.pdfDosyaAdi || '').toLowerCase().endsWith('.pdf');
  }, [currentDocBase64, currentFatura?.pdfDosyaAdi]);

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] overflow-hidden bg-slate-900/5 dark:bg-slate-950 p-3 sm:p-4 gap-3">
      {/* 1. ÜST NAVİGASYON & FİLTRELEME ÇUBUĞU */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Muhasebe Fiş Denetimi & Mahsup Kontrolü
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px] font-semibold">
                {filteredFaturalar.length} Fiş Listelendi
              </Badge>
            </h1>
            <p className="text-xs text-slate-500">
              Görseli inceleyin, Luca mahsup yevmiye maddelerini doğrulayın ve onaylayın.
            </p>
          </div>
        </div>

        {/* Fatura Arama & Filtre */}
        <div className="flex items-center gap-2 flex-wrap">
          <Input 
            placeholder="Tedarikçi, Belge No, Not ara..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-xs w-44 sm:w-56"
          />

          <Select value={filterType} onValueChange={(val: any) => setFilterType(val)}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue placeholder="Filtrele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Fişler ({alisFaturalari?.length || 0})</SelectItem>
              <SelectItem value="with-doc">📷 Görselli Olanlar</SelectItem>
              <SelectItem value="without-doc">
                ⚠️ Görseli Eksikler ({missingDocInvoices.length})
              </SelectItem>
              <SelectItem value="missing-code">⚠️ Hesabı Eksikler</SelectItem>
              <SelectItem value="vehicle">🚗 Araç / Akaryakıt</SelectItem>
            </SelectContent>
          </Select>

          {/* Toplu Görsel Eşleme Sihirbazı Butonu */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setBatchModalOpen(true)}
            className="h-8 text-xs gap-1.5 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
            title="Görseli eksik fişlere topluca fotoğraf/PDF eşleştirin"
          >
            <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Toplu Görsel Eşle</span>
            {missingDocInvoices.length > 0 && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] h-4.5 px-1.5 py-0 font-bold ml-0.5">
                {missingDocInvoices.length} Eksik
              </Badge>
            )}
          </Button>

          {/* Fiş Gezinme / Sayacı */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded"
              disabled={selectedIndex <= 0}
              onClick={goPrev}
              title="Önceki Fiş (Sol Ok Tuşu)"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <span className="text-xs font-bold px-2 text-slate-700 dark:text-slate-200 whitespace-nowrap">
              {filteredFaturalar.length > 0 ? `${selectedIndex + 1} / ${filteredFaturalar.length}` : '0 / 0'}
            </span>

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded"
              disabled={selectedIndex >= filteredFaturalar.length - 1}
              onClick={goNext}
              title="Sonraki Fiş (Sağ Ok Tuşu)"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrint}
            className="h-8 text-xs gap-1.5"
            title="Mahsup Fişini Yazdır"
          >
            <Printer className="w-3.5 h-3.5" /> Yazdır
          </Button>
        </div>
      </div>

      {filteredFaturalar.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-900 border rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Kayıtlı Alış Faturası Bulunamadı</h3>
          <p className="text-sm text-slate-500 max-w-md mt-1">
            Filtreleme kriterlerinize uygun fatura veya fiş bulunamadı. Lütfen filtreyi değiştirin veya Yeni Alış Faturası Girişi menüsünden fiş ekleyin.
          </p>
        </div>
      ) : (
        /* 2. ANA BÖLÜNMÜŞ (SPLIT) ÇALIŞMA ALANI */
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
          
          {/* ======================================================== */}
          {/* SOL PANEL (5 Kolon): AKTARILMIŞ FİŞ / FATURA GÖRSELİ */}
          {/* ======================================================== */}
          <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {/* Sol Panel Toolbar */}
            <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 p-2.5 px-3 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  {currentFatura?.pdfDosyaAdi || (currentDocBase64 ? 'Belge Görseli' : 'Görsel Yüklenmedi')}
                </span>
                {currentDocBase64 ? (
                  <Badge variant="secondary" className="text-[10px] h-5 bg-emerald-100 text-emerald-800 border-emerald-200 shrink-0">
                    Aktarıldı
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] h-5 bg-amber-100 text-amber-800 border-amber-200 shrink-0">
                    Görsel Eksik
                  </Badge>
                )}
              </div>

              {/* Görsel Kontrolleri & Yükleme Butonları */}
              <div className="flex items-center gap-1">
                {/* Gizli Dosya Seçici */}
                <input 
                  ref={docInputRef} 
                  type="file" 
                  accept="image/*,application/pdf" 
                  className="hidden" 
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleSingleFileUpload(f);
                    e.target.value = '';
                  }} 
                />

                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs gap-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 px-2" 
                  onClick={() => docInputRef.current?.click()} 
                  disabled={uploadingDoc}
                  title="Bu fişe fotoğraf veya PDF yükleyin"
                >
                  {uploadingDoc ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{currentDocBase64 ? 'Değiştir' : 'Görsel Yükle'}</span>
                </Button>

                {currentDocBase64 && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-slate-600 hover:text-slate-900" 
                      onClick={handleZoomOut} 
                      title="Uzaklaştır"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-[11px] font-mono font-medium text-slate-500 px-1">
                      %{Math.round(zoomLevel * 100)}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-slate-600 hover:text-slate-900" 
                      onClick={handleZoomIn} 
                      title="Yakınlaştır"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-slate-600 hover:text-slate-900" 
                      onClick={handleRotate} 
                      title="90° Döndür"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-slate-600 hover:text-slate-900" 
                      onClick={handleResetZoom} 
                      title="Sıfırla"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-indigo-600 hover:bg-indigo-50" 
                      onClick={handleDownloadDoc} 
                      title="İndir"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Görsel / Belge Görüntüleyici Alanı */}
            <div 
              className={cn(
                "flex-1 bg-slate-950/5 dark:bg-slate-950/40 relative overflow-auto flex items-center justify-center p-3 select-none transition-colors",
                isDragging && "bg-indigo-50/50 dark:bg-indigo-950/30"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleSingleFileUpload(file);
              }}
            >
              {docLoading || uploadingDoc ? (
                <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-xs font-medium">
                    {uploadingDoc ? 'Görsel kaydediliyor...' : 'Belge görseli yükleniyor...'}
                  </span>
                </div>
              ) : currentDocBase64 ? (
                isPdf ? (
                  <iframe 
                    src={currentDocBase64} 
                    className="w-full h-full rounded border-0 bg-white" 
                    title="Fatura PDF"
                  />
                ) : (
                  <div 
                    className="transition-transform duration-150 ease-out flex items-center justify-center max-w-full max-h-full"
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transformOrigin: 'center center'
                    }}
                  >
                    <img 
                      src={currentDocBase64} 
                      alt="Fiş Görseli" 
                      className="max-w-full max-h-[calc(100vh-14rem)] object-contain rounded shadow-lg border border-slate-200 dark:border-slate-800"
                    />
                  </div>
                )
              ) : (
                /* GÖRSEL EKSİK DURUMU: ETKİLEŞİMLİ SÜRÜKLE-BIRAK VE YÜKLEME ALANI */
                <div 
                  className={cn(
                    "flex flex-col items-center justify-center p-6 text-center rounded-2xl border-2 border-dashed transition-all w-full max-w-sm m-auto",
                    isDragging 
                      ? "border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/60 scale-102" 
                      : "border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 shadow-sm hover:border-indigo-400"
                  )}
                >
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 shadow-sm border border-indigo-100 dark:border-indigo-900">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Bu Fişin Görseli Eksik</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
                    Fiş taslaktan aktarıldığı için görseli eksik kalmış. Bilgisayarınızdaki görseli yükleyin:
                  </p>

                  <div className="mt-4 flex flex-col items-center gap-2 w-full">
                    <Button 
                      size="sm" 
                      onClick={() => docInputRef.current?.click()} 
                      disabled={uploadingDoc}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm"
                    >
                      <FileUp className="w-4 h-4" /> Görsel / Belge Seç
                    </Button>

                    <span className="text-[11px] text-slate-400">
                      veya buraya bırakın / <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border rounded font-mono text-[10px] text-slate-600 dark:text-slate-300">Ctrl + V</kbd> ile yapıştırın
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* SAĞ PANEL (7 Kolon): MAHSUP FİŞİ + ÇEKİLMİŞ BİLGİLER */}
          {/* ======================================================== */}
          <div className="lg:col-span-7 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
            
            {/* ---------------------------------------------------- */}
            {/* SAĞ ÜST: MUHASEBE MAHSUP FİŞİ TABLOSU (LUCA FORMATI) */}
            {/* ---------------------------------------------------- */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm print:border-none print:shadow-none">
              
              {/* Mahsup Fişi Başlığı */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-3 px-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-white/10 flex items-center justify-center font-bold text-xs">
                    MF
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-wide uppercase">
                      Muhasebe Mahsup Fişi
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      Tarih: <b>{currentFatura?.faturaTarihi}</b> | Fiş No: <b>{currentFatura?.faturaNo || 'YOK'}</b>
                    </p>
                  </div>
                </div>

                {/* Borç / Alacak Denge Durumu */}
                <div className="flex items-center gap-2">
                  {mahsupDetay?.isDengeli ? (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Fiş Dengeli
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs flex items-center gap-1 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" /> Dengesiz Fiş (Fark: {mahsupDetay?.fark} TL)
                    </Badge>
                  )}

                  <Button 
                    size="sm" 
                    onClick={handleSaveAccounting}
                    disabled={isUpdating}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-7 text-xs font-semibold px-3 shadow"
                  >
                    <Save className="w-3.5 h-3.5 mr-1" />
                    {isUpdating ? 'Kaydediliyor...' : 'Kaydet'}
                  </Button>

                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={handleDeleteFatura}
                    disabled={isUpdating}
                    className="h-7 text-xs font-semibold px-2.5 shadow gap-1 bg-rose-600 hover:bg-rose-700 text-white border-rose-700"
                    title="Bu fişi ve bağlı tüm kayıtları (stok, cari ve dosya) her yerden kalıcı olarak siler"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Fişi Sil
                  </Button>
                </div>
              </div>

              {/* Fiş Üst Açıklama Alanı (4 Kolon: Gider, KDV, Karşı Hesap, Açıklama) */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 p-2.5 px-3 grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs items-end">
                <div>
                  <span className="text-slate-500 font-medium block text-[10px] uppercase mb-1">Varsayılan Gider Hesabı</span>
                  <LucaAccountSelect 
                    value={editMuhasebeKodu} 
                    onChange={handleMainGiderCodeChange} 
                    placeholder="Gider hesabı seçin..."
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-500 font-medium text-[10px] uppercase">KDV Hesabı (191/391)</span>
                    <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-medium">Ayarlardan Bağlı</span>
                  </div>
                  <LucaAccountSelect 
                    value={editKdvHesapKodu} 
                    onChange={handleMainKdvCodeChange} 
                    placeholder="KDV hesabı (191/391)..."
                    className="h-8 text-xs bg-white dark:bg-slate-900 border-indigo-200 focus-visible:ring-indigo-500"
                  />
                </div>

                <div>
                  <span className="text-slate-500 font-medium block text-[10px] uppercase mb-1">Varsayılan Karşı Hesap</span>
                  <LucaAccountSelect 
                    value={editKarsiHesapKodu} 
                    onChange={handleMainKarsiCodeChange} 
                    placeholder="Karşı hesap (100, 331, 320, 102...)"
                    className="h-8 text-xs bg-white dark:bg-slate-900 border-amber-200 focus-visible:ring-amber-500"
                  />
                </div>

                <div>
                  <span className="text-slate-500 font-medium block text-[10px] uppercase mb-1">Fiş Açıklaması</span>
                  <Input 
                    value={editAciklama} 
                    onChange={(e) => setEditAciklama(e.target.value)}
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                    placeholder="Yevmiye fiş açıklaması"
                  />
                </div>
              </div>

              {/* Dinamik Satır Ekleme & KKEG Ayırma Araç Çubuğu */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 px-3 bg-indigo-50/30 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* %70 GİDER / %30 KKEG AYIR BUTONU */}
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline"
                    onClick={handleKkegAyir}
                    className="h-7 text-xs font-semibold gap-1.5 text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 shadow-sm"
                    title="Matrah ve KDV'yi %70 Gider ve %30 KKEG (Kanunen Kabul Edilmeyen Gider) olarak ayırır"
                  >
                    <Scissors className="w-3.5 h-3.5 text-amber-600" />
                    ✂️ %70 Gider / %30 KKEG Ayır
                  </Button>

                  {/* GİDER (BORÇ) SATIRI EKLE */}
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline"
                    onClick={handleAddBorcRow}
                    className="h-7 text-xs font-semibold gap-1 text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Gider Satırı Ekle
                  </Button>

                  {/* KDV (BORÇ) SATIRI EKLE */}
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline"
                    onClick={handleAddKdvRow}
                    className="h-7 text-xs font-semibold gap-1 text-purple-700 bg-purple-50/80 hover:bg-purple-100 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                    title="Çoklu KDV oranları veya ek KDV kalemi eklemek için KDV satırı açar"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + KDV Satırı Ekle
                  </Button>

                  {/* KARŞI HESAP (ALACAK) SATIRI EKLE */}
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline"
                    onClick={handleAddAlacakRow}
                    className="h-7 text-xs font-semibold gap-1 text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Karşı Hesap (Ödeme) Ekle
                  </Button>

                  {/* SIFIRLA */}
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="ghost"
                    onClick={handleResetToDefault}
                    className="h-7 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 gap-1"
                    title="Fiş satırlarını orijinal değerlere döndür"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Sıfırla
                  </Button>
                </div>

                {/* DENKLİK GÖSTERGESİ */}
                <div className="flex items-center gap-2">
                  {mahsupDetay?.isDengeli ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] gap-1 font-semibold dark:bg-emerald-950/50 dark:text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Fiş Dengeli
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="destructive" className="text-[11px] gap-1 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" /> Fark: {mahsupDetay?.fark && mahsupDetay.fark > 0 ? `+${mahsupDetay.fark.toFixed(2)}` : (mahsupDetay?.fark || 0).toFixed(2)} TL
                      </Badge>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline" 
                        onClick={handleBalanceDifference}
                        className="h-6 text-[10px] text-amber-800 bg-amber-50 border-amber-300 hover:bg-amber-100 font-semibold px-2"
                        title="Farkı otomatik olarak dengeye getirir"
                      >
                        Farkı Eşitle
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Mahsup Fişi Maddeleri Tablosu (Dinamik ve Düzenlenebilir) */}
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b font-semibold">
                      <th className="py-2 px-2 w-10 text-center">M.No</th>
                      <th className="py-2 px-2 w-64">Hesap Kodu & Adı</th>
                      <th className="py-2 px-2">Satır Açıklaması</th>
                      <th className="py-2 px-2 w-28 text-right">Borç (TL)</th>
                      <th className="py-2 px-2 w-28 text-right">Alacak (TL)</th>
                      <th className="py-2 px-1 w-10 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {mahsupSatirlari.map((m) => (
                      <tr 
                        key={m.id} 
                        className={cn(
                          "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                          m.borc > 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/60"
                        )}
                      >
                        <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-xs">
                          {m.maddeNo}
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="space-y-1">
                            <LucaAccountSelect 
                              value={m.kod} 
                              onChange={(newKod) => handleUpdateRow(m.id, { kod: newKod, ad: getAccountName(newKod) })} 
                              placeholder="Hesap kodu..."
                              className="h-7 text-xs bg-white dark:bg-slate-900"
                            />
                            <div className="text-[10px] text-slate-500 font-medium truncate px-1" title={m.ad}>
                              {m.ad}
                            </div>
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <Input 
                            value={m.aciklama} 
                            onChange={(e) => handleUpdateRow(m.id, { aciklama: e.target.value })} 
                            placeholder="Madde açıklaması..."
                            className="h-7 text-xs bg-white dark:bg-slate-900"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={m.borc === 0 ? '' : m.borc} 
                            onChange={(e) => handleUpdateRow(m.id, { borc: parseFloat(e.target.value) || 0 })} 
                            placeholder="0.00"
                            className="h-7 text-xs text-right font-mono font-semibold bg-white dark:bg-slate-900"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={m.alacak === 0 ? '' : m.alacak} 
                            onChange={(e) => handleUpdateRow(m.id, { alacak: parseFloat(e.target.value) || 0 })} 
                            placeholder="0.00"
                            className="h-7 text-xs text-right font-mono font-semibold bg-white dark:bg-slate-900"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center">
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteRow(m.id)}
                            className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title="Bu satırı sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Mahsup Fişi Dip Toplam */}
                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                      <td colSpan={3} className="py-2.5 px-3 text-right uppercase font-sans text-xs">
                        Toplam Yevmiye Tutarı:
                      </td>
                      <td className="py-2.5 px-2 text-right text-indigo-700 dark:text-indigo-400 font-mono text-sm">
                        {(mahsupDetay?.toplamBorc || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                      </td>
                      <td className="py-2.5 px-2 text-right text-indigo-700 dark:text-indigo-400 font-mono text-sm">
                        {(mahsupDetay?.toplamAlacak || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* SAĞ ALT: FİŞTEN / FATURADAN ÇEKİLMİŞ DETAYLI BİLGİLER */}
            {/* ---------------------------------------------------- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* Kart 1: Tedarikçi & Belge */}
              <Card className="shadow-sm">
                <CardHeader className="p-3 pb-2 border-b bg-slate-50/50 dark:bg-slate-800/30">
                  <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    Tedarikçi & Belge Bilgileri
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Tedarikçi Ünvanı</span>
                    <span className="font-bold text-slate-900 dark:text-white line-clamp-1" title={currentFatura?.tedarikciAdi}>
                      {currentFatura?.tedarikciAdi || 'Bilinmiyor'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">VKN / TCKN</span>
                      <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                        {currentFatura?.tedarikciVkn || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Belge / Fiş No</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {currentFatura?.faturaNo || '-'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Düzenleme Tarihi</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {currentFatura?.faturaTarihi || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Cari Durumu</span>
                      {currentFatura?.cariId ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] h-4">
                          Cari Kart Bağlı
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Kayıtsız Cari</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Kart 2: Tutar & KDV Dağılımı */}
              <Card className="shadow-sm">
                <CardHeader className="p-3 pb-2 border-b bg-slate-50/50 dark:bg-slate-800/30">
                  <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    Tutar & Vergi Dağılımı
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-500">KDV Hariç Matrah:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {mahsupDetay?.matrah.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-500">KDV Oranı & Tutarı:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      %{mahsupDetay?.kdvOrani} ({mahsupDetay?.kdvTutari.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL)
                    </span>
                  </div>

                  {mahsupDetay?.tevkifatTutari ? (
                    <div className="flex justify-between items-center py-0.5 text-amber-600">
                      <span>Tevkifat Kesintisi:</span>
                      <span className="font-mono font-semibold">
                        -{mahsupDetay.tevkifatTutari.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                      </span>
                    </div>
                  ) : null}

                  {mahsupDetay?.stopajTutari ? (
                    <div className="flex justify-between items-center py-0.5 text-red-500">
                      <span>Stopaj Kesintisi:</span>
                      <span className="font-mono font-semibold">
                        -{mahsupDetay.stopajTutari.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                      </span>
                    </div>
                  ) : null}

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <span className="font-bold text-slate-900 dark:text-white uppercase text-[11px]">Genel Toplam:</span>
                    <span className="text-sm font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                      {mahsupDetay?.toplamTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Kart 3: Harcama Detayı & AI Çıkarımı */}
              <Card className="shadow-sm">
                <CardHeader className="p-3 pb-2 border-b bg-slate-50/50 dark:bg-slate-800/30">
                  <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Harcama & Kısıt Bilgileri
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Mal / Hizmet Açıklaması</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2 mt-0.5">
                      {currentFatura?.malHizmetAdi || 'Belirtilmedi'}
                    </p>
                  </div>

                  {currentFatura?.vehiclePlate || mahsupDetay?.hasKkeg ? (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-2 flex items-start gap-2">
                      <Car className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[11px] text-amber-900 dark:text-amber-200 block">
                          Binek Araç Kısıtlaması (%70 / %30)
                        </span>
                        <p className="text-[10px] text-amber-700 dark:text-amber-300">
                          {currentFatura?.vehiclePlate ? `Plaka: ${currentFatura.vehiclePlate} | ` : ''} 
                          %70 Gider, %30 KKEG uygulandı.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-[11px] flex items-center gap-1 pt-1">
                      <Info className="w-3.5 h-3.5 text-slate-400" /> Genel şirket işletme gideri.
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Ödeme Durumu:</span>
                    <Badge variant={currentFatura?.odemeDurumu === 'odendi' ? 'default' : 'secondary'} className="text-[10px]">
                      {currentFatura?.odemeDurumu === 'odendi' ? 'Ödendi' : 'Ödenmedi / Kasa'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

            </div>

          </div>

        </div>
      )}

      {/* Toplu Görsel Eşleme Sihirbazı Modalı */}
      <MuhasebeTopluGorselEsleModal 
        open={batchModalOpen} 
        onOpenChange={setBatchModalOpen} 
        missingInvoices={missingDocInvoices} 
      />
    </div>
  );
}
export default MuhasebeFisInceleme;
