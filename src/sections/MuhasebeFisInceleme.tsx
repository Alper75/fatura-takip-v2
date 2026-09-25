import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { AlisFatura } from '@/types';

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
  const [filterType, setFilterType] = useState<'all' | 'with-doc' | 'missing-code' | 'vehicle'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Görsel / Belge Durumu
  const [docLoading, setDocLoading] = useState(false);
  const [currentDocBase64, setCurrentDocBase64] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Düzenleme Modu
  const [editMuhasebeKodu, setEditMuhasebeKodu] = useState('');
  const [editKarsiHesapKodu, setEditKarsiHesapKodu] = useState('');
  const [editAciklama, setEditAciklama] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

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
      return;
    }

    setEditMuhasebeKodu(currentFatura.muhasebeKodu || '');
    setEditKarsiHesapKodu(currentFatura.karsiHesapKodu || '100.01');
    setEditAciklama(currentFatura.aciklama || `${currentFatura.tedarikciAdi} - ${currentFatura.faturaNo}`);
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

  // Hesap Planı İsim Yardımcısı
  const getAccountName = (code: string) => {
    if (!code) return 'Hesap Seçilmedi';
    const found = (lucaAccounts || []).find(a => a.kod === code);
    if (found) return found.ad;
    // Varsayılan Muhasebe İsimleri
    if (code.startsWith('770')) return 'Genel Yönetim Giderleri';
    if (code.startsWith('153')) return 'Ticari Mallar';
    if (code.startsWith('191')) return 'İndirilecek KDV';
    if (code.startsWith('100')) return 'Kasa Hesabı';
    if (code.startsWith('108')) return 'Diğer Hazır Değerler (Kredi Kartı Slipleri)';
    if (code.startsWith('300') || code.startsWith('309')) return 'Kredi Kartı Borçları';
    if (code.startsWith('320')) return 'Satıcılar Cari Hesabı';
    if (code.startsWith('689')) return 'Kanunen Kabul Edilmeyen Giderler (KKEG)';
    if (code.startsWith('360')) return 'Ödenecek Vergi ve Fonlar (Stopaj/Tevkifat)';
    return 'Tanımlı Hesap';
  };

  // KDV Oranına göre 191 alt hesabı belirleme
  const getKdvAccountCode = (rate: number | string) => {
    const r = String(rate);
    if (r === '1') return '191.01';
    if (r === '8' || r === '10') return '191.10';
    if (r === '18' || r === '20') return '191.20';
    return '191.20';
  };

  // Fatura & Mahsup Fişi Hesaplamaları
  const mahsupDetay = useMemo(() => {
    if (!currentFatura) return null;

    const toplamTutar = parseFloat(String(currentFatura.toplamTutar || 0)) || 0;
    const kdvOrani = parseFloat(String(currentFatura.kdvOrani || 20)) || 0;
    const matrah = parseFloat(String(currentFatura.matrah || 0)) || Math.round((toplamTutar / (1 + kdvOrani / 100)) * 100) / 100;
    const kdvTutari = parseFloat(String(currentFatura.kdvTutari || 0)) || Math.round((toplamTutar - matrah) * 100) / 100;
    const stopajTutari = parseFloat(String(currentFatura.stopajTutari || 0)) || 0;
    const tevkifatTutari = parseFloat(String(currentFatura.tevkifatTutari || 0)) || 0;

    // Araç / Gider Kısıtlaması Kontrolü (%70 Gider / %30 KKEG)
    const isVehicleExpense = !!currentFatura.vehiclePlate || 
      /akaryakıt|yakıt|benzin|motorin|bakım|onarım/i.test(currentFatura.malHizmetAdi || '') ||
      (currentFatura.aciklama || '').includes('%70 Gider');

    const hasKkeg = isVehicleExpense;

    let borcSatirlari: { maddeNo: number; kod: string; ad: string; borc: number; alacak: number; aciklama: string }[] = [];
    let alacakSatirlari: { maddeNo: number; kod: string; ad: string; borc: number; alacak: number; aciklama: string }[] = [];
    let maddeSayaci = 1;

    const giderKodu = editMuhasebeKodu || currentFatura.muhasebeKodu || '770.01.001';
    const kdvKodu = getKdvAccountCode(kdvOrani);
    const karsiKodu = editKarsiHesapKodu || currentFatura.karsiHesapKodu || (currentFatura.cariId ? '320.01' : '100.01');

    if (hasKkeg) {
      // %70 Gider Payı (Matrah)
      const giderMatrah = Math.round(matrah * 0.7 * 100) / 100;
      borcSatirlari.push({
        maddeNo: maddeSayaci++,
        kod: giderKodu,
        ad: getAccountName(giderKodu),
        borc: giderMatrah,
        alacak: 0,
        aciklama: `${currentFatura.malHizmetAdi || 'Mal/Hizmet'} (%70 Gider Payı)`
      });

      // %70 KDV Payı
      const giderKdv = Math.round(kdvTutari * 0.7 * 100) / 100;
      borcSatirlari.push({
        maddeNo: maddeSayaci++,
        kod: kdvKodu,
        ad: `${getAccountName(kdvKodu)} (%${kdvOrani})`,
        borc: giderKdv,
        alacak: 0,
        aciklama: `İndirilecek KDV %${kdvOrani} (%70 Pay)`
      });

      // %30 KKEG (Matrahın %30'u + KDV'nin %30'u)
      const kkegMatrah = Math.round(matrah * 0.3 * 100) / 100;
      const kkegKdv = Math.round(kdvTutari * 0.3 * 100) / 100;
      const toplamKkeg = Math.round((kkegMatrah + kkegKdv) * 100) / 100;

      borcSatirlari.push({
        maddeNo: maddeSayaci++,
        kod: '689.01.001',
        ad: 'Kanunen Kabul Edilmeyen Giderler (KKEG)',
        borc: toplamKkeg,
        alacak: 0,
        aciklama: `Binek Araç Kısıtı (%30 KKEG: Matrah ${kkegMatrah} TL + KDV ${kkegKdv} TL)`
      });
    } else {
      // Normal Belge: Tam Matrah
      borcSatirlari.push({
        maddeNo: maddeSayaci++,
        kod: giderKodu,
        ad: getAccountName(giderKodu),
        borc: matrah,
        alacak: 0,
        aciklama: currentFatura.malHizmetAdi || 'Mal ve Hizmet Alımı'
      });

      // Tam KDV
      if (kdvTutari > 0) {
        borcSatirlari.push({
          maddeNo: maddeSayaci++,
          kod: kdvKodu,
          ad: `${getAccountName(kdvKodu)} (%${kdvOrani})`,
          borc: kdvTutari,
          alacak: 0,
          aciklama: `İndirilecek KDV %${kdvOrani}`
        });
      }
    }

    // Varsa Tevkifat / Stopaj Kesintileri (Alacak Tarafı)
    if (tevkifatTutari > 0) {
      alacakSatirlari.push({
        maddeNo: maddeSayaci++,
        kod: '360.01.001',
        ad: 'Tevkifat KDV Kesintisi',
        borc: 0,
        alacak: tevkifatTutari,
        aciklama: `KDV Tevkifatı (${currentFatura.tevkifatOrani})`
      });
    }

    if (stopajTutari > 0) {
      alacakSatirlari.push({
        maddeNo: maddeSayaci++,
        kod: '360.02.001',
        ad: 'Ödenecek Stopaj Vergisi',
        borc: 0,
        alacak: stopajTutari,
        aciklama: `Stopaj Kesintisi (%${currentFatura.stopajOrani})`
      });
    }

    // Karşı Hesap (Kasa / Kredi Kartı / Tedarikçi)
    const netKarsiAlacak = Math.round((toplamTutar - stopajTutari - tevkifatTutari) * 100) / 100;
    alacakSatirlari.push({
      maddeNo: maddeSayaci++,
      kod: karsiKodu,
      ad: getAccountName(karsiKodu),
      borc: 0,
      alacak: netKarsiAlacak,
      aciklama: `${currentFatura.tedarikciAdi} - Belge No: ${currentFatura.faturaNo}`
    });

    const tumMaddeler = [...borcSatirlari, ...alacakSatirlari];
    const toplamBorc = Math.round(tumMaddeler.reduce((acc, m) => acc + m.borc, 0) * 100) / 100;
    const toplamAlacak = Math.round(tumMaddeler.reduce((acc, m) => acc + m.alacak, 0) * 100) / 100;
    const fark = Math.round((toplamBorc - toplamAlacak) * 100) / 100;
    const isDengeli = Math.abs(fark) < 0.05;

    return {
      toplamTutar,
      matrah,
      kdvOrani,
      kdvTutari,
      stopajTutari,
      tevkifatTutari,
      hasKkeg,
      maddeler: tumMaddeler,
      toplamBorc,
      toplamAlacak,
      fark,
      isDengeli
    };
  }, [currentFatura, editMuhasebeKodu, editKarsiHesapKodu, lucaAccounts]);

  // Mahsup Fişi Güncellemelerini Kaydet
  const handleSaveAccounting = async () => {
    if (!currentFatura) return;
    setIsUpdating(true);
    try {
      await updateAlisFatura(currentFatura.id, {
        muhasebeKodu: editMuhasebeKodu,
        karsiHesapKodu: editKarsiHesapKodu,
        aciklama: editAciklama
      } as any);

      toast.success('Muhasebe mahsup fişi bilgileri başarıyla güncellendi!');
    } catch (e: any) {
      toast.error('Güncelleme hatası: ' + e.message);
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
    return currentDocBase64.startsWith('data:application/pdf') || (currentFatura?.pdfDosyaAdi || '').toLowerCase().endsWith('.pdf');
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
            <SelectTrigger className="h-8 text-xs w-40">
              <SelectValue placeholder="Filtrele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Fişler</SelectItem>
              <SelectItem value="with-doc">📷 Görselli Olanlar</SelectItem>
              <SelectItem value="missing-code">⚠️ Hesabı Eksikler</SelectItem>
              <SelectItem value="vehicle">🚗 Araç / Akaryakıt</SelectItem>
            </SelectContent>
          </Select>

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
                  {currentFatura?.pdfDosyaAdi || 'Belge Görseli'}
                </span>
                {currentDocBase64 && (
                  <Badge variant="secondary" className="text-[10px] h-5 bg-emerald-100 text-emerald-800 border-emerald-200">
                    Aktarıldı
                  </Badge>
                )}
              </div>

              {/* Görsel Kontrolleri */}
              <div className="flex items-center gap-1">
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
                {currentDocBase64 && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-indigo-600 hover:bg-indigo-50" 
                    onClick={handleDownloadDoc} 
                    title="İndir"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Görsel / Belge Görüntüleyici Alanı */}
            <div className="flex-1 bg-slate-950/5 dark:bg-slate-950/40 relative overflow-auto flex items-center justify-center p-3 select-none">
              {docLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-xs">Belge görseli yükleniyor...</span>
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
                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 max-w-xs">
                  <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-3 text-slate-500">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Yüklenmiş Görsel Yok</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Bu fiş manuel girilmiş veya görseli yüklenmemiş olabilir.
                  </p>
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
                </div>
              </div>

              {/* Fiş Üst Açıklama Alanı */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 p-2.5 px-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 font-medium block text-[10px] uppercase">Gider / Alış Hesabı</span>
                  <div className="mt-1">
                    <Select value={editMuhasebeKodu} onValueChange={setEditMuhasebeKodu}>
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-900">
                        <SelectValue placeholder="Hesap Kodu Seçin" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {lucaAccounts && lucaAccounts.length > 0 ? (
                          lucaAccounts.map(acc => (
                            <SelectItem key={acc.kod} value={acc.kod} className="text-xs">
                              <b>{acc.kod}</b> - {acc.ad}
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="770.01.001">770.01.001 - Yemek ve Mutfak Gideri</SelectItem>
                            <SelectItem value="770.02.001">770.02.001 - Taşıt ve Akaryakıt Gideri</SelectItem>
                            <SelectItem value="770.03.001">770.03.001 - Kırtasiye ve Büro Gideri</SelectItem>
                            <SelectItem value="153.01.001">153.01.001 - Ticari Mallar Alışı</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block text-[10px] uppercase">Karşı Hesap (Ödeme / Cari)</span>
                  <div className="mt-1">
                    <Select value={editKarsiHesapKodu} onValueChange={setEditKarsiHesapKodu}>
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-900">
                        <SelectValue placeholder="Karşı Hesap Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100.01">100.01 - Merkez Kasa (Nakit)</SelectItem>
                        <SelectItem value="108.01">108.01 - Kredi Kartı Slipleri</SelectItem>
                        <SelectItem value="300.01">300.01 - Şirket Kredi Kartı Hesabı</SelectItem>
                        <SelectItem value="320.01">320.01 - Satıcı Cari Hesabı</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block text-[10px] uppercase">Fiş Açıklaması</span>
                  <Input 
                    value={editAciklama} 
                    onChange={(e) => setEditAciklama(e.target.value)}
                    className="h-7 text-xs mt-1 bg-white dark:bg-slate-900"
                    placeholder="Yevmiye fiş açıklaması"
                  />
                </div>
              </div>

              {/* Mahsup Fişi Maddeleri Tablosu */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b font-semibold">
                      <th className="py-2 px-3 w-12 text-center">M.No</th>
                      <th className="py-2 px-3 w-32">Hesap Kodu</th>
                      <th className="py-2 px-3">Hesap Adı & Açıklama</th>
                      <th className="py-2 px-3 w-28 text-right">Borç (TL)</th>
                      <th className="py-2 px-3 w-28 text-right">Alacak (TL)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {mahsupDetay?.maddeler.map((m, idx) => (
                      <tr 
                        key={idx} 
                        className={cn(
                          "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                          m.borc > 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/60"
                        )}
                      >
                        <td className="py-2 px-3 text-center text-slate-400 font-normal">
                          {m.maddeNo}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[11px]",
                            m.kod.startsWith('770') || m.kod.startsWith('153') ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" :
                            m.kod.startsWith('191') ? "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200" :
                            m.kod.startsWith('689') ? "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200" :
                            "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                          )}>
                            {m.kod}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-sans">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{m.ad}</div>
                          <div className="text-[11px] text-slate-500 font-normal">{m.aciklama}</div>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {m.borc > 0 ? m.borc.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {m.alacak > 0 ? m.alacak.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
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
                      <td className="py-2.5 px-3 text-right text-indigo-700 dark:text-indigo-400 font-mono text-sm">
                        {mahsupDetay?.toplamBorc.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                      </td>
                      <td className="py-2.5 px-3 text-right text-indigo-700 dark:text-indigo-400 font-mono text-sm">
                        {mahsupDetay?.toplamAlacak.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                      </td>
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
    </div>
  );
}
export default MuhasebeFisInceleme;
