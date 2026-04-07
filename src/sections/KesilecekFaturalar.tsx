import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  FilePlus, 
  Search, 
  Trash2, 
  Download, 
  Upload,
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Send, 
  ShieldCheck, 
  Loader2,
  Package,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import type { KesilecekFatura, FaturaKalemi } from '@/types';
import { useUrunler } from '@/modules/stok/hooks/useStokQuery';

const KDV_ORANLARI = [0, 1, 8, 10, 18, 20];

const newKalem = (): FaturaKalemi => ({
  id: 'k' + Date.now() + Math.random().toString(36).slice(2),
  ad: '',
  miktar: 1,
  birim: 'C62',           // GIB kodu: C62 = Adet
  birimFiyat: 0,
  kdvOrani: 20,
  tevkifatOrani: 0,       // % olarak (ornek: 30 = %30 = 3/10)
  tevkifatKodu: '',       // ornek: '616'
});

// GIB Portal'daki fatura tipleriyle birebir
const FATURA_TIPI_SECENEKLERI = [
  { value: 'SATIS',             label: 'SATIŞ' },
  { value: 'IADE',              label: 'GENEL İADE' },
  { value: 'TEVKIFAT',          label: 'TEVKİFAT' },
  { value: 'TEVKIFATIADE',      label: 'TEVKİFAT İADE' },
  { value: 'ISTISNA',           label: 'İSTİSNA' },
  { value: 'OZELMATRAH',        label: 'ÖZEL MATRAH' },
  { value: 'IHRACKAYITLI',      label: 'İHRAÇ KAYITLI' },
  { value: 'KONAKLAMAVERGISI',  label: 'KONAKLAMA VERGİSİ' },
  { value: 'YTBSATIS',          label: 'YATIRIM TEŞVİK SATIŞ' },
  { value: 'YTBISTISNA',        label: 'YATIRIM TEŞVİK İSTİSNA' },
  { value: 'YTBIADE',           label: 'YATIRIM TEŞVİK İADE' },
  { value: 'YTBTEVKIFAT',       label: 'YATIRIM TEŞVİK TEVKİFAT' },
  { value: 'YTBTEVKIFATIADE',   label: 'YATIRIM TEŞVİK TEVKİFAT İADE' },
];

// GIB'in desteklediği birim kodları
const BIRIM_KODLARI = [
  { value: 'C62', label: 'Adet' },
  { value: 'HUR', label: 'Saat' },
  { value: 'DAY', label: 'Gün' },
  { value: 'MON', label: 'Ay' },
  { value: 'ANN', label: 'Yıl' },
  { value: 'PA',  label: 'Paket' },
  { value: 'BX',  label: 'Kutu' },
  { value: 'KGM', label: 'Kilogram (kg)' },
  { value: 'GRM', label: 'Gram (g)' },
  { value: 'LTR', label: 'Litre (lt)' },
  { value: 'TNE', label: 'Ton' },
  { value: 'MTR', label: 'Metre (m)' },
  { value: 'MTK', label: 'Metre Kare (m2)' },
  { value: 'MTQ', label: 'Metre Küp (m3)' },
  { value: 'SET', label: 'Set' },
];

// KDV Tevkifat oranları (%)
const TEVKIFAT_ORAN_SECENEKLERI = [
  { value: 0,  label: 'Yok' },
  { value: 20, label: '%20 (2/10)' },
  { value: 30, label: '%30 (3/10)' },
  { value: 40, label: '%40 (4/10)' },
  { value: 50, label: '%50 (5/10)' },
  { value: 70, label: '%70 (7/10)' },
  { value: 90, label: '%90 (9/10)' },
  { value: 100, label: '%100 (10/10)' },
];

