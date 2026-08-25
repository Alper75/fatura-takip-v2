import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { FileSpreadsheet, RefreshCw, Send, BookOpen, Layers } from 'lucide-react';
import { toast } from 'sonner';

export function FaturaAktarim() {
  const { apiFetch, cariler, isIsletmeDefteri } = useApp();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<any>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ALIS' | 'SATIS'>('ALL');
  const [aracGideriIds, setAracGideriIds] = useState<string[]>([]);

  useEffect(() => {
    fetchSettings();
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

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const alisRes = await apiFetch('/api/alis-faturalari');
      const satisRes = await apiFetch('/api/satis-faturalari');
      
      let allInvoices: any[] = [];
      if (alisRes.success) {
        allInvoices = [...allInvoices, ...alisRes.data.map((f: any) => ({ ...f, _type: 'ALIS' }))];
      }
      if (satisRes.success) {
        allInvoices = [...allInvoices, ...satisRes.data.map((f: any) => ({ ...f, _type: 'SATIS' }))];
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
    const [y, m, d] = tarih.split('-');
    return `${d}/${m}/${y}`;
  };

  // İŞLETME DEFTERİ İÇİN SATIR FORMATI (HESAP KODSUZ GELİR / GİDER LİSTESİ)
  const getIsletmeDefteriSatiri = (fatura: any, isAracGideri: boolean = false) => {
    const isAlis = fatura._type === 'ALIS';
    const isIade = isAlis ? (parseFloat(fatura.toplamTutar || 0) < 0 || (fatura.malHizmetAdi && String(fatura.malHizmetAdi).toLowerCase().includes('iade'))) : (parseFloat(fatura.alinanUcret || 0) < 0 || (fatura.aciklama && String(fatura.aciklama).toLowerCase().includes('iade')));
    const kdvOrani = (fatura.kdvOrani || 20).toString();
    const matrah = parseFloat(fatura.matrah) || 0;
    const kdvTutar = parseFloat(fatura.kdvTutari) || 0;
    const tevkifatTutar = parseFloat(fatura.tevkifatTutari) || 0;
    const stopajTutar = parseFloat(fatura.stopajTutari) || 0;
    const oivTutar = isAlis ? (parseFloat(fatura.oivTutari) || 0) : 0;
    const toplam = isAlis ? (parseFloat(fatura.toplamTutar) || 0) : (parseFloat(fatura.alinanUcret) || 0);

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

  // BİLANÇO ESASI İÇİN YEVMİYE MAHSUP SATIRLARI (HESAP PLANLI ÇİFT TARAFLI)
  const getMuhasebeSatirlari = (fatura: any, isAracGideri: boolean = false) => {
    const satirListesi: any[] = [];
    const isAlis = fatura._type === 'ALIS';
    const isIade = isAlis ? (parseFloat(fatura.toplamTutar || 0) < 0 || (fatura.malHizmetAdi && String(fatura.malHizmetAdi).toLowerCase().includes('iade'))) : (parseFloat(fatura.alinanUcret || 0) < 0 || (fatura.aciklama && String(fatura.aciklama).toLowerCase().includes('iade')));
    
    // Cari Kod Belirleme
    let cariKod = isAlis ? '320' : '120';
    if (fatura.cariId) {
      const matchedCari = cariler.find(c => c.id === fatura.cariId);
      if (matchedCari && matchedCari.muhasebeKodu) {
        cariKod = matchedCari.muhasebeKodu;
      }
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
    if (settings) {
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
      'Belge Türü': 'Fatura',
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
    const selectedInvoices = invoices.filter(inv => selectedIds.includes(inv.id));

    if (isIsletmeDefteri) {
      // İŞLETME DEFTERİ EXCEL ÇIKTISI
      const exportData = selectedInvoices.map(inv => getIsletmeDefteriSatiri(inv, aracGideriIds.includes(inv.id)));
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
        exportData = [...exportData, ...getMuhasebeSatirlari(inv, aracGideriIds.includes(inv.id))];
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Faturalar_Luca');
      XLSX.writeFile(wb, `Faturalar_Luca_Mahsup_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Luca Bilanço Mahsup Excel dosyası başarıyla indirildi.');
    }
  };

  const handleExtensionExport = () => {
    if (selectedIds.length === 0) return toast.error('Lütfen fatura seçin.');
    const selectedInvoices = invoices.filter(inv => selectedIds.includes(inv.id));

    if (isIsletmeDefteri) {
      const isletmeRows = selectedInvoices.map(inv => getIsletmeDefteriSatiri(inv, aracGideriIds.includes(inv.id)));
      
      const rawInvoices = selectedInvoices.map(inv => ({
        id: inv.id,
        faturaNo: inv.faturaNo || '',
        faturaTarihi: inv.faturaTarihi,
        unvan: inv.ad || (cariler.find(c => c.id === inv.cariId)?.unvan) || '',
        ad: inv.ad || '',
        tcVkn: inv.tcVkn || (cariler.find(c => c.id === inv.cariId)?.vknTckn) || '',
        matrah: parseFloat(inv.matrah) || 0,
        kdvOrani: inv.kdvOrani || '20',
        kdvTutari: parseFloat(inv.kdvTutari) || 0,
        tevkifatTutari: parseFloat(inv.tevkifatTutari) || 0,
        stopajTutari: parseFloat(inv.stopajTutari) || 0,
        toplamTutar: inv._type === 'ALIS' ? (parseFloat(inv.toplamTutar) || 0) : (parseFloat(inv.alinanUcret) || 0),
        tur: inv._type === 'ALIS' ? 'gider' : 'gelir',
        tip: inv._type === 'ALIS' ? 'ALIS' : 'SATIS',
        defterTuru: 'ISLETME',
        isAracGideri: aracGideriIds.includes(inv.id)
      }));

      // A) LocalStorage kaydı
      try {
        localStorage.setItem('fatura_app_luca_isletme', JSON.stringify(isletmeRows));
        localStorage.setItem('fatura_app_luca_data', JSON.stringify({ isIsletme: true, data: isletmeRows, faturalar: rawInvoices }));
        localStorage.setItem('luca_aktarim_faturalar', JSON.stringify(rawInvoices));
        localStorage.setItem('luca_transfer_data', JSON.stringify(rawInvoices));
      } catch (e) {
        console.error('LocalStorage error:', e);
      }

      // B) CustomEvent & PostMessage
      const payload = { isIsletme: true, isletmeRows, faturalar: rawInvoices, count: selectedInvoices.length };
      
      window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SEND_ISLETME', { detail: isletmeRows }));
      window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_DATA', { detail: payload }));
      window.dispatchEvent(new CustomEvent('LUCA_SEND_INVOICES', { detail: rawInvoices }));
      document.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SEND_ISLETME', { detail: isletmeRows }));
      document.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_DATA', { detail: payload }));

      window.postMessage({ type: 'FATURA_APP_LUCA_SEND_ISLETME', detail: isletmeRows, data: isletmeRows, payload }, '*');
      window.postMessage({ type: 'FATURA_APP_LUCA_DATA', detail: payload, data: payload }, '*');

      toast.success(`${selectedInvoices.length} fatura İşletme Defteri formatında Luca Eklentisine gönderildi!`);
    } else {
      if (!settings) return toast.error('KDV Ayarları bulunamadı. Lütfen ayarları yapın.');
      let exportData: any[] = [];
      selectedInvoices.forEach(inv => {
        const excelRows = getMuhasebeSatirlari(inv, aracGideriIds.includes(inv.id));
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

      try {
        localStorage.setItem('fatura_app_luca_mahsup', JSON.stringify(exportData));
        localStorage.setItem('fatura_app_luca_data', JSON.stringify({ isIsletme: false, data: exportData }));
        localStorage.setItem('luca_aktarim_faturalar', JSON.stringify(exportData));
      } catch (e) {
        console.error('LocalStorage error:', e);
      }

      const payload = { isIsletme: false, mahsupRows: exportData, count: selectedInvoices.length };

      window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SEND_MAHSUP', { detail: exportData }));
      window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_DATA', { detail: payload }));
      document.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SEND_MAHSUP', { detail: exportData }));
      document.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_DATA', { detail: payload }));

      window.postMessage({ type: 'FATURA_APP_LUCA_SEND_MAHSUP', detail: exportData, data: exportData }, '*');
      window.postMessage({ type: 'FATURA_APP_LUCA_DATA', detail: payload, data: payload }, '*');

      toast.success(`${selectedInvoices.length} fatura Mahsup Fişi olarak Luca Eklentisine gönderildi!`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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
                {isIsletmeDefteri ? "İşletme Excel'e Aktar" : "Luca Excel İndir"}
              </Button>
              <Button 
                onClick={handleExtensionExport} 
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
                  <TableHead>Firma / Muhatap</TableHead>
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
                    const toplam = isAlis ? (parseFloat(inv.toplamTutar) || 0) : (parseFloat(inv.alinanUcret) || 0);
                    const isArac = aracGideriIds.includes(inv.id);

                    return (
                      <TableRow 
                        key={inv.id} 
                        className={selectedIds.includes(inv.id) ? 'bg-indigo-50/40' : ''}
                        data-luca-no={inv.faturaNo || ''}
                        data-luca-tarih={inv.faturaTarihi}
                        data-luca-unvan={inv.ad || ''}
                        data-luca-vkn={inv.tcVkn || ''}
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
                        data-luca-stopaj-kodu={inv.stopajKodu || ''}
                        data-luca-stopaj-oran={inv.stopajOrani || ''}
                        data-luca-stopaj-tutar={inv.stopajTutari || 0}
                        data-luca-muhasebe-kodu={inv.muhasebeKodu || ''}
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
                        <TableCell className="max-w-[200px] truncate text-xs font-medium" title={inv.ad}>
                          {inv.ad || 'İsimsiz'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {matrah.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">%{inv.kdvOrani || 20}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-indigo-600 font-medium">
                          {kdvTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-slate-800">
                          {toplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </TableCell>
                        <TableCell className="text-center">
                          {isAlis && (
                            <Checkbox 
                              checked={isArac} 
                              onCheckedChange={(checked) => {
                                setAracGideriIds(prev => checked ? [...prev, inv.id] : prev.filter(i => i !== inv.id));
                              }} 
                            />
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
