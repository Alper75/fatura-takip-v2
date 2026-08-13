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
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  FileSpreadsheet,
  Search, 
  Trash2, 
  Landmark, 
  ArrowUpRight, 
  ArrowDownLeft,
  FilterX,
  Pencil,
  Tag,
  ExternalLink,
  Plus,
  Zap,
  Receipt,
  Users
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CariHareket } from '@/types';
import { LucaAccountSelect } from '@/components/LucaAccountSelect';

const SYSTEM_CATEGORIES = [
  { id: 'genel_gider', ad: 'Genel Gider' },
  { id: 'kira_odemesi', ad: 'Kira Ödemesi' },
  { id: 'maas_odemesi', ad: 'Maaş Ödemesi' },
  { id: 'ssk_odemesi', ad: 'SSK/Bağkur Ödemesi' },
  { id: 'vergi_kdv', ad: 'KDV Ödemesi' },
  { id: 'banka_masrafi', ad: 'Banka Masrafı' }
];

export function BankaEkstreListesi() {
  const { 
    cariHareketler, 
    bankaHesaplari, 
    cariler, 
    deleteCariHareket, 
    updateCariHareket,
    addCariHareket,
    giderKategorileri,
    masrafKurallari,
    addMasrafKurali,
    deleteMasrafKurali,
    addGiderKategorisi,
    updateGiderKategorisi,
    deleteGiderKategorisi,
    lucaAccounts
  } = useApp();
  
  // Ekstre Filtre State'leri
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBanka, setSelectedBanka] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [selectedKategori, setSelectedKategori] = useState<string>('all');

  // Düzenleme State'leri
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CariHareket>>({});

  // Toplu İşlem State'i
  const [selectedHareketIds, setSelectedHareketIds] = useState<string[]>([]);

  // Masraf Form State
  const [giderForm, setGiderForm] = useState({
    tarih: new Date().toISOString().split('T')[0],
    tutar: '',
    aciklama: '',
    islemTuru: 'genel_gider',
    kategoriId: '',
    bankaId: '',
    muhasebeKodu: '',
    dovizTuru: 'TRY',
    dovizTutar: '',
    dovizKuru: ''
  });

  // Kural Form State
  const [kuralForm, setKuralForm] = useState({
    anahtarKelime: '',
    islemTuru: 'genel_gider',
    aciklama: '',
    kategoriId: '',
    muhasebeKodu: ''
  });

  // Kategori Yönetim Modali
  const [isCategoryManageOpen, setIsCategoryManageOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatLuca, setNewCatLuca] = useState('');
  const [newCatTip, setNewCatTip] = useState<'GIDER'|'GELIR'>('GIDER');

  // Sadece banka işlemi olanları (bankaId olanlar) veya tüm işlemleri filtrele
  // Kullanıcı tüm masrafların ekstrede görülmesini istiyor.
  const filteredHareketler = useMemo(() => {
    const parseDateString = (dateStr: string) => {
      if (!dateStr) return 0;
      if (dateStr.includes('.')) {
        const [datePart, timePart] = dateStr.split(' ');
        const [day, month, year] = datePart.split('.');
        const [hour, minute] = timePart ? timePart.split(':') : ['00', '00'];
        return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)).getTime();
      }
      return new Date(dateStr).getTime() || 0;
    };

    return cariHareketler
      .filter(h => h.bankaId !== null && h.bankaId !== undefined)
      .filter(h => {
        const matchesSearch = (h.aciklama || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBanka = selectedBanka === 'all' || h.bankaId === selectedBanka;
        
        const hTime = parseDateString(h.tarih);
        const matchesStartDate = !startDate || hTime >= new Date(startDate).getTime();
        // Bitiş tarihi için o günün sonuna kadar olanları dahil et (23:59:59)
        const matchesEndDate = !endDate || hTime <= new Date(endDate + 'T23:59:59').getTime();
        
        const amount = h.tutar;
        const matchesMinVal = !minAmount || amount >= parseFloat(minAmount);
        const matchesMaxVal = !maxAmount || amount <= parseFloat(maxAmount);
        
        const matchesKategori = selectedKategori === 'all' || 
                                (selectedKategori === 'none' ? !h.kategoriId : h.kategoriId === selectedKategori);

        return matchesSearch && matchesBanka && matchesStartDate && matchesEndDate && matchesMinVal && matchesMaxVal && matchesKategori;
      })
      .sort((a, b) => {
        const timeDiff = parseDateString(b.tarih) - parseDateString(a.tarih);
        if (timeDiff === 0) {
          return new Date(b.olusturmaTarihi || 0).getTime() - new Date(a.olusturmaTarihi || 0).getTime();
        }
        return timeDiff;
      });
  }, [cariHareketler, searchTerm, selectedBanka, startDate, endDate, minAmount, maxAmount, selectedKategori]);

  const exportToExcel = () => {
    const exportData = filteredHareketler.map(h => {
      const banka = bankaHesaplari.find(b => b.id === h.bankaId);
      const cari = cariler.find(c => c.id === h.cariId);
      const kategori = h.kategoriId ? giderKategorileri.find(k => k.id === h.kategoriId) : null;
      return {
        'Tarih': h.tarih,
        'Banka': banka?.hesapAdi || 'Bilinmiyor',
        'Açıklama': h.aciklama,
        'Cari': cari?.unvan || 'Diğer',
        'Kategori': kategori?.ad || h.islemTuru,
        'Luca Kodu': h.muhasebeKodu || '',
        'Tutar': h.tutar,
        'Yön': (h.islemTuru === 'tahsilat' || h.islemTuru === 'satis_faturasi' || (h.islemTuru === 'transfer' && h.aciklama.includes('GELEN'))) ? 'GİRİŞ' : 'ÇIKIŞ'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Banka Ekstresi');
    XLSX.writeFile(wb, `Banka_Ekstre_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel dosyası indiriliyor...');
  };

  const formatDateForLuca = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('.')) {
      const [datePart] = dateStr.split(' ');
      const [day, month, year] = datePart.split('.');
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const exportToLucaExcel = () => {
    if (selectedHareketIds.length === 0) {
      toast.error('Lütfen aktarılacak işlemleri seçin.');
      return;
    }

    const selected = filteredHareketler.filter(h => selectedHareketIds.includes(h.id));
    const exportData: any[] = [];

    selected.forEach(h => {
      const banka = bankaHesaplari.find(b => b.id === h.bankaId);
      const isGiris = (h.islemTuru === 'tahsilat' || h.islemTuru === 'satis_faturasi' || h.islemTuru === 'diger_gelir' || (h.islemTuru === 'transfer' && (h.aciklama || '').toUpperCase().includes('GELEN')));
      
      const formattedDate = formatDateForLuca(h.tarih);
      const evrakNo = Math.floor(10000000000 + Math.random() * 90000000000).toString();

      // Satır 1 (Banka Bacağı)
      exportData.push({
        'Fiş No': '',
        'Fiş Tarihi': formattedDate,
        'Fiş Açıklama': 'Banka',
        'Hesap Kodu': banka?.muhasebeKodu || '',
        'Evrak No': evrakNo,
        'Evrak Tarihi': formattedDate,
        'Detay Açıklama': h.aciklama,
        'Borç': isGiris ? h.tutar : 0,
        'Alacak': !isGiris ? h.tutar : 0,
        'Miktar': '',
        'Belge Türü': 'BA',
        'Para Birimi': '',
        'Kur': '',
        'Döviz Tutar': ''
      });

      // Satır 2 (Karşı Bacak)
      exportData.push({
        'Fiş No': '',
        'Fiş Tarihi': formattedDate,
        'Fiş Açıklama': 'Banka',
        'Hesap Kodu': h.muhasebeKodu || '',
        'Evrak No': evrakNo,
        'Evrak Tarihi': formattedDate,
        'Detay Açıklama': h.aciklama,
        'Borç': !isGiris ? h.tutar : 0,
        'Alacak': isGiris ? h.tutar : 0,
        'Miktar': '',
        'Belge Türü': 'BA',
        'Para Birimi': '',
        'Kur': '',
        'Döviz Tutar': ''
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Banka_Luca_Aktarim');
    XLSX.writeFile(wb, `Banka_Luca_Aktarim_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Luca Excel dosyası başarıyla indirildi.');
  };

  const formatCurrency = (val: number, currencyCode: string = 'TRY') => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currencyCode }).format(val);

  const toggleSelection = (id: string) => {
    setSelectedHareketIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedHareketIds.length === filteredHareketler.length) {
      setSelectedHareketIds([]);
    } else {
      setSelectedHareketIds(filteredHareketler.map(h => h.id));
    }
  };

  const handleBulkDelete = async () => {
    for (const id of selectedHareketIds) {
      deleteCariHareket(id);
    }
    toast.success(`${selectedHareketIds.length} hareket başarıyla silindi.`);
    setSelectedHareketIds([]);
  };

  const handleBulkSendToLuca = () => {
    const selected = filteredHareketler.filter(h => selectedHareketIds.includes(h.id));
    const payload = selected.flatMap(h => {
      const banka = bankaHesaplari.find(b => b.id === h.bankaId);
      const cari = cariler.find(c => c.id === h.cariId);
      const isGiris = (h.islemTuru === 'tahsilat' || h.islemTuru === 'satis_faturasi' || h.islemTuru === 'diger_gelir' ||
        (h.islemTuru === 'transfer' && (h.aciklama || '').toUpperCase().includes('GELEN')));
      
      const formattedTarih = formatDateForLuca(h.tarih);
      const evrakNo = Math.floor(1000 + Math.random() * 9000).toString();
      
      return [
        {
          // 1. Cari / Karşı Hesap Satırı
          tarih: formattedTarih,
          evrakNo: evrakNo,
          aciklama: h.aciklama,
          tutar: h.tutar,
          tur: isGiris ? 'alacak' : 'borc',
          islemTuru: h.islemTuru,
          banka: banka?.hesapAdi || '',
          cari: cari?.unvan || '',
          muhasebeKodu: (h as any).muhasebeKodu || '',
          dovizTuru: h.dovizTuru,
          dovizTutar: h.dovizTutar,
          dovizKuru: h.dovizKuru
        },
        {
          // 2. Banka Satırı (Ters Kayıt)
          tarih: formattedTarih,
          evrakNo: evrakNo,
          aciklama: h.aciklama,
          tutar: h.tutar,
          tur: isGiris ? 'borc' : 'alacak',
          islemTuru: h.islemTuru,
          banka: banka?.hesapAdi || '',
          cari: cari?.unvan || '',
          muhasebeKodu: banka?.muhasebeKodu || '',
          dovizTuru: h.dovizTuru,
          dovizTutar: h.dovizTutar,
          dovizKuru: h.dovizKuru
        }
      ];
    });
    window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SEND_BANKA_HAREKETLERI', {
      detail: { hareketler: payload }
    }));
    toast.success(`${selected.length} hareket (${payload.length} satır) Luca'ya gönderildi.`, {
      description: 'Luca eklentisi yüklü ve aktifse işlem tamamlanacaktır.'
    });
  };

  const [isFetchingKur, setIsFetchingKur] = useState(false);
  const fetchTcmbKur = async (tarih: string, targetCurrency: string) => {
    setIsFetchingKur(true);
    try {
      const res = await fetch(`/api/kur?date=${tarih}`);
      const data = await res.json();
      if (data.success && data.rates && data.rates[targetCurrency]) {
        const kur = data.rates[targetCurrency].ForexBuying;
        setGiderForm(prev => {
           const yTutar = prev.dovizTutar ? (parseFloat(prev.dovizTutar) * kur).toFixed(2) : prev.tutar;
           return { ...prev, dovizKuru: kur.toString(), tutar: yTutar };
        });
        toast.success(`TCMB Kuru Çekildi: ${kur} (${data.date})`);
      } else {
        toast.error('Belirtilen tarihe ait kur bulunamadı.');
      }
    } catch (e) {
      toast.error('Kur çekilirken hata oluştu.');
    } finally {
      setIsFetchingKur(false);
    }
  };

  const handleGiderEkle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!giderForm.tutar || !giderForm.aciklama || !giderForm.bankaId) {
      toast.error('Lütfen tüm alanları doldurun.');
      return;
    }

    addCariHareket({
      cariId: '', // Genel gider olduğu için cari boş
      tarih: giderForm.tarih,
      tutar: parseFloat(giderForm.tutar),
      aciklama: giderForm.aciklama,
      islemTuru: giderForm.islemTuru as any,
      kategoriId: giderForm.kategoriId || null,
      bankaId: giderForm.bankaId,
      muhasebeKodu: giderForm.muhasebeKodu,
      dekontDosya: null,
      dovizTuru: giderForm.dovizTuru as any,
      dovizTutar: giderForm.dovizTutar ? parseFloat(giderForm.dovizTutar) : undefined,
      dovizKuru: giderForm.dovizKuru ? parseFloat(giderForm.dovizKuru) : undefined
    });

    setGiderForm({
      ...giderForm,
      tutar: '',
      aciklama: '',
      muhasebeKodu: '',
      dovizTutar: '',
      dovizKuru: ''
    });
    toast.success('Masraf başarıyla eklendi ve ekstreye işlendi.');
  };

  const handleKuralEkle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kuralForm.anahtarKelime) {
      toast.error('Lütfen anahtar kelime girin.');
      return;
    }

    addMasrafKurali({
      anahtarKelime: kuralForm.anahtarKelime,
      islemTuru: kuralForm.islemTuru as any,
      aciklama: kuralForm.aciklama,
      kategoriId: kuralForm.kategoriId || undefined,
      muhasebeKodu: kuralForm.muhasebeKodu || undefined
    });

    setKuralForm({
      anahtarKelime: '',
      islemTuru: 'genel_gider',
      aciklama: '',
      kategoriId: '',
      muhasebeKodu: ''
    });
    toast.success('Masraf kuralı eklendi.');
  };

  const handleGecmiseUygula = (kural: any) => {
    let count = 0;
    const keyword = (kural.anahtarKelime || '').toLocaleUpperCase('tr-TR');
    if (!keyword) return;

    for (const h of cariHareketler) {
      if (!h.aciklama) continue;
      
      if (h.aciklama.toLocaleUpperCase('tr-TR').includes(keyword)) {
        const updates: Partial<CariHareket> = {};
        let needsUpdate = false;
        
        if (h.islemTuru !== kural.islemTuru) {
           let targetIslemTuru = kural.islemTuru;
           if (kural.kategoriId) {
             const cat = giderKategorileri.find(c => c.id === kural.kategoriId);
             if (cat?.tip === 'GELIR' && targetIslemTuru === 'genel_gider') {
               targetIslemTuru = 'diger_gelir';
             }
           }
           updates.islemTuru = targetIslemTuru;
           needsUpdate = true;
        }
        
        // Akıllı kural (masraf kuralı) uygulandığında, daha önce atanmış bir cari varsa temizle
        if (h.cariId && h.cariId !== 'sistem') {
           updates.cariId = 'sistem';
           needsUpdate = true;
        }

        if (kural.kategoriId && h.kategoriId !== kural.kategoriId) {
           updates.kategoriId = kural.kategoriId;
           needsUpdate = true;
           
           // Eğer kuralın kendi muhasebe kodu yoksa, kategorinin kodunu al
           if (!kural.muhasebeKodu) {
             const cat = giderKategorileri.find(k => k.id === kural.kategoriId);
             if (cat?.muhasebeKodu && h.muhasebeKodu !== cat.muhasebeKodu) {
               updates.muhasebeKodu = cat.muhasebeKodu;
             }
           }
        }
        
        if (kural.muhasebeKodu && h.muhasebeKodu !== kural.muhasebeKodu) {
           updates.muhasebeKodu = kural.muhasebeKodu;
           needsUpdate = true;
        }
        
        if (needsUpdate) {
           updateCariHareket(h.id, updates);
           count++;
        }
      }
    }
    toast.success(`Kural ${count} adet geçmiş harekete uygulandı.`);
  };

  const handleTransferleriBul = () => {
    let count = 0;
    for (const h of cariHareketler) {
      if (!h.aciklama) continue;
      
      const aciklamaUpper = h.aciklama.toLocaleUpperCase('tr-TR');
      const aciklamaUpperNoSpace = aciklamaUpper.replace(/\s+/g, '');
      let matchedBank = null;
      
      for (const banka of bankaHesaplari) {
        if (!banka.muhasebeKodu || banka.id === h.bankaId) continue;
        const cleanIban = banka.iban ? banka.iban.replace(/\s+/g, '').toLocaleUpperCase('tr-TR') : '';
        if (cleanIban && cleanIban.length > 5 && aciklamaUpperNoSpace.includes(cleanIban)) {
          matchedBank = banka;
          break;
        }
      }

      if (!matchedBank) {
        for (const banka of bankaHesaplari) {
          if (!banka.muhasebeKodu || banka.id === h.bankaId) continue;
          const cleanHesapNo = banka.hesapNo ? banka.hesapNo.replace(/\s+/g, '').toLocaleUpperCase('tr-TR') : '';
          if (cleanHesapNo && cleanHesapNo.length > 4 && aciklamaUpperNoSpace.includes(cleanHesapNo)) {
            matchedBank = banka;
            break;
          }
        }
      }
      
      if (matchedBank && h.muhasebeKodu !== matchedBank.muhasebeKodu) {
        updateCariHareket(h.id, { muhasebeKodu: matchedBank.muhasebeKodu });
        count++;
      }
    }
    toast.success(`${count} adet transfere otomatik Luca kodu atandı.`);
  };

  const handleCarileriBul = () => {
    let cariCount = 0;
    let lucaCount = 0;
    for (const h of cariHareketler) {
      if (!h.aciklama) continue;
      
      const aciklamaUpper = h.aciklama.toLocaleUpperCase('tr-TR');
      let matchedCari = null;
      
      for (const cari of cariler) {
        if (!cari.unvan) continue;
        const unvanUpper = cari.unvan.toLocaleUpperCase('tr-TR');
        
        // Unvan çok kısaysa hatalı eşleşmeyi önle
        if (unvanUpper.length > 3 && aciklamaUpper.includes(unvanUpper)) {
          matchedCari = cari;
          break;
        }
      }
      
      if (matchedCari) {
        if (h.cariId !== matchedCari.id) {
          // Cari atandığında, daha önceki kategori/genel_gider atamasını temizleyip cari hareketi (ödeme/tahsilat) yapıyoruz
          const isGiden = h.islemTuru === 'genel_gider' || h.islemTuru === 'odeme' || h.islemTuru === 'banka_masrafi';
          
          updateCariHareket(h.id, { 
            cariId: matchedCari.id,
            kategoriId: null, // Cariye gittiği için kategoriyi temizle
            islemTuru: isGiden ? 'odeme' : 'tahsilat'
          });
          cariCount++;
        }
      } else {
        let matchedLuca = null;
        for (const hesap of lucaAccounts) {
          if (!hesap.ad) continue;
          const hesapAdUpper = hesap.ad.toLocaleUpperCase('tr-TR');
          if (hesapAdUpper.length > 3 && aciklamaUpper.includes(hesapAdUpper)) {
            matchedLuca = hesap;
            break;
          }
        }
        
        if (matchedLuca && h.muhasebeKodu !== matchedLuca.kod) {
          updateCariHareket(h.id, {
            muhasebeKodu: matchedLuca.kod
          });
          lucaCount++;
        }
      }
    }
    toast.success(`${cariCount} Cariye, ${lucaCount} Luca Hesabına otomatik eşleşme yapıldı.`);
  };

  return (
    <div className="space-y-6">
      <style>{`
        .bluca-checkbox-injected, 
        [class*="bluca-checkbox"],
        [class*="bluca-button"],
        #bluca-floating-button {
          display: none !important;
        }
      `}</style>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
            Banka ve Masraf Ekstresi
          </h2>
          <p className="text-slate-500 mt-1">Banka hareketlerinizi ve masraflarınızı tek bir yerden yönetin.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="gap-2 border-slate-200 hover:bg-slate-50 text-slate-700"
            onClick={() => setIsCategoryManageOpen(true)}
          >
            <Tag className="w-4 h-4 text-rose-500" />
            Kategorileri Yönet
          </Button>
          <Button onClick={exportToLucaExcel} variant="outline" className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <FileSpreadsheet className="w-4 h-4" />
            Luca Excel İndir
          </Button>
          <Button onClick={exportToExcel} variant="outline" className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <FileSpreadsheet className="w-4 h-4" />
            Normal Excel İndir
          </Button>
        </div>
      </div>

      <Tabs defaultValue="ekstre" className="w-full">
        <TabsList className="grid w-full md:w-[600px] grid-cols-3">
          <TabsTrigger value="ekstre" className="gap-2">
            <Landmark className="w-4 h-4" /> Tüm Hareketler
          </TabsTrigger>
          <TabsTrigger value="yeni-masraf" className="gap-2">
            <Receipt className="w-4 h-4" /> Yeni Masraf Ekle
          </TabsTrigger>
          <TabsTrigger value="kurallar" className="gap-2">
            <Zap className="w-4 h-4" /> Akıllı Kurallar
          </TabsTrigger>
        </TabsList>

        {/* ======================= EKSTRE SEKME ======================= */}
        <TabsContent value="ekstre" className="space-y-4 mt-6">
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800">Hareket Listesi</h3>
                  <p className="text-xs text-slate-500">Bankalardan gelen veya manuel eklenen işlemleriniz.</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleCarileriBul}
                    className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs h-8"
                  >
                    <Users className="w-3.5 h-3.5" /> Carileri Eşleştir
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleTransferleriBul}
                    className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs h-8"
                  >
                    <Zap className="w-3.5 h-3.5" /> Transferleri Eşleştir
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Açıklamalarda ara..." 
                    className="pl-10 h-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="w-full md:w-52">
                  <Select value={selectedBanka} onValueChange={setSelectedBanka}>
                    <SelectTrigger className="h-10">
                      <div className="flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-slate-400" />
                        <SelectValue placeholder="Banka Filtrele" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Bankalar</SelectItem>
                      {bankaHesaplari.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.hesapAdi}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-full md:w-48">
                  <Select value={selectedKategori} onValueChange={setSelectedKategori}>
                    <SelectTrigger className="h-10">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-slate-400" />
                        <SelectValue placeholder="Kategori" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Kategoriler</SelectItem>
                      <SelectItem value="none">Kategorisiz</SelectItem>
                      {giderKategorileri.map(k => (
                        <SelectItem key={k.id} value={k.id}>{k.ad}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Tarih Filtreleri */}
                <div className="flex items-center gap-2">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 h-10" />
                  <span className="text-slate-400">-</span>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 h-10" />
                </div>

                {/* Tutar Filtreleri */}
                <div className="flex items-center gap-2">
                  <Input type="number" placeholder="Min ₺" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="w-24 h-10" />
                  <Input type="number" placeholder="Max ₺" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="w-24 h-10" />
                </div>

                {(searchTerm || selectedBanka !== 'all' || startDate || endDate || minAmount || maxAmount || selectedKategori !== 'all') && (
                  <Button variant="ghost" onClick={() => { 
                    setSearchTerm(''); 
                    setSelectedBanka('all'); 
                    setSelectedKategori('all');
                    setStartDate('');
                    setEndDate('');
                    setMinAmount('');
                    setMaxAmount('');
                  }} className="text-slate-500 h-10">
                    <FilterX className="w-4 h-4 mr-2" /> Sıfırla
                  </Button>
                )}
              </div>
            </CardHeader>
            
            {selectedHareketIds.length > 0 && (
              <div className="flex items-center justify-between bg-indigo-50/80 p-3 px-4 border-b border-indigo-100">
                <span className="text-sm font-medium text-indigo-900">{selectedHareketIds.length} hareket seçildi</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                    onClick={handleBulkSendToLuca}
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Luca'ya Gönder
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="gap-2 h-8">
                        <Trash2 className="w-3.5 h-3.5" /> Seçilenleri Sil
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Seçili Hareketleri Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                          Seçilen {selectedHareketIds.length} hareket kalıcı olarak silinecek ve banka bakiyeleri güncellenecektir. Bu işlem geri alınamaz. Emin misiniz?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
                          Evet, Sil
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-slate-50/50">
                      <TableHead className="w-12 text-center align-middle">
                        <div className="flex justify-center items-center h-full">
                          <Checkbox 
                            checked={filteredHareketler.length > 0 && selectedHareketIds.length === filteredHareketler.length}
                            onCheckedChange={toggleAll}
                            className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                          />
                        </div>
                      </TableHead>
                      <TableHead className="w-32">Tarih</TableHead>
                      <TableHead>Banka</TableHead>
                      <TableHead className="min-w-[200px]">Açıklama</TableHead>
                      <TableHead>Cari / Kategori</TableHead>
                      <TableHead className="w-[180px]">Luca Kodu</TableHead>
                      <TableHead className="text-right">Tutar</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHareketler.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-slate-400">
                          Hareket bulunamadı.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHareketler.map((h) => {
                        const banka = bankaHesaplari.find(b => b.id === h.bankaId);
                        const cari = cariler.find(c => c.id === h.cariId);
                        const kategori = h.kategoriId ? giderKategorileri.find(k => k.id === h.kategoriId) : null;
                        const isGiris = (h.islemTuru === 'tahsilat' || h.islemTuru === 'satis_faturasi' || h.islemTuru === 'diger_gelir' || (h.islemTuru === 'transfer' && (h.aciklama || '').toUpperCase().includes('GELEN')));

                        return (
                          <TableRow
                            key={h.id}
                            className={cn("group transition-colors", selectedHareketIds.includes(h.id) ? "bg-indigo-50/30" : "")}
                            data-luca-tarih={h.tarih}
                            data-luca-aciklama={h.aciklama || ''}
                            data-luca-tutar={h.tutar}
                            data-luca-tur={isGiris ? 'alacak' : 'borc'}
                            data-luca-islem-turu={h.islemTuru || ''}
                            data-luca-banka={banka?.hesapAdi || ''}
                            data-luca-cari={cari?.unvan || ''}
                            data-luca-cari-vkn={cari?.vknTckn || ''}
                          >
                            <TableCell className="text-center align-middle">
                              <div className="flex justify-center items-center h-full">
                                <Checkbox 
                                  checked={selectedHareketIds.includes(h.id)}
                                  onCheckedChange={() => toggleSelection(h.id)}
                                  className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium text-slate-600">
                              {h.tarih?.split('-').reverse().join('.')}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-900">{banka?.hesapAdi}</span>
                                <span className="text-[10px] text-slate-400">{banka?.bankaAdi}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isGiris ? (
                                  <div className="p-1 rounded bg-green-50 text-green-600">
                                    <ArrowDownLeft className="w-3 h-3" />
                                  </div>
                                ) : (
                                  <div className="p-1 rounded bg-red-50 text-red-600">
                                    <ArrowUpRight className="w-3 h-3" />
                                  </div>
                                )}
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-slate-700 truncate max-w-[250px]" title={h.aciklama}>
                                    {h.aciklama}
                                  </span>
                                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                                    {(h.islemTuru || '').replace(/_/g, ' ')}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="flex flex-col gap-2 min-w-[150px]">
                                {cari ? (
                                  <span className="font-semibold text-indigo-700 px-2 py-0.5 bg-indigo-50 rounded w-fit max-w-[200px] truncate block" title={cari.unvan}>
                                    {cari.unvan}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 italic text-[10px]">Cari Seçilmedi</span>
                                )}

                                {kategori ? (
                                  <span className="font-bold text-rose-700 px-2 py-0.5 bg-rose-50 rounded w-fit border border-rose-100 flex items-center gap-1 shadow-sm">
                                    <Tag className="w-3 h-3" />
                                    {kategori.ad}
                                  </span>
                                ) : (
                                  <Select 
                                    value={h.kategoriId || 'none'} 
                                    onValueChange={(val) => {
                                      const cat = giderKategorileri.find(k => k.id === val);
                                      updateCariHareket(h.id, { 
                                        kategoriId: val === 'none' ? null : val,
                                        muhasebeKodu: cat?.muhasebeKodu || h.muhasebeKodu
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-7 text-[10px] w-full bg-slate-50 border-slate-200">
                                      <SelectValue placeholder="Kategori Seç" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Kategori Seçilmedi</SelectItem>
                                      {giderKategorileri.map(k => (
                                        <SelectItem key={k.id} value={k.id}>{k.ad}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <LucaAccountSelect 
                                value={h.muhasebeKodu || ''} 
                                onChange={(code: string) => updateCariHareket(h.id, { muhasebeKodu: code })}
                                className="h-8 text-[11px]"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className={cn(
                                "font-bold text-sm tabular-nums",
                                isGiris ? "text-green-600" : "text-slate-900"
                              )}>
                                {isGiris ? '+' : '-'}{formatCurrency(h.tutar, 'TRY')}
                              </div>
                              {h.dovizTutar && (
                                <div className="text-[11px] font-medium text-slate-400 tabular-nums">
                                  ({formatCurrency(h.dovizTutar, banka?.dovizTuru || h.dovizTuru)})
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                               <div className="flex items-center justify-end gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-8 h-8 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      setEditingId(h.id);
                                      setEditForm(h);
                                    }}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>

                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Hareketi Sil</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Bu işlem banka bakiyesini de güncelleyecektir. Emin misiniz?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => {
                                          deleteCariHareket(h.id);
                                          toast.success('Hareket silindi ve bakiye güncellendi.');
                                        }} className="bg-red-600 hover:bg-red-700">
                                          Sil
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                               </div>
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
        </TabsContent>

        {/* ======================= YENİ MASRAF SEKME ======================= */}
        <TabsContent value="yeni-masraf" className="mt-6">
          <Card className="max-w-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Yeni Masraf Ekle</CardTitle>
              <CardDescription>Banka veya kasadan yapılan bir masrafı sisteme girin. Bu işlem banka ekstrenize de eklenecektir.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGiderEkle} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tarih">İşlem Tarihi</Label>
                    <Input 
                      id="tarih" 
                      type="date" 
                      value={giderForm.tarih}
                      onChange={(e) => setGiderForm({...giderForm, tarih: e.target.value})}
                    />
                  </div>
                  {giderForm.dovizTuru !== 'TRY' ? (
                    <div className="space-y-2 col-span-2 bg-slate-50 p-4 rounded-lg border">
                      <div className="flex justify-between items-center mb-2">
                        <Label className="text-slate-700 font-semibold">{giderForm.dovizTuru} Döviz İşlemi</Label>
                        <Button type="button" variant="outline" size="sm" onClick={() => fetchTcmbKur(giderForm.tarih, giderForm.dovizTuru)} disabled={isFetchingKur}>
                          {isFetchingKur ? 'Çekiliyor...' : 'TCMB Kur Getir'}
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="dovizTutar">Döviz Tutarı</Label>
                          <Input 
                            id="dovizTutar" type="number" step="0.01" placeholder="0.00"
                            value={giderForm.dovizTutar}
                            onChange={(e) => {
                               const dTut = e.target.value;
                               const k = parseFloat(giderForm.dovizKuru || '0');
                               const yTut = (parseFloat(dTut || '0') * k).toFixed(2);
                               setGiderForm({...giderForm, dovizTutar: dTut, tutar: k > 0 ? yTut : giderForm.tutar});
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dovizKuru">Döviz Kuru</Label>
                          <Input 
                            id="dovizKuru" type="number" step="0.0001" placeholder="0.0000"
                            value={giderForm.dovizKuru}
                            onChange={(e) => {
                               const k = e.target.value;
                               const dTut = parseFloat(giderForm.dovizTutar || '0');
                               const yTut = (dTut * parseFloat(k || '0')).toFixed(2);
                               setGiderForm({...giderForm, dovizKuru: k, tutar: parseFloat(k) > 0 ? yTut : giderForm.tutar});
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tutar">TL Karşılığı</Label>
                          <Input 
                            id="tutar" type="number" placeholder="0.00"
                            value={giderForm.tutar}
                            onChange={(e) => setGiderForm({...giderForm, tutar: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="tutar">Tutar</Label>
                      <Input 
                        id="tutar" 
                        type="number" 
                        placeholder="0.00"
                        value={giderForm.tutar}
                        onChange={(e) => setGiderForm({...giderForm, tutar: e.target.value})}
                      />
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="banka">Ödeme Yapılan Banka</Label>
                  <Select value={String(giderForm.bankaId || '')} onValueChange={(val) => {
                      const banka = bankaHesaplari.find(b => String(b.id) === val);
                      setGiderForm({
                        ...giderForm, 
                        bankaId: val,
                        dovizTuru: banka?.dovizTuru || 'TRY'
                      });
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Banka Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {(bankaHesaplari || []).map(b => (
                        <SelectItem key={b.id} value={String(b.id || '')}>{b.hesapAdi}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tur">Kategori</Label>
                  <Select value={giderForm.kategoriId || giderForm.islemTuru} onValueChange={(val) => {
                    const selectedCat = giderKategorileri.find(k => k.id === val);
                    if (selectedCat) {
                      setGiderForm({
                        ...giderForm, 
                        kategoriId: val, 
                        islemTuru: 'genel_gider',
                        muhasebeKodu: selectedCat.muhasebeKodu || giderForm.muhasebeKodu
                      });
                    } else {
                      setGiderForm({...giderForm, kategoriId: '', islemTuru: val});
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategori Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="header-system" disabled className="text-[10px] font-bold text-slate-400">SİSTEM KATEGORİLERİ</SelectItem>
                      {SYSTEM_CATEGORIES.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.ad}</SelectItem>
                      ))}
                      
                      {giderKategorileri.filter(k => !SYSTEM_CATEGORIES.some(s => s.id === k.id)).length > 0 && (
                        <>
                          <SelectItem value="separator" disabled className="text-[10px] font-bold text-slate-400 border-t mt-2 pt-2">ÖZEL KATEGORİLER</SelectItem>
                          {giderKategorileri.filter(k => !SYSTEM_CATEGORIES.some(s => s.id === k.id)).map(k => (
                            <SelectItem key={k.id} value={k.id}>{k.ad}</SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="muhasebeKodu">Luca Muhasebe Kodu</Label>
                  <LucaAccountSelect 
                    value={giderForm.muhasebeKodu || ''} 
                    onChange={(code) => setGiderForm({...giderForm, muhasebeKodu: code})}
                    placeholder="Kod Seçin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aciklama">Açıklama</Label>
                  <Input 
                    id="aciklama" 
                    placeholder="Örn: Mart ayı telefon faturası"
                    value={giderForm.aciklama}
                    onChange={(e) => setGiderForm({...giderForm, aciklama: e.target.value})}
                  />
                </div>
                <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 gap-2">
                  <Plus className="w-4 h-4" /> Masrafı Kaydet
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================= KURALLAR SEKME ======================= */}
        <TabsContent value="kurallar" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <CardTitle className="text-lg">Yeni Akıllı Kural</CardTitle>
                </div>
                <CardDescription>Banka ekstresi yüklerken açıklamaya göre otomatik kategori atayın</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleKuralEkle} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="kelime">Açıklamada Geçen Kelime</Label>
                    <Input 
                      id="kelime" 
                      placeholder="Örn: TURKCELL"
                      value={kuralForm.anahtarKelime}
                      onChange={(e) => setKuralForm({...kuralForm, anahtarKelime: e.target.value})}
                    />
                    <p className="text-[10px] text-slate-400">Bu kelime (küçük/büyük harf duyarlı değil) banka açıklamasında geçerse kural çalışır.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="k-tur">Kategori / İşlem Türü</Label>
                    <Select value={kuralForm.kategoriId || kuralForm.islemTuru} onValueChange={(val) => {
                      const selectedCat = giderKategorileri.find(k => k.id === val);
                      if (selectedCat) {
                        setKuralForm({
                          ...kuralForm, 
                          kategoriId: val, 
                          islemTuru: selectedCat.tip === 'GELIR' ? 'diger_gelir' : 'genel_gider',
                          muhasebeKodu: selectedCat.muhasebeKodu || kuralForm.muhasebeKodu
                        });
                      } else {
                        setKuralForm({...kuralForm, kategoriId: '', islemTuru: val});
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçiniz" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="header-system" disabled className="text-[10px] font-bold text-slate-400">SİSTEM KATEGORİLERİ</SelectItem>
                        {SYSTEM_CATEGORIES.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.ad}</SelectItem>
                        ))}
                        
                        {giderKategorileri.filter(k => !SYSTEM_CATEGORIES.some(s => s.id === k.id) && k.tip !== 'GELIR').length > 0 && (
                          <>
                            <SelectItem value="separator" disabled className="text-[10px] font-bold text-slate-400 border-t mt-2 pt-2">ÖZEL GİDER KATEGORİLERİ</SelectItem>
                            {giderKategorileri.filter(k => !SYSTEM_CATEGORIES.some(s => s.id === k.id) && k.tip !== 'GELIR').map(k => (
                              <SelectItem key={k.id} value={k.id}>{k.ad}</SelectItem>
                            ))}
                          </>
                        )}
                        {giderKategorileri.filter(k => k.tip === 'GELIR').length > 0 && (
                          <>
                            <SelectItem value="separator_gelir" disabled className="text-[10px] font-bold text-slate-400 border-t mt-2 pt-2">GELİR KATEGORİLERİ</SelectItem>
                            {giderKategorileri.filter(k => k.tip === 'GELIR').map(k => (
                              <SelectItem key={k.id} value={k.id}>{k.ad}</SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Luca Muhasebe Kodu</Label>
                    <LucaAccountSelect 
                      value={kuralForm.muhasebeKodu || ''} 
                      onChange={(code) => setKuralForm({...kuralForm, muhasebeKodu: code})}
                      placeholder="Kod Seçin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="k-acik">Ek Açıklama (Opsiyonel)</Label>
                    <Input 
                      id="k-acik" 
                      placeholder="Kural açıklaması"
                      value={kuralForm.aciklama}
                      onChange={(e) => setKuralForm({...kuralForm, aciklama: e.target.value})}
                    />
                  </div>
                  <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 gap-2">
                    <Plus className="w-4 h-4" /> Kuralı Ekle
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-0 shadow-sm overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Tanımlı Atama Kuralları</CardTitle>
                <CardDescription>Banka entegrasyonunda ilk bu kurallar kontrol edilir</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead>Anahtar Kelime</TableHead>
                      <TableHead>Hedef Kategori</TableHead>
                      <TableHead>Luca Kodu</TableHead>
                      <TableHead>Notlar</TableHead>
                      <TableHead className="w-24 text-right">İşlemler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masrafKurallari.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-slate-400">Kural tanımlanmamış.</TableCell>
                      </TableRow>
                    ) : (
                      masrafKurallari.map((k) => {
                        const cat = k.kategoriId ? giderKategorileri.find(c => c.id === k.kategoriId) : null;
                        return (
                          <TableRow key={k.id}>
                            <TableCell className="font-bold text-amber-700 bg-amber-50/30">"{k.anahtarKelime}"</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 capitalize text-xs font-semibold">
                                  <Tag className="w-3 h-3 text-slate-400" />
                                  {(k.islemTuru || '').replace(/_/g, ' ')}
                                </div>
                                {cat && (
                                  <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded w-fit">{cat.ad}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {k.muhasebeKodu ? (
                                <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                                  {k.muhasebeKodu}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-300 italic">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-slate-500">{k.aciklama || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 text-[10px] gap-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                                  onClick={() => handleGecmiseUygula(k)}
                                >
                                  <Zap className="w-3 h-3" /> Geçmişe Uygula
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="w-7 h-7 text-slate-300 hover:text-red-500"
                                  onClick={() => deleteMasrafKurali(k.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Düzenleme Modalı */}
      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Hareketi Düzenle</DialogTitle>
            <DialogDescription>
              İşlem bilgilerini güncelleyin. Bakiye otomatik olarak yeniden hesaplanacaktır.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tarih" className="text-right text-xs">Tarih</Label>
              <Input id="tarih" type="date" className="col-span-3" value={editForm.tarih || ''} onChange={(e) => setEditForm({...editForm, tarih: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tutar" className="text-right text-xs">Tutar (TL)</Label>
              <Input id="tutar" type="number" step="0.01" className="col-span-3" value={editForm.tutar || ''} onChange={(e) => setEditForm({...editForm, tutar: parseFloat(e.target.value)})} />
            </div>
            {editForm.dovizTuru && editForm.dovizTuru !== 'TRY' && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dovizKuru" className="text-right text-xs">Kur ({editForm.dovizTuru})</Label>
                  <Input 
                    id="dovizKuru" 
                    type="number" 
                    step="0.000001"
                    className="col-span-3" 
                    value={editForm.dovizKuru || ''} 
                    onChange={(e) => {
                       const newKur = parseFloat(e.target.value);
                       const dvz = editForm.dovizTutar || 0;
                       setEditForm({...editForm, dovizKuru: newKur, tutar: (newKur > 0 && dvz > 0) ? Number((newKur * dvz).toFixed(2)) : editForm.tutar});
                    }} 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dovizTutar" className="text-right text-xs">Dvz. Tutar</Label>
                  <Input 
                    id="dovizTutar" 
                    type="number" 
                    step="0.01"
                    className="col-span-3" 
                    value={editForm.dovizTutar || ''} 
                    onChange={(e) => {
                       const newDvz = parseFloat(e.target.value);
                       const kur = editForm.dovizKuru || 0;
                       setEditForm({...editForm, dovizTutar: newDvz, tutar: (newDvz > 0 && kur > 0) ? Number((newDvz * kur).toFixed(2)) : editForm.tutar});
                    }} 
                  />
                </div>
              </>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="aciklama" className="text-right text-xs">Açıklama</Label>
              <Input id="aciklama" className="col-span-3" value={editForm.aciklama || ''} onChange={(e) => setEditForm({...editForm, aciklama: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="banka" className="text-right text-xs">Banka</Label>
              <div className="col-span-3">
                <select 
                  className="w-full h-9 bg-white border border-slate-200 rounded-md px-3 text-sm outline-none focus:border-indigo-500"
                  value={editForm.bankaId || ''} 
                  onChange={(e) => setEditForm({...editForm, bankaId: e.target.value})}
                >
                  <option value="">Banka Seçin</option>
                  {bankaHesaplari.map(b => (
                    <option key={b.id} value={b.id}>{b.hesapAdi}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cari" className="text-right text-xs">Cari</Label>
              <div className="col-span-3">
                <select 
                  className="w-full h-9 bg-white border border-slate-200 rounded-md px-3 text-sm outline-none focus:border-indigo-500"
                  value={editForm.cariId || 'none'} 
                  onChange={(e) => setEditForm({...editForm, cariId: e.target.value === 'none' ? undefined : e.target.value})}
                >
                  <option value="none">Seçilmedi</option>
                  {cariler.map(c => (
                    <option key={c.id} value={c.id}>{c.unvan}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="muhasebeKodu" className="text-right text-xs">Luca Kodu</Label>
              <div className="col-span-3">
                <LucaAccountSelect 
                  value={editForm.muhasebeKodu || ''} 
                  onChange={(code: string) => setEditForm({...editForm, muhasebeKodu: code})}
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="kategori" className="text-right text-xs">Kategori</Label>
              <div className="col-span-3">
                <select 
                  className="w-full h-9 bg-white border border-slate-200 rounded-md px-3 text-sm outline-none focus:border-indigo-500"
                  value={editForm.kategoriId || 'none'} 
                  onChange={(e) => setEditForm({...editForm, kategoriId: e.target.value === 'none' ? null : e.target.value})}
                >
                  <option value="none">Seçilmedi</option>
                  {giderKategorileri.map(k => (
                    <option key={k.id} value={k.id}>{k.ad}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>Vazgeç</Button>
            <Button onClick={() => {
              if (editingId) {
                updateCariHareket(editingId, editForm);
                setEditingId(null);
                toast.success('Hareket başarıyla güncellendi.');
              }
            }}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kategori Yönetimi Dialog */}
      <Dialog open={isCategoryManageOpen} onOpenChange={setIsCategoryManageOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-rose-500" />
              Kategorileri Yönet
            </DialogTitle>
            <DialogDescription>
              İşlemlerinizi gruplandırmak için yeni gider veya gelir kategorileri ekleyebilir, mevcutları silebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <Label className="text-xs font-bold text-slate-500 uppercase">Yeni Kategori Ekle</Label>
              <div className="flex gap-2">
                <Select value={newCatTip} onValueChange={(val: 'GIDER'|'GELIR') => setNewCatTip(val)}>
                  <SelectTrigger className="w-[110px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GIDER">Gider</SelectItem>
                    <SelectItem value="GELIR">Gelir</SelectItem>
                  </SelectContent>
                </Select>
                <Input 
                  placeholder="Kategori adı... (Örn: Kırtasiye)" 
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="bg-white"
                />
                <div className="w-[180px]">
                  <LucaAccountSelect 
                    value={newCatLuca}
                    onChange={setNewCatLuca}
                    placeholder="Luca Kodu (Opsiyonel)"
                    className="bg-white"
                  />
                </div>
                <Button 
                  className="bg-rose-600 hover:bg-rose-700 shrink-0"
                  onClick={() => {
                    const trimmed = String(newCatName || '').trim();
                    if (trimmed) {
                      addGiderKategorisi(trimmed, newCatLuca, undefined, newCatTip);
                      setNewCatName('');
                      setNewCatLuca('');
                      setNewCatTip('GIDER');
                      toast.success('Kategori eklendi.');
                    } else {
                      toast.error('Lütfen kategori adı girin.');
                    }
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Ekle
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b text-xs font-bold text-slate-500">
                MEVCUT KATEGORİLER
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {(() => {
                  const mergedCategories = [
                    ...SYSTEM_CATEGORIES.map(sc => {
                      const dbCat = giderKategorileri.find(k => k.id === sc.id);
                      return { ...sc, muhasebeKodu: dbCat?.muhasebeKodu, isSystem: true, tip: 'GIDER' };
                    }),
                    ...giderKategorileri
                      .filter(k => !SYSTEM_CATEGORIES.some(s => s.id === k.id))
                      .map(k => ({ ...k, isSystem: false, tip: k.tip || 'GIDER' }))
                  ];

                  return mergedCategories.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm italic">
                      Henüz kategori bulunmuyor.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {mergedCategories.map((cat) => (
                        <div key={cat.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                          <div className="flex-1 flex items-center gap-2">
                            <span className="font-medium text-slate-700">{cat.ad}</span>
                            {cat.tip === 'GELIR' ? (
                              <span className="text-[9px] font-bold bg-green-100 text-green-600 px-1.5 py-0.5 rounded uppercase">GELİR</span>
                            ) : (
                              <span className="text-[9px] font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded uppercase">GİDER</span>
                            )}
                            {cat.isSystem && (
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">Sistem</span>
                            )}
                          </div>
                          <div className="w-[180px]">
                            <LucaAccountSelect 
                              value={cat.muhasebeKodu || ''}
                              onChange={(code) => {
                                const exists = giderKategorileri.some(k => k.id === cat.id);
                                if (exists) {
                                  updateGiderKategorisi(cat.id, { muhasebeKodu: code });
                                } else {
                                  addGiderKategorisi(cat.ad, code, cat.id);
                                }
                              }}
                              placeholder="Kod Tanımla"
                              className="h-8 text-[10px]"
                            />
                          </div>
                          <div className="w-8">
                            {!cat.isSystem && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                onClick={() => {
                                  deleteGiderKategorisi(cat.id);
                                  toast.success('Kategori silindi.');
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <p className="text-[10px] text-amber-700 leading-relaxed italic">
                <strong>Not:</strong> Sistem ana kategorileri (Maaş, Kira vb.) silinemez. Özel kategoriler silindiğinde o kategoriye ait eski harcamalar listede "Bilinmiyor" olarak görünebilir.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setIsCategoryManageOpen(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