// Tevkifat kodları (GIB portal formatinda)
const TEVKIFAT_KODLARI = [
  { value: '', label: '-- Kod Seçin --' },
  { value: '601', label: '601 - Yapım İşleri Mhnd-Mimarlık-Etüt' },
  { value: '602', label: '602 - Etüt, plan-proje, danışmanlık, denetim' },
  { value: '603', label: '603 - Makine, Teçhizat Tadil/Bakım/Onarım' },
  { value: '604', label: '604 - Yemek servis hizmeti' },
  { value: '605', label: '605 - Organizasyon hizmeti' },
  { value: '606', label: '606 - İşgülü temin hizmetleri' },
  { value: '607', label: '607 - Özel güvenlik hizmeti' },
  { value: '608', label: '608 - Yapı denetim hizmetleri' },
  { value: '609', label: '609 - Fason Tekstil/Konfeksiyon' },
  { value: '610', label: '610 - Turistik mağazalara verilen hizmet' },
  { value: '611', label: '611 - Spor kulüpleri yayın/reklam' },
  { value: '612', label: '612 - Temizlik Hizmeti' },
  { value: '613', label: '613 - Çevre, Bahçe ve Bakım Hizmetleri' },
  { value: '614', label: '614 - Servis taşımacılığı' },
  { value: '615', label: '615 - Her Türlü Baskı ve Basım Hizmetleri' },
  { value: '616', label: '616 - Diğer Hizmetler' },
  { value: '617', label: '617 - Hurda metalden külçe teslimleri' },
  { value: '618', label: '618 - Bakır,Çinko,Alüm. Külçe Teslimi' },
  { value: '619', label: '619 - Bakır, çinko ve alüm. ürünleri teslimi' },
  { value: '620', label: '620 - İstisnadan vaçgeçenlerin hurda teslimi' },
  { value: '621', label: '621 - Metal/plastik/lastik hurda hammadde' },
  { value: '622', label: '622 - Pamuk, tiftik, yün; post ve deri' },
  { value: '623', label: '623 - Ağaç ve orman ürünleri teslimi' },
  { value: '624', label: '624 - Yük Taşımacılığı Hizmeti' },
  { value: '625', label: '625 - Ticari Reklam Hizmetleri' },
  { value: '626', label: '626 - Diğer Teslimler' },
  { value: '627', label: '627 - Demir-Çelik Ürünleri Teslimi' },
  { value: '801', label: '801 - Yapım İşleri (800-serisi)' },
  { value: '802', label: '802 - Etüt/Plan/Proje/Danışmanlık' },
  { value: '803', label: '803 - Makine/Teçhizat Bakım/Onarım' },
  { value: '804', label: '804 - Yemek Servis Hizmeti' },
  { value: '805', label: '805 - Organizasyon Hizmeti' },
  { value: '806', label: '806 - İşgülü Temin Hizmetleri' },
  { value: '807', label: '807 - Özel Güvenlik Hizmeti' },
  { value: '808', label: '808 - Yapı Denetim Hizmetleri' },
  { value: '809', label: '809 - Fason Tekstil (800-serisi)' },
  { value: '810', label: '810 - Turistik Mağaza Müşteri Bulma' },
  { value: '811', label: '811 - Spor Kulüpleri Yayın/Reklam' },
  { value: '812', label: '812 - Temizlik Hizmeti (800-serisi)' },
  { value: '813', label: '813 - Çevre/Bahçe Bakım Hizmetleri' },
  { value: '814', label: '814 - Servis Taşımacılığı Hizmeti' },
  { value: '815', label: '815 - Baskı ve Basım Hizmetleri' },
  { value: '816', label: '816 - Hurda Metalden Külçe Teslimleri' },
  { value: '817', label: '817 - Bakır,Çinko,Alüm Külçe (800-serisi)' },
  { value: '818', label: '818 - Bakır,Çinko,Alüm Ürün Teslimi' },
  { value: '819', label: '819 - İstisnadan Vaçgeçenlerin Hurda Teslimi' },
  { value: '820', label: '820 - Metal/Plastik/Lastik Hurda' },
  { value: '821', label: '821 - Pamuk/Tiftik/Yün/Post/Deri' },
  { value: '822', label: '822 - Ağaç ve Orman Ürünleri' },
  { value: '823', label: '823 - Yük Taşımacılığı Hizmeti (800)' },
  { value: '824', label: '824 - Ticari Reklam Hizmetleri (800)' },
  { value: '825', label: '825 - Demir-Çelik Ürünleri Teslimi (800)' },
];

