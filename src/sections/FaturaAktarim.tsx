import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { FileSpreadsheet, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';

export function FaturaAktarim() {
  const { apiFetch, cariler } = useApp();
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
      } else {
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

  const getMuhasebeSatirlari = (fatura: any, isAracGideri: boolean = false) => {
    const satirListesi: any[] = [];
    const isAlis = fatura._type === 'ALIS';
    const isIade = isAlis ? (parseFloat(fatura.toplamTutar || 0) < 0 || (fatura.malHizmetAdi && String(fatura.malHizmetAdi).toLowerCase().includes('iade'))) : (parseFloat(fatura.alinanUcret || 0) < 0 || (fatura.aciklama && String(fatura.aciklama).toLowerCase().includes('iade')));
    
    const evrakNo = fatura.faturaNo || fatura.id.toString();
    const fTarih = formatTarih(fatura.faturaTarihi);
    const aciklama = isAlis ? `${fatura.tedarikciAdi || ''} - ${fatura.malHizmetAdi || ''}` : `${fatura.ad || ''} ${fatura.soyad || ''}`.trim();
    
    // Cari Kodu
    let cariKod = isAlis ? '320' : '120';
    if (fatura.karsiHesapKodu) {
      cariKod = fatura.karsiHesapKodu;
    } else if (fatura.cariId) {
      const matchedCari = cariler.find(c => c.id === fatura.cariId);
      if (matchedCari && matchedCari.muhasebeKodu) {
        cariKod = matchedCari.muhasebeKodu;
      }
    }
    
    // Matrah Hesabı
    let gelirGiderKod = isAlis ? (isIade ? '600' : '153') : (isIade ? '610' : '600');
    if (fatura.muhasebeKodu) {
      gelirGiderKod = fatura.muhasebeKodu;
    }
    
    // KDV Hesabı
    const kdvOrani = (fatura.kdvOrani || 20).toString();
    let kdvKodu = '';
    if (settings) {
      if (isAlis) {
        kdvKodu = isIade ? settings.alis_iade?.[kdvOrani] : settings.alis?.[kdvOrani];
      } else {
        kdvKodu = isIade ? settings.satis_iade?.[kdvOrani] : settings.satis?.[kdvOrani];
      }
    }
    if (!kdvKodu) kdvKodu = isAlis ? (isIade ? '391' : '191') : (isIade ? '191' : '391');

    // Meblağlar
    const matrah = parseFloat(fatura.matrah) || 0;
    const kdvTutar = parseFloat(fatura.kdvTutari) || 0;
    const oivTutar = isAlis ? (parseFloat(fatura.oivTutari) || 0) : 0;
    const toplam = isAlis ? (parseFloat(fatura.toplamTutar) || 0) : (parseFloat(fatura.alinanUcret) || 0);
    
    // KKEG / Araç Gider Kısıtlaması %70-%30
    let giderMatrah = matrah;
    let giderKdv = kdvTutar;
    let kkegMatrah = 0;
    let kkegKdv = 0;
    
    if (isAracGideri && isAlis && !isIade) {
      giderMatrah = Number((matrah * 0.70).toFixed(2));
      kkegMatrah = Number((matrah * 0.30).toFixed(2));
      giderKdv = Number((kdvTutar * 0.70).toFixed(2));
      kkegKdv = Number((kdvTutar * 0.30).toFixed(2));
    }

    const createRow = (hesap: string, borc: number, alacak: number, detay: string) => ({
        'Fiş No': '',
        'Fiş Tarihi': fTarih,
        'Fiş Açıklama': isAlis ? 'Alış Faturası' : 'Satış Faturası',
        'Hesap Kodu': hesap,
        'Evrak No': evrakNo,
        'Evrak Tarihi': fTarih,
        'Detay Açıklama': detay,
        'Borç': Number(borc.toFixed(2)),
        'Alacak': Number(alacak.toFixed(2)),
        'Miktar': '',
        'Belge Türü': 'FT',
        'Para Birimi': '',
        'Kur': '',
        'Döviz Tutar': ''
    });

    if (isAlis) {
        if (!isIade) {
            satirListesi.push(createRow(gelirGiderKod, giderMatrah, 0, aciklama));
            if (kkegMatrah > 0) satirListesi.push(createRow(settings?.aracGiderKkegKodu || '689.02', kkegMatrah, 0, aciklama + ' (%30 KKEG Matrah)'));
            
            if (giderKdv > 0) satirListesi.push(createRow(kdvKodu, giderKdv, 0, aciklama));
            if (kkegKdv > 0) satirListesi.push(createRow(settings?.aracGiderKkegKodu || '689.02', kkegKdv, 0, aciklama + ' (%30 KKEG KDV)'));
            
            if (oivTutar > 0) satirListesi.push(createRow(settings?.oivKodu || '689.01', oivTutar, 0, aciklama + ' (ÖİV)'));
            
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
            satirListesi.push(createRow(gelirGiderKod, 0, matrah, aciklama));
            satirListesi.push(createRow(kdvKodu, 0, kdvTutar, aciklama));
        } else {
            satirListesi.push(createRow(gelirGiderKod, matrah, 0, aciklama));
            satirListesi.push(createRow(kdvKodu, kdvTutar, 0, aciklama));
            satirListesi.push(createRow(cariKod, 0, toplam, aciklama));
        }
    }
    return satirListesi;
  };

  const handleExcelExport = () => {
    if (!settings) return toast.error('KDV Ayarları bulunamadı. Lütfen ayarları yapın.');
    if (selectedIds.length === 0) return toast.error('Lütfen fatura seçin.');

    let exportData: any[] = [];
    const selectedInvoices = invoices.filter(inv => selectedIds.includes(inv.id));
    
    selectedInvoices.forEach(inv => {
      exportData = [...exportData, ...getMuhasebeSatirlari(inv, aracGideriIds.includes(inv.id))];
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Faturalar_Luca');
    XLSX.writeFile(wb, `Faturalar_Luca_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Luca Excel dosyası başarıyla indirildi.');
  };

  const handleExtensionExport = () => {
    if (!settings) return toast.error('KDV Ayarları bulunamadı. Lütfen ayarları yapın.');
    if (selectedIds.length === 0) return toast.error('Lütfen fatura seçin.');

    let exportData: any[] = [];
    const selectedInvoices = invoices.filter(inv => selectedIds.includes(inv.id));
    
    selectedInvoices.forEach(inv => {
      const excelRows = getMuhasebeSatirlari(inv, aracGideriIds.includes(inv.id));
      // Excel satırlarını eklenti formatına çevir
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

    window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SEND_MAHSUP', {
        detail: exportData
    }));
    toast.success(`${selectedInvoices.length} fatura Eklenti hafızasına (Mahsup Fişi olarak) gönderildi!`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bilanço Fatura Aktarım</h1>
          <p className="text-slate-500">Faturaları Bilanço muhasebesi kurallarına göre (Mahsup Fişi) Luca'ya aktarın.</p>
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
              <label className="text-xs text-slate-500">Türü</label>
              <select 
                className="w-32 h-9 border border-slate-200 rounded-md text-sm px-2 outline-none"
                value={filterType}
                onChange={e => setFilterType(e.target.value as any)}
              >
                <option value="ALL">Tümü</option>
                <option value="ALIS">Alış</option>
                <option value="SATIS">Satış</option>
              </select>
            </div>
            <Button onClick={fetchInvoices} disabled={loading} className="gap-2 h-9">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Faturaları Getir
            </Button>
            <div className="flex-1"></div>
            <Button onClick={handleExcelExport} variant="outline" className="gap-2 h-9 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100">
              <FileSpreadsheet className="w-4 h-4" />
              Excel (Luca) İndir
            </Button>
            <Button onClick={handleExtensionExport} className="gap-2 h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Send className="w-4 h-4" />
              Eklentiye Gönder
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[50px] text-center">
                    <Checkbox checked={selectedIds.length === filteredInvoices.length && filteredInvoices.length > 0} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Fatura No</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Unvan / İsim</TableHead>
                  <TableHead className="text-right">Matrah</TableHead>
                  <TableHead className="text-right">KDV</TableHead>
                  <TableHead className="text-center w-[90px]">Araç Gideri</TableHead>
                  <TableHead className="text-right">Toplam</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center h-32 text-slate-400">Gösterilecek fatura bulunamadı. Lütfen tarih filtrelerini seçip "Faturaları Getir" butonuna basın.</TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-center">
                        <Checkbox checked={selectedIds.includes(inv.id)} onCheckedChange={() => toggleSelection(inv.id)} />
                      </TableCell>
                      <TableCell>{formatTarih(inv.faturaTarihi)}</TableCell>
                      <TableCell className="font-mono text-xs">{inv.faturaNo}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${inv._type === 'ALIS' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                          {inv._type}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={inv._type === 'ALIS' ? inv.tedarikciAdi : `${inv.ad || ''} ${inv.soyad || ''}`.trim()}>
                        {inv._type === 'ALIS' ? inv.tedarikciAdi : `${inv.ad || ''} ${inv.soyad || ''}`.trim()}
                      </TableCell>
                      <TableCell className="text-right">{(parseFloat(inv.matrah) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</TableCell>
                      <TableCell className="text-right">{(parseFloat(inv.kdvTutari) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</TableCell>
                      <TableCell className="text-center">
                        {inv._type === 'ALIS' && (
                          <Checkbox 
                            checked={aracGideriIds.includes(inv.id)} 
                            onCheckedChange={(checked) => {
                              if (checked) setAracGideriIds(prev => [...prev, inv.id]);
                              else setAracGideriIds(prev => prev.filter(id => id !== inv.id));
                            }} 
                            title="Araç Gideri Kısıtlaması (%70 Gider, %30 KKEG)"
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{(inv._type === 'ALIS' ? (parseFloat(inv.toplamTutar) || 0) : (parseFloat(inv.alinanUcret) || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
