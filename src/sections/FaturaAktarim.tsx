import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { FileSpreadsheet, RefreshCw, Send, BookOpen, Layers, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { StopajKoduModal } from '@/components/StopajKoduModal';
import { deduceStopajKodu } from '@/constants/lucaStopajKodlari';

export function FaturaAktarim() {
  const { apiFetch, cariler, isIsletmeDefteri, companies, user, lucaAccounts = [], giderKategorileri = [] } = useApp();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Stopaj Kodu Modal State
  const [isStopajModalOpen, setIsStopajModalOpen] = useState(false);
  const [stopajModalAction, setStopajModalAction] = useState<'export' | 'copy_script'>('export');
  const [stopajInvoices, setStopajInvoices] = useState<any[]>([]);
  const [stopajKodMap, setStopajKodMap] = useState<Record<string, string>>({});

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ALIS' | 'SATIS'>('ALL');
  const [aracGideriIds, setAracGideriIds] = useState<string[]>([]);

  useEffect(() => {
    fetchSettings();
    fetchInvoices();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('/api/settings/luca_kdv_ayarlari');
      if (res.success && res.value) {
        setSettings(JSON.parse(res.value));
      } else if (!isIsletmeDefteri) {
        toast.error('Lütfen önce KDV hesap ayarlarını tamamlayın.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getFaturaUnvan = (f: any): string => {
    if (f._type === 'ALIS') {
      return (f.tedarikciAdi || f.tedarikci_adi || f.ad || (cariler.find(c => c.id === f.cariId)?.unvan) || '').trim();
    }
    const adSoyad = [f.ad, f.soyad].filter(Boolean).join(' ').trim();
    return (adSoyad || f.unvan || f.tedarikciAdi || (cariler.find(c => c.id === f.cariId)?.unvan) || '').trim();
  };

  const getFaturaVkn = (f: any): string => {
    if (f._type === 'ALIS') {
      return (f.tedarikciVkn || f.tedarikci_vkn || f.tcVkn || (cariler.find(c => c.id === f.cariId)?.vknTckn) || '').trim();
    }
    return (f.tcVkn || f.tc_vkn || f.vknTckn || (cariler.find(c => c.id === f.cariId)?.vknTckn) || '').trim();
  };

  const getHesapAdi = (inv: any): string => {
    const kod = (inv.muhasebeKodu || '').trim();
    if (!kod) return '';
    
    // 1. Luca Hesap Planında tam eşleşme
    const lucaAcc = (lucaAccounts || []).find((a: any) => a.kod === kod || a.hesapKodu === kod);
    if (lucaAcc && lucaAcc.ad) return `${kod} - ${lucaAcc.ad}`;

    // 2. Gider Kategorilerinde ara
    const giderKat = (giderKategorileri || []).find((g: any) => g.muhasebeKodu === kod || (inv.giderKategoriId && g.id === inv.giderKategoriId));
    if (giderKat && giderKat.ad) return `${kod} - ${giderKat.ad}`;

    // 3. Bilinen standart muhasebe kodları
    if (kod.startsWith('770.03')) return `${kod} - Yeme / İçme & Gıda`;
    if (kod.startsWith('770.02') || kod.startsWith('770.05')) return `${kod} - Ulaşım & Akaryakıt`;
    if (kod.startsWith('770.01')) return `${kod} - Ofis & Kırtasiye`;
    if (kod.startsWith('770')) return `${kod} - Genel Yönetim Gideri`;
    if (kod.startsWith('760')) return `${kod} - Pazarlama & Satış`;
    if (kod.startsWith('153')) return `${kod} - Ticari Mallar`;
    if (kod.startsWith('600')) return `${kod} - Yurtiçi Satış`;

    return kod;
  };

  // Otomatik Araç / KKEG Kontrolü (%70 Gider / %30 KKEG)
  const isInvoiceKkegOrArac = (inv: any): boolean => {
    if (!inv) return false;
    if (aracGideriIds.includes(inv.id)) return true;
    if (inv.vehiclePlate || inv.plaka) return true;
    if (inv.hasKkeg || inv.has_kkeg || inv.isAracGideri) return true;
    const aciklama = String(inv.aciklama || '').toLowerCase();
    if (aciklama.includes('%70') || aciklama.includes('kkeg') || aciklama.includes('binek araç') || aciklama.includes('binek arac')) return true;
    const malHizmet = String(inv.malHizmetAdi || '').toLowerCase();
    if (/akaryakıt|yakıt|benzin|motorin|otogaz|lpg|shell|petrol|opet|bp|total|aytemiz/i.test(malHizmet)) return true;
    const unvan = String(inv.ad || inv.unvan || inv.tedarikciAdi || '').toLowerCase();
    if (/petrol|akaryakıt|benzin|shell|opet|bp|total/i.test(unvan)) return true;
    if (inv.mahsupSatirlari && Array.isArray(inv.mahsupSatirlari)) {
      if (inv.mahsupSatirlari.some((r: any) => String(r.kod || '').startsWith('689'))) return true;
    }
    return false;
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const alisRes = await apiFetch('/api/alis-faturalari');
      const satisRes = await apiFetch('/api/satis-faturalari');
      
      let allInvoices: any[] = [];
      if (alisRes.success) {
        allInvoices = [...allInvoices, ...alisRes.data.map((f: any) => {
          const invObj = { ...f, _type: 'ALIS' };
          const unvan = getFaturaUnvan(invObj) || 'Muhtelif Tedarikçi';
          const tcVkn = getFaturaVkn(invObj);
          return { ...invObj, ad: unvan, unvan, tcVkn };
        })];
      }
      if (satisRes.success) {
        allInvoices = [...allInvoices, ...satisRes.data.map((f: any) => {
          const invObj = { ...f, _type: 'SATIS' };
          const unvan = getFaturaUnvan(invObj) || 'Muhtelif Müşteri';
          const tcVkn = getFaturaVkn(invObj);
          return { ...invObj, ad: unvan, unvan, tcVkn };
        })];
      }

      // Filter by Date
      if (startDate) {
        allInvoices = allInvoices.filter(f => f.faturaTarihi >= startDate);
      }
      if (endDate) {
        allInvoices = allInvoices.filter(f => f.faturaTarihi <= endDate);
      }

      // Sort by Date
      allInvoices.sort((a, b) => new Date(a.faturaTarihi).getTime() - new Date(b.faturaTarihi).getTime());
      
      setInvoices(allInvoices);
      
      // KKEG / Araç giderlerini otomatik tespit edip işaretle
      const autoAracIds = allInvoices.filter(inv => isInvoiceKkegOrArac(inv)).map(inv => inv.id);
      setAracGideriIds(autoAracIds);

      setSelectedIds([]);
    } catch (e: any) {
      toast.error('Faturalar yüklenirken hata oluştu: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => filterType === 'ALL' || inv._type === filterType);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredInvoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInvoices.map(f => f.id));
    }
  };

    const formatTarih = (tarih: string) => {
    if (!tarih) return '';
    const str = String(tarih).trim();
    if (str.includes('/')) return str;
    if (str.includes('.') && str.split('.').length === 3) return str.replace(/\./g, '/');
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
    return str;
  };

  // İŞLETME DEFTERİ İÇİN SATIR FORMATI (HESAP KODSUZ GELİR / GİDER LİSTESİ)
  const getIsletmeDefteriSatiri = (fatura: any, isAracGideriParam: boolean = false) => {
    const isAracGideri = isAracGideriParam || isInvoiceKkegOrArac(fatura);
    const isAlis = fatura._type === 'ALIS';
    const isIade = isAlis ? (parseFloat(fatura.toplamTutar || 0) < 0 || (fatura.malHizmetAdi && String(fatura.malHizmetAdi).toLowerCase().includes('iade'))) : (parseFloat(fatura.alinanUcret || 0) < 0 || (fatura.aciklama && String(fatura.aciklama).toLowerCase().includes('iade')));
    const kdvOrani = (fatura.kdvOrani || 20).toString();
    const matrah = parseFloat(fatura.matrah) || 0;
    const kdvTutar = parseFloat(fatura.kdvTutari) || 0;
    const tevkifatTutar = parseFloat(fatura.tevkifatTutari) || 0;
    const stopajTutar = parseFloat(fatura.stopajTutari) || 0;
    const oivTutar = isAlis ? (parseFloat(fatura.oivTutari) || 0) : 0;
    const kdvDahil = Math.round((matrah + kdvTutar) * 100) / 100;
    const toplam = (matrah > 0 || kdvTutar > 0) ? kdvDahil : (isAlis ? (parseFloat(fatura.toplamTutar) || 0) : (parseFloat(fatura.alinanUcret) || 0));

    const cariUnvan = fatura.ad || (cariler.find(c => c.id === fatura.cariId)?.unvan) || 'Muhtelif Cari';
    const tcVkn = fatura.tcVkn || (cariler.find(c => c.id === fatura.cariId)?.vknTckn) || '';
    const evrakNo = fatura.faturaNo || '';
    const aciklama = fatura.aciklama || (isAlis ? `Alış Faturası - ${cariUnvan}` : `Satış Faturası - ${cariUnvan}`);

    return {
      'Dönem / Ay': fatura.faturaTarihi ? fatura.faturaTarihi.substring(0, 7) : '',
      'Kayıt Türü': isAlis ? (isIade ? 'GELİR (ALIŞ İADE)' : 'GİDER') : (isIade ? 'GİDER (SATIŞ İADE)' : 'GELİR'),
      'Evrak Tarihi': formatTarih(fatura.faturaTarihi),
      'Evrak No': evrakNo,
      'Cari / Firma Adı': cariUnvan,
      'Vergi / TC No': tcVkn,
      'Açıklama': aciklama + (isAracGideri ? ' [Binek Araç %70 Gider]' : ''),
      'Matrah (KDV Hariç)': isAracGideri ? Math.round(matrah * 0.7 * 100) / 100 : matrah,
      'KDV Oranı (%)': `%${kdvOrani}`,
      'KDV Tutarı': isAracGideri ? Math.round(kdvTutar * 0.7 * 100) / 100 : kdvTutar,
      'Tevkifat Tutarı': tevkifatTutar,
      'Stopaj Tutarı': stopajTutar,
      'ÖİV Tutarı': oivTutar,
      'Toplam Tutar': toplam,
      'Gider / Gelir Türü': isAlis ? (isAracGideri ? 'Binek Araç Gideri (%70 Kısıtlı)' : 'Genel İşletme Gideri') : 'Mal/Hizmet Satış Geliri'
    };
  };

  // FATURALARI TARİHE GÖRE (ESKİDEN YENİYE / KRONOLOJİK) SIRALAMA
  const sortInvoicesChronologically = (list: any[]) => {
    return [...list].sort((a, b) => {
      const timeA = new Date(a.faturaTarihi).getTime() || 0;
      const timeB = new Date(b.faturaTarihi).getTime() || 0;
      if (timeA !== timeB) return timeA - timeB;
      return String(a.faturaNo || '').localeCompare(String(b.faturaNo || ''), undefined, { numeric: true });
    });
  };

  // SADECE fiilen stopaj tutarı > 0 olan faturalar stopajlıdır!
  const isInvoiceStopajli = (inv: any): boolean => {
    const stopajTutari = typeof inv.stopajTutari === 'number'
      ? inv.stopajTutari
      : (parseFloat(String(inv.stopajTutari || inv.stopaj_tutari || inv.stopajTutar || '0').replace(',', '.')) || 0);
    return stopajTutari > 0;
  };

  const getLucaHizliFisItems = (selectedInvoices: any[], customStopajMap?: Record<string, string>) => {
    const sorted = sortInvoicesChronologically(selectedInvoices);
    return sorted.map(inv => {
      const isAlis = inv._type === 'ALIS';
      const matrah = parseFloat(inv.matrah) || 0;
      const kdvTutar = parseFloat(inv.kdvTutari) || 0;
      const tevkifatTutar = parseFloat(inv.tevkifatTutari) || 0;
      const stopajTutar = typeof inv.stopajTutari === 'number'
        ? inv.stopajTutari
        : (parseFloat(String(inv.stopajTutari || inv.stopaj_tutari || inv.stopajTutar || '0').replace(',', '.')) || 0);
      const isArac = isInvoiceKkegOrArac(inv);
      const kdvOranNum = parseFloat(inv.kdvOrani || 20);
      const matrahHesap = isArac ? Math.round(matrah * 0.7 * 100) / 100 : matrah;
      const kdvHesap = isArac ? Math.round(kdvTutar * 0.7 * 100) / 100 : kdvTutar;
      const kdvDahilToplam = Math.round((matrahHesap + kdvHesap) * 100) / 100;
      const fallbackToplam = isAlis ? (parseFloat(inv.toplamTutar) || 0) : (parseFloat(inv.alinanUcret) || 0);
      const toplam = (matrahHesap > 0 || kdvHesap > 0) ? kdvDahilToplam : fallbackToplam;

      // Stopaj Kodu: SADECE fiilen stopaj tutarı > 0 olan faturalarda atanır!
      const hasActualStopaj = isInvoiceStopajli(inv);
      let stopajKoduVal = '';
      if (hasActualStopaj) {
        if (customStopajMap && customStopajMap[inv.id] !== undefined) {
          stopajKoduVal = customStopajMap[inv.id];
        } else if (stopajKodMap[inv.id] !== undefined) {
          stopajKoduVal = stopajKodMap[inv.id];
        } else if (inv.stopajKodu) {
          stopajKoduVal = inv.stopajKodu;
        } else {
          stopajKoduVal = deduceStopajKodu(inv);
        }
        if (!stopajKoduVal) {
          stopajKoduVal = '022-20';
        }
      }

      // Tevkifat Kodu (Luca Hizli Fis option value & İstisna Kodu)
      let tevkifatVal = '0';
      let istisnaTablo = '0';
      let istisnaKodNo = '';
      let istisnaOranStr = '';

      if (tevkifatTutar > 0) {
        istisnaTablo = '6'; // Tablo 2 (KISMİ TEVKİFAT UYGULANAN İŞLEMLER)
        const oran = String(inv.tevkifatOrani || '');
        const dbKod = String(inv.tevkifatKodu || '').trim();

        if (oran.includes('2/10')) {
          tevkifatVal = '10';
          istisnaOranStr = '2/10';
          istisnaKodNo = dbKod && dbKod.length === 3 ? dbKod : '624'; // 624: Yük Taşımacılığı
        } else if (oran.includes('3/10')) {
          tevkifatVal = '12';
          istisnaOranStr = '3/10';
          istisnaKodNo = dbKod && dbKod.length === 3 ? dbKod : '625'; // 625: Ticari Reklam
        } else if (oran.includes('4/10')) {
          tevkifatVal = '13';
          istisnaOranStr = '4/10';
          istisnaKodNo = dbKod && dbKod.length === 3 ? dbKod : '601'; // 601: Yapım İşleri
        } else if (oran.includes('5/10')) {
          tevkifatVal = '11';
          istisnaOranStr = '5/10';
          istisnaKodNo = dbKod && dbKod.length === 3 ? dbKod : '616'; // 616: Diğer Hizmetler
        } else if (oran.includes('7/10')) {
          tevkifatVal = '9';
          istisnaOranStr = '7/10';
          istisnaKodNo = dbKod && dbKod.length === 3 ? dbKod : '612'; // 612: Temizlik Hizmeti
        } else if (oran.includes('9/10')) {
          tevkifatVal = '4';
          istisnaOranStr = '9/10';
          istisnaKodNo = dbKod && dbKod.length === 3 ? dbKod : '606'; // 606: İşgücü / 602: Danışmanlık
        } else if (oran.includes('Tam')) {
          tevkifatVal = '5';
          istisnaOranStr = 'Tam';
          istisnaKodNo = dbKod && dbKod.length === 3 ? dbKod : '601';
        } else {
          tevkifatVal = '11';
          istisnaOranStr = '5/10';
          istisnaKodNo = dbKod && dbKod.length === 3 ? dbKod : '616';
        }
      }

      const cariUnvan = inv.ad || (cariler.find(c => c.id === inv.cariId)?.unvan) || '';
      const fNo = inv.faturaNo || '';

      // Açıklamayı temizle: "GİB / e-Logo / Uyumsoft aktarıldı..." gibi kalıpları kaldır
      let temizAciklama = (inv.aciklama || '').trim();
      if (temizAciklama) {
        temizAciklama = temizAciklama
          .replace(/GİB\s*e-Arşiv\s*Portalından\s*aktarıldı\.?\s*(Alıcı:|Satıcı:)?\s*/gi, '')
          .replace(/e-?Logo\s*üzerinden\s*(otomatik\s*)?içe\s*aktarıldı\.?\s*(\(UUID:[^\)]*\))?\s*/gi, '')
          .replace(/Uyumsoft\s*üzerinden\s*(otomatik\s*)?içe\s*aktarıldı\.?\s*(\(UUID:[^\)]*\))?\s*/gi, '')
          .replace(/Logodan\s*aktarılan\.?\s*/gi, '')
          .replace(/^Alıcı:\s*/gi, '')
          .replace(/^Satıcı:\s*/gi, '')
          .trim();
      }
      if (!temizAciklama || temizAciklama.startsWith('(')) {
        temizAciklama = cariUnvan || (isAlis ? 'Mal/Hizmet Alımı' : 'Mal/Hizmet Satışı');
      }

      const kodFullStr = istisnaKodNo ? `${istisnaKodNo} | ${istisnaOranStr}` : '';

      return {
        tur: isAlis ? '1' : '0', // 0: Gelir, 1: Gider
        islem: isAlis ? '1' : '0',
        kategori: '1', // 1: Defter Fişleri
        belge: '1', // 1: Satış/Alış
        evrakTarih: formatTarih(inv.faturaTarihi),
        kayitTarihi: formatTarih(inv.faturaTarihi),
        tarih: formatTarih(inv.faturaTarihi),
        seriNo: '', // Seri no boş bırakılır (GİB yazılmasın)
        evrakNo: fNo,
        no: fNo,
        tckn: inv.tcVkn || (cariler.find(c => c.id === inv.cariId)?.vknTckn) || '',
        vkn: inv.tcVkn || (cariler.find(c => c.id === inv.cariId)?.vknTckn) || '',
        soyadi: cariUnvan,
        adi: inv.soyad || '',
        unvan: cariUnvan,
        aciklama: temizAciklama,
        tutar: matrahHesap,
        matrah: matrahHesap,
        kdvOran: `${kdvOranNum.toFixed(1)}`, // "20.0", "10.0", "1.0"
        kdvOrani: `${kdvOranNum}`,
        kdvTutar: kdvHesap,
        kdvTutari: kdvHesap,
        toplamTutar: toplam,
        toplam: toplam,
        tevkifat: tevkifatVal,
        tablo: istisnaTablo,
        kodNo: istisnaKodNo,
        oranStr: istisnaOranStr,
        kodFull: kodFullStr,
        stopajTutari: stopajTutar,
        stopajKodu: hasActualStopaj ? stopajKoduVal : '',
        beyanBelgeTuru: (fNo.startsWith('SMM') || inv.tur === 'smm' || inv.tip === 'smm') 
          ? '8' 
          : (isAlis 
              ? (fNo.length >= 16 || fNo.startsWith('GİB') || fNo.startsWith('EAR') || fNo.startsWith('EAF') || fNo.startsWith('FAT') ? '9' : '1')
              : (fNo.length >= 16 || fNo.startsWith('GİB') || fNo.startsWith('EAR') || fNo.startsWith('EAF') ? '7' : '1')
            ),
        alisSatisTuru: isAlis ? '1' : '1',
        kayitAltTuru: '1',
        item_type: isAlis ? 'standard' : 'standard',
        e_document_type: fNo.startsWith('SMM') || fNo.startsWith('E') ? 'EInvoice' : 'Invoice',
        purchase_sales_type: '1'
      };
    });
  };

  // BİLANÇO ESASI İÇİN YEVMİYE MAHSUP SATIRLARI (HESAP PLANLI ÇİFT TARAFLI)
  const getMuhasebeSatirlari = (fatura: any, isAracGideriParam: boolean = false) => {
    // 1. ÖZEL MAHSUP SATIRLARI KONTROLÜ
    // Fiş denetimi ve mahsup kontrolünde kullanıcı satırları bölmüş/özelleştirmişse direkt o satırları kullan!
    let customRows = fatura.mahsupSatirlari;
    if (typeof customRows === 'string') {
      try { customRows = JSON.parse(customRows); } catch (e) {}
    }
    if (Array.isArray(customRows) && customRows.length > 0) {
      return customRows.map((m: any) => ({
        'Evrak Tarihi': formatTarih(fatura.faturaTarihi),
        'Evrak No': fatura.faturaNo || '',
        'Belge Türü': 'FT',
        'Hesap Kodu': m.kod,
        'Borç': Math.round((Number(m.borc) || 0) * 100) / 100,
        'Alacak': Math.round((Number(m.alacak) || 0) * 100) / 100,
        'Detay Açıklama': m.aciklama || fatura.aciklama || `${fatura.ad || ''}`,
        'KDV Oranı': (fatura.kdvOrani || 20).toString()
      }));
    }

    const isAracGideri = isAracGideriParam || isInvoiceKkegOrArac(fatura);
    const satirListesi: any[] = [];
    const isAlis = fatura._type === 'ALIS';
    const isIade = isAlis ? (parseFloat(fatura.toplamTutar || 0) < 0 || (fatura.malHizmetAdi && String(fatura.malHizmetAdi).toLowerCase().includes('iade'))) : (parseFloat(fatura.alinanUcret || 0) < 0 || (fatura.aciklama && String(fatura.aciklama).toLowerCase().includes('iade')));
    
    // Karşı Hesap (Cari / Kasa / Banka / Ortaklar 331) Belirleme:
    // 1. Faturada tanımlanmış veya Mahsup Kontrolü'nde seçilmiş Karşı Hesap Kodu EN ÖNCELİKLİDİR (Örn: 331, 331.01, 100.01, 102.01)
    let cariKod = (fatura.karsiHesapKodu || fatura.karsi_hesap_kodu || '').trim();
    
    // 2. Faturada özel karşı hesap seçilmemişse, bağlı carinin hesap kodunu kullan
    if (!cariKod && fatura.cariId) {
      const matchedCari = cariler.find(c => c.id === fatura.cariId);
      if (matchedCari && matchedCari.muhasebeKodu) {
        cariKod = matchedCari.muhasebeKodu.trim();
      }
    }

    // 3. Hiçbiri yoksa varsayılan cari kodu
    if (!cariKod) {
      cariKod = isAlis ? '320.01' : '120.01';
    }
    
    const kdvOrani = (fatura.kdvOrani || 20).toString();
    const matrah = parseFloat(fatura.matrah) || 0;
    const kdvTutar = parseFloat(fatura.kdvTutari) || 0;
    const tevkifatTutar = parseFloat(fatura.tevkifatTutari) || 0;
    const stopajTutar = parseFloat(fatura.stopajTutari) || 0;
    const isTevkifatli = tevkifatTutar > 0;

    // Matrah Hesabı
    let gelirGiderKod = isAlis ? (isIade ? '600' : '153') : (isIade ? '610' : '600');
    if (fatura.muhasebeKodu) {
      gelirGiderKod = fatura.muhasebeKodu;
    } else if (settings) {
      if (!isAlis) {
        if (isIade) {
          gelirGiderKod = settings.satis_iade_matrah?.[kdvOrani] || '610';
        } else if (isTevkifatli) {
          gelirGiderKod = settings.satis_tevkifat_matrah?.[kdvOrani] || settings.satis_tevkifat_matrah?.['varsayilan'] || settings.satis_matrah?.[kdvOrani] || settings.varsayilanSatisKodu || '600';
        } else {
          gelirGiderKod = settings.satis_matrah?.[kdvOrani] || settings.varsayilanSatisKodu || '600';
        }
      } else {
        gelirGiderKod = isIade 
          ? (settings.alis_iade_matrah?.[kdvOrani] || '600') 
          : (settings.alis_matrah?.[kdvOrani] || settings.varsayilanAlisKodu || '153');
      }
    }
    
    // KDV Hesabı
    let kdvKodu = '';
    if (fatura.kdvHesapKodu) {
      kdvKodu = fatura.kdvHesapKodu;
    } else if (settings) {
      if (isAlis) {
        kdvKodu = isIade ? settings.alis_iade?.[kdvOrani] : settings.alis?.[kdvOrani];
      } else {
        kdvKodu = isIade ? settings.satis_iade?.[kdvOrani] : settings.satis?.[kdvOrani];
      }
    }
    if (!kdvKodu) kdvKodu = isAlis ? (isIade ? '391' : '191') : (isIade ? '191' : '391');

    const oivTutar = isAlis ? (parseFloat(fatura.oivTutari) || 0) : 0;
    const toplam = isAlis ? (parseFloat(fatura.toplamTutar) || 0) : (parseFloat(fatura.alinanUcret) || 0);
    
    const evrakNo = fatura.faturaNo || '';
    const aciklama = fatura.aciklama || (isAlis ? `Alış Faturası - ${fatura.ad || ''}` : `Satış Faturası - ${fatura.ad || ''}`);

    const createRow = (kod: string, borc: number, alacak: number, detayAciklama: string) => ({
      'Evrak Tarihi': formatTarih(fatura.faturaTarihi),
      'Evrak No': evrakNo,
      'Belge Türü': 'FT',
      'Hesap Kodu': kod,
      'Borç': Math.round(borc * 100) / 100,
      'Alacak': Math.round(alacak * 100) / 100,
      'Detay Açıklama': detayAciklama,
      'KDV Oranı': kdvOrani
    });

    if (isAlis) {
        if (!isIade) {
            if (isAracGideri) {
                const matrahGider = matrah * 0.70;
                const matrahKkeg = matrah * 0.30;
                const kdvGider = kdvTutar * 0.70;
                const kdvKkeg = kdvTutar * 0.30;
                const kkegHesapKodu = settings?.aracGiderKkegKodu || '689.02';

                satirListesi.push(createRow(gelirGiderKod, matrahGider, 0, aciklama + ' (%70 Gider)'));
                satirListesi.push(createRow(kdvKodu, kdvGider, 0, aciklama + ' (%70 İndirilecek KDV)'));
                satirListesi.push(createRow(kkegHesapKodu, matrahKkeg + kdvKkeg, 0, aciklama + ' (%30 KKEG ve İndirilemeyen KDV)'));
            } else {
                satirListesi.push(createRow(gelirGiderKod, matrah, 0, aciklama));
                satirListesi.push(createRow(kdvKodu, kdvTutar, 0, aciklama));
            }

            if (oivTutar > 0) {
              satirListesi.push(createRow(settings?.oivKodu || '689.01', oivTutar, 0, aciklama + ' (ÖİV Tutarı)'));
            }

            if (tevkifatTutar > 0) {
              satirListesi.push(createRow(settings?.tevkifat || '360.01', 0, tevkifatTutar, aciklama + ' (KDV Tevkifatı)'));
            }
            if (stopajTutar > 0) {
              satirListesi.push(createRow(settings?.stopaj || '360.02', 0, stopajTutar, aciklama + ' (Stopaj Kesintisi)'));
            }

            satirListesi.push(createRow(cariKod, 0, toplam, aciklama));
        } else {
            satirListesi.push(createRow(cariKod, toplam, 0, aciklama));
            satirListesi.push(createRow(gelirGiderKod, 0, matrah, aciklama));
            satirListesi.push(createRow(kdvKodu, 0, kdvTutar, aciklama));
            if (oivTutar > 0) satirListesi.push(createRow(settings?.oivKodu || '689.01', 0, oivTutar, aciklama + ' (ÖİV İade)'));
        }
    } else {
        if (!isIade) {
            satirListesi.push(createRow(cariKod, toplam, 0, aciklama));

            if (stopajTutar > 0) {
              const stopajHesabi = settings?.satisStopaj || settings?.stopaj || '193';
              satirListesi.push(createRow(stopajHesabi, stopajTutar, 0, aciklama + ' (Stopaj Kesintisi)'));
            }

            satirListesi.push(createRow(gelirGiderKod, 0, matrah, aciklama));

            const netKdvTutar = Math.max(0, kdvTutar - tevkifatTutar);
            if (netKdvTutar > 0) {
              satirListesi.push(createRow(kdvKodu, 0, netKdvTutar, aciklama + (tevkifatTutar > 0 ? ' (Tevkifatlı KDV)' : '')));
            }
        } else {
            satirListesi.push(createRow(gelirGiderKod, matrah, 0, aciklama));
            satirListesi.push(createRow(kdvKodu, kdvTutar, 0, aciklama));
            satirListesi.push(createRow(cariKod, 0, toplam, aciklama));
        }
    }
    return satirListesi;
  };

  const handleExcelExport = () => {
    if (selectedIds.length === 0) return toast.error('Lütfen fatura seçin.');
    const selectedInvoices = sortInvoicesChronologically(invoices.filter(inv => selectedIds.includes(inv.id)));

    if (isIsletmeDefteri) {
      // İŞLETME DEFTERİ EXCEL ÇIKTISI
      const exportData = selectedInvoices.map(inv => getIsletmeDefteriSatiri(inv, isInvoiceKkegOrArac(inv)));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Isletme_Defteri');
      XLSX.writeFile(wb, `Isletme_Defteri_Faturalar_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`${selectedInvoices.length} adet fatura İşletme Defteri Excel tablosu olarak indirildi.`);
    } else {
      // BİLANÇO ESASI MAHSUP FİŞİ ÇIKTISI
      if (!settings) return toast.error('KDV Ayarları bulunamadı. Lütfen ayarları yapın.');
      let exportData: any[] = [];
      selectedInvoices.forEach(inv => {
        exportData = [...exportData, ...getMuhasebeSatirlari(inv, isInvoiceKkegOrArac(inv))];
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Faturalar_Luca');
      XLSX.writeFile(wb, `Faturalar_Luca_Mahsup_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Luca Bilanço Mahsup Excel dosyası başarıyla indirildi.');
    }
  };

  // LUCA HIZLI FİŞ (hizliFisPopUp.do) KONSOL SCRIPTİNİ ÇALIŞTIR & KOPYALA
  const executeCopyScript = (selectedInvoices: any[], customStopajMap?: Record<string, string>) => {
    const items = getLucaHizliFisItems(selectedInvoices, customStopajMap);

    const scriptCode = `// Luca Hızlı Fiş (hizliFisPopUp.do) Otomatik Doldurma ve Alt+E Satır Açma Kodu
(async function() {
  const faturalar = ${JSON.stringify(items, null, 2)};
  
  function setVal(id, val) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el) {
      if (el.hasAttribute('readonly')) {
        el.removeAttribute('readonly');
        el.readOnly = false;
      }
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }
  }

  function pressAltE() {
    const altEBtn = document.querySelector("[hotkey*='Alt+E'], [hotkey*='alt+e'], [hotkey*='ALT+E'], [hotkey*='Alt+e']");
    if (altEBtn) {
      altEBtn.click();
      return;
    }
    const evtDown = new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true, cancelable: true });
    const evtUp = new KeyboardEvent('keyup', { key: 'e', code: 'KeyE', keyCode: 69, which: 69, altKey: true, bubbles: true, cancelable: true });
    const target = document.activeElement || document.body;
    target.dispatchEvent(evtDown);
    target.dispatchEvent(evtUp);
    document.dispatchEvent(evtDown);
    document.dispatchEvent(evtUp);
    window.dispatchEvent(evtDown);
    window.dispatchEvent(evtUp);
    if (typeof window.satirEkle === 'function') window.satirEkle();
    else if (typeof window.addRow === 'function') window.addRow();
  }

  for (let i = 0; i < faturalar.length; i++) {
    const item = faturalar[i];
    
    // Satır i henüz yoksa Alt+E bas ve bekle
    if (!document.getElementById('islem' + i) && i > 0) {
      pressAltE();
      let attempts = 0;
      while (!document.getElementById('islem' + i) && attempts < 25) {
        await new Promise(r => setTimeout(r, 40));
        attempts++;
      }
    }

    setVal('islem' + i, item.tur);
    setVal('kategori' + i, item.kategori || '1');
    setVal('belge' + i, item.belge || '1');
    setVal('evrakTarih' + i, item.evrakTarih);
    setVal('kayitTarihi' + i, item.kayitTarihi || item.evrakTarih);
    setVal('seriNo' + i, '');
    setVal('evrakNo' + i, item.evrakNo || '');
    setVal('tckn' + i, item.tckn || '');
    setVal('soyadi' + i, item.soyadi || '');
    setVal('adi' + i, item.adi || '');
    setVal('aciklama' + i, item.aciklama || '');
    
    const isTevkifatli = item.tevkifat && item.tevkifat !== '0';
    setVal('TABLO_TURU' + i, isTevkifatli ? (item.tablo || '6') : '0');
    if (isTevkifatli) {
      const kodFullVal = item.kodFull || (item.kodNo ? (item.kodNo + ' | ' + (item.oranStr || '')) : '');
      const kodEl = document.getElementById('kodNo' + i) || document.querySelector('[name="detaylar[' + i + '].kodNo"]');
      if (kodEl) setVal(kodEl, kodFullVal);
      const td8 = document.getElementById('td8_' + i);
      if (td8) {
        td8.querySelectorAll('input').forEach(inp => setVal(inp, kodFullVal));
      }
      if (typeof window.setIstisna === 'function') {
        try { window.setIstisna('kodNo' + i, kodFullVal, item.oranStr || ''); } catch(e) {}
      }
      if (typeof window.kodDegisti === 'function') {
        try { window.kodDegisti(kodFullVal); } catch(e) {}
      }
      if (typeof window.detayKodDegisti === 'function') {
        try { window.detayKodDegisti(kodFullVal); } catch(e) {}
      }
    }

    setVal('tutar' + i, (item.tutar !== undefined ? item.tutar : item.matrah).toString().replace('.', ','));
    setVal('kdvOran2_' + i, item.kdvOran || '20.0');
    setVal('kdvTutar' + i, (item.kdvTutar !== undefined ? item.kdvTutar : item.kdvTutari).toString().replace('.', ','));
    const tutarNum = parseFloat(String(item.tutar !== undefined ? item.tutar : item.matrah).replace(',', '.')) || 0;
    const kdvNum = parseFloat(String(item.kdvTutar !== undefined ? item.kdvTutar : item.kdvTutari).replace(',', '.')) || 0;
    let finalTop = item.toplamTutar !== undefined ? item.toplamTutar : item.toplam;
    if (tutarNum > 0 && kdvNum > 0 && (!finalTop || parseFloat(String(finalTop).replace(',', '.')) === tutarNum)) {
      finalTop = Math.round((tutarNum + kdvNum) * 100) / 100;
    }
    setVal('topNotBura' + i, finalTop.toString().replace('.', ','));
    if (isTevkifatli) setVal('tevkifat' + i, item.tevkifat);

    // Multiselect alanları (td24, td25, td26, td27: Beyan Belge Türü, Alış Satış Türü, Kayıt Alt Türü, Stopaj Kodu)
    const setMultiSelectField = async (colName, targetVal, labelKeywords, isStopaj = false) => {
      const sSelect = document.getElementById(colName + i) 
        || document.querySelector('select[name="detaylar[' + i + '].' + colName + '"]')
        || (document.getElementById('islem' + i) ? document.getElementById('islem' + i).closest('tr')?.querySelector('.' + colName + 'Td select') : null);
      
      const m = sSelect ? sSelect.closest('.multiselect') : (
        document.getElementById('islem' + i) ? document.getElementById('islem' + i).closest('tr')?.querySelector('.' + colName + 'Td .multiselect') : null
      );
      
      const valStr = (targetVal || '').toString().trim();

      if (!valStr || valStr === '0') {
        if (sSelect) {
          sSelect.value = '';
          sSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (m) {
          m.querySelectorAll('.checkboxes input:checked').forEach(c => {
            c.click();
            c.checked = false;
            c.dispatchEvent(new Event('change', { bubbles: true }));
          });
          const cbDiv = m.querySelector('.checkboxes');
          if (cbDiv && cbDiv.style.display !== 'none') {
            const box = m.querySelector('.overSelect') || m.querySelector('.selectBox');
            if (box) box.click();
          }
        }
        if (isStopaj && typeof window.stopaj_kodu_degisti === 'function' && sSelect) {
          try { window.stopaj_kodu_degisti(sSelect); } catch(e) {}
        }
        return;
      }

      // Değer varsa:
      if (sSelect) {
        sSelect.value = valStr;
        sSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (m) {
        const box = m.querySelector('.overSelect') || m.querySelector('.selectBox');
        const cbDiv = m.querySelector('.checkboxes');

        // Checkbox listesi dinamik yüklenir, kutuyu tıkla
        if (box) {
          box.click();
          if (!cbDiv || cbDiv.children.length === 0) {
            await new Promise(r => setTimeout(r, 40));
          }
        }

        const sCode = valStr.split('-')[0].trim();
        let chk = m.querySelector('.checkboxes input[value="' + valStr + '"]')
          || m.querySelector('.checkboxes input[value^="' + valStr + '-"]')
          || m.querySelector('.checkboxes input[value^="' + valStr + '"]')
          || (sCode ? m.querySelector('.checkboxes input[value="' + sCode + '"]') : null)
          || (sCode ? m.querySelector('.checkboxes input[value^="' + sCode + '"]') : null);

        if (!chk && labelKeywords && labelKeywords.length > 0) {
          const labels = Array.from(m.querySelectorAll('.checkboxes label'));
          const foundLabel = labels.find(l => {
            const txt = (l.innerText || '').toLowerCase();
            return labelKeywords.some(kw => txt.includes(kw.toLowerCase()));
          });
          if (foundLabel) chk = foundLabel.querySelector('input') || foundLabel;
        }

        if (chk) {
          if (!chk.checked) {
            chk.click();
            chk.checked = true;
            chk.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } else {
          // Eğer spesifik checkbox bulunamazsa ama tek seçenek veya default varsa ilkini seç
          const firstChk = m.querySelector('.checkboxes input');
          if (firstChk && !isStopaj && !firstChk.checked) {
            firstChk.click();
            firstChk.checked = true;
            firstChk.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        // Dropdown açık kaldıysa kapat
        if (cbDiv && cbDiv.style.display !== 'none' && box) {
          box.click();
        }
      }

      if (isStopaj && typeof window.stopaj_kodu_degisti === 'function' && sSelect) {
        try { window.stopaj_kodu_degisti(sSelect); } catch(e) {}
      }
    };

    // 1. Belge Türü (DB)
    const isAlisRow = (item.islem === '1' || item.tur === '1' || item.tur === 'gider' || item.tip === 'ALIS');
    const fNoStr = (item.evrakNo || item.faturaNo || item.no || '').toString().trim();
    const isSmm = fNoStr.startsWith('SMM') || item.tur === 'smm' || item.tip === 'smm';
    const isEBelge = fNoStr.length >= 16 || fNoStr.startsWith('GİB') || fNoStr.startsWith('EAR') || fNoStr.startsWith('EAF') || fNoStr.startsWith('FAT');
    
    let beyanVal = item.beyanBelgeTuru;
    if (!beyanVal) {
      if (isSmm) beyanVal = '8';
      else if (isAlisRow) beyanVal = isEBelge ? '9' : '1';
      else beyanVal = isEBelge ? '7' : '1';
    }
    await setMultiSelectField('beyanBelgeTuru', beyanVal, isSmm ? ['serbest', 'smm'] : (isEBelge ? ['arşiv', 'fatura', 'e-'] : ['fatura']), false);

    // 2. Alış/Satış Türü
    await setMultiSelectField('alisSatisTuru', item.alisSatisTuru || '1', ['normal', 'satış', 'alış', '1'], false);

    // 3. Kayıt Alt Türü
    await setMultiSelectField('kayitAltTuru', item.kayitAltTuru || '1', ['mal', 'hizmet', '1'], false);

    // 4. Stopaj Kodu (Sadece stopaj tutarı > 0 olanlarda doldurulur, diğerlerinde temizlenir)
    const stopajKoduVal = (item.stopajKodu || item.stopaj_kodu || '').toString().trim();
    const sTutar = typeof item.stopajTutari === 'number'
      ? item.stopajTutari
      : (parseFloat(String(item.stopajTutari || item.stopaj_tutari || item.stopajTutar || '0').replace(',', '.')) || 0);
    const hasStopaj = sTutar > 0 && stopajKoduVal && stopajKoduVal !== '0';
    await setMultiSelectField('stopajKodu', hasStopaj ? stopajKoduVal : '', hasStopaj ? [stopajKoduVal.split('-')[0]] : [], true);

    // Sonraki satır için Alt + E tuşuna bas
    if (i < faturalar.length - 1) {
      pressAltE();
      await new Promise(r => setTimeout(r, 60));
    }
  }

  alert(faturalar.length + ' adet fatura Luca Hızlı Fiş tablosuna aktarıldı!');
})();`;

    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    toast.success(`${selectedInvoices.length} faturanın Luca Hızlı Fiş scripti panoya kopyalandı!`);
  };

  // İŞLETME DEFTERİ LUCA EKLENTİSİNE GÖNDERME
  const executeExtensionExportIsletme = (selectedInvoices: any[], customStopajMap?: Record<string, string>) => {
    const hizliFisItems = getLucaHizliFisItems(selectedInvoices, customStopajMap);
    const isletmeRows = selectedInvoices.map(inv => getIsletmeDefteriSatiri(inv, aracGideriIds.includes(inv.id)));
    
    const rawInvoices = selectedInvoices.map(inv => {
      const hasActualStopaj = isInvoiceStopajli(inv);
      const stopajTutar = typeof inv.stopajTutari === 'number'
        ? inv.stopajTutari
        : (parseFloat(String(inv.stopajTutari || inv.stopaj_tutari || inv.stopajTutar || '0').replace(',', '.')) || 0);

      let sKod = '';
      if (hasActualStopaj) {
        if (customStopajMap && customStopajMap[inv.id] !== undefined) {
          sKod = customStopajMap[inv.id];
        } else if (stopajKodMap[inv.id] !== undefined) {
          sKod = stopajKodMap[inv.id];
        } else if (inv.stopajKodu) {
          sKod = inv.stopajKodu;
        } else {
          sKod = deduceStopajKodu(inv) || '022-20';
        }
      }

      const unvan = inv.ad || inv.unvan || inv.tedarikciAdi || (cariler.find(c => c.id === inv.cariId)?.unvan) || 'Muhtelif Cari';
      const tcVkn = inv.tcVkn || inv.tedarikciVkn || (cariler.find(c => c.id === inv.cariId)?.vknTckn) || '';

      return {
        id: inv.id,
        faturaNo: inv.faturaNo || '',
        faturaTarihi: inv.faturaTarihi,
        unvan,
        ad: unvan,
        tcVkn,
        matrah: parseFloat(inv.matrah) || 0,
        kdvOrani: inv.kdvOrani || '20',
        kdvTutari: parseFloat(inv.kdvTutari) || 0,
        tevkifatTutari: parseFloat(inv.tevkifatTutari) || 0,
        stopajTutari: stopajTutar,
        stopajKodu: sKod,
        toplamTutar: (parseFloat(inv.matrah) || 0) > 0 || (parseFloat(inv.kdvTutari) || 0) > 0
          ? Math.round(((parseFloat(inv.matrah) || 0) + (parseFloat(inv.kdvTutari) || 0)) * 100) / 100
          : (inv._type === 'ALIS' ? (parseFloat(inv.toplamTutar) || 0) : (parseFloat(inv.alinanUcret) || 0)),
        tur: inv._type === 'ALIS' ? 'gider' : 'gelir',
        tip: inv._type === 'ALIS' ? 'ALIS' : 'SATIS',
        defterTuru: 'ISLETME',
        isAracGideri: isInvoiceKkegOrArac(inv)
      };
    });

    const activeComp = companies.find(c => c.id === (user?.companyId || 1));
    const targetCompany = {
      id: activeComp?.id || 1,
      vkn: activeComp?.tax_no || (activeComp as any)?.vknTckn || '',
      unvan: activeComp?.name || (activeComp as any)?.unvan || ''
    };

    // A) LocalStorage kaydı
    try {
      localStorage.setItem('fatura_app_luca_isletme', JSON.stringify(hizliFisItems));
      localStorage.setItem('fatura_app_luca_data', JSON.stringify({ targetCompany, isIsletme: true, invoices: hizliFisItems, data: hizliFisItems, raw: rawInvoices }));
      localStorage.setItem('luca_aktarim_faturalar', JSON.stringify(hizliFisItems));
      localStorage.setItem('luca_transfer_data', JSON.stringify(hizliFisItems));
      localStorage.setItem('hizli_fis_data', JSON.stringify(hizliFisItems));
      localStorage.setItem('transferData', JSON.stringify({ isIsletme: true, invoices: hizliFisItems }));
    } catch (e) {
      console.error('LocalStorage error:', e);
    }

    // B) CustomEvent & PostMessage
    const payload = { targetCompany, isIsletme: true, invoices: hizliFisItems, hizliFisItems, isletmeRows, faturalar: rawInvoices, count: selectedInvoices.length };
    
    window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SEND_ISLETME', { detail: hizliFisItems }));
    window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_DATA', { detail: payload }));
    window.dispatchEvent(new CustomEvent('LUCA_SEND_INVOICES', { detail: hizliFisItems }));
    document.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SEND_ISLETME', { detail: hizliFisItems }));
    document.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_DATA', { detail: payload }));

    window.postMessage({ type: 'FATURA_APP_LUCA_SEND_ISLETME', detail: hizliFisItems, data: hizliFisItems, payload }, '*');
    window.postMessage({ type: 'FATURA_APP_LUCA_DATA', detail: payload, data: payload }, '*');

    toast.success(`${selectedInvoices.length} fatura Luca Hızlı Fiş için hazırlandı! Luca sekmesine geçip eklenti ikonuna tıklayarak "Faturaları Aktar" diyebilirsiniz.`, { duration: 6000 });
  };

  // BİLANÇO ESASI LUCA EKLENTİSİNE GÖNDERME
  const executeExtensionExportBilanco = (selectedInvoices: any[]) => {
    if (!settings) return toast.error('KDV Ayarları bulunamadı. Lütfen ayarları yapın.');
    let exportData: any[] = [];
    selectedInvoices.forEach(inv => {
      const excelRows = getMuhasebeSatirlari(inv, isInvoiceKkegOrArac(inv));
      const extRows = excelRows.map(row => ({
        tarih: row['Evrak Tarihi'],
        evrakNo: row['Evrak No'],
        aciklama: row['Detay Açıklama'],
        tutar: row['Borç'] > 0 ? row['Borç'] : row['Alacak'],
        tur: row['Borç'] > 0 ? 'borc' : 'alacak',
        muhasebeKodu: row['Hesap Kodu'],
        belgeTuru: row['Belge Türü']
      }));
      exportData = [...exportData, ...extRows];
    });

    const activeComp = companies.find(c => c.id === (user?.companyId || 1));
    const targetCompany = {
      id: activeComp?.id || 1,
      vkn: activeComp?.tax_no || (activeComp as any)?.vknTckn || '',
      unvan: activeComp?.name || (activeComp as any)?.unvan || ''
    };

    try {
      localStorage.setItem('fatura_app_luca_mahsup', JSON.stringify(exportData));
      localStorage.setItem('fatura_app_luca_data', JSON.stringify({ targetCompany, isIsletme: false, data: exportData }));
      localStorage.setItem('luca_aktarim_faturalar', JSON.stringify(exportData));
    } catch (e) {
      console.error('LocalStorage error:', e);
    }

    const payload = { targetCompany, isIsletme: false, mahsupRows: exportData, count: selectedInvoices.length };

    window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SEND_MAHSUP', { detail: exportData }));
    window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_DATA', { detail: payload }));
    document.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SEND_MAHSUP', { detail: exportData }));
    document.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_DATA', { detail: payload }));

    window.postMessage({ type: 'FATURA_APP_LUCA_SEND_MAHSUP', detail: exportData, data: exportData }, '*');
    window.postMessage({ type: 'FATURA_APP_LUCA_DATA', detail: payload, data: payload }, '*');

    toast.success(`${selectedInvoices.length} fatura (${exportData.length} yevmiye satırı) eklentiye gönderildi! Luca sekmesinde eklenti ikonuna tıklayıp "Mahsup Fişini Aktar" diyebilirsiniz.`, { duration: 6000 });
  };

  // Buton Tetikleyicileri (Stopaj Kontrollü)
  const handleCopyScriptClick = () => {
    if (selectedIds.length === 0) return toast.error('Lütfen fatura seçin.');
    const selectedInvoices = sortInvoicesChronologically(invoices.filter(inv => selectedIds.includes(inv.id)));
    
    // Stopajlı faturaları tespit et (Sadece fiilen stopajı olanlar)
    const stopajList = selectedInvoices.filter(inv => isInvoiceStopajli(inv));

    if (stopajList.length > 0) {
      const initialMap: Record<string, string> = {};
      stopajList.forEach(inv => {
        initialMap[inv.id] = stopajKodMap[inv.id] || inv.stopajKodu || deduceStopajKodu(inv) || '022-20';
      });
      setStopajKodMap(prev => ({ ...prev, ...initialMap }));
      setStopajInvoices(stopajList);
      setStopajModalAction('copy_script');
      setIsStopajModalOpen(true);
      return;
    }

    executeCopyScript(selectedInvoices);
  };

  const handleExtensionExportClick = () => {
    if (selectedIds.length === 0) return toast.error('Lütfen fatura seçin.');
    const selectedInvoices = sortInvoicesChronologically(invoices.filter(inv => selectedIds.includes(inv.id)));

    if (isIsletmeDefteri) {
      // Stopajlı faturaları tespit et (Sadece fiilen stopajı olanlar)
      const stopajList = selectedInvoices.filter(inv => isInvoiceStopajli(inv));

      if (stopajList.length > 0) {
        const initialMap: Record<string, string> = {};
        stopajList.forEach(inv => {
          initialMap[inv.id] = stopajKodMap[inv.id] || inv.stopajKodu || deduceStopajKodu(inv) || '022-20';
        });
        setStopajKodMap(prev => ({ ...prev, ...initialMap }));
        setStopajInvoices(stopajList);
        setStopajModalAction('export');
        setIsStopajModalOpen(true);
        return;
      }

      executeExtensionExportIsletme(selectedInvoices);
    } else {
      executeExtensionExportBilanco(selectedInvoices);
    }
  };

  const handleStopajModalConfirm = (updatedKodMap: Record<string, string>) => {
    setStopajKodMap(prev => ({ ...prev, ...updatedKodMap }));
    const selectedInvoices = sortInvoicesChronologically(invoices.filter(inv => selectedIds.includes(inv.id)));
    
    if (stopajModalAction === 'copy_script') {
      executeCopyScript(selectedInvoices, updatedKodMap);
    } else {
      executeExtensionExportIsletme(selectedInvoices, updatedKodMap);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Stopaj Kodu Seçim Modalı */}
      <StopajKoduModal
        isOpen={isStopajModalOpen}
        onClose={() => setIsStopajModalOpen(false)}
        invoices={stopajInvoices}
        initialMap={stopajKodMap}
        actionType={stopajModalAction}
        onConfirm={handleStopajModalConfirm}
      />

      {/* Header & Mode Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">
              {isIsletmeDefteri ? 'İşletme Defteri Fatura & Excel Aktarımı' : 'Bilanço Fatura Aktarım'}
            </h1>
            {isIsletmeDefteri ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <BookOpen className="w-3.5 h-3.5" /> İşletme Defteri Modu (Hesap Kodsuz)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                <Layers className="w-3.5 h-3.5" /> Bilanço Esası (Mahsup Fişi / 600-153)
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {isIsletmeDefteri 
              ? '2. Sınıf işletme defteri için faturalarınızı hesap kodu olmadan doğrudan Gelir / Gider ve KDV Matrah dökümü olarak aktarın.' 
              : '1. Sınıf tüccarlar için faturaları 600 Gelir, 153/770 Gider ve 391/191 KDV hesap kodlarıyla Luca Mahsup Fişi formatında aktarın.'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Başlangıç Tarihi</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36 h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Bitiş Tarihi</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36 h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Fatura Türü</label>
              <select 
                value={filterType} 
                onChange={(e: any) => setFilterType(e.target.value)}
                className="h-9 border border-input rounded-md px-3 text-sm bg-background"
              >
                <option value="ALL">Tümü (Alış + Satış)</option>
                <option value="ALIS">Sadece Alışlar (Gider)</option>
                <option value="SATIS">Sadece Satışlar (Gelir)</option>
              </select>
            </div>
            <Button onClick={fetchInvoices} disabled={loading} variant="secondary" className="h-9 gap-1.5">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Faturaları Getir
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <Button 
                onClick={handleExcelExport} 
                disabled={selectedIds.length === 0} 
                variant="outline" 
                className="h-9 gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                {isIsletmeDefteri ? "İşletme Excel İndir" : "Luca Excel İndir"}
              </Button>

              {isIsletmeDefteri && (
                <Button 
                  onClick={handleCopyScriptClick} 
                  disabled={selectedIds.length === 0} 
                  variant="outline" 
                  className="h-9 gap-1.5 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
                  title="Luca Hızlı Fiş (hizliFisPopUp.do) sayfasına otomatik yapıştırma scripti kopyalar"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-amber-600" />}
                  {copied ? "Kopyalandı!" : "📋 Hızlı Fiş Kodu Kopyala"}
                </Button>
              )}

              <Button 
                onClick={handleExtensionExportClick} 
                disabled={selectedIds.length === 0} 
                className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Send className="w-4 h-4" /> 
                {isIsletmeDefteri ? "Luca'ya Aktar (İşletme)" : "Luca'ya Aktar (Mahsup)"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <Checkbox checked={filteredInvoices.length > 0 && selectedIds.length === filteredInvoices.length} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Evrak No</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Firma / Muhatap & Gider Hesabı</TableHead>
                  <TableHead className="text-right">Matrah</TableHead>
                  <TableHead className="text-center">KDV</TableHead>
                  <TableHead className="text-right">KDV Tutar</TableHead>
                  <TableHead className="text-right">Net / Toplam</TableHead>
                  <TableHead className="text-center">Araç Gideri (%70)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                      Fatura bulunamadı. Lütfen tarih seçip "Faturaları Getir" butonuna basın.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((inv) => {
                    const isAlis = inv._type === 'ALIS';
                    const matrah = parseFloat(inv.matrah) || 0;
                    const kdvTutar = parseFloat(inv.kdvTutari) || 0;
                    const kdvDahil = Math.round((matrah + kdvTutar) * 100) / 100;
                    const toplam = (matrah > 0 || kdvTutar > 0) ? kdvDahil : (isAlis ? (parseFloat(inv.toplamTutar) || 0) : (parseFloat(inv.alinanUcret) || 0));
                    const isArac = isInvoiceKkegOrArac(inv);
                    const stopajTutar = typeof inv.stopajTutari === 'number'
                      ? inv.stopajTutari
                      : (parseFloat(String(inv.stopajTutari || inv.stopaj_tutari || inv.stopajTutar || '0').replace(',', '.')) || 0);
                    const hasStopaj = isInvoiceStopajli(inv);
                    const deducedKod = hasStopaj
                      ? (stopajKodMap[inv.id] || inv.stopajKodu || deduceStopajKodu(inv) || '022-20')
                      : '';

                    const unvan = inv.ad || inv.unvan || inv.tedarikciAdi || 'Muhtelif Cari';
                    const vkn = inv.tcVkn || inv.tedarikciVkn || '';
                    const hesapAdi = getHesapAdi(inv);
                    const hasCustomMahsup = inv.mahsupSatirlari && Array.isArray(inv.mahsupSatirlari) && inv.mahsupSatirlari.length > 0;
                    const resolvedKdvKod = inv.kdvHesapKodu || (isAlis ? (settings?.alis?.[String(inv.kdvOrani || 20)] || '191.20') : (settings?.satis?.[String(inv.kdvOrani || 20)] || '391.20'));

                    return (
                      <TableRow 
                        key={inv.id} 
                        className={selectedIds.includes(inv.id) ? 'bg-indigo-50/40' : ''}
                        data-luca-no={inv.faturaNo || ''}
                        data-luca-tarih={inv.faturaTarihi}
                        data-luca-unvan={unvan}
                        data-luca-vkn={vkn}
                        data-luca-matrah={matrah}
                        data-luca-kdv={kdvTutar}
                        data-luca-kdv-oran={inv.kdvOrani || '20'}
                        data-luca-toplam={toplam}
                        data-luca-tur={isAlis ? 'alis' : 'satis'}
                        data-luca-tip={isAlis ? 'gider' : 'gelir'}
                        data-luca-defter-turu={isIsletmeDefteri ? 'isletme' : 'bilanco'}
                        data-luca-tevkifat-kodu={inv.tevkifatKodu || ''}
                        data-luca-tevkifat-oran={inv.tevkifatOrani || ''}
                        data-luca-tevkifat-tutar={inv.tevkifatTutari || 0}
                        data-luca-stopaj-kodu={deducedKod}
                        data-luca-stopaj-oran={hasStopaj ? (inv.stopajOrani || '') : ''}
                        data-luca-stopaj-tutar={hasStopaj ? stopajTutar : 0}
                        data-luca-muhasebe-kodu={inv.muhasebeKodu || ''}
                        data-luca-karsi-hesap-kodu={inv.karsiHesapKodu || ''}
                        data-luca-kdv-hesap-kodu={resolvedKdvKod}
                      >
                        <TableCell className="text-center">
                          <Checkbox checked={selectedIds.includes(inv.id)} onCheckedChange={() => toggleSelection(inv.id)} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{formatTarih(inv.faturaTarihi)}</TableCell>
                        <TableCell className="font-medium text-xs">{inv.faturaNo || '-'}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isAlis ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                            {isAlis ? 'GİDER (ALIŞ)' : 'GELİR (SATIŞ)'}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          <div className="font-semibold text-xs text-slate-900 truncate" title={unvan}>
                            {unvan}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {hesapAdi ? (
                              <div className="text-[11px] text-indigo-600 font-medium truncate flex items-center gap-1" title={hesapAdi}>
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                                {hesapAdi}
                              </div>
                            ) : (
                              inv.malHizmetAdi && (
                                <div className="text-[11px] text-slate-500 truncate" title={inv.malHizmetAdi}>
                                  {inv.malHizmetAdi}
                                </div>
                              )
                            )}
                            {inv.karsiHesapKodu && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200" title="Karşı / Ödeme Hesabı">
                                Karşı: {inv.karsiHesapKodu}
                              </span>
                            )}
                            {hasCustomMahsup && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold" title="Fiş denetiminde özel olarak bölündü">
                                Özel Mahsup ({inv.mahsupSatirlari.length} Kalem)
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {matrah.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          <div>%{inv.kdvOrani || 20}</div>
                          <div className="text-[10px] text-indigo-600 font-mono mt-0.5" title="KDV Hesabı (191/391)">
                            {resolvedKdvKod}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-indigo-600 font-medium">
                          {kdvTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-slate-800">
                          {toplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </TableCell>
                        <TableCell className="text-center">
                          {isAlis && (
                            <div className="flex flex-col items-center gap-1">
                              <Checkbox 
                                checked={isArac} 
                                onCheckedChange={(checked) => {
                                  setAracGideriIds(prev => checked ? [...prev, inv.id] : prev.filter(i => i !== inv.id));
                                }} 
                              />
                              {isArac && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 whitespace-nowrap">
                                  %70 KKEG
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