// Stopaj tipleri
const STOPAJ_TIPI_SECENEKLERI = [
  { value: '', label: 'Yok' },
  { value: 'V0011', label: 'KV. Stopajı (Kurumlar Vergisi)' },
  { value: 'V0003', label: 'GV. Stopajı (Gelir Vergisi)' },
];

export function KesilecekFaturalar() {
  const { 
    kesilecekFaturalar, 
    addKesilecekFatura, 
    updateKesilecekFatura, 
    deleteKesilecekFatura,
    openSatisDrawer,
    cariler
  } = useApp();
  const { data: urunler } = useUrunler();

  const [searchTerm, setSearchTerm] = useState('');
  
  // Form
  const [form, setForm] = useState({
    ad: '', soyad: '', vknTckn: '', vergiDairesi: '',
    adres: '', il: '', ilce: '', kdvOrani: '20',
    faturaTarihi: new Date().toISOString().split('T')[0],
    aciklama: '', cariId: 'none',
  });

  // Kalem listesi
  const [kalemler, setKalemler] = useState<FaturaKalemi[]>([newKalem()]);

  // GİB States
  const [isGibModalOpen, setIsGibModalOpen] = useState(false);
  const [gibCredentials, setGibCredentials] = useState({ username: '', password: '' });
  const [selectedInvoiceForGib, setSelectedInvoiceForGib] = useState<KesilecekFatura | null>(null);
  const [isGibSending, setIsGibSending] = useState(false);
  const [autoSign, setAutoSign] = useState(false);
  const [gibFaturaTipi, setGibFaturaTipi] = useState('SATIS');
  const [gibStopajTipi, setGibStopajTipi] = useState('');
  const [gibStopajOrani, setGibStopajOrani] = useState('0');

  // Kalem hesaplamaları
  const kalemToplam = useMemo(() => {
    return kalemler.reduce((sum, k) => {
      const bFiyat = Number(k.birimFiyat) || 0;
      const miktar = Number(k.miktar) || 0;
      const kOran = Number(k.kdvOrani) || 0;
      
      const matrah = bFiyat * miktar;
      const kdv = matrah * (kOran / 100);
      return { 
        matrah: sum.matrah + matrah, 
        kdv: sum.kdv + kdv, 
        toplam: sum.toplam + matrah + kdv 
      };
    }, { matrah: 0, kdv: 0, toplam: 0 });
  }, [kalemler]);

  const filteredInvoices = useMemo(() => {
    if (!kesilecekFaturalar || !Array.isArray(kesilecekFaturalar)) return [];
    return kesilecekFaturalar
      .filter(f => 
        (f.ad || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
        (f.soyad && f.soyad.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.vknTckn || "").includes(searchTerm)
      )
      .sort((a, b) => new Date(b.olusturmaTarihi || 0).getTime() - new Date(a.olusturmaTarihi || 0).getTime());
  }, [kesilecekFaturalar, searchTerm]);

  const handleCariChange = (cariId: string) => {
    if (!cariId || cariId === 'none') {
      setForm(prev => ({ ...prev, cariId: 'none', ad: '', soyad: '', vknTckn: '', vergiDairesi: '', adres: '', il: '', ilce: '' }));
      return;
    }
    const cari = cariler?.find(c => c.id === cariId);
    if (cari) {
      setForm(prev => ({ ...prev, cariId: cari.id, ad: cari.unvan, soyad: '', vknTckn: cari.vknTckn, vergiDairesi: cari.vergiDairesi || '', adres: cari.adres || '' }));
    }
  };

  // Kalem güncelleme fonksiyonları
  const addKalem = () => setKalemler(prev => [...prev, newKalem()]);
  const removeKalem = (id: string) => setKalemler(prev => prev.filter(k => k.id !== id));
  const updateKalem = (id: string, field: keyof FaturaKalemi, value: any) =>
    setKalemler(prev => prev.map(k => k.id === id ? { ...k, [field]: value } : k));

  const selectUrunForKalem = (kalemId: string, urunId: string) => {
    if (!urunId || urunId === 'none') {
      updateKalem(kalemId, 'urunId', undefined);
      return;
    }
    const urun = urunler?.find(u => u.id === urunId);
    if (urun) {
      setKalemler(prev => prev.map(k => k.id === kalemId ? {
        ...k,
        urunId: urun.id,
        ad: urun.urunAdi || '',
        birimFiyat: urun.birimFiyat || 0,
        birim: urun.anaBirim || 'ADET',
      } : k));
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ad || !form.vknTckn) {
      toast.error('Lütfen müşteri adı ve VKN/TC alanlarını doldurun.');
      return;
    }
    const kalemlerDolu = kalemler.filter(k => k.ad.trim() && k.birimFiyat > 0);
    if (kalemlerDolu.length === 0) {
      toast.error('En az bir kalem ekleyin (ad ve birim fiyat dolu olmalı).');
      return;
    }

    addKesilecekFatura({
      ad: form.ad, soyad: form.soyad, vknTckn: form.vknTckn,
      vergiDairesi: form.vergiDairesi, adres: form.adres, il: form.il, ilce: form.ilce,
      tutar: kalemToplam.toplam,
      kdvDahil: true,
      kdvOrani: parseInt(form.kdvOrani),
      faturaTarihi: form.faturaTarihi,
      aciklama: form.aciklama,
      kalemler: kalemlerDolu,
      cariId: form.cariId !== 'none' ? form.cariId : undefined,
    });

    setForm({ ad: '', soyad: '', vknTckn: '', vergiDairesi: '', adres: '', il: '', ilce: '', kdvOrani: '20', faturaTarihi: new Date().toISOString().split('T')[0], aciklama: '', cariId: 'none' });
    setKalemler([newKalem()]);
    toast.success('Fatura planı listeye eklendi.');
  };

  const downloadTemplate = () => {
    const template = [{ 'Ad (veya Firma)': 'Örnek A.Ş.', 'Soyad (Şahıs ise)': '', 'VKN / TCKN': '1234567890', 'Vergi Dairesi': 'Kadıköy', 'Adres': 'Kadıköy / İstanbul', 'İl': 'İstanbul', 'İlçe': 'Kadıköy', 'Fatura Tarihi (GG.AA.YYYY)': new Date().toLocaleDateString('tr-TR'), 'Tutar': '1500.50', 'KDV Oranı': '20', 'KDV Dahil mi? (E/H)': 'E', 'Açıklama': 'Sistem Bakım Ücreti' }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
    XLSX.writeFile(wb, 'kesilecek_fatura_sablon.xlsx');
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        data.forEach((row: any) => {
          addKesilecekFatura({
            ad: row['Ad (veya Firma)'] || '', soyad: row['Soyad (Şahıs ise)'] || '',
            vknTckn: String(row['VKN / TCKN'] || ''), vergiDairesi: row['Vergi Dairesi'] || '',
            adres: row['Adres'] || '', il: row['İl'] || '', ilce: row['İlçe'] || '',
            tutar: parseFloat(String(row['Tutar'] || '0').replace(',', '.')) || 0,
            kdvOrani: parseInt(row['KDV Oranı'] || '20') || 0,
            faturaTarihi: row['Fatura Tarihi (GG.AA.YYYY)'] || new Date().toISOString().split('T')[0],
            aciklama: row['Açıklama'] || '',
            kdvDahil: (row['KDV Dahil mi? (E/H)'] || 'E').toUpperCase() === 'E',
          });
        });
        toast.success(`${data.length} kayıt başarıyla yüklendi.`);
      } catch { toast.error('Excel okuma hatası. Lütfen şablonu kullanın.'); }
    };
    reader.readAsBinaryString(file);
  };

  const convertToRealInvoice = (f: KesilecekFatura) => {
    openSatisDrawer({ ad: f.ad, soyad: f.soyad || '', tcVkn: f.vknTckn, adres: f.adres, alinanUcret: String(f.tutar), aciklama: f.aciklama });
    updateKesilecekFatura(f.id, { durum: 'kesildi' });
  };

  const handleGibSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForGib || !gibCredentials.username || !gibCredentials.password) {
      toast.error('Lütfen tüm bilgileri girin.');
      return;
    }
    if (!selectedInvoiceForGib.vknTckn) {
      toast.error('Faturada VKN/TC bulunmuyor. Listeye eklerken VKN/TC girin.');
      return;
    }
    setIsGibSending(true);
    try {
      const apiUrl = import.meta.env.DEV ? 'http://localhost:5000/api/gib/create-draft' : '/api/gib/create-draft';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
          credentials: gibCredentials,
          invoice: {
            ...selectedInvoiceForGib,
            faturaTipi: gibFaturaTipi,
            stopajTipi: gibStopajTipi || undefined,
            stopajOrani: gibStopajOrani !== '0' ? gibStopajOrani : undefined,
          },
          autoSign,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(result.message + (result.data?.invoiceUUID ? ` (UUID: ${result.data.invoiceUUID})` : ''));
        setIsGibModalOpen(false);
        updateKesilecekFatura(selectedInvoiceForGib.id, { durum: 'kesildi' });
      } else {
        toast.error(`${result.error || 'GİB Hatası'}: ${result.message}`);
      }
    } catch {
      toast.error('Sunucuya bağlanılamadı.');
    } finally {
      setIsGibSending(false);
    }
  };

  const openGibModal = (f: KesilecekFatura) => {
    setSelectedInvoiceForGib(f);
    setGibFaturaTipi('SATIS');
    setGibStopajTipi('');
    setGibStopajOrani('0');
    setIsGibModalOpen(true);
  };
  const formatCurrency = (val: number) => {
    const safeVal = isNaN(val) || val === null || val === undefined ? 0 : val;
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(safeVal);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <FilePlus className="w-6 h-6 text-blue-600" />
            </div>
            Kesilecek Faturalar
          </h2>
          <p className="text-slate-500 mt-1">Sıraya alınmış ve toplu kesilecek faturaları yönetin</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTemplate} className="gap-2 h-10">
            <Download className="w-4 h-4" /> Şablon İndir
          </Button>
          <div className="relative">
            <input type="file" id="excel-upload" className="hidden" accept=".xlsx,.xls" onChange={handleExcelUpload} />
            <Button onClick={() => document.getElementById('excel-upload')?.click()} className="gap-2 h-10 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Upload className="w-4 h-4" /> Excel Yükle
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Kartı */}
        <Card className="lg:col-span-5 border-0 shadow-sm ring-1 ring-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Fatura Planı Ekle</CardTitle>
            <CardDescription>Müşteri bilgileri ve ürün/hizmet kalemlerini girin</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              {/* Cari seçimi */}
              <div className="space-y-2">
                <Label>Cari Karttan Seç (Opsiyonel)</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.cariId} onChange={e => handleCariChange(e.target.value)}
                >
                  <option value="none">-- Manuel Giriş --</option>
                  {cariler?.map(c => <option key={c.id} value={c.id}>{c.unvan}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Firma Ünvanı / Ad *</Label><Input value={form.ad} onChange={e => setForm({...form, ad: e.target.value})} className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">Soyad</Label><Input value={form.soyad} onChange={e => setForm({...form, soyad: e.target.value})} className="h-9" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">VKN / TCKN *</Label><Input value={form.vknTckn} onChange={e => setForm({...form, vknTckn: e.target.value})} className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">Vergi Dairesi</Label><Input value={form.vergiDairesi} onChange={e => setForm({...form, vergiDairesi: e.target.value})} className="h-9" /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Fatura Tarihi</Label><Input type="date" value={form.faturaTarihi} onChange={e => setForm({...form, faturaTarihi: e.target.value})} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs">Tam Adres</Label><Input value={form.adres} onChange={e => setForm({...form, adres: e.target.value})} className="h-9" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">İl</Label><Input value={form.il} onChange={e => setForm({...form, il: e.target.value})} className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">İlçe</Label><Input value={form.ilce} onChange={e => setForm({...form, ilce: e.target.value})} className="h-9" /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Fatura Açıklaması</Label><Textarea value={form.aciklama} onChange={e => setForm({...form, aciklama: e.target.value})} className="resize-none h-14" /></div>

              {/* Kalem Listesi */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-blue-700 flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Ürün / Hizmet Kalemleri</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addKalem} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" />Kalem Ekle</Button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {kalemler.map((k) => (
                    <div key={k.id} className="border rounded-lg p-3 bg-slate-50/50 space-y-2 relative">
                      {kalemler.length > 1 && (
                        <button type="button" onClick={() => removeKalem(k.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Stoktan seç */}
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-400 font-medium">Stoktan Seç (Opsiyonel)</Label>
                        <Select
                          value={k.urunId || 'none'}
                          onValueChange={(val) => selectUrunForKalem(k.id, val)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-white">
                            <SelectValue placeholder="Stok ürünü seç..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Manuel giriş --</SelectItem>
                            {urunler?.map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.urunAdi} ({u.stokKodu})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-400">Ürün / Hizmet Adı</Label>
                        <Input value={k.ad} onChange={e => updateKalem(k.id, 'ad', e.target.value)} className="h-8 text-sm" placeholder="Ürün veya hizmet adı" />
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-slate-400">Miktar</Label>
                          <Input type="number" min="0.01" step="0.01" value={k.miktar} onChange={e => updateKalem(k.id, 'miktar', parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-slate-400">Birim</Label>
                          <select value={k.birim} onChange={e => updateKalem(k.id, 'birim', e.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                            {BIRIM_KODLARI.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-slate-400">B.Fiyat ₺</Label>
                          <Input type="number" min="0" step="0.01" value={k.birimFiyat || ''} onChange={e => updateKalem(k.id, 'birimFiyat', parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-slate-400">KDV %</Label>
                          <select value={k.kdvOrani} onChange={e => updateKalem(k.id, 'kdvOrani', parseInt(e.target.value))} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                            {KDV_ORANLARI.map(o => <option key={o} value={o}>%{o}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* KDV Tevkifatı - çift seçici */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-amber-700 font-medium">KDV Tevkifat Oranı</Label>
                          <select
                            value={k.tevkifatOrani}
                            onChange={e => updateKalem(k.id, 'tevkifatOrani', parseInt(e.target.value))}
                            className="h-8 w-full rounded-md border border-amber-100 bg-background px-2 text-xs"
                          >
                            {TEVKIFAT_ORAN_SECENEKLERI.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-amber-700 font-medium">Tevkifat Kodu</Label>
                          <select
                            value={k.tevkifatKodu || ''}
                            onChange={e => updateKalem(k.id, 'tevkifatKodu', e.target.value)}
                            className="h-8 w-full rounded-md border border-amber-100 bg-background px-2 text-xs"
                            disabled={!k.tevkifatOrani}
                          >
                            {TEVKIFAT_KODLARI.map(kod => (
                              <option key={kod.value} value={kod.value}>{kod.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="text-right text-xs text-slate-500">
                        Matrah: <span className="font-bold text-slate-700">{formatCurrency(k.birimFiyat * k.miktar)}</span>
                        {' · '}KDV: <span className="font-bold text-emerald-700">{formatCurrency((k.birimFiyat * k.miktar) * (k.kdvOrani / 100))}</span>
                        {k.tevkifatOrani > 0 && (
                          <span className="text-amber-600">
                            {' · '}Tevk: -{formatCurrency(
                              (k.birimFiyat * k.miktar) * (k.kdvOrani / 100) * (k.tevkifatOrani / 100)
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Toplam özeti */}
                <div className="bg-blue-50 rounded-lg p-3 text-xs flex justify-between items-center border border-blue-100">
                  <div className="space-y-0.5 text-slate-600">
                    <div>Matrah: <strong>{formatCurrency(kalemToplam.matrah)}</strong></div>
                    <div>Toplam KDV: <strong>{formatCurrency(kalemToplam.kdv)}</strong></div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 text-[10px]">GENEL TOPLAM</div>
                    <div className="text-xl font-bold text-blue-700">{formatCurrency(kalemToplam.toplam)}</div>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 gap-2 mt-2 font-semibold">
                <Plus className="w-4 h-4" /> Planla ve Listeye Ekle
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Liste Kartı */}
        <Card className="lg:col-span-7 border-0 shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <CardHeader className="bg-slate-50/30 border-b pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg">Bekleyen Faturalar</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Müşteri veya VKN ara..." className="pl-10 h-9 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 border-0 hover:bg-slate-50/50">
                    <TableHead className="font-semibold text-slate-600">Müşteri Detayları</TableHead>
                    <TableHead className="font-semibold text-slate-600">Kalemler</TableHead>
                    <TableHead className="font-semibold text-slate-600">Toplam</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-center">Durum</TableHead>
                    <TableHead className="text-right font-semibold text-slate-600">Aksiyon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                          <AlertCircle className="w-8 h-8 opacity-20" />
                          <p>Kayıtlı fatura planı bulunamadı.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map(f => (
                      <TableRow key={f.id} className="group border-0 border-b last:border-0 hover:bg-blue-50/30 transition-colors">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 leading-tight">{f.ad} {f.soyad}</span>
                            <span className="text-[11px] text-slate-500 font-medium">{f.vknTckn}</span>
                            {f.faturaTarihi && <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-1.5 rounded w-fit mt-0.5">{f.faturaTarihi}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {f.kalemler && f.kalemler.length > 0 ? (
                              f.kalemler.slice(0, 2).map(k => (
                                <span key={k.id} className="text-[11px] text-slate-600">
                                  {k.miktar}x {k.ad}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">{f.aciklama || 'Açıklama yok'}</span>
                            )}
                            {f.kalemler && f.kalemler.length > 2 && (
                              <span className="text-[10px] text-blue-500">+{f.kalemler.length - 2} kalem daha</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-slate-900">{formatCurrency(f.tutar)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            {f.durum === 'bekliyor' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                                <AlertCircle className="w-3 h-3" /> BEKLİYOR
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> KESİLDİ
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            {f.durum === 'bekliyor' && (
                              <>
                                <Button
                                  variant="outline" size="sm" onClick={() => openGibModal(f)}
                                  className="h-7 text-[10px] font-bold bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-600 hover:text-white hover:border-amber-600 gap-1"
                                >
                                  <ShieldCheck className="w-3 h-3" /> GİB'E GÖNDER
                                </Button>
                                <Button
                                  variant="outline" size="sm" onClick={() => convertToRealInvoice(f)}
                                  className="h-7 text-[10px] font-bold bg-white border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600"
                                >
                                  FATURA KES
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost" size="icon" onClick={() => deleteKesilecekFatura(f.id)}
                              className="w-8 h-8 text-slate-300 hover:text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GİB Modal */}
      <Dialog open={isGibModalOpen} onOpenChange={setIsGibModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              GİB e-Arşiv Fatura Gönderimi
            </DialogTitle>
            <DialogDescription>
              Faturayı GİB e-Arşiv portalına göndermek için giriş bilgilerinizi girin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGibSend} className="space-y-4 py-2">
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="gib_user">Kullanıcı Kodu / VKN</Label>
                <Input id="gib_user" value={gibCredentials.username} onChange={e => setGibCredentials({...gibCredentials, username: e.target.value})} placeholder="Kullanıcı Kodu" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="gib_pass">Şifre</Label>
                <Input id="gib_pass" type="password" value={gibCredentials.password} onChange={e => setGibCredentials({...gibCredentials, password: e.target.value})} placeholder="********" required />
              </div>
            </div>

            {selectedInvoiceForGib && (
              <div className="bg-slate-50 p-3 rounded-md border text-sm text-slate-600 space-y-1">
                <p><strong>Müşteri:</strong> {selectedInvoiceForGib.ad} {selectedInvoiceForGib.soyad}</p>
                <p><strong>VKN/TC:</strong> {selectedInvoiceForGib.vknTckn || <span className="text-red-500 font-bold">⚠️ Eksik!</span>}</p>
                <p><strong>Toplam:</strong> {formatCurrency(selectedInvoiceForGib.tutar)}</p>
                {selectedInvoiceForGib.kalemler && selectedInvoiceForGib.kalemler.length > 0 && (
                  <p><strong>Kalemler:</strong> {selectedInvoiceForGib.kalemler.length} adet ürün/hizmet kalemi</p>
                )}
              </div>
            )}

            {/* Fatura Tipi */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-semibold">Fatura Tipi</Label>
              <select
                value={gibFaturaTipi}
                onChange={e => setGibFaturaTipi(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {FATURA_TIPI_SECENEKLERI.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {gibFaturaTipi === 'TEVKIFAT' && (
                <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                  ℹ️ Tevkifatlı fatura için kalemlerdeki KDV Tevkifatı oranlarının dolu olduğundan emin olun.
                </p>
              )}
            </div>

            {/* Stopaj Türü + Oran */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-semibold">Stopaj (Varsa)</Label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={gibStopajTipi}
                  onChange={e => setGibStopajTipi(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {STOPAJ_TIPI_SECENEKLERI.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={gibStopajOrani}
                    onChange={e => setGibStopajOrani(e.target.value)}
                    placeholder="0"
                    className="h-9 w-20"
                    disabled={!gibStopajTipi}
                  />
                  <span className="text-xs text-slate-400">%</span>
                </div>
              </div>
              {gibStopajTipi && gibStopajOrani !== '0' && parseFloat(gibStopajOrani) > 0 && (
                <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-1">
                  & Matrah üzerinden %{gibStopajOrani} {gibStopajTipi === 'V0011' ? 'Kurumlar Vergisi' : 'Gelir Vergisi'} stopajı uygulanacak.
                </p>
              )}
            </div>

            {/* Taslak / Otomatik Onay Seçimi */}
            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-sm font-semibold">Gönderim Modu</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAutoSign(false)}
                  className={cn(
                    "flex-1 rounded-md border p-2 text-xs font-medium text-center transition-all",
                    !autoSign ? "bg-amber-500 border-amber-600 text-white shadow" : "bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  📄 Taslak Olarak Gönder
                  <div className={cn("text-[10px] mt-0.5", !autoSign ? "text-amber-100" : "text-slate-400")}>Portala taslak bırakır, imzalamazsınız</div>
                </button>
                <button
                  type="button"
                  onClick={() => setAutoSign(true)}
                  className={cn(
                    "flex-1 rounded-md border p-2 text-xs font-medium text-center transition-all",
                    autoSign ? "bg-emerald-600 border-emerald-700 text-white shadow" : "bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  ✅ Otomatik Onayla
                  <div className={cn("text-[10px] mt-0.5", autoSign ? "text-emerald-100" : "text-slate-400")}>Faturayı anında imzalar ve resmileştirir</div>
                </button>
              </div>
              {autoSign && (
                <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  ⚠️ Otomatik onaylama seçildi. Fatura geri alınamaz biçimde oluşturulacaktır.
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsGibModalOpen(false)} disabled={isGibSending}>İptal</Button>
              <Button
                type="submit"
                className={cn("gap-2", autoSign ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700")}
                disabled={isGibSending}
              >
                {isGibSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {autoSign ? 'Onayla ve Gönder' : 'Taslak Gönder'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
