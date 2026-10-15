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
  FileText,
  X,
  Edit2,
  Printer,
  Clock,
  ArrowUpDown,
  Calendar,
  LogOut,
  Undo2,
  RefreshCw,
  Filter,
  Sparkles,
  ChevronDown,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Layers,
  MoreHorizontal,
  GitCompare,
  FileCheck2,
  UploadCloud,
  CheckCheck,
  AlertTriangle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
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
import { Checkbox } from '@/components/ui/checkbox';
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
    cariler,
    satisFaturalari,
    downloadSatisPdf,
    deleteSatisFatura,
    addSatisFatura,
    updateSatisFatura,
    cariHareketler,
    deleteCariHareket
  } = useApp();
  const { data: urunler } = useUrunler();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'bekleyen' | 'kesilenler'>('bekleyen');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const parseGibAmount = (val: any) => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let str = String(val).trim();
    if (!str) return 0;
    str = str.replace(/[^\d.,-]/g, '').trim();
    if (!str) return 0;
    if (str.includes(',') && str.includes('.')) {
      str = str.replace(/\./g, '').replace(/,/g, '.');
    } else if (str.includes(',')) {
      str = str.replace(/,/g, '.');
    } else if ((str.match(/\./g) || []).length > 1) {
      str = str.replace(/\./g, '');
    }
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
  };

  const getAliciUnvan = (inv: any) => {
    return inv.aliciUnvan || inv.aliciUnvanAdSoyad || (inv.aliciAdi ? `${inv.aliciAdi} ${inv.aliciSoyadi || ''}`.trim() : '') || 'Bilinmeyen Alıcı';
  };

  const cleanDigits = (val: any) => String(val || '').replace(/\D/g, '').trim();

  const normalizeText = (text: string) => {
    return (text || '')
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const extractGibAmount = (g: any) => {
    if (!g) return 0;
    const raw = g.odenecek 
      ?? g.odenecekTutar 
      ?? g.belgeTutari 
      ?? g.faturaTutari 
      ?? g.toplamTutar 
      ?? g.vergilerDahilToplamTutar 
      ?? g.genelToplam
      ?? g.toplam
      ?? g.tutar;
    return parseGibAmount(raw);
  };

  const amountsMatch = (fAmt: number, gAmt: number): boolean => {
    if (fAmt <= 0 || gAmt <= 0) return false;
    if (Math.abs(fAmt - gAmt) < 1.05) return true;
    const vatRates = [1.20, 1.10, 1.01, 1.08];
    for (const r of vatRates) {
      if (Math.abs(fAmt * r - gAmt) < 1.50) return true;
      if (Math.abs(gAmt * r - fAmt) < 1.50) return true;
    }
    if (Math.abs(fAmt * 0.80 - gAmt) < 1.50) return true;
    if (Math.abs(gAmt * 0.80 - fAmt) < 1.50) return true;
    return false;
  };

  const datesMatch = (dateA: string, dateB: string): boolean => {
    if (!dateA || !dateB) return true;
    const cleanA = dateA.split('T')[0].trim();
    const cleanB = dateB.split('T')[0].trim();
    if (cleanA === cleanB) return true;
    const timeA = new Date(cleanA).getTime();
    const timeB = new Date(cleanB).getTime();
    if (!isNaN(timeA) && !isNaN(timeB)) {
      const diffDays = Math.abs(timeA - timeB) / (1000 * 60 * 60 * 24);
      if (diffDays <= 3) return true;
    }
    return false;
  };

  const titlesMatch = (nameA: string, nameB: string): boolean => {
    const normA = normalizeText(nameA).replace(/\s/g, '');
    const normB = normalizeText(nameB).replace(/\s/g, '');
    if (!normA || !normB) return false;
    if (normA.includes(normB) || normB.includes(normA)) return true;

    const STOP_WORDS = new Set(['ve', 'ile', 'san', 'tic', 'ltd', 'sti', 'as', 'a', 's', 'sanayi', 'ticaret', 'limited', 'sirketi', 'anonim']);
    const wordsA = normalizeText(nameA).split(' ').filter(w => w.length >= 3 && !STOP_WORDS.has(w));
    const wordsB = normalizeText(nameB).split(' ').filter(w => w.length >= 3 && !STOP_WORDS.has(w));
    if (wordsA.length > 0 && wordsB.length > 0) {
      const common = wordsA.filter(w => wordsB.includes(w));
      if (common.length >= 1) return true;
    }
    return false;
  };

  const parseExcelDate = (rowDate: any): string => {
    if (!rowDate) return new Date().toISOString().split('T')[0];
    if (typeof rowDate === 'number') {
      const dateObj = new Date(Math.round((rowDate - 25569) * 86400 * 1000));
      const yyyy = dateObj.getUTCFullYear();
      const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    if (typeof rowDate === 'string') {
      const strDate = rowDate.trim();
      const parts = strDate.split(/[.\/-]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 2) {
          const year = parseInt(parts[2]) > 50 ? "19" + parts[2] : "20" + parts[2];
          return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      return strDate.split('T')[0];
    }
    if (rowDate instanceof Date) {
      const yyyy = rowDate.getFullYear();
      const mm = String(rowDate.getMonth() + 1).padStart(2, '0');
      const dd = String(rowDate.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return new Date().toISOString().split('T')[0];
  };

  // Akıllı Çapraz Kontrol & Mutabakat States
  const [isCrossCheckModalOpen, setIsCrossCheckModalOpen] = useState(false);
  const [crossCheckFileName, setCrossCheckFileName] = useState('');
  const [isCrossChecking, setIsCrossChecking] = useState(false);
  const [isImportingUnmatched, setIsImportingUnmatched] = useState(false);
  const [crossCheckActiveTab, setCrossCheckActiveTab] = useState<'unmatched' | 'matched'>('unmatched');
  const [crossCheckResult, setCrossCheckResult] = useState<{
    totalUploaded: number;
    matchedList: any[];
    unmatchedList: any[];
    isCalculated: boolean;
  }>({
    totalUploaded: 0,
    matchedList: [],
    unmatchedList: [],
    isCalculated: false
  });

  // Form
  const [form, setForm] = useState({
    ad: '', soyad: '', vknTckn: '', vergiDairesi: '',
    adres: '', il: '', ilce: '', kdvOrani: '20',
    faturaTarihi: new Date().toISOString().split('T')[0],
    aciklama: '', cariId: 'none', kdvHesaplamaTipi: 'DAHIL'
  });

  // Kalem listesi
  const [kalemler, setKalemler] = useState<FaturaKalemi[]>([newKalem()]);

  // GİB States
  const [isGibModalOpen, setIsGibModalOpen] = useState(false);
  const [gibCredentials, setGibCredentials] = useState(() => ({
    username: localStorage.getItem('gib_username') || '',
    password: localStorage.getItem('gib_password') || ''
  }));
  const [selectedInvoiceForGib, setSelectedInvoiceForGib] = useState<KesilecekFatura | null>(null);
  const [isGibSending, setIsGibSending] = useState(false);
  const [isGibLoggingOut, setIsGibLoggingOut] = useState(false);
  const [autoSign, setAutoSign] = useState(false);
  const [gibFaturaTipi, setGibFaturaTipi] = useState('SATIS');
  const [gibStopajTipi, setGibStopajTipi] = useState('');
  const [gibStopajOrani, setGibStopajOrani] = useState('0');

  // GİB Oturumunu Güvenle Kapatma (Kilitli Oturumu Açma)
  const handleGibForceLogout = async (targetUsername?: string) => {
    const userToLogout = targetUsername || gibCredentials.username || gibFetchCredentials.username;
    if (!userToLogout) {
      toast.error('Lütfen önce GİB kullanıcı adınızı girin.');
      return;
    }
    setIsGibLoggingOut(true);
    try {
      const apiUrl = import.meta.env.DEV ? 'http://localhost:5000/api/gib/force-logout' : '/api/gib/force-logout';
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ credentials: { username: userToLogout } })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'GİB oturumu güvenli şekilde sonlandırıldı.');
      } else {
        toast.error(data.message || 'Çıkış yapılırken bir hata oluştu.');
      }
    } catch {
      toast.error('GİB çıkış servisine bağlanılamadı.');
    } finally {
      setIsGibLoggingOut(false);
    }
  };

  // GİB Fetch States
  const [isGibFetchModalOpen, setIsGibFetchModalOpen] = useState(false);
  const [gibFetchCredentials, setGibFetchCredentials] = useState(() => ({
    username: localStorage.getItem('gib_username') || '',
    password: localStorage.getItem('gib_password') || ''
  }));
  const [gibDateRange, setGibDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [isGibFetching, setIsGibFetching] = useState(false);
  const [gibInvoices, setGibInvoices] = useState<any[]>([]);

  // Toplu GİB States
  const [selectedInvoiceIdsForGib, setSelectedInvoiceIdsForGib] = useState<string[]>([]);
  const [isBulkGibModalOpen, setIsBulkGibModalOpen] = useState(false);
  const [isBulkGibSending, setIsBulkGibSending] = useState(false);
  const [sortOrder, setSortOrder] = useState<'tarih_asc' | 'tarih_desc' | 'olusturma_desc'>('tarih_asc');

  // Toplu GİB Konfigürasyon States
  const [bulkFaturaTipi, setBulkFaturaTipi] = useState<string>('AUTO');
  const [bulkStopajMode, setBulkStopajMode] = useState<string>('KEEP');
  const [bulkStopajOrani, setBulkStopajOrani] = useState<string>('20');
  const [bulkDefaultTevkifatKodu, setBulkDefaultTevkifatKodu] = useState<string>('616');

  // GİB Görüntüleyici States
  const [gibViewerHtml, setGibViewerHtml] = useState<string | null>(null);
  const [isGibViewerOpen, setIsGibViewerOpen] = useState(false);
  const [bulkGibProgress, setBulkGibProgress] = useState<{
    current: number;
    total: number;
    successes: number;
    errors: number;
    currentInvoiceName?: string;
    currentInvoiceDate?: string;
  }>({ current: 0, total: 0, successes: 0, errors: 0 });

  // Kesilen Faturalar Tarih Filtreleme & Seçim States
  const [kesilenStartDate, setKesilenStartDate] = useState<string>('');
  const [kesilenEndDate, setKesilenEndDate] = useState<string>('');
  const [selectedKesilenIds, setSelectedKesilenIds] = useState<string[]>([]);

  // GİB Sorgulama ve Eşleştirme States
  const [isGibQueryModalOpen, setIsGibQueryModalOpen] = useState(false);
  const [isGibQuerying, setIsGibQuerying] = useState(false);
  const [gibQueryResult, setGibQueryResult] = useState<{
    matched: any[];
    unmatched: any[];
    allGib: any[];
    queryRange?: { startDate: string; endDate: string };
  } | null>(null);
  const [isGibResultModalOpen, setIsGibResultModalOpen] = useState(false);
  const [resultActiveTab, setResultActiveTab] = useState<'matched' | 'unmatched' | 'all'>('unmatched');
  const [tempGibQueryCreds, setTempGibQueryCreds] = useState({
    username: '',
    password: '',
    startDate: '',
    endDate: ''
  });

  // Tarih Çözümleyici & Kronolojik Sıralayıcı (İlk tarihten son tarihe / Eskiden yeniye)
  const parseInvoiceDate = (dateStr?: string, fallbackStr?: string): number => {
    if (dateStr) {
      const clean = String(dateStr).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
        const t = new Date(clean.split('T')[0]).getTime();
        if (!isNaN(t)) return t;
      }
      const parts = clean.split(/[./-]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          const t = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
          if (!isNaN(t)) return t;
        } else if (parts[0].length === 4) {
          const t = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
          if (!isNaN(t)) return t;
        }
      }
      const t = new Date(clean).getTime();
      if (!isNaN(t)) return t;
    }
    if (fallbackStr) {
      const t = new Date(fallbackStr).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  };

  const sortInvoicesChronologically = (list: any[]) => {
    return [...list].sort((a, b) => {
      const timeA = parseInvoiceDate(a.faturaTarihi, a.olusturmaTarihi);
      const timeB = parseInvoiceDate(b.faturaTarihi, b.olusturmaTarihi);
      if (timeA !== timeB) return timeA - timeB; // Eskiden yeniye (ilk tarihten başla)

      const cA = new Date(a.olusturmaTarihi || 0).getTime() || 0;
      const cB = new Date(b.olusturmaTarihi || 0).getTime() || 0;
      if (cA !== cB) return cA - cB;

      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  };

  // VKN Sorgu ve Düzenleme States
  const [isVknLoading, setIsVknLoading] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [isBulkLookupRunning, setIsBulkLookupRunning] = useState(false);
  const [bulkLookupProgress, setBulkLookupProgress] = useState({ current: 0, total: 0 });

  // Kalem hesaplamaları
  const kalemToplam = useMemo(() => {
    return kalemler.reduce((sum, k) => {
      const bFiyat = Number(k.birimFiyat) || 0;
      const miktar = Number(k.miktar) || 0;
      const kOran = Number(k.kdvOrani) || 0;
      
      let matrah = 0, kdv = 0;
      if (form.kdvHesaplamaTipi === 'DAHIL') {
        const kdvDahilToplam = bFiyat * miktar;
        matrah = kdvDahilToplam / (1 + (kOran / 100));
        kdv = kdvDahilToplam - matrah;
      } else {
        matrah = bFiyat * miktar;
        kdv = matrah * (kOran / 100);
      }
      
      return { 
        matrah: sum.matrah + matrah, 
        kdv: sum.kdv + kdv, 
        toplam: sum.toplam + matrah + kdv 
      };
    }, { matrah: 0, kdv: 0, toplam: 0 });
  }, [kalemler, form.kdvHesaplamaTipi]);

  const resolvedInvoices = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    
    if (activeTab === 'bekleyen') {
      const pending = (kesilecekFaturalar || []).filter(f => f.durum !== 'kesildi');
      const filtered = pending.filter(f => 
        String(f.ad || "").toLowerCase().includes(searchLower) || 
        String(f.soyad || "").toLowerCase().includes(searchLower) ||
        String(f.vknTckn || "").toLowerCase().includes(searchLower)
      );

      return [...filtered].sort((a, b) => {
        if (sortOrder === 'tarih_asc') {
          const timeA = parseInvoiceDate(a.faturaTarihi, a.olusturmaTarihi);
          const timeB = parseInvoiceDate(b.faturaTarihi, b.olusturmaTarihi);
          if (timeA !== timeB) return timeA - timeB; // Eskiden yeniye (kronolojik)
          return (new Date(a.olusturmaTarihi || 0).getTime()) - (new Date(b.olusturmaTarihi || 0).getTime());
        } else if (sortOrder === 'tarih_desc') {
          const timeA = parseInvoiceDate(a.faturaTarihi, a.olusturmaTarihi);
          const timeB = parseInvoiceDate(b.faturaTarihi, b.olusturmaTarihi);
          if (timeA !== timeB) return timeB - timeA; // Yeniden eskiye
          return (new Date(b.olusturmaTarihi || 0).getTime()) - (new Date(a.olusturmaTarihi || 0).getTime());
        } else {
          return (new Date(b.olusturmaTarihi || 0).getTime()) - (new Date(a.olusturmaTarihi || 0).getTime());
        }
      });
    } else {
      // Kesilenler / Onaylananlar
      const planCut = (kesilecekFaturalar || []).filter(f => f.durum === 'kesildi');
      const realSales = (satisFaturalari || []).map((sf: any) => ({
        id: sf.id,
        ad: sf.ad || sf.unvan || '',
        soyad: sf.soyad || '',
        vknTckn: sf.tcVkn || '',
        tutar: parseFloat(sf.alinanUcret) || 0,
        matrah: sf.matrah !== undefined && sf.matrah !== null ? parseFloat(sf.matrah) : undefined,
        kdvTutari: sf.kdvTutari !== undefined && sf.kdvTutari !== null ? parseFloat(sf.kdvTutari) : undefined,
        tevkifatTutari: sf.tevkifatTutari !== undefined && sf.tevkifatTutari !== null ? parseFloat(sf.tevkifatTutari) : undefined,
        faturaTarihi: sf.faturaTarihi,
        aciklama: sf.aciklama,
        durum: 'kesildi',
        faturaNo: sf.faturaNo,
        isRealSalesInvoice: true,
        pdfDosya: sf.pdfDosya,
        gibUuid: sf.gibUuid,
        olusturmaTarihi: sf.created_at || sf.olusturmaTarihi || sf.faturaTarihi
      }));

      // Deduplicate planCut against realSales (using vknTckn and Tutarı)
      const filteredPlanCut = planCut.filter(p => {
        return !realSales.some(r => r.vknTckn === p.vknTckn && Math.abs(r.tutar - p.tutar) < 0.01);
      });

      let combined: any[] = [...filteredPlanCut, ...realSales];
      
      // Tarih Filtresi (Kesilenler)
      if (kesilenStartDate) {
        combined = combined.filter(f => {
          const d = f.faturaTarihi || f.olusturmaTarihi || '';
          return !d || d >= kesilenStartDate;
        });
      }
      if (kesilenEndDate) {
        combined = combined.filter(f => {
          const d = f.faturaTarihi || f.olusturmaTarihi || '';
          return !d || d <= kesilenEndDate;
        });
      }

      return combined
        .filter(f => 
          String(f.ad || "").toLowerCase().includes(searchLower) || 
          String(f.soyad || "").toLowerCase().includes(searchLower) ||
          String(f.vknTckn || "").toLowerCase().includes(searchLower) ||
          String(f.faturaNo || "").toLowerCase().includes(searchLower)
        )
        .sort((a, b) => new Date(b.olusturmaTarihi || 0).getTime() - new Date(a.olusturmaTarihi || 0).getTime());
    }
  }, [kesilecekFaturalar, satisFaturalari, activeTab, searchTerm, sortOrder, kesilenStartDate, kesilenEndDate]);

  const pendingInvoices = useMemo(() => resolvedInvoices.filter(f => f.durum === 'bekliyor'), [resolvedInvoices]);

  // Seçilen faturaları tarihe göre (eskiden yeniye) sıralı sırada tut
  const chronologicallySortedSelected = useMemo(() => {
    const selectedList = pendingInvoices.filter(f => selectedInvoiceIdsForGib.includes(f.id));
    return sortInvoicesChronologically(selectedList);
  }, [pendingInvoices, selectedInvoiceIdsForGib]);

  const selectedDateRange = useMemo(() => {
    if (chronologicallySortedSelected.length === 0) return null;
    const start = chronologicallySortedSelected[0]?.faturaTarihi || '-';
    const end = chronologicallySortedSelected[chronologicallySortedSelected.length - 1]?.faturaTarihi || '-';
    return { start, end };
  }, [chronologicallySortedSelected]);

  // İstatistikler (Metrik Kartları)
  const stats = useMemo(() => {
    const pendingList = (kesilecekFaturalar || []).filter(f => f.durum !== 'kesildi');
    const pendingTotal = pendingList.reduce((sum, f) => sum + (Number(f.tutar) || 0), 0);

    const cutPlan = (kesilecekFaturalar || []).filter(f => f.durum === 'kesildi');
    const cutSales = satisFaturalari || [];
    const cutTotal = cutPlan.reduce((sum, f) => sum + (Number(f.tutar) || 0), 0) +
                     cutSales.reduce((sum, s: any) => sum + (parseFloat(s.alinanUcret) || 0), 0);
    const cutCount = cutPlan.length + cutSales.length;

    const matchedNoCount = cutPlan.filter(f => f.faturaNo && f.faturaNo !== 'Taslak').length +
                           cutSales.filter(s => s.faturaNo).length;

    return {
      pendingCount: pendingList.length,
      pendingTotal,
      cutCount,
      cutTotal,
      matchedNoCount,
    };
  }, [kesilecekFaturalar, satisFaturalari]);

  // Akıllı Gönderim Ön Denetim Raporu (Smart Pre-Flight Audit)
  const smartAudit = useMemo(() => {
    const selected = chronologicallySortedSelected;
    let tevkifatCount = 0;
    let stopajCount = 0;
    let consumerCount = 0;
    let invalidVknCount = 0;
    let zeroAmountCount = 0;
    let totalAmt = 0;
    const warnings: string[] = [];

    selected.forEach(inv => {
      const vkn = String(inv.vknTckn || '').replace(/\D/g, '');
      const tutar = Number(inv.tutar) || 0;
      totalAmt += tutar;

      if (!vkn || (vkn.length !== 10 && vkn.length !== 11)) {
        invalidVknCount++;
        warnings.push(`"${inv.ad}": VKN/TCKN eksik veya geçersiz (${inv.vknTckn || 'boş'})`);
      }
      if (vkn === '11111111111') {
        consumerCount++;
      }
      if (tutar <= 0) {
        zeroAmountCount++;
        warnings.push(`"${inv.ad}": Tutar 0 TL olamaz`);
      }
      const hasTev = (inv.kalemler || []).some((k: any) => parseFloat(k.tevkifatOrani) > 0 || k.tevkifatKodu) ||
                     parseFloat(inv.tevkifatOrani as any) > 0;
      if (hasTev) tevkifatCount++;

      const hasStp = parseFloat(inv.stopajOrani as any) > 0 || inv.stopajTipi;
      if (hasStp) stopajCount++;
    });

    return {
      totalSelected: selected.length,
      totalAmt,
      tevkifatCount,
      stopajCount,
      consumerCount,
      invalidVknCount,
      zeroAmountCount,
      warnings,
      isReady: invalidVknCount === 0 && zeroAmountCount === 0 && selected.length > 0
    };
  }, [chronologicallySortedSelected]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedInvoiceIdsForGib(pendingInvoices.map(f => f.id));
    else setSelectedInvoiceIdsForGib([]);
  };

  const handleSelectOne = (checked: boolean, id: string) => {
    if (checked) setSelectedInvoiceIdsForGib(prev => [...prev, id]);
    else setSelectedInvoiceIdsForGib(prev => prev.filter(item => item !== id));
  };

  const handleSelectAllKesilen = (checked: boolean) => {
    if (checked) setSelectedKesilenIds(resolvedInvoices.map((f: any) => f.id));
    else setSelectedKesilenIds([]);
  };

  const handleSelectOneKesilen = (checked: boolean, id: string) => {
    if (checked) setSelectedKesilenIds(prev => Array.from(new Set([...prev, id])));
    else setSelectedKesilenIds(prev => prev.filter(item => item !== id));
  };

  // Hızlı Tarih Filtreleri (Kesilenler)
  const setKesilenThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    setKesilenStartDate(firstDay);
    setKesilenEndDate(lastDay);
  };

  const setKesilenToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setKesilenStartDate(today);
    setKesilenEndDate(today);
  };

  const clearKesilenDateFilter = () => {
    setKesilenStartDate('');
    setKesilenEndDate('');
  };

  // Kesilen / Bekleyen faturaları tekrar Bekleyen Faturalar listesine geri çekme
  const revertToPending = async (invoiceIds: string[]) => {
    if (!invoiceIds || invoiceIds.length === 0) return;
    const count = invoiceIds.length;
    
    try {
      for (const invId of invoiceIds) {
        const inv = resolvedInvoices.find((f: any) => f.id === invId);
        if (!inv) continue;

        // 1. Eğer kesilecekFaturalar içinde varsa durumunu bekliyor yap
        const inPlan = (kesilecekFaturalar || []).find(f => f.id === invId);
        if (inPlan) {
          await updateKesilecekFatura(invId, {
            durum: 'bekliyor',
            faturaNo: undefined,
            gibUuid: undefined
          });
        } else {
          // Yalnızca satış faturalarında varsa, kesilecek fatura olarak yeniden oluştur
          await addKesilecekFatura({
            ad: inv.ad,
            soyad: inv.soyad || '',
            vknTckn: inv.vknTckn || '',
            tutar: inv.tutar,
            faturaTarihi: inv.faturaTarihi || new Date().toISOString().split('T')[0],
            aciklama: inv.aciklama || 'Geri alınan fatura',
            kalemler: inv.kalemler || [],
            cariId: inv.cariId
          });
        }

        // 2. Varsa bağlı satış faturasını sil (mükerrerliği önlemek için)
        const matchingSales = (satisFaturalari || []).find((sf: any) => 
          sf.id === invId || (inv.gibUuid && sf.gibUuid === inv.gibUuid) || (inv.faturaNo && sf.faturaNo === inv.faturaNo)
        );
        if (matchingSales) {
          await deleteSatisFatura(matchingSales.id);
        }

        // 3. Varsa bağlı cari hareketi sil
        const matchingHareket = (cariHareketler || []).find((ch: any) => 
          ch.bagliFaturaId === invId || (matchingSales && ch.bagliFaturaId === matchingSales.id)
        );
        if (matchingHareket) {
          await deleteCariHareket(matchingHareket.id);
        }
      }

      setSelectedKesilenIds(prev => prev.filter(id => !invoiceIds.includes(id)));
      setIsGibResultModalOpen(false);
      toast.success(`${count} fatura başarıyla 'Bekleyen Faturalar' sekmesine geri çekildi.`);
    } catch (err: any) {
      console.error('Bekleyenlere geri çekme hatası:', err);
      toast.error('Geri alma sırasında hata oluştu: ' + (err.message || 'Bilinmeyen hata'));
    }
  };

  // Toplu Silme Fonksiyonu (Bekleyen veya Kesilen seçili faturalar için)
  const handleBulkDelete = async () => {
    const isBekleyen = activeTab === 'bekleyen';
    const selectedIds = isBekleyen ? selectedInvoiceIdsForGib : selectedKesilenIds;
    
    if (!selectedIds || selectedIds.length === 0) {
      toast.warning('Lütfen silmek istediğiniz faturaları seçin.');
      return;
    }

    const message = isBekleyen
      ? `Seçilen ${selectedIds.length} adet bekleyen faturayı sistemden kalıcı olarak silmek istediğinize emin misiniz?`
      : `Seçilen ${selectedIds.length} adet faturayı sistemden kalıcı olarak silmek istediğinize emin misiniz? (Bağlı satış ve cari kayıtları da temizlenecektir)`;

    if (!window.confirm(message)) return;

    try {
      const count = selectedIds.length;
      for (const invId of selectedIds) {
        const inv = resolvedInvoices.find((f: any) => f.id === invId);

        // 1. Kesilecek fatura planında varsa sil
        if (kesilecekFaturalar.some(k => k.id === invId)) {
          await deleteKesilecekFatura(invId);
        }

        // 2. Satış faturasında varsa sil
        const matchingSales = (satisFaturalari || []).find((sf: any) => 
          sf.id === invId || (inv?.gibUuid && sf.gibUuid === inv.gibUuid) || (inv?.faturaNo && sf.faturaNo === inv.faturaNo)
        );
        if (matchingSales) {
          await deleteSatisFatura(matchingSales.id);
        } else if (inv?.isRealSalesInvoice) {
          await deleteSatisFatura(invId);
        }

        // 3. Varsa bağlı cari hareketi sil
        const matchingHareket = (cariHareketler || []).find((ch: any) => 
          ch.bagliFaturaId === invId || (matchingSales && ch.bagliFaturaId === matchingSales.id)
        );
        if (matchingHareket) {
          await deleteCariHareket(matchingHareket.id);
        }
      }

      if (isBekleyen) {
        setSelectedInvoiceIdsForGib([]);
      } else {
        setSelectedKesilenIds([]);
      }

      toast.success(`${count} adet fatura başarıyla silindi.`);
    } catch (err: any) {
      console.error('Toplu silme hatası:', err);
      toast.error('Toplu silme sırasında hata oluştu: ' + (err.message || 'Bilinmeyen hata'));
    }
  };

  // GİB Sorgulama Giriş Modalı Açıcı
  const openGibQueryModal = () => {
    const targets = selectedKesilenIds.length > 0
      ? resolvedInvoices.filter((f: any) => selectedKesilenIds.includes(f.id))
      : resolvedInvoices;

    const now = new Date();
    const past60Days = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    let start = kesilenStartDate;
    let end = kesilenEndDate;

    if (!start || !end) {
      const parsedTimes = targets
        .map((f: any) => parseInvoiceDate(f.faturaTarihi, f.olusturmaTarihi))
        .filter(t => t > 0)
        .sort((a, b) => a - b);

      if (parsedTimes.length > 0) {
        const minD = new Date(parsedTimes[0]);
        minD.setDate(minD.getDate() - 7);
        const maxD = new Date(parsedTimes[parsedTimes.length - 1]);
        maxD.setDate(maxD.getDate() + 7);
        start = minD.toISOString().split('T')[0];
        end = maxD.toISOString().split('T')[0];
      } else {
        start = past60Days;
        end = today;
      }
    }

    setTempGibQueryCreds(prev => ({
      username: prev.username || gibCredentials.username || gibFetchCredentials.username || localStorage.getItem('gib_username') || '',
      password: prev.password || gibCredentials.password || gibFetchCredentials.password || localStorage.getItem('gib_password') || '',
      startDate: start || past60Days,
      endDate: end || today
    }));
    setIsGibQueryModalOpen(true);
  };

  // Manuel GİB Faturasını Sistem Faturasına Bağlama
  const handleManualBindGibInvoice = async (systemInvoiceId: string, gibInvoice: any) => {
    try {
      const officialNo = gibInvoice.belgeNumarasi || gibInvoice.faturaNo;
      const officialUuid = gibInvoice.ettn || gibInvoice.uuid || gibInvoice.faturaUuid;

      if (!officialNo && !officialUuid) {
        toast.error('Bu faturada resmi belge numarası veya UUID bulunamadı.');
        return;
      }

      await updateKesilecekFatura(systemInvoiceId, {
        faturaNo: officialNo,
        gibUuid: officialUuid
      });

      const realSales = (satisFaturalari || []).find(sf => sf.id === systemInvoiceId);
      if (realSales) {
        await updateSatisFatura(systemInvoiceId, {
          ...realSales,
          faturaNo: officialNo,
          gibUuid: officialUuid
        } as any);
      }

      setGibQueryResult(prev => {
        if (!prev) return null;
        const targetInv = prev.unmatched.find(u => u.id === systemInvoiceId);
        if (!targetInv) return prev;
        return {
          ...prev,
          unmatched: prev.unmatched.filter(u => u.id !== systemInvoiceId),
          matched: [...prev.matched, { systemInvoice: targetInv, gibInvoice, newFaturaNo: officialNo }]
        };
      });

      toast.success(`${officialNo || 'Fatura'} başarıyla sistem faturasına bağlandı!`);
    } catch (err: any) {
      console.error('Manuel bağlama hatası:', err);
      toast.error('Bağlama hatası: ' + err.message);
    }
  };

  // GİB Faturalarını Sistem Kayıtlarıyla Akıllı Eşleştirme ve Fatura No Güncelleme
  const matchAndApplyGibInvoices = async (
    gibList: any[],
    customTargets?: any[],
    dateRangeInfo?: { startDate: string; endDate: string }
  ) => {
    if (!gibList || gibList.length === 0) {
      toast.warning('Eşleştirilecek GİB faturası bulunamadı.');
      return;
    }

    const targets = (customTargets && customTargets.length > 0)
      ? customTargets
      : (selectedKesilenIds.length > 0
          ? resolvedInvoices.filter((f: any) => selectedKesilenIds.includes(f.id))
          : resolvedInvoices);

    if (targets.length === 0) {
      toast.info('Sistemde eşleştirilecek kesilmiş fatura bulunamadı.');
      return;
    }

    toast.info(`${gibList.length} adet GİB faturası, sistemdeki ${targets.length} adet fatura ile akıllı eşleştiriliyor...`);

    const cleanDigits = (val: any) => String(val || '').replace(/\D/g, '').trim();

    const normalizeText = (text: string) => {
      return (text || '')
        .toLowerCase()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const extractGibAmount = (g: any) => {
      if (!g) return 0;
      const raw = g.odenecek 
        ?? g.odenecekTutar 
        ?? g.belgeTutari 
        ?? g.faturaTutari 
        ?? g.toplamTutar 
        ?? g.vergilerDahilToplamTutar 
        ?? g.genelToplam
        ?? g.toplam
        ?? g.tutar;
      return parseGibAmount(raw);
    };

    const amountsMatch = (fAmt: number, gAmt: number): boolean => {
      if (fAmt <= 0 || gAmt <= 0) return false;
      // 1. Doğrudan eşitlik (1.05 TL kuruş toleransı)
      if (Math.abs(fAmt - gAmt) < 1.05) return true;
      // 2. KDV Dahil / Hariç farklılıkları (%20, %10, %1, %8)
      const vatRates = [1.20, 1.10, 1.01, 1.08];
      for (const r of vatRates) {
        if (Math.abs(fAmt * r - gAmt) < 1.50) return true;
        if (Math.abs(gAmt * r - fAmt) < 1.50) return true;
      }
      // 3. Stopaj kesintisi toleransı (%20 stopaj: * 0.80)
      if (Math.abs(fAmt * 0.80 - gAmt) < 1.50) return true;
      if (Math.abs(gAmt * 0.80 - fAmt) < 1.50) return true;
      return false;
    };

    const titlesMatch = (nameA: string, nameB: string): boolean => {
      const normA = normalizeText(nameA).replace(/\s/g, '');
      const normB = normalizeText(nameB).replace(/\s/g, '');
      if (!normA || !normB) return false;
      if (normA.includes(normB) || normB.includes(normA)) return true;

      // Kelime bazlı benzerlik (Örn: ABC İnşaat San. Tic. Ltd. Şti. ile ABC İNŞAAT)
      const STOP_WORDS = new Set(['ve', 'ile', 'san', 'tic', 'ltd', 'sti', 'as', 'a', 's', 'sanayi', 'ticaret', 'limited', 'sirketi', 'anonim']);
      const wordsA = normalizeText(nameA).split(' ').filter(w => w.length >= 3 && !STOP_WORDS.has(w));
      const wordsB = normalizeText(nameB).split(' ').filter(w => w.length >= 3 && !STOP_WORDS.has(w));
      if (wordsA.length > 0 && wordsB.length > 0) {
        const common = wordsA.filter(w => wordsB.includes(w));
        if (common.length >= 1) return true;
      }
      return false;
    };

    const matched: any[] = [];
    const unmatched: any[] = [];
    const matchedGibIndices = new Set<number>();

    for (const f of targets) {
      const fTutar = Number(f.tutar) || 0;
      const fVknClean = cleanDigits(f.vknTckn);
      const fUuid = (f.gibUuid || '').toLowerCase().trim();
      const fNo = (f.faturaNo || '').trim();
      const fName = `${f.ad || ''} ${f.soyad || ''}`.trim();

      let match: any = null;
      let matchIndex = -1;

      // 1. Fatura / Belge Numarası Eşleşmesi (En kesin resmi numara)
      if (fNo && fNo !== 'Taslak') {
        matchIndex = gibList.findIndex((g, idx) => {
          if (matchedGibIndices.has(idx)) return false;
          const gNo = (g.belgeNumarasi || g.faturaNo || '').trim();
          return gNo && gNo === fNo;
        });
        if (matchIndex >= 0) match = gibList[matchIndex];
      }

      // 2. Gerçek VKN / TCKN (11111111111 hariç) + Tutar Eşleşmesi
      if (!match && fVknClean && fVknClean !== '11111111111') {
        matchIndex = gibList.findIndex((g, idx) => {
          if (matchedGibIndices.has(idx)) return false;
          const gVkn = cleanDigits(g.aliciVknTckn || g.vknTckn || g.aliciVergiNo || g.aliciTcKimlikNo || g.vergiNo);
          const gTutar = extractGibAmount(g);
          return gVkn === fVknClean && amountsMatch(fTutar, gTutar);
        });
        if (matchIndex >= 0) match = gibList[matchIndex];
      }

      // 3. UUID / ETTN Eşleşmesi (Mükerrer sahte UUID'lerin yanlış bağlanmasını önlemek için VKN, Tutar veya İsim doğrulamasıyla)
      if (!match && fUuid) {
        matchIndex = gibList.findIndex((g, idx) => {
          if (matchedGibIndices.has(idx)) return false;
          const gUuid = (g.ettn || g.uuid || g.faturaUuid || '').toLowerCase().trim();
          if (gUuid !== fUuid) return false;
          // Doğrulama: VKN, isim veya tutardan en az biri uyuşmalı
          const gVkn = cleanDigits(g.aliciVknTckn || g.vknTckn || g.aliciVergiNo || g.aliciTcKimlikNo || g.vergiNo);
          const gTutar = extractGibAmount(g);
          const gName = g.aliciUnvanAdSoyad || g.aliciUnvan || g.unvan || g.aliciAdi || '';
          return (fVknClean && gVkn === fVknClean) || amountsMatch(fTutar, gTutar) || titlesMatch(fName, gName);
        });
        if (matchIndex >= 0) match = gibList[matchIndex];
      }

      // 4. Gerçek VKN / TCKN (11111111111 hariç) + Ünvan/İsim Eşleşmesi
      if (!match && fVknClean && fVknClean !== '11111111111') {
        matchIndex = gibList.findIndex((g, idx) => {
          if (matchedGibIndices.has(idx)) return false;
          const gVkn = cleanDigits(g.aliciVknTckn || g.vknTckn || g.aliciVergiNo || g.aliciTcKimlikNo || g.vergiNo);
          const gName = g.aliciUnvanAdSoyad || g.aliciUnvan || g.unvan || g.aliciAdi || '';
          return gVkn === fVknClean && titlesMatch(fName, gName);
        });
        if (matchIndex >= 0) match = gibList[matchIndex];
      }

      // 5. Alıcı Ünvanı / İsim + Tutar Eşleşmesi (11111111111 ve perakende şahıs dahil tüm müşteriler)
      if (!match && fName.length >= 2) {
        matchIndex = gibList.findIndex((g, idx) => {
          if (matchedGibIndices.has(idx)) return false;
          const gName = g.aliciUnvanAdSoyad || g.aliciUnvan || g.unvan || g.aliciAdi || '';
          const gTutar = extractGibAmount(g);
          return titlesMatch(fName, gName) && amountsMatch(fTutar, gTutar);
        });
        if (matchIndex >= 0) match = gibList[matchIndex];
      }

      // 6. Gerçek VKN/TCKN ile tekil kayıt (GİB listesinde bu VKN'ye ait yalnızca 1 fatura varsa)
      if (!match && fVknClean && fVknClean !== '11111111111') {
        const sameVknIndices: number[] = [];
        gibList.forEach((g, idx) => {
          if (matchedGibIndices.has(idx)) return;
          const gVkn = cleanDigits(g.aliciVknTckn || g.vknTckn || g.aliciVergiNo || g.aliciTcKimlikNo || g.vergiNo);
          if (gVkn === fVknClean) sameVknIndices.push(idx);
        });
        if (sameVknIndices.length === 1) {
          matchIndex = sameVknIndices[0];
          match = gibList[matchIndex];
        }
      }

      // 7. Tekil Tutar Eşleşmesi (GİB listesinde bu tutarda yalnızca 1 adet eşleşmemiş fatura varsa)
      if (!match && fTutar > 0) {
        const sameAmountIndices: number[] = [];
        gibList.forEach((g, idx) => {
          if (matchedGibIndices.has(idx)) return;
          const gTutar = extractGibAmount(g);
          if (amountsMatch(fTutar, gTutar)) {
            sameAmountIndices.push(idx);
          }
        });
        if (sameAmountIndices.length === 1) {
          matchIndex = sameAmountIndices[0];
          match = gibList[matchIndex];
        }
      }

      if (match && matchIndex >= 0) {
        matchedGibIndices.add(matchIndex);
        const officialNo = match.belgeNumarasi || match.faturaNo;
        const officialUuid = match.ettn || match.uuid || match.faturaUuid;

        if (officialNo || officialUuid) {
          await updateKesilecekFatura(f.id, {
            faturaNo: officialNo || f.faturaNo,
            gibUuid: officialUuid || f.gibUuid
          });

          if (f.isRealSalesInvoice) {
            await updateSatisFatura(f.id, {
              ...f,
              faturaNo: officialNo || f.faturaNo,
              gibUuid: officialUuid || f.gibUuid
            } as any);
          }
        }

        matched.push({ systemInvoice: f, gibInvoice: match, newFaturaNo: officialNo });
      } else {
        unmatched.push(f);
      }
    }

    setGibQueryResult({
      matched,
      unmatched,
      allGib: gibList,
      queryRange: dateRangeInfo
    });
    setResultActiveTab(matched.length > 0 ? 'matched' : (unmatched.length > 0 ? 'unmatched' : 'all'));
    setIsGibResultModalOpen(true);
    setIsGibQueryModalOpen(false);

    if (matched.length > 0) {
      toast.success(`${matched.length} faturanın GİB resmi numarası başarıyla eşleştirildi ve kaydedildi!`);
    }
    if (unmatched.length > 0) {
      toast.warning(`${unmatched.length} fatura GİB'de bulunamadı (henüz kesilmemiş veya bilgileri uyuşmuyor).`);
    }
  };

  // Seçilen faturaları GİB'den sorgulayıp fatura numaralarını getirme
  const handleQueryGibForSelected = async (customCreds?: {
    username?: string;
    password?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const credUsername = (customCreds?.username || tempGibQueryCreds.username || gibCredentials.username || gibFetchCredentials.username || '').trim();
    const credPassword = (customCreds?.password || tempGibQueryCreds.password || gibCredentials.password || gibFetchCredentials.password || '').trim();

    if (!credUsername || !credPassword) {
      openGibQueryModal();
      return;
    }

    const credentials = { username: credUsername, password: credPassword };
    setGibCredentials(credentials);
    setGibFetchCredentials(credentials);
    if (credUsername) localStorage.setItem('gib_username', credUsername);
    if (credPassword) localStorage.setItem('gib_password', credPassword);

    const targets = selectedKesilenIds.length > 0
      ? resolvedInvoices.filter((f: any) => selectedKesilenIds.includes(f.id))
      : resolvedInvoices;

    if (targets.length === 0) {
      toast.info('Sorgulanacak kesilmiş fatura bulunamadı.');
      return;
    }

    const now = new Date();
    const past60Days = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    let queryStart = customCreds?.startDate || tempGibQueryCreds.startDate || kesilenStartDate;
    let queryEnd = customCreds?.endDate || tempGibQueryCreds.endDate || kesilenEndDate;

    if (!queryStart || !queryEnd) {
      const parsedTimes = targets
        .map((f: any) => parseInvoiceDate(f.faturaTarihi, f.olusturmaTarihi))
        .filter(t => t > 0)
        .sort((a, b) => a - b);

      if (parsedTimes.length > 0) {
        const minD = new Date(parsedTimes[0]);
        minD.setDate(minD.getDate() - 7);
        const maxD = new Date(parsedTimes[parsedTimes.length - 1]);
        maxD.setDate(maxD.getDate() + 7);
        queryStart = queryStart || minD.toISOString().split('T')[0];
        queryEnd = queryEnd || maxD.toISOString().split('T')[0];
      } else {
        queryStart = queryStart || past60Days;
        queryEnd = queryEnd || today;
      }
    }

    setIsGibQuerying(true);
    try {
      toast.info(`GİB e-Arşiv faturaları sorgulanıyor (${queryStart} - ${queryEnd})...`);

      const apiUrl = import.meta.env.DEV ? 'http://localhost:5000/api/gib/invoices' : '/api/gib/invoices';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          credentials,
          startDate: queryStart,
          endDate: queryEnd
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'GİB faturaları alınamadı.');
      }

      const gibList: any[] = result.data || [];
      setGibInvoices(gibList);
      toast.info(`GİB'den ${gibList.length} adet fatura alındı.`);

      await matchAndApplyGibInvoices(gibList, targets, { startDate: queryStart, endDate: queryEnd });
    } catch (err: any) {
      console.error('GİB sorgulama hatası:', err);
      toast.error('GİB sorgulama hatası: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setIsGibQuerying(false);
    }
  };

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

  const handleVknLookup = async () => {
    if (!form.vknTckn || form.vknTckn.length < 10) {
      toast.error('Lütfen geçerli bir VKN veya TCKN girin.');
      return;
    }
    if (!gibCredentials.username || !gibCredentials.password) {
      toast.info('Otomatik sorgulama için lütfen önce Toplu Gönder veya GİB\'den Çek menüsünden bir kez GİB şifrenizi girin.');
      return;
    }
    
    setIsVknLoading(true);
    try {
      const apiUrl = import.meta.env.DEV ? 'http://localhost:5000/api/gib/recipient-info' : '/api/gib/recipient-info';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ credentials: gibCredentials, vknTckn: form.vknTckn })
      });
      const result = await response.json();
      
      if (result.success && result.data) {
        setForm(prev => ({
          ...prev,
          ad: result.data.unvan || result.data.adi || '',
          soyad: result.data.soyadi || '',
          vergiDairesi: result.data.vergiDairesi || ''
        }));
        toast.success('GİB bilgileri getirildi.');
      } else {
        toast.error(result.message || 'Mükellef bulunamadı.');
      }
    } catch (err) {
      toast.error('Sorgulama hatası.');
    } finally {
      setIsVknLoading(false);
    }
  };

  const handleBulkLookup = async () => {
    if (!gibCredentials.username || !gibCredentials.password) {
      toast.info('Lütfen önce GİB şifrenizi tanımlayın (Toplu Gönder menüsünden).');
      return;
    }
    
    setIsBulkLookupRunning(true);
    let successes = 0;
    const apiUrl = import.meta.env.DEV ? 'http://localhost:5000/api/gib/recipient-info' : '/api/gib/recipient-info';
    
    for (let i = 0; i < selectedInvoiceIdsForGib.length; i++) {
      setBulkLookupProgress({ current: i + 1, total: selectedInvoiceIdsForGib.length });
      const invId = selectedInvoiceIdsForGib[i];
      const inv = pendingInvoices.find(f => f.id === invId);
      
      if (!inv || !inv.vknTckn) continue;
      
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ credentials: gibCredentials, vknTckn: inv.vknTckn })
        });
        const result = await response.json();
        
        if (result.success && result.data) {
          successes++;
          updateKesilecekFatura(inv.id, {
            ad: result.data.unvan || result.data.adi || inv.ad,
            soyad: result.data.soyadi || inv.soyad,
            vergiDairesi: result.data.vergiDairesi || inv.vergiDairesi
          });
        }
      } catch (err) {
        console.error(err);
      }
    }
    
    setIsBulkLookupRunning(false);
    toast.success(`Toplu VKN sorgusu tamamlandı. ${successes} fatura güncellendi.`);
  };

  const loadInvoiceForEdit = (f: KesilecekFatura) => {
    setEditingInvoiceId(f.id);
    setIsFormOpen(true);
    setForm({
      ad: f.ad, soyad: f.soyad || '', vknTckn: f.vknTckn, vergiDairesi: f.vergiDairesi || '',
      adres: f.adres || '', il: f.il || '', ilce: f.ilce || '', kdvOrani: String(f.kdvOrani || 20),
      faturaTarihi: f.faturaTarihi || new Date().toISOString().split('T')[0],
      aciklama: f.aciklama || '', cariId: f.cariId || 'none',
      kdvHesaplamaTipi: f.kdvDahil ? 'DAHIL' : 'HARIC'
    });
    setKalemler(f.kalemler && f.kalemler.length > 0 ? [...f.kalemler] : [newKalem()]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingInvoiceId(null);
    setIsFormOpen(false);
    setForm({ ad: '', soyad: '', vknTckn: '', vergiDairesi: '', adres: '', il: '', ilce: '', kdvOrani: '20', faturaTarihi: new Date().toISOString().split('T')[0], aciklama: '', cariId: 'none', kdvHesaplamaTipi: 'DAHIL' });
    setKalemler([newKalem()]);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ad || !form.vknTckn) {
      toast.error('Lütfen müşteri adı ve VKN/TC alanlarını doldurun.');
      return;
    }
    const kalemlerDolu = kalemler.filter(k => String(k.ad || '').trim() && (Number(k.birimFiyat) || 0) > 0);
    if (kalemlerDolu.length === 0) {
      toast.error('En az bir kalem ekleyin (ad ve birim fiyat dolu olmalı).');
      return;
    }

    const invoiceData = {
      ad: form.ad, soyad: form.soyad, vknTckn: form.vknTckn,
      vergiDairesi: form.vergiDairesi, adres: form.adres, il: form.il, ilce: form.ilce,
      tutar: kalemToplam.toplam,
      kdvDahil: form.kdvHesaplamaTipi === 'DAHIL',
      kdvOrani: parseInt(form.kdvOrani),
      faturaTarihi: form.faturaTarihi,
      aciklama: form.aciklama,
      kalemler: kalemlerDolu,
      cariId: form.cariId !== 'none' ? form.cariId : undefined,
    };

    if (editingInvoiceId) {
      updateKesilecekFatura(editingInvoiceId, invoiceData);
      toast.success('Fatura planı güncellendi.');
    } else {
      addKesilecekFatura(invoiceData);
      toast.success('Fatura planı listeye eklendi.');
    }

    cancelEdit();
  };

  const downloadTemplate = () => {
    const template = [{ 
      'Ad (veya Firma)': 'Örnek A.Ş.', 
      'Soyad (Şahıs ise)': '', 
      'VKN / TCKN': '1234567890', 
      'Vergi Dairesi': 'Kadıköy', 
      'Adres': 'Kadıköy / İstanbul', 
      'İl': 'İstanbul', 
      'İlçe': 'Kadıköy', 
      'Fatura Tarihi (GG.AA.YYYY)': new Date().toLocaleDateString('tr-TR'), 
      'Ürün/Hizmet Adı': 'Sistem Bakım Ücreti',
      'Miktar': '1',
      'Birim Fiyat': '1500.50',
      'Tutar': '1500.50', 
      'KDV Oranı': '20', 
      'KDV Dahil mi? (E/H)': 'E', 
      'Açıklama': 'Aylık bakım' 
    }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
    XLSX.writeFile(wb, 'kesilecek_fatura_sablon.xlsx');
  };

  // Akıllı Çapraz Kontrol ve Eşleştirme Motoru
  const executeCrossCheck = (uploadedRows: any[], gibInvoicesList?: any[]) => {
    // 1. Zaten kesilmiş tüm fatura havuzunu oluştur
    const allCutPool: Array<{
      date: string;
      amount: number;
      matrah?: number;
      kdvTutari?: number;
      vkn: string;
      title: string;
      faturaNo: string;
      source: string;
      raw: any;
    }> = [];

    // satisFaturalari (Sistemdeki resmi satış faturaları)
    satisFaturalari.forEach(sf => {
      allCutPool.push({
        date: sf.faturaTarihi || '',
        amount: Number(sf.alinanUcret) || 0,
        matrah: sf.matrah ? Number(sf.matrah) : undefined,
        kdvTutari: sf.kdvTutari ? Number(sf.kdvTutari) : undefined,
        vkn: cleanDigits(sf.tcVkn),
        title: `${sf.ad || ''} ${sf.soyad || ''}`.trim(),
        faturaNo: sf.faturaNo || '',
        source: 'Kayıtlı Satış Faturası',
        raw: sf
      });
    });

    // kesilecekFaturalar içinde durumu 'kesildi' olan veya faturaNo atanmış olanlar
    kesilecekFaturalar.forEach(kf => {
      if (kf.durum === 'kesildi' || (kf.faturaNo && kf.faturaNo.trim() !== '')) {
        allCutPool.push({
          date: kf.faturaTarihi || '',
          amount: Number(kf.tutar) || 0,
          matrah: kf.matrah ? Number(kf.matrah) : undefined,
          kdvTutari: kf.kdvTutari ? Number(kf.kdvTutari) : undefined,
          vkn: cleanDigits(kf.vknTckn),
          title: `${kf.ad || ''} ${kf.soyad || ''}`.trim(),
          faturaNo: kf.faturaNo || '',
          source: 'Kesilmiş Fatura',
          raw: kf
        });
      }
    });

    // GİB e-Arşiv listesi
    const currentGibList = gibInvoicesList || gibInvoices || [];
    currentGibList.forEach(g => {
      const gTutar = parseGibAmount(g.tutar || g.faturaTutari || g.toplamTutar || g.odenecekTutar || g.vergilerDahilToplamTutar);
      const gParts = (g.belgeTarihi || '').split(/[.\/-]/);
      const gFormattedDate = gParts.length === 3 ? `${gParts[2]}-${gParts[1]}-${gParts[0]}` : (g.belgeTarihi || '');
      allCutPool.push({
        date: gFormattedDate,
        amount: gTutar,
        matrah: g.matrah ? Number(g.matrah) : undefined,
        kdvTutari: g.kdvTutari ? Number(g.kdvTutari) : undefined,
        vkn: cleanDigits(g.aliciVknTckn || g.vknTckn),
        title: getAliciUnvan(g),
        faturaNo: g.belgeNumarasi || 'GİB Taslak/Onaylı',
        source: 'GİB e-Arşiv',
        raw: g
      });
    });

    const matchedList: any[] = [];
    const unmatchedList: any[] = [];
    const usedTargetIndices = new Set<number>();

    for (const row of uploadedRows) {
      const rowDate = row.faturaTarihi || '';
      const rowTutar = Number(row.tutar) || 0;
      const rowVknClean = cleanDigits(row.vknTckn);
      const rowTitle = `${row.ad || ''} ${row.soyad || ''}`.trim();

      let matchedIdx = -1;
      let matchType: 'TC111_NAME_MATCH' | 'VKN_MATCH' | 'TITLE_MATCH' = 'VKN_MATCH';

      // 1. ÖZEL KURAL: Eğer VKN 11111111111 ise -> ADA GÖRE kontrol et (Tarih + Tutar + Müşteri Adı/Unvanı)
      if (rowVknClean === '11111111111') {
        matchedIdx = allCutPool.findIndex((target, idx) => {
          if (usedTargetIndices.has(idx)) return false;
          const amountsOk = amountsMatch(rowTutar, target.amount);
          const datesOk = datesMatch(rowDate, target.date);
          const namesOk = titlesMatch(rowTitle, target.title);
          return amountsOk && datesOk && namesOk;
        });
        if (matchedIdx >= 0) {
          matchType = 'TC111_NAME_MATCH';
        }
      } else {
        // 2. STANDART KURAL: Tarih + Tutar + VKN eşleştirmesi
        matchedIdx = allCutPool.findIndex((target, idx) => {
          if (usedTargetIndices.has(idx)) return false;
          const amountsOk = amountsMatch(rowTutar, target.amount);
          const datesOk = datesMatch(rowDate, target.date);
          const vknOk = rowVknClean && target.vkn && rowVknClean === target.vkn;
          return amountsOk && datesOk && vknOk;
        });
        if (matchedIdx >= 0) {
          matchType = 'VKN_MATCH';
        } else if (rowTitle.length >= 3) {
          // VKN formatı farklı veya boşsa İsim + Tarih + Tutar yedek eşleşmesi
          matchedIdx = allCutPool.findIndex((target, idx) => {
            if (usedTargetIndices.has(idx)) return false;
            const amountsOk = amountsMatch(rowTutar, target.amount);
            const datesOk = datesMatch(rowDate, target.date);
            const namesOk = titlesMatch(rowTitle, target.title);
            return amountsOk && datesOk && namesOk;
          });
          if (matchedIdx >= 0) {
            matchType = 'TITLE_MATCH';
          }
        }
      }

      if (matchedIdx >= 0) {
        usedTargetIndices.add(matchedIdx);
        matchedList.push({
          excelRow: row,
          matchedInvoice: allCutPool[matchedIdx],
          matchType
        });
      } else {
        unmatchedList.push({
          excelRow: row
        });
      }
    }

    setCrossCheckResult({
      totalUploaded: uploadedRows.length,
      matchedList,
      unmatchedList,
      isCalculated: true
    });
    setCrossCheckActiveTab(unmatchedList.length > 0 ? 'unmatched' : 'matched');
  };

  const handleCrossCheckFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCrossCheckFileName(file.name);
    setIsCrossChecking(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws, { raw: true });

        if (!rawData || rawData.length === 0) {
          toast.warning('Yüklenen dosya boş.');
          setIsCrossChecking(false);
          return;
        }

        const parsedRows = rawData.map((row: any) => {
          const rawDate = row['Fatura Tarihi (GG.AA.YYYY)'] || row['Fatura Tarihi'] || row['Tarih'] || row['Belge Tarihi'] || row['Tarih (GG.AA.YYYY)'];
          const parsedDate = parseExcelDate(rawDate);

          const miktar = parseFloat(String(row['Miktar'] || '1').replace(',', '.')) || 1;
          const birimFiyat = parseFloat(String(row['Birim Fiyat'] || '0').replace(',', '.')) || 0;
          let tutar = parseFloat(String(row['Tutar'] || row['Toplam Tutar'] || row['Genel Toplam'] || row['Ödenecek Tutar'] || row['Toplam'] || '0').replace(',', '.')) || 0;
          if (tutar === 0 && birimFiyat > 0) tutar = miktar * birimFiyat;

          const rawMatrah = row['Matrah'] || row['Mal Hizmet Toplam'] || row['Vergisiz Tutar'];
          const matrah = rawMatrah ? parseFloat(String(rawMatrah).replace(',', '.')) : (tutar > 0 ? +(tutar / 1.2).toFixed(2) : 0);

          const rawKdv = row['KDV'] || row['KDV Tutarı'] || row['Hesaplanan KDV'];
          const kdvTutari = rawKdv ? parseFloat(String(rawKdv).replace(',', '.')) : +(tutar - matrah).toFixed(2);

          const urunAdi = row['Ürün/Hizmet Adı'] || row['Hizmet Adı'] || row['Ürün Adı'] || row['Açıklama'] || 'Hizmet Bedeli';

          const vkn = String(row['VKN / TCKN'] || row['VKN'] || row['TCKN'] || row['Vergi No'] || row['Müşteri VKN'] || '').trim();
          const ad = String(row['Ad (veya Firma)'] || row['Firma Adı'] || row['Müşteri'] || row['Unvan'] || row['Alıcı Unvan'] || row['Ad'] || '').trim();
          const soyad = String(row['Soyad (Şahıs ise)'] || row['Soyad'] || '').trim();

          return {
            ad,
            soyad,
            vknTckn: vkn,
            vergiDairesi: String(row['Vergi Dairesi'] || ''),
            adres: String(row['Adres'] || ''),
            il: String(row['İl'] || ''),
            ilce: String(row['İlçe'] || ''),
            tutar,
            matrah,
            kdvTutari,
            kdvOrani: parseInt(row['KDV Oranı'] || '20') || 20,
            faturaTarihi: parsedDate,
            aciklama: String(row['Açıklama'] || 'Excel Çapraz Kontrol Listesinden Aktarıldı'),
            kdvDahil: (row['KDV Dahil mi? (E/H)'] || 'E').toUpperCase() !== 'H',
            urunAdi,
            miktar,
            birimFiyat: birimFiyat > 0 ? birimFiyat : tutar,
            kalemler: [
              {
                id: 'k' + Date.now() + Math.random().toString(36).substr(2, 5),
                ad: urunAdi,
                miktar,
                birim: 'C62',
                birimFiyat: birimFiyat > 0 ? birimFiyat : tutar,
                kdvOrani: parseInt(row['KDV Oranı'] || '20') || 20,
                tevkifatOrani: 0
              }
            ]
          };
        });

        executeCrossCheck(parsedRows);
        toast.success(`${parsedRows.length} fatura başarıyla okundu ve çapraz kontrolden geçirildi.`);
      } catch (err: any) {
        console.error('Dosya okuma hatası:', err);
        toast.error('Dosya okunamadı. Lütfen geçerli bir Excel veya CSV dosyası yükleyin.');
      } finally {
        setIsCrossChecking(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportUnmatchedToKesilecek = async () => {
    if (!crossCheckResult.unmatchedList || crossCheckResult.unmatchedList.length === 0) {
      toast.info('Eklenecek kesilmemiş fatura bulunamadı.');
      return;
    }

    setIsImportingUnmatched(true);
    let addedCount = 0;
    try {
      for (const item of crossCheckResult.unmatchedList) {
        const row = item.excelRow;
        await addKesilecekFatura({
          ad: row.ad,
          soyad: row.soyad,
          vknTckn: row.vknTckn,
          vergiDairesi: row.vergiDairesi,
          adres: row.adres,
          il: row.il,
          ilce: row.ilce,
          tutar: row.tutar,
          matrah: row.matrah,
          kdvTutari: row.kdvTutari,
          kdvOrani: row.kdvOrani,
          faturaTarihi: row.faturaTarihi,
          aciklama: row.aciklama,
          kdvDahil: row.kdvDahil,
          kalemler: row.kalemler
        });
        addedCount++;
      }

      toast.success(`${addedCount} adet kesilmemiş fatura Kesilecek Faturalar listesine eklendi! (${crossCheckResult.matchedList.length} adet mükerrer fatura korundu)`);
      setIsCrossCheckModalOpen(false);
      setActiveTab('bekleyen');
    } catch (err: any) {
      console.error('Aktarma hatası:', err);
      toast.error('Aktarma sırasında hata oluştu: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setIsImportingUnmatched(false);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { raw: true });
        data.forEach((row: any) => {
          let parsedDate = new Date().toISOString().split('T')[0];
          const rowDate = row['Fatura Tarihi (GG.AA.YYYY)'];
          
          if (rowDate) {
            if (typeof rowDate === 'number') {
              const dateObj = new Date(Math.round((rowDate - 25569) * 86400 * 1000));
              const yyyy = dateObj.getUTCFullYear();
              const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
              const dd = String(dateObj.getUTCDate()).padStart(2, '0');
              parsedDate = `${yyyy}-${mm}-${dd}`;
            } else if (typeof rowDate === 'string') {
              const strDate = rowDate.trim();
              const parts = strDate.split(/[.\/-]/);
              if (parts.length === 3) {
                if (parts[2].length === 4) {
                  parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                } else if (parts[0].length === 4) {
                  parsedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                } else if (parts[2].length === 2) {
                  const year = parseInt(parts[2]) > 50 ? "19" + parts[2] : "20" + parts[2];
                  parsedDate = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
              } else {
                parsedDate = strDate.split('T')[0];
              }
            } else if (rowDate instanceof Date) {
              const yyyy = rowDate.getFullYear();
              const mm = String(rowDate.getMonth() + 1).padStart(2, '0');
              const dd = String(rowDate.getDate()).padStart(2, '0');
              parsedDate = `${yyyy}-${mm}-${dd}`;
            }
          }

          const miktar = parseFloat(String(row['Miktar'] || '1').replace(',', '.')) || 1;
          const birimFiyat = parseFloat(String(row['Birim Fiyat'] || '0').replace(',', '.')) || 0;
          let tutar = parseFloat(String(row['Tutar'] || '0').replace(',', '.')) || 0;
          if (tutar === 0 && birimFiyat > 0) tutar = miktar * birimFiyat;
          
          const urunAdi = row['Ürün/Hizmet Adı'] || row['Açıklama'] || 'Hizmet';

          addKesilecekFatura({
            ad: row['Ad (veya Firma)'] || '', soyad: row['Soyad (Şahıs ise)'] || '',
            vknTckn: String(row['VKN / TCKN'] || ''), vergiDairesi: row['Vergi Dairesi'] || '',
            adres: row['Adres'] || '', il: row['İl'] || '', ilce: row['İlçe'] || '',
            tutar: tutar,
            kdvOrani: parseInt(row['KDV Oranı'] || '20') || 0,
            faturaTarihi: parsedDate,
            aciklama: row['Açıklama'] || '',
            kdvDahil: (row['KDV Dahil mi? (E/H)'] || 'E').toUpperCase() === 'E',
            kalemler: [
              {
                id: 'k' + Date.now() + Math.random().toString(36).substr(2, 5),
                ad: urunAdi,
                miktar: miktar,
                birim: 'C62',
                birimFiyat: birimFiyat > 0 ? birimFiyat : tutar,
                kdvOrani: parseInt(row['KDV Oranı'] || '20') || 0,
                tevkifatOrani: 0
              }
            ]
          });
        });
        toast.success(`${data.length} kayıt başarıyla yüklendi.`);
      } catch { toast.error('Excel okuma hatası. Lütfen şablonu kullanın.'); }
    };
    reader.readAsBinaryString(file);
  };

  const convertToRealInvoice = (f: KesilecekFatura) => {
    // Tüm kalemleri stokKalemleri formatına dönüştür
    const stokKalemleri = (f.kalemler || [])
      .filter(k => k.urunId)
      .map(k => ({
        id: k.id || ('sk' + Date.now() + Math.random().toString(36).slice(2)),
        urunId: k.urunId || '',
        miktar: k.miktar || 1,
        birimFiyat: k.birimFiyat || 0,
        urunAdi: k.ad || '',
      }));
    
    const aciklamaList = (f.kalemler || []).map(k => `${k.miktar}x ${k.ad}`).join(', ');
    
    openSatisDrawer({
      // Cari / Müşteri bilgileri
      ad: f.ad,
      soyad: f.soyad || '-',
      tcVkn: f.vknTckn,
      adres: f.adres || '',
      // Cari ID — SatisFaturaDrawer'daki açılır listede otomatik seçer
      cariId: f.cariId,
      // Tutar ve açıklama
      alinanUcret: String(f.tutar),
      aciklama: f.aciklama || aciklamaList || '',
      // Stok Kalemleri dahil olmak üzere SatisFaturaDrawer'a aktarıyoruz
      stokKalemleri,
    } as any);
    updateKesilecekFatura(f.id, { durum: 'kesildi' });
  };

  const transferToSales = async (f: KesilecekFatura, newUuid?: string, newFaturaNo?: string, silent = false) => {
    try {
      const finalUuid = newUuid || f.gibUuid;
      const finalFaturaNo = newFaturaNo || f.faturaNo;
      const exists = satisFaturalari.some((sf: any) => (sf.faturaNo && sf.faturaNo === finalFaturaNo) || (sf.gibUuid && sf.gibUuid === finalUuid));
      if (exists) {
        if (!silent) toast.info('Bu fatura zaten satış faturalarına aktarılmış.');
        return;
      }
      
      const formattedDate = f.faturaTarihi || new Date().toISOString().split('T')[0];
      
      await addSatisFatura({
        id: finalUuid || f.id || Date.now().toString(),
        gibUuid: finalUuid,
        tcVkn: f.vknTckn,
        ad: f.ad,
        soyad: f.soyad || '',
        vergiDairesi: f.vergiDairesi || '',
        adres: f.adres || 'Sistemden Aktarıldı',
        hizmetAdi: 'Kesilen Fatura Aktarımı',
        alinanUcret: f.tutar.toString(),
        faturaTarihi: formattedDate,
        kdvOrani: f.kdvOrani?.toString() || '20',
        tevkifatOrani: '0',
        tevkifatKodu: '',
        stopajOrani: f.stopajOrani || '0',
        stopajKodu: '',
        faturaNo: finalFaturaNo || '',
        aciklama: f.aciklama || 'Sistem üzerinden kesilip satışlara aktarıldı.',
        cariId: f.cariId,
      } as any);

      if (!silent) toast.success(`${finalFaturaNo || 'Fatura'} satış faturalarına aktarıldı.`);
    } catch (err: any) {
      console.error(err);
      if (!silent) toast.error('Satışlara aktarım sırasında hata oluştu: ' + err.message);
    }
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
        const newUuid = result.data?.invoiceUUID || undefined;
        const newFaturaNo = result.data?.invoiceNo || undefined;
        toast.success(result.message + (newUuid ? ` (UUID: ${newUuid})` : ''));
        setIsGibModalOpen(false);
        updateKesilecekFatura(selectedInvoiceForGib.id, { 
          durum: 'kesildi',
          gibUuid: newUuid,
          faturaNo: newFaturaNo
        });
        // Otomatik olarak satışlara aktar
        transferToSales(selectedInvoiceForGib, newUuid, newFaturaNo);
      } else {
        const errorMsg = result.message || '';
        if (errorMsg.includes('açık') || errorMsg.includes('Güvenli Çıkış') || errorMsg.includes('oturum') || errorMsg.includes('kilit')) {
          toast.error(`GİB Oturum Uyarısı: ${errorMsg}`, {
            duration: 8000,
            action: {
              label: 'Güvenli Çıkış Yap',
              onClick: () => handleGibForceLogout()
            }
          });
        } else {
          toast.error(`${result.error || 'GİB Hatası'}: ${result.message}`);
        }
      }
    } catch {
      toast.error('Sunucuya bağlanılamadı.');
    } finally {
      setIsGibSending(false);
    }
  };

  const openGibModal = (f: KesilecekFatura) => {
    setSelectedInvoiceForGib(f);
    
    // Akıllı Otomatik Tip Tespiti
    const hasKalemTev = (f.kalemler || []).some((k: any) => parseFloat(k.tevkifatOrani) > 0 || k.tevkifatKodu);
    const hasRootTev = parseFloat(f.tevkifatOrani as any) > 0 || f.tevkifatKodu;
    if (hasKalemTev || hasRootTev) {
      setGibFaturaTipi('TEVKIFAT');
    } else if (f.faturaTipi && f.faturaTipi !== 'SATIS') {
      setGibFaturaTipi(f.faturaTipi);
    } else {
      setGibFaturaTipi('SATIS');
    }

    const hasStopaj = parseFloat(f.stopajOrani as any) > 0 || f.stopajTipi;
    if (hasStopaj) {
      setGibStopajTipi(f.stopajTipi || 'V0003');
      setGibStopajOrani(String(parseFloat(f.stopajOrani as any) || 20));
    } else {
      setGibStopajTipi('');
      setGibStopajOrani('0');
    }
    setIsGibModalOpen(true);
  };

  const openBulkGibModal = () => {
    setBulkFaturaTipi('AUTO');
    setBulkStopajMode('KEEP');
    setBulkStopajOrani('20');
    setBulkDefaultTevkifatKodu('616');
    setBulkGibProgress({ 
      current: 0, 
      total: chronologicallySortedSelected.length, 
      successes: 0, 
      errors: 0,
      currentInvoiceName: '',
      currentInvoiceDate: ''
    });
    setIsBulkGibModalOpen(true);
  };

  const handleBulkGibSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gibCredentials.username || !gibCredentials.password) {
      toast.error('Lütfen GİB giriş bilgilerinizi girin.');
      return;
    }
    
    if (chronologicallySortedSelected.length === 0) {
      toast.error('Lütfen gönderilecek faturaları seçin.');
      return;
    }

    setIsBulkGibSending(true);
    let successes = 0;
    let errors = 0;
    const apiUrl = import.meta.env.DEV ? 'http://localhost:5000/api/gib/create-draft' : '/api/gib/create-draft';
    
    // Faturaları kesinlikle ilk tarihten son tarihe (kronolojik sıra) göre gönder
    for (let i = 0; i < chronologicallySortedSelected.length; i++) {
      const inv = chronologicallySortedSelected[i];
      
      // GİB oturum ve servis stabilitesi için faturalar arasına dinlenme koy (ilk fatura hariç)
      if (i > 0) {
        await new Promise(r => setTimeout(r, 1600));
      }
      
      setBulkGibProgress(prev => ({ 
        ...prev, 
        current: i + 1, 
        total: chronologicallySortedSelected.length,
        currentInvoiceName: `${inv.ad || ''} ${inv.soyad || ''}`.trim(),
        currentInvoiceDate: inv.faturaTarihi || ''
      }));
      
      if (!inv || !inv.vknTckn) {
        errors++;
        continue;
      }

      // 1. Fatura Tipini Akıllı Belirle
      let resolvedFaturaTipi = 'SATIS';
      const hasKalemTevkifat = (inv.kalemler || []).some((k: any) => 
        (parseFloat(k.tevkifatOrani) > 0) || Boolean(k.tevkifatKodu)
      );
      const hasRootTevkifat = (parseFloat(inv.tevkifatOrani as any) > 0) || 
                              (parseFloat(inv.tevkifatTutari as any) > 0) || 
                              Boolean(inv.tevkifatKodu);

      if (bulkFaturaTipi === 'AUTO') {
        if (inv.faturaTipi && inv.faturaTipi !== 'SATIS') {
          resolvedFaturaTipi = inv.faturaTipi;
        } else if (hasKalemTevkifat || hasRootTevkifat) {
          resolvedFaturaTipi = 'TEVKIFAT';
        } else {
          resolvedFaturaTipi = 'SATIS';
        }
      } else {
        resolvedFaturaTipi = bulkFaturaTipi;
      }

      // 2. Stopaj Türü ve Oranını Belirle
      let resolvedStopajTipi: string | undefined = undefined;
      let resolvedStopajOrani: string | undefined = undefined;

      if (bulkStopajMode === 'V0003' || bulkStopajMode === 'V0011') {
        resolvedStopajTipi = bulkStopajMode;
        resolvedStopajOrani = bulkStopajOrani !== '0' ? bulkStopajOrani : undefined;
      } else if (bulkStopajMode === 'NONE') {
        resolvedStopajTipi = undefined;
        resolvedStopajOrani = undefined;
      } else {
        // 'KEEP' -> faturanın kendi stopajını koru
        const invStopajOranNum = parseFloat(inv.stopajOrani as any) || 0;
        if (inv.stopajTipi) {
          resolvedStopajTipi = inv.stopajTipi;
          resolvedStopajOrani = invStopajOranNum > 0 ? String(invStopajOranNum) : undefined;
        } else if (invStopajOranNum > 0 || (inv as any)._type === 'SMM') {
          resolvedStopajTipi = 'V0003';
          resolvedStopajOrani = invStopajOranNum > 0 ? String(invStopajOranNum) : '20';
        }
      }

      // 3. Kalemlerdeki Tevkifat Kodunu ve Oranını Güvenceye Al
      const effectiveDefaultTevkifatKodu = inv.tevkifatKodu || bulkDefaultTevkifatKodu || '616';
      const isTevkifat = resolvedFaturaTipi === 'TEVKIFAT' || hasKalemTevkifat || hasRootTevkifat;
      
      const safeKalemler = (inv.kalemler && inv.kalemler.length > 0) 
        ? inv.kalemler.map((k: any) => {
            const kOran = parseFloat(k.tevkifatOrani) || 0;
            const itemNeedsTevkifat = isTevkifat || kOran > 0;
            return {
              ...k,
              tevkifatOrani: kOran > 0 ? kOran : (itemNeedsTevkifat ? (parseFloat(inv.tevkifatOrani as any) || 50) : 0),
              tevkifatKodu: itemNeedsTevkifat ? (k.tevkifatKodu || effectiveDefaultTevkifatKodu) : ''
            };
          })
        : undefined;
      
      let sentSuccessfully = false;
      let lastErrorMessage = '';
      
      // Her fatura için en fazla 2 deneme (GİB anlık yoğunluğuna karşı otomatik kurtarma)
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (attempt > 1) {
          setBulkGibProgress(prev => ({ 
            ...prev, 
            currentInvoiceName: `${inv.ad || ''} ${inv.soyad || ''} (Yeniden deneniyor...)`.trim()
          }));
          await new Promise(r => setTimeout(r, 2200));
        }

        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({
              credentials: gibCredentials,
              invoice: {
                ...inv,
                kalemler: safeKalemler,
                faturaTipi: isTevkifat ? 'TEVKIFAT' : resolvedFaturaTipi,
                stopajTipi: resolvedStopajTipi,
                stopajOrani: resolvedStopajOrani,
                tevkifatKodu: isTevkifat ? effectiveDefaultTevkifatKodu : (inv.tevkifatKodu || undefined),
                tevkifatOrani: isTevkifat ? (inv.tevkifatOrani || '5/10') : undefined,
              },
              autoSign,
            }),
          });
          const result = await response.json();
          
          if (result.success) {
            sentSuccessfully = true;
            successes++;
            const newUuid = result.data?.invoiceUUID || undefined;
            const newFaturaNo = result.data?.invoiceNo || undefined;
            updateKesilecekFatura(inv.id, { 
              durum: 'kesildi',
              gibUuid: newUuid,
              faturaNo: newFaturaNo
            });
            // Otomatik olarak satış faturalarına da kaydet (sessiz mod)
            await transferToSales(inv, newUuid, newFaturaNo, true);
            break; // Başarılı, sonraki faturaya geç
          } else {
            lastErrorMessage = result.message || 'GİB Hatası';
          }
        } catch (err: any) {
          lastErrorMessage = err?.message || 'Ağ hatası';
        }
      }

      if (!sentSuccessfully) {
        errors++;
        console.error(`GİB gönderim hatası (${inv.ad} - ${inv.faturaTarihi}):`, lastErrorMessage);
      }
    }
    
    setIsBulkGibSending(false);
    setIsBulkGibModalOpen(false);
    setSelectedInvoiceIdsForGib([]);
    toast.success(`Toplu işlem tamamlandı. ${successes} fatura tarih sırasıyla (kronolojik) GİB'e iletildi.${errors > 0 ? ` (${errors} hatalı)` : ''}`);

    // Toplu gönderim bittiğinde GİB oturumunu arka planda güvenle kapat
    try {
      const logoutApiUrl = import.meta.env.DEV ? 'http://localhost:5000/api/gib/force-logout' : '/api/gib/force-logout';
      await fetch(logoutApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ credentials: gibCredentials })
      });
    } catch (e) {
      console.warn('Toplu işlem sonrası GİB çıkış uyarısı:', e);
    }
  };

  const handleGibFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gibFetchCredentials.username || !gibFetchCredentials.password) {
      toast.error('Lütfen kullanıcı kodu ve şifrenizi girin.');
      return;
    }
    setIsGibFetching(true);
    try {
      const apiUrl = import.meta.env.DEV ? 'http://localhost:5000/api/gib/invoices' : '/api/gib/invoices';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({
          credentials: gibFetchCredentials,
          startDate: gibDateRange.startDate,
          endDate: gibDateRange.endDate,
          includeDetails: true
        })
      });
      const result = await response.json();
      if (result.success) {
        setGibInvoices(result.data || []);
        toast.success(`${(result.data || []).length} fatura (Matrah, KDV ve Toplam tutarlarıyla) başarıyla getirildi.`);
      } else {
        toast.error(result.message || 'Faturalar getirilemedi.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Sunucuya bağlanılamadı.');
    } finally {
      setIsGibFetching(false);
    }
  };

  const handleDownloadGibPdf = async (inv: any) => {
    try {
      const credentials = (gibFetchCredentials.username && gibFetchCredentials.password) 
        ? gibFetchCredentials 
        : (gibCredentials.username && gibCredentials.password) ? gibCredentials : null;

      if (!credentials) {
        setIsGibFetchModalOpen(true);
        toast.warning('GİB portalından fatura çekmek için lütfen kullanıcı bilgilerinizi girin.');
        return;
      }

      toast.info('GİB faturası getiriliyor, lütfen bekleyin...');
      const apiUrl = import.meta.env.DEV ? 'http://localhost:5000/api/gib/download-pdf' : '/api/gib/download-pdf';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({
          credentials,
          uuid: inv.ettn || inv.gibUuid,
          signed: inv.onayDurumu === 'Onaylandı' || inv.durum === 'kesildi'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fatura görüntülenemedi.');
      }

      const result = await response.json();
      if (result.success && result.html) {
        setGibViewerHtml(result.html);
        setIsGibViewerOpen(true);
      } else {
        throw new Error(result.message || 'Fatura HTML içeriği boş.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Görüntüleme hatası: ' + err.message);
    }
  };

  const importGibInvoice = async (gibInv: any) => {
    const exists = satisFaturalari.some(sf => sf.faturaNo === gibInv.belgeNumarasi || sf.id === gibInv.ettn);
    if (exists) {
      toast.info('Bu fatura zaten sistemde kayıtlı.');
      return;
    }

    try {
      toast.info('Fatura detayları GİB\'den alınıyor...');
      let finalAmount = 0;
      let finalAliciUnvan = getAliciUnvan(gibInv);
      let finalVkn = gibInv.aliciVknTckn || '';

      try {
        const detailsApiUrl = import.meta.env.DEV ? 'http://localhost:5000/api/gib/invoice-details' : '/api/gib/invoice-details';
        const detailsResponse = await fetch(detailsApiUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${localStorage.getItem('token')}` 
          },
          body: JSON.stringify({
            credentials: gibFetchCredentials,
            uuid: gibInv.ettn,
            signed: gibInv.onayDurumu === 'Onaylandı'
          })
        });
        if (detailsResponse.ok) {
          const detailsResult = await detailsResponse.json();
          if (detailsResult.success) {
            finalAmount = detailsResult.tutar || 0;
            if (detailsResult.aliciUnvan) finalAliciUnvan = detailsResult.aliciUnvan;
            if (detailsResult.aliciVknTckn) finalVkn = detailsResult.aliciVknTckn;
            if (detailsResult.tevkifatTutari) gibInv.tevkifatTutari = detailsResult.tevkifatTutari;
            if (detailsResult.stopajTutari) gibInv.stopajTutari = detailsResult.stopajTutari;
              if (detailsResult.matrah) gibInv.matrah = detailsResult.matrah;
              if (detailsResult.kdvTutari) gibInv.kdvTutari = detailsResult.kdvTutari;
          }
        }
      } catch (detailsErr) {
        console.error('Detaylar getirilemedi:', detailsErr);
      }

      if (finalAmount === 0) {
        finalAmount = extractGibAmount(gibInv);
      }

      const parts = (gibInv.belgeTarihi || '').split(/-|\//);
      const formattedDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : new Date().toISOString().split('T')[0];
      
      const matchingCari = cariler.find(c => c.vknTckn === finalVkn);
      const cariId = matchingCari ? matchingCari.id : undefined;

      // Akıllı Cari Hafızası: Cari için daha önce tevkifatlı / normal faturada kullanılan 600 kodunu bul
      let learnedMuhasebeKodu = '';
      const isTevkifatli = Number(gibInv.tevkifatTutari || 0) > 0;
      const previousInvoicesForCari = satisFaturalari.filter(sf => 
        (cariId && sf.cariId === cariId) || (finalVkn && sf.tcVkn === finalVkn)
      );
      const matchSameType = previousInvoicesForCari.find(sf => 
        isTevkifatli ? (Number(sf.tevkifatTutari || 0) > 0 && sf.muhasebeKodu) : (!(Number(sf.tevkifatTutari || 0) > 0) && sf.muhasebeKodu)
      );
      if (matchSameType && matchSameType.muhasebeKodu) {
        learnedMuhasebeKodu = matchSameType.muhasebeKodu;
      } else {
        const anyMatch = previousInvoicesForCari.find(sf => sf.muhasebeKodu);
        if (anyMatch && anyMatch.muhasebeKodu) learnedMuhasebeKodu = anyMatch.muhasebeKodu;
      }

      const finalMatrah = Number(gibInv.matrah) || (finalAmount > 0 ? +(finalAmount / 1.20).toFixed(2) : 0);
      const finalKdv = Number(gibInv.kdvTutari) || (finalAmount > 0 ? +(finalAmount - finalMatrah).toFixed(2) : 0);

      await addSatisFatura({
        id: gibInv.ettn,
        gibUuid: gibInv.ettn,
        tcVkn: finalVkn,
        ad: finalAliciUnvan,
        soyad: '',
        vergiDairesi: '',
        adres: 'GİB e-Arşiv Portaldan Aktarıldı',
        hizmetAdi: 'Muhtelif İşlemler (GİB Aktarım)',
        alinanUcret: finalAmount.toString(),
        matrah: finalMatrah,
        kdvTutari: finalKdv,
        faturaTarihi: formattedDate,
        kdvOrani: (gibInv.kdvTutari && gibInv.matrah) ? Math.round((gibInv.kdvTutari / gibInv.matrah) * 100).toString() : '20',
        tevkifatOrani: (gibInv.tevkifatTutari && gibInv.kdvTutari) ? `${Math.round((gibInv.tevkifatTutari / gibInv.kdvTutari) * 10)}/10` : '0',
        tevkifatTutari: gibInv.tevkifatTutari || 0,
        tevkifatKodu: '',
        stopajOrani: (gibInv.stopajTutari && gibInv.matrah) ? Math.round((gibInv.stopajTutari / gibInv.matrah) * 100).toString() : '0',
        stopajTutari: gibInv.stopajTutari || 0,
        stopajKodu: '',
        muhasebeKodu: learnedMuhasebeKodu || undefined,
        faturaNo: gibInv.belgeNumarasi || '',
        aciklama: gibInv.aciklama || 'GİB e-Arşiv Portalından aktarıldı. Alıcı: ' + finalAliciUnvan,
        cariId: cariId,
      } as any);

      toast.success(`${gibInv.belgeNumarasi || 'Fatura'} başarıyla sisteme aktarıldı.`);
      setGibInvoices(prev => prev.map(inv => inv.ettn === gibInv.ettn ? { ...inv, isImported: true } : inv));
    } catch (err: any) {
      console.error(err);
      toast.error('Aktarım sırasında hata oluştu: ' + err.message);
    }
  };

  const importAllGibInvoices = async () => {
    let imported = 0;
    toast.info('Tüm faturalar detaylarıyla aktarılıyor, lütfen bekleyin...');
    for (const gibInv of gibInvoices) {
      const exists = satisFaturalari.some(sf => sf.faturaNo === gibInv.belgeNumarasi || sf.id === gibInv.ettn);
      if (exists || gibInv.isImported) continue;

      try {
        let finalAmount = 0;
        let finalAliciUnvan = getAliciUnvan(gibInv);
        let finalVkn = gibInv.aliciVknTckn || '';

        try {
          const detailsApiUrl = import.meta.env.DEV ? 'http://localhost:5000/api/gib/invoice-details' : '/api/gib/invoice-details';
          const detailsResponse = await fetch(detailsApiUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              Authorization: `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify({
              credentials: gibFetchCredentials,
              uuid: gibInv.ettn,
              signed: gibInv.onayDurumu === 'Onaylandı'
            })
          });
          if (detailsResponse.ok) {
            const detailsResult = await detailsResponse.json();
            if (detailsResult.success) {
              finalAmount = detailsResult.tutar || 0;
              if (detailsResult.aliciUnvan) finalAliciUnvan = detailsResult.aliciUnvan;
              if (detailsResult.aliciVknTckn) finalVkn = detailsResult.aliciVknTckn;
              if (detailsResult.tevkifatTutari) gibInv.tevkifatTutari = detailsResult.tevkifatTutari;
              if (detailsResult.stopajTutari) gibInv.stopajTutari = detailsResult.stopajTutari;
              if (detailsResult.matrah) gibInv.matrah = detailsResult.matrah;
              if (detailsResult.kdvTutari) gibInv.kdvTutari = detailsResult.kdvTutari;
              if (finalAmount === 0) {
                console.error("GİB Parse Hatası Debug Bilgisi:", detailsResult);
                toast.error(`Tutar bulunamadı! Detay: ${JSON.stringify(detailsResult.debugRegexMatches || {})}`);
              }
            } else {
              toast.error('GİB Detay Hatası: ' + detailsResult.message);
            }
          } else {
            const errText = await detailsResponse.text();
            toast.error('Sunucu Hatası (500): ' + errText);
          }
        } catch (detailsErr) {
          console.error('Detaylar getirilemedi:', detailsErr);
          toast.error('Ağ Hatası: Detaylar getirilemedi');
        }

        if (finalAmount === 0) {
          finalAmount = extractGibAmount(gibInv);
        }

        const parts = (gibInv.belgeTarihi || '').split(/-|\//);
        const formattedDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : new Date().toISOString().split('T')[0];
        
        const matchingCariAll = cariler.find(c => c.vknTckn === finalVkn);
        const cariIdAll = matchingCariAll ? matchingCariAll.id : undefined;

        // Akıllı Cari Hafızası (Toplu aktarım için)
        let learnedMuhasebeKoduAll = '';
        const isTevkifatliAll = Number(gibInv.tevkifatTutari || 0) > 0;
        const previousInvoicesForCariAll = satisFaturalari.filter(sf => 
          (cariIdAll && sf.cariId === cariIdAll) || (finalVkn && sf.tcVkn === finalVkn)
        );
        const matchSameTypeAll = previousInvoicesForCariAll.find(sf => 
          isTevkifatliAll ? (Number(sf.tevkifatTutari || 0) > 0 && sf.muhasebeKodu) : (!(Number(sf.tevkifatTutari || 0) > 0) && sf.muhasebeKodu)
        );
        if (matchSameTypeAll && matchSameTypeAll.muhasebeKodu) {
          learnedMuhasebeKoduAll = matchSameTypeAll.muhasebeKodu;
        } else {
          const anyMatchAll = previousInvoicesForCariAll.find(sf => sf.muhasebeKodu);
          if (anyMatchAll && anyMatchAll.muhasebeKodu) learnedMuhasebeKoduAll = anyMatchAll.muhasebeKodu;
        }

        const finalMatrahAll = Number(gibInv.matrah) || (finalAmount > 0 ? +(finalAmount / 1.20).toFixed(2) : 0);
        const finalKdvAll = Number(gibInv.kdvTutari) || (finalAmount > 0 ? +(finalAmount - finalMatrahAll).toFixed(2) : 0);

        await addSatisFatura({
          id: gibInv.ettn,
          gibUuid: gibInv.ettn,
          tcVkn: finalVkn,
          ad: finalAliciUnvan,
          soyad: '',
          vergiDairesi: '',
          adres: 'GİB e-Arşiv Portaldan Aktarıldı',
          hizmetAdi: 'Muhtelif İşlemler (GİB Aktarım)',
          alinanUcret: finalAmount.toString(),
          matrah: finalMatrahAll,
          kdvTutari: finalKdvAll,
          faturaTarihi: formattedDate,
          kdvOrani: (gibInv.kdvTutari && gibInv.matrah) ? Math.round((gibInv.kdvTutari / gibInv.matrah) * 100).toString() : '20',
          tevkifatOrani: (gibInv.tevkifatTutari && gibInv.kdvTutari) ? `${Math.round((gibInv.tevkifatTutari / gibInv.kdvTutari) * 10)}/10` : '0',
          tevkifatTutari: gibInv.tevkifatTutari || 0,
          tevkifatKodu: '',
          stopajOrani: (gibInv.stopajTutari && gibInv.matrah) ? Math.round((gibInv.stopajTutari / gibInv.matrah) * 100).toString() : '0',
          stopajTutari: gibInv.stopajTutari || 0,
          stopajKodu: '',
          muhasebeKodu: learnedMuhasebeKoduAll || undefined,
          faturaNo: gibInv.belgeNumarasi || '',
          aciklama: gibInv.aciklama || 'GİB e-Arşiv Portalından aktarıldı. Alıcı: ' + finalAliciUnvan,
          cariId: cariIdAll,
        } as any);
        imported++;
      } catch (err) {
        console.error('Import error for ' + gibInv.belgeNumarasi, err);
      }
    }
    
    setGibInvoices(prev => prev.map(inv => ({ ...inv, isImported: true })));
    toast.success(`${imported} yeni fatura başarıyla sisteme aktarıldı.`);
  };
  const formatCurrency = (val: number) => {
    const safeVal = isNaN(val) || val === null || val === undefined ? 0 : val;
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(safeVal);
  };

  return (
    <div className="space-y-5">
      {/* 1. Üst Başlık & Global Eylemler */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <FilePlus className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Kesilecek Faturalar
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-500" />
                Akıllı e-Arşiv Merkezi
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              GİB e-Arşiv portalına toplu gönderim, kronolojik sıra güvencesi ve resmi fatura no eşleştirme
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className={cn(
              "gap-2 h-9 text-xs font-bold transition-all shadow-xs cursor-pointer",
              isFormOpen 
                ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200" 
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
            )}
          >
            {isFormOpen ? <EyeOff className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isFormOpen ? 'Formu Kapat' : '+ Yeni Fatura Planla'}
          </Button>

          {/* Akıllı Çapraz Kontrol & Excel Yükle Butonu */}
          <Button
            onClick={() => {
              setIsCrossCheckModalOpen(true);
              setCrossCheckFileName('');
              setCrossCheckResult({ totalUploaded: 0, matchedList: [], unmatchedList: [], isCalculated: false });
            }}
            className="gap-1.5 h-9 text-xs font-bold bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow-xs cursor-pointer"
          >
            <GitCompare className="w-4 h-4 text-amber-300" />
            <span>Akıllı Karşılaştır & Yükle</span>
          </Button>

          {/* Excel İşlemleri Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs font-semibold border-slate-200 text-slate-700 bg-white hover:bg-slate-50">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Excel ▾</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem 
                onClick={() => {
                  setIsCrossCheckModalOpen(true);
                  setCrossCheckFileName('');
                  setCrossCheckResult({ totalUploaded: 0, matchedList: [], unmatchedList: [], isCalculated: false });
                }} 
                className="cursor-pointer gap-2 text-xs font-semibold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50"
              >
                <GitCompare className="w-3.5 h-3.5 text-indigo-600" />
                <span>GİB Çapraz Kontrol & Yükle</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadTemplate} className="cursor-pointer gap-2 text-xs">
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Excel Şablonu İndir</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => document.getElementById('excel-upload')?.click()} className="cursor-pointer gap-2 text-xs">
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel'den Doğrudan Yükle</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <input type="file" id="excel-upload" className="hidden" accept=".xlsx,.xls" onChange={handleExcelUpload} />
        </div>
      </div>

      {/* 2. KPI Metrik Özet Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Bekleyen Kartı */}
        <div 
          onClick={() => setActiveTab('bekleyen')}
          className={cn(
            "p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden group",
            activeTab === 'bekleyen' 
              ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-200/80 shadow-xs" 
              : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Bekleyen Faturalar
            </span>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
              {stats.pendingCount} Adet
            </span>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(stats.pendingTotal)}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">GİB portalına iletilmeyi bekliyor</p>
        </div>

        {/* Kesilen / Onaylanan Kartı */}
        <div 
          onClick={() => setActiveTab('kesilenler')}
          className={cn(
            "p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden group",
            activeTab === 'kesilenler' 
              ? "bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-200/80 shadow-xs" 
              : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Kesilen & Onaylanan
            </span>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
              {stats.cutCount} Adet
            </span>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(stats.cutTotal)}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">GİB'de onaylanmış ve sisteme işlenmiş</p>
        </div>

        {/* Akıllı GİB Durumu */}
        <div className="p-3.5 sm:p-4 rounded-xl border bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border-slate-700 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              GİB Numarası Eşleşmesi
            </span>
            <span className="text-[10px] font-bold bg-white/10 text-emerald-300 px-2 py-0.5 rounded-full border border-white/10">
              {stats.matchedNoCount} Eşleşen
            </span>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-white tracking-tight flex items-baseline gap-2">
            <span>{stats.matchedNoCount}</span>
            <span className="text-xs font-medium text-slate-400 font-sans">resmi no tanımlı</span>
          </div>
          <div className="mt-1 flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={openGibQueryModal}
              className="text-[11px] font-bold text-blue-300 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
            >
              GİB'den Sorgula & Eşle
            </button>
            <span className="text-slate-500">·</span>
            <button
              type="button"
              onClick={() => {
                setIsGibFetchModalOpen(true);
                setGibInvoices([]);
              }}
              className="text-[11px] font-bold text-amber-300 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
            >
              Faturaları Çek
            </button>
          </div>
        </div>
      </div>

      {/* 3. Ana Gövde (Form + Tablo) */}
      <div className={cn(
        "transition-all",
        isFormOpen ? "grid grid-cols-1 lg:grid-cols-12 gap-6" : "w-full"
      )}>
        {/* Form Kartı (Açılıp Kapanabilir) */}
        {isFormOpen && (
          <Card className="lg:col-span-5 border-0 shadow-sm ring-1 ring-slate-200 h-fit sticky top-4">
            <CardHeader className="pb-3 border-b bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                    {editingInvoiceId ? <Edit2 className="w-4 h-4 text-emerald-600" /> : <Plus className="w-4 h-4 text-blue-600" />}
                    {editingInvoiceId ? 'Fatura Planını Düzenle' : 'Yeni Fatura Planı Ekle'}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Müşteri bilgileri ve ürün/hizmet kalemlerini girin
                  </CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={cancelEdit} 
                  className="h-7 w-7 text-slate-400 hover:text-slate-700" 
                  title="Formu Kapat"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleAdd} className="space-y-4">
                {/* Cari seçimi */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Cari Karttan Seç (Opsiyonel)</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                    value={form.cariId} onChange={e => handleCariChange(e.target.value)}
                  >
                    <option value="none">-- Manuel Giriş --</option>
                    {cariler?.map(c => <option key={c.id} value={c.id}>{c.unvan}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Firma Ünvanı / Ad *</Label>
                    <Input value={form.ad} onChange={e => setForm({...form, ad: e.target.value})} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Soyad</Label>
                    <Input value={form.soyad} onChange={e => setForm({...form, soyad: e.target.value})} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">VKN / TCKN *</Label>
                    <div className="flex gap-1">
                      <Input value={form.vknTckn} onChange={e => setForm({...form, vknTckn: e.target.value})} className="h-8 text-xs font-mono" />
                      <Button type="button" onClick={handleVknLookup} disabled={isVknLoading} variant="outline" className="h-8 px-2 shrink-0 bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100" title="GİB'den Müşteri Sorgula">
                        {isVknLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Vergi Dairesi</Label>
                    <Input value={form.vergiDairesi} onChange={e => setForm({...form, vergiDairesi: e.target.value})} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Fatura Tarihi</Label>
                  <Input type="date" value={form.faturaTarihi} onChange={e => setForm({...form, faturaTarihi: e.target.value})} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Tam Adres</Label>
                  <Input value={form.adres} onChange={e => setForm({...form, adres: e.target.value})} className="h-8 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1"><Label className="text-[11px] font-semibold">İl</Label><Input value={form.il} onChange={e => setForm({...form, il: e.target.value})} className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-[11px] font-semibold">İlçe</Label><Input value={form.ilce} onChange={e => setForm({...form, ilce: e.target.value})} className="h-8 text-xs" /></div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Fatura Açıklaması</Label>
                  <Textarea value={form.aciklama} onChange={e => setForm({...form, aciklama: e.target.value})} className="resize-none h-12 text-xs" />
                </div>

                {/* Kalem Listesi */}
                <div className="space-y-2 border-t pt-2.5">
                  <div className="flex items-center justify-between gap-2 border-b pb-1.5">
                    <Label className="text-xs font-bold text-blue-700 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" /> Ürün / Hizmet Kalemleri
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <select
                        className="h-7 text-[11px] rounded-md border border-input bg-background px-1.5"
                        value={form.kdvHesaplamaTipi}
                        onChange={e => setForm({ ...form, kdvHesaplamaTipi: e.target.value as 'DAHIL' | 'HARIC' })}
                      >
                        <option value="DAHIL">KDV Dahil</option>
                        <option value="HARIC">KDV Hariç</option>
                      </select>
                      <Button type="button" size="sm" variant="outline" onClick={addKalem} className="h-7 text-[11px] gap-1 px-2 font-semibold">
                        <Plus className="w-3 h-3" /> Ekle
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {kalemler.map((k) => (
                      <div key={k.id} className="border rounded-lg p-2.5 bg-slate-50/60 space-y-2 relative">
                        {kalemler.length > 1 && (
                          <button type="button" onClick={() => removeKalem(k.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div className="space-y-0.5">
                          <Label className="text-[10px] text-slate-400">Ürün / Hizmet Adı</Label>
                          <Input value={k.ad} onChange={e => updateKalem(k.id, 'ad', e.target.value)} className="h-7 text-xs" placeholder="Hizmet veya ürün" />
                        </div>

                        <div className="grid grid-cols-4 gap-1.5">
                          <div>
                            <Label className="text-[9px] text-slate-400">Miktar</Label>
                            <Input type="number" min="0.01" step="0.01" value={k.miktar} onChange={e => updateKalem(k.id, 'miktar', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                          </div>
                          <div>
                            <Label className="text-[9px] text-slate-400">Birim</Label>
                            <select value={k.birim} onChange={e => updateKalem(k.id, 'birim', e.target.value)} className="h-7 w-full rounded border border-input bg-background px-1 text-[11px]">
                              {BIRIM_KODLARI.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <Label className="text-[9px] text-slate-400">B.Fiyat ₺</Label>
                            <Input type="number" min="0" step="0.01" value={k.birimFiyat || ''} onChange={e => updateKalem(k.id, 'birimFiyat', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                          </div>
                          <div>
                            <Label className="text-[9px] text-slate-400">KDV %</Label>
                            <select value={k.kdvOrani} onChange={e => updateKalem(k.id, 'kdvOrani', parseInt(e.target.value))} className="h-7 w-full rounded border border-input bg-background px-1 text-[11px]">
                              {KDV_ORANLARI.map(o => <option key={o} value={o}>%{o}</option>)}
                            </select>
                          </div>
                        </div>

                        {/* KDV Tevkifatı */}
                        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                          <div>
                            <Label className="text-[9px] text-amber-700 font-semibold">Tevkifat Oranı</Label>
                            <select
                              value={k.tevkifatOrani}
                              onChange={e => updateKalem(k.id, 'tevkifatOrani', parseInt(e.target.value))}
                              className="h-7 w-full rounded border border-amber-200 bg-background px-1 text-[10px]"
                            >
                              {TEVKIFAT_ORAN_SECENEKLERI.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-[9px] text-amber-700 font-semibold">Tevkifat Kodu</Label>
                            <select
                              value={k.tevkifatKodu || ''}
                              onChange={e => updateKalem(k.id, 'tevkifatKodu', e.target.value)}
                              className="h-7 w-full rounded border border-amber-200 bg-background px-1 text-[10px]"
                              disabled={!k.tevkifatOrani}
                            >
                              {TEVKIFAT_KODLARI.map(kod => (
                                <option key={kod.value} value={kod.value}>{kod.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="text-right text-[10px] text-slate-500 pt-0.5">
                          Matrah: <strong className="text-slate-700">{formatCurrency(k.birimFiyat * k.miktar)}</strong>
                          {' · '}KDV: <strong className="text-emerald-700">{formatCurrency((k.birimFiyat * k.miktar) * (k.kdvOrani / 100))}</strong>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Toplam Özeti */}
                  <div className="bg-blue-50/80 rounded-lg p-2.5 text-xs flex justify-between items-center border border-blue-100">
                    <div className="text-[11px] text-slate-600">
                      <div>Matrah: <strong>{formatCurrency(kalemToplam.matrah)}</strong></div>
                      <div>KDV: <strong>{formatCurrency(kalemToplam.kdv)}</strong></div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-400 text-[9px] font-bold">GENEL TOPLAM</div>
                      <div className="text-lg font-black text-blue-700">{formatCurrency(kalemToplam.toplam)}</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="submit" className={cn("flex-1 h-9 gap-1.5 text-xs font-bold", editingInvoiceId ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700")}>
                    {editingInvoiceId ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />} 
                    {editingInvoiceId ? 'Değişiklikleri Kaydet' : 'Planla ve Ekle'}
                  </Button>
                  {editingInvoiceId && (
                    <Button type="button" variant="outline" size="sm" onClick={cancelEdit} className="h-9 text-xs">İptal</Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Liste Kartı (Fatura Tablosu) */}
        <Card className={cn(
          "border-0 shadow-sm ring-1 ring-slate-200 overflow-hidden transition-all",
          isFormOpen ? "lg:col-span-7" : "col-span-12"
        )}>
          <CardHeader className="bg-slate-50/50 border-b p-3.5 sm:p-4 space-y-3">
            {/* Satır 1: Sekmeler ve Birincil İşlemler */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Sekmeler */}
              <div className="flex items-center p-1 bg-slate-200/60 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setActiveTab('bekleyen')}
                  className={cn(
                    "text-xs font-bold py-1.5 px-3 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                    activeTab === 'bekleyen' 
                      ? "bg-white text-slate-900 shadow-xs" 
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Bekleyen Faturalar
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full">
                    {pendingInvoices.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('kesilenler')}
                  className={cn(
                    "text-xs font-bold py-1.5 px-3 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                    activeTab === 'kesilenler' 
                      ? "bg-white text-slate-900 shadow-xs" 
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Kesilenler / Onaylananlar
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full">
                    {stats.cutCount}
                  </span>
                </button>
              </div>

              {/* Sağ Eylemler (Gruplanmış & Kompakt) */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Seçim Varsa Akıllı Gönderim Butonu */}
                {activeTab === 'bekleyen' && selectedInvoiceIdsForGib.length > 0 && (
                  <Button
                    size="sm"
                    onClick={openBulkGibModal}
                    className="h-8 gap-1.5 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-600/20"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    Akıllı GİB Gönder ({selectedInvoiceIdsForGib.length})
                  </Button>
                )}

                {/* Bekleyenlerde Seçilenleri Sil Butonu */}
                {activeTab === 'bekleyen' && selectedInvoiceIdsForGib.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkDelete}
                    className="h-8 gap-1.5 text-xs font-bold border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Seçilenleri Sil ({selectedInvoiceIdsForGib.length})
                  </Button>
                )}

                {/* Seçim Varsa Bekleyenler Sekmesinde Ek İşlemler Dropdown */}
                {activeTab === 'bekleyen' && selectedInvoiceIdsForGib.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-slate-200">
                        <span>İşlemler</span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={handleBulkLookup} disabled={isBulkLookupRunning} className="gap-2 text-xs cursor-pointer">
                        {isBulkLookupRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 text-blue-600" />}
                        <span>VKN/TCKN Bilgisi Sorgula</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleBulkDelete} className="gap-2 text-xs cursor-pointer text-rose-600 focus:text-rose-700">
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Seçilenleri Sil</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Kesilenler Sekmesinde Seçim Varsa Butonlar */}
                {activeTab === 'kesilenler' && selectedKesilenIds.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (confirm(`Seçilen ${selectedKesilenIds.length} faturayı tekrar bekleyen faturalar listesine geri almak istiyor musunuz?`)) {
                          revertToPending(selectedKesilenIds);
                        }
                      }}
                      className="h-8 gap-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Bekleyenlere Al ({selectedKesilenIds.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkDelete}
                      className="h-8 gap-1.5 text-xs font-bold border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Seçilenleri Sil ({selectedKesilenIds.length})
                    </Button>
                  </div>
                )}

                {/* GİB Portalı Dropdown Menüsü */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-slate-200 bg-white gap-1.5 text-slate-700 hover:bg-slate-50">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>GİB Portalı</span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={openGibQueryModal} className="gap-2 text-xs cursor-pointer">
                      <Search className="w-3.5 h-3.5 text-blue-600" />
                      <div>
                        <div className="font-semibold">GİB'den Sorgula & Eşle</div>
                        <div className="text-[10px] text-slate-400">Resmi numaraları kontrol eder</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setIsGibFetchModalOpen(true);
                        setGibInvoices([]);
                      }} 
                      className="gap-2 text-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-600" />
                      <div>
                        <div className="font-semibold">GİB'den Faturaları Çek</div>
                        <div className="text-[10px] text-slate-400">Kesilmiş faturaları içe aktar</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleGibForceLogout()} className="gap-2 text-xs text-rose-600 cursor-pointer">
                      <LogOut className="w-3.5 h-3.5" />
                      <span>GİB Oturumunu Kapat (Kilit Çöz)</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {!isFormOpen && (
                  <Button 
                    size="sm"
                    onClick={() => setIsFormOpen(true)}
                    className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Yeni Plan
                  </Button>
                )}
              </div>
            </div>

            {/* Satır 2: Arama, Sıralama ve Tarih Filtresi */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200/60">
              <div className="flex items-center gap-2 flex-wrap flex-1">
                {/* Arama Kutusu */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input 
                    placeholder="Müşteri, VKN veya Fatura No..." 
                    className="pl-9 h-8 text-xs bg-white border-slate-200" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Sıralama */}
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 h-8">
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  <select
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value as any)}
                    className="bg-transparent text-[11px] font-semibold text-slate-700 border-0 p-0 focus:outline-none cursor-pointer"
                  >
                    <option value="tarih_asc">📅 Tarih: Eskiden Yeniye (GİB Sıralı)</option>
                    <option value="tarih_desc">📅 Tarih: Yeniden Eskiye</option>
                    <option value="olusturma_desc">⏱️ Son Eklenen</option>
                  </select>
                </div>
              </div>

              {/* Kesilenler Tarih Filtresi */}
              {activeTab === 'kesilenler' && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 h-8 shadow-2xs">
                    <Calendar className="w-3 h-3 text-blue-600 shrink-0" />
                    <input
                      type="date"
                      value={kesilenStartDate}
                      onChange={e => setKesilenStartDate(e.target.value)}
                      className="w-24 bg-transparent text-[11px] text-slate-700 border-0 p-0 focus:outline-none"
                    />
                    <span className="text-slate-400 text-xs">-</span>
                    <input
                      type="date"
                      value={kesilenEndDate}
                      onChange={e => setKesilenEndDate(e.target.value)}
                      className="w-24 bg-transparent text-[11px] text-slate-700 border-0 p-0 focus:outline-none"
                    />
                    {(kesilenStartDate || kesilenEndDate) && (
                      <button onClick={clearKesilenDateFilter} className="text-slate-400 hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={setKesilenThisMonth}
                    className="text-[10px] font-semibold bg-white border border-slate-200 hover:border-blue-300 rounded px-2 h-8 text-slate-700 cursor-pointer"
                  >
                    Bu Ay
                  </button>
                  <button
                    type="button"
                    onClick={setKesilenToday}
                    className="text-[10px] font-semibold bg-white border border-slate-200 hover:border-blue-300 rounded px-2 h-8 text-slate-700 cursor-pointer"
                  >
                    Bugün
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 border-0 hover:bg-slate-50/50">
                    <TableHead className="w-10 text-center">
                      <Checkbox 
                        checked={
                          activeTab === 'bekleyen'
                            ? (pendingInvoices.length > 0 && selectedInvoiceIdsForGib.length === pendingInvoices.length)
                            : (resolvedInvoices.length > 0 && selectedKesilenIds.length === resolvedInvoices.length)
                        } 
                        onCheckedChange={
                          activeTab === 'bekleyen' ? handleSelectAll : handleSelectAllKesilen
                        } 
                        title={activeTab === 'bekleyen' ? 'Tüm bekleyenleri seç' : 'Tüm kesilenleri seç'}
                      />
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">Müşteri Detayları</TableHead>
                    <TableHead className="font-semibold text-slate-600">Kalemler / Açıklama</TableHead>
                    <TableHead className="font-semibold text-slate-600">Fatura No</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-right">Matrah</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-right">KDV</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-right">Genel Toplam</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-center">Durum</TableHead>
                    <TableHead className="text-right font-semibold text-slate-600">Aksiyon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resolvedInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                          <AlertCircle className="w-8 h-8 opacity-20" />
                          <p>{activeTab === 'bekleyen' ? 'Kayıtlı bekleyen fatura planı bulunamadı.' : 'Seçili filtrelere uygun kesilmiş fatura bulunamadı.'}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    resolvedInvoices.map((f: any) => {
                      const queueIndex = activeTab === 'bekleyen' 
                        ? chronologicallySortedSelected.findIndex(item => item.id === f.id) 
                        : -1;

                      return (
                      <TableRow key={f.id} className="group border-0 border-b last:border-0 hover:bg-blue-50/30 transition-colors">
                        <TableCell className="text-center">
                          <Checkbox 
                            checked={
                              activeTab === 'bekleyen' 
                                ? selectedInvoiceIdsForGib.includes(f.id) 
                                : selectedKesilenIds.includes(f.id)
                            } 
                            onCheckedChange={(c: boolean) => 
                              activeTab === 'bekleyen' 
                                ? handleSelectOne(c, f.id) 
                                : handleSelectOneKesilen(c, f.id)
                            } 
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 leading-tight">{f.ad} {f.soyad}</span>
                              {activeTab === 'bekleyen' && queueIndex !== -1 && (
                                <span 
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200"
                                  title={`Kronolojik gönderim sırasında ${queueIndex + 1}. sırada gönderilecek`}
                                >
                                  #{queueIndex + 1}. Sıra
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium">{f.vknTckn}</span>
                            {f.faturaTarihi && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[11px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 w-fit flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-blue-500" />
                                  {f.faturaTarihi}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {f.kalemler && f.kalemler.length > 0 ? (
                              f.kalemler.slice(0, 2).map((k: any) => (
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
                          {f.faturaNo ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded w-fit shadow-xs">
                                {f.faturaNo}
                              </span>
                              {f.gibUuid && (
                                <span className="text-[9px] font-mono text-slate-400 truncate max-w-[110px]" title={`GİB ETTN: ${f.gibUuid}`}>
                                  {f.gibUuid.slice(0, 8)}...
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No Yok</span>
                          )}
                        </TableCell>
                        {(() => {
                          const rowTutar = Number(f.tutar) || 0;
                          const rowMatrah = (f.matrah !== undefined && f.matrah !== null && Number(f.matrah) > 0)
                            ? Number(f.matrah)
                            : (f.kalemler && f.kalemler.length > 0)
                              ? f.kalemler.reduce((sum: number, k: any) => sum + (Number(k.miktar || 1) * Number(k.birimFiyat || 0)), 0)
                              : (rowTutar > 0 ? +(rowTutar / 1.20).toFixed(2) : 0);
                          const rowKdv = (f.kdvTutari !== undefined && f.kdvTutari !== null && Number(f.kdvTutari) > 0)
                            ? Number(f.kdvTutari)
                            : (rowTutar > 0 ? +(rowTutar - rowMatrah).toFixed(2) : 0);

                          return (
                            <>
                              <TableCell className="text-right">
                                <span className="font-mono text-xs font-medium text-slate-600">{formatCurrency(rowMatrah)}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-mono text-xs font-medium text-blue-600">{formatCurrency(rowKdv)}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-mono text-xs font-bold text-slate-900">{formatCurrency(rowTutar)}</span>
                              </TableCell>
                            </>
                          );
                        })()}
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
                            {f.durum === 'bekliyor' ? (
                              <div className="flex gap-1.5 items-center">
                                <Button
                                  variant="outline" size="icon" onClick={() => loadInvoiceForEdit(f)}
                                  className="h-7 w-7 text-slate-400 hover:text-blue-600 border-slate-200" title="Düzenle"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
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
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                <Button
                                  variant="outline" size="icon" onClick={() => loadInvoiceForEdit(f)}
                                  className="h-7 w-7 text-slate-400 hover:text-blue-600 border-slate-200" title="Düzenle"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => {
                                    if (confirm(`"${f.ad} ${f.soyad || ''}" faturasını tekrar Bekleyen Faturalar listesine geri almak istiyor musunuz?`)) {
                                      revertToPending([f.id]);
                                    }
                                  }}
                                  className="h-7 text-[10px] font-bold bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-600 hover:text-white hover:border-amber-600 gap-1"
                                  title="Bu faturayı tekrar Bekleyen Faturalar listesine taşır"
                                >
                                  <Undo2 className="w-3 h-3" /> BEKLEYENLERE AL
                                </Button>
                                {f.faturaNo ? (
                                  <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                                    {f.faturaNo}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                    Taslak / No Yok
                                  </span>
                                )}
                                {f.gibUuid && (
                                  <Button
                                    variant="outline" size="sm" onClick={() => handleDownloadGibPdf(f)}
                                    className="h-7 text-[10px] font-bold bg-white border-red-200 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 gap-1"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-red-500" /> GİB PDF
                                  </Button>
                                )}
                                {!f.isRealSalesInvoice && !satisFaturalari.some((sf: any) => sf.gibUuid === f.gibUuid || sf.faturaNo === f.faturaNo) && (
                                  <Button
                                    variant="outline" size="sm" onClick={() => transferToSales(f)}
                                    className="h-7 text-[10px] font-bold bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600"
                                  >
                                    SATIŞA AKTAR
                                  </Button>
                                )}
                                {f.isRealSalesInvoice && f.pdfDosya && (
                                  <Button
                                    variant="outline" size="sm" onClick={() => downloadSatisPdf(f.id)}
                                    className="h-7 text-[10px] font-bold bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-600 hover:text-white hover:border-slate-600 gap-1"
                                  >
                                    <Download className="w-3 h-3" /> PDF
                                  </Button>
                                )}
                              </div>
                            )}
                            <Button
                              variant="ghost" size="icon" 
                              onClick={() => {
                                if (f.isRealSalesInvoice) {
                                  if (confirm('Bu onaylanmış satış faturasını sistemden silmek istediğinize emin misiniz?')) {
                                    deleteSatisFatura(f.id);
                                  }
                                } else {
                                  deleteKesilecekFatura(f.id);
                                }
                              }}
                              className="w-8 h-8 text-slate-300 hover:text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
            <div className="flex items-center justify-between pb-1 border-b">
              <span className="text-xs font-semibold text-slate-700">GİB Giriş Bilgileri</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleGibForceLogout()}
                disabled={isGibLoggingOut || !gibCredentials.username}
                className="h-7 px-2 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-1 border border-rose-200"
                title="GİB'de açık kalan oturumu kapatır ve hesabın kilidini açar"
              >
                {isGibLoggingOut ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                Güvenli Çıkış Yap
              </Button>
            </div>
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

      {/* Toplu GİB Modal */}
      <Dialog open={isBulkGibModalOpen} onOpenChange={setIsBulkGibModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              Toplu GİB e-Arşiv Fatura Gönderimi
            </DialogTitle>
            <DialogDescription>
              Seçilen {chronologicallySortedSelected.length} adet faturayı GİB'e göndermek üzeresiniz.
            </DialogDescription>
          </DialogHeader>

          {/* Tarih Önceliği & Kronolojik Sıra Uyarısı */}
          <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-1.5 text-amber-950">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Tarih Önceliği (Müteselsil Sıra Kuralı)</span>
              </div>
              <span className="text-[10px] font-bold bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full">
                Otomatik Kronolojik
              </span>
            </div>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              GİB'de evrak numaralarının fatura tarihleriyle tam uyumlu ve ardışık olması için faturalar <strong>ilk tarihten son tarihe (eskiden yeniye)</strong> sırayla gönderilecektir.
            </p>
            {selectedDateRange && (
              <div className="flex items-center gap-2 pt-1 text-[11px] font-medium text-amber-950">
                <span className="text-amber-700">Gönderim Tarih Aralığı:</span>
                <span className="bg-white px-2 py-0.5 rounded border border-amber-200 font-mono font-bold text-amber-900">
                  {selectedDateRange.start}
                </span>
                <span>➔</span>
                <span className="bg-white px-2 py-0.5 rounded border border-amber-200 font-mono font-bold text-amber-900">
                  {selectedDateRange.end}
                </span>
              </div>
            )}
          </div>

          {/* Akıllı Ön Denetim Paneli */}
          <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-blue-950">Akıllı Ön Denetim Raporu</h4>
                  <p className="text-[10px] text-blue-700">GİB kurallarına göre analiz edildi</p>
                </div>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                smartAudit.isReady 
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300" 
                  : "bg-amber-100 text-amber-800 border-amber-300"
              )}>
                {smartAudit.isReady ? '✅ Gönderime Hazır' : '⚠️ İnceleme Gerekli'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="bg-white/90 p-1.5 rounded-lg border border-blue-100">
                <span className="text-[9px] text-slate-500 block font-medium">Toplam</span>
                <span className="text-xs font-bold text-slate-900">{smartAudit.totalSelected} Adet</span>
              </div>
              <div className="bg-white/90 p-1.5 rounded-lg border border-blue-100">
                <span className="text-[9px] text-slate-500 block font-medium">Tutar</span>
                <span className="text-xs font-bold text-blue-700">{formatCurrency(smartAudit.totalAmt)}</span>
              </div>
              <div className="bg-white/90 p-1.5 rounded-lg border border-blue-100">
                <span className="text-[9px] text-slate-500 block font-medium">Tevkifat</span>
                <span className="text-xs font-bold text-amber-700">{smartAudit.tevkifatCount} Adet</span>
              </div>
              <div className="bg-white/90 p-1.5 rounded-lg border border-blue-100">
                <span className="text-[9px] text-slate-500 block font-medium">Stopaj</span>
                <span className="text-xs font-bold text-indigo-700">{smartAudit.stopajCount} Adet</span>
              </div>
            </div>

            {smartAudit.warnings.length > 0 && (
              <div className="bg-amber-100/90 border border-amber-300 rounded-lg p-2 text-[10px] text-amber-900 space-y-0.5">
                <div className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-700 shrink-0" />
                  Eksik/Hatalı Olabilecek Kayıtlar:
                </div>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  {smartAudit.warnings.slice(0, 2).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {smartAudit.warnings.length > 2 && (
                    <li>...ve {smartAudit.warnings.length - 2} uyarı daha</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <form onSubmit={handleBulkGibSend} className="space-y-4 py-1">
            <div className="flex items-center justify-between pb-1 border-b">
              <span className="text-xs font-semibold text-slate-700">GİB Giriş Bilgileri</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleGibForceLogout()}
                disabled={isGibLoggingOut || !gibCredentials.username}
                className="h-7 px-2 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-1 border border-rose-200"
                title="GİB'de açık kalan oturumu kapatır ve hesabın kilidini açar"
              >
                {isGibLoggingOut ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                Güvenli Çıkış Yap
              </Button>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="bulk_gib_user">Kullanıcı Kodu / VKN</Label>
                <Input id="bulk_gib_user" value={gibCredentials.username} onChange={e => setGibCredentials({...gibCredentials, username: e.target.value})} placeholder="Kullanıcı Kodu" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bulk_gib_pass">Şifre</Label>
                <Input id="bulk_gib_pass" type="password" value={gibCredentials.password} onChange={e => setGibCredentials({...gibCredentials, password: e.target.value})} placeholder="********" required />
              </div>
            </div>

            {/* Fatura Tipi Seçimi */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-semibold">Fatura Tipi</Label>
              <select
                value={bulkFaturaTipi}
                onChange={e => setBulkFaturaTipi(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium"
              >
                <option value="AUTO">🤖 Otomatik (Faturadaki Tipe Göre - Tevkifatlı ise Tevkifat, değilse Satış)</option>
                {FATURA_TIPI_SECENEKLERI.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {bulkFaturaTipi === 'AUTO' && (
                <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-1">
                  💡 Tevkifat oranı veya tevkifat tutarı içeren faturalar otomatik <strong>TEVKİFAT</strong>, diğerleri <strong>SATIŞ</strong> olarak gönderilecektir.
                </p>
              )}
            </div>

            {/* Varsayılan Tevkifat Kodu (Tevkifatlı faturalar için) */}
            {(bulkFaturaTipi === 'AUTO' || bulkFaturaTipi === 'TEVKIFAT') && (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Varsayılan Tevkifat Kodu</Label>
                  <span className="text-[10px] text-slate-500 font-medium">Faturada boş ise kullanılır</span>
                </div>
                <select
                  value={bulkDefaultTevkifatKodu}
                  onChange={e => setBulkDefaultTevkifatKodu(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                >
                  {TEVKIFAT_KODLARI.map(k => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Stopaj Türü / Stopaj Kodu & Oranı */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Stopaj Durumu (Varsa)</Label>
                <span className="text-[10px] text-slate-500 font-medium">e-SMM / Serbest Meslek / KV Stopaj</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={bulkStopajMode}
                  onChange={e => {
                    const val = e.target.value;
                    setBulkStopajMode(val);
                    if ((val === 'V0003' || val === 'V0011') && (!bulkStopajOrani || bulkStopajOrani === '0')) {
                      setBulkStopajOrani('20');
                    }
                  }}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs font-medium"
                >
                  <option value="KEEP">🔄 Faturalardaki Mevcut Stopajı Koru</option>
                  <option value="NONE">❌ Stopaj Yok (Stopajsız Gönder)</option>
                  <option value="V0003">GV. Stopajı (Gelir Vergisi / e-SMM)</option>
                  <option value="V0011">KV. Stopajı (Kurumlar Vergisi)</option>
                </select>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={bulkStopajOrani}
                    onChange={e => setBulkStopajOrani(e.target.value)}
                    placeholder="20"
                    className="h-9 w-20"
                    disabled={bulkStopajMode === 'KEEP' || bulkStopajMode === 'NONE'}
                  />
                  <span className="text-xs text-slate-400 font-medium">%</span>
                </div>
              </div>
              {bulkStopajMode === 'KEEP' && (
                <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                  ℹ️ Faturaların kendi içindeki stopaj oranı (örn. e-SMM %20) korunarak GİB'e aktarılır.
                </p>
              )}
              {(bulkStopajMode === 'V0003' || bulkStopajMode === 'V0011') && (
                <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-1">
                  & Tüm seçilen faturalara %{bulkStopajOrani} {bulkStopajMode === 'V0011' ? 'Kurumlar Vergisi' : 'Gelir Vergisi'} stopajı uygulanacaktır.
                </p>
              )}
            </div>

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
                </button>
              </div>
            </div>

            {isBulkGibSending && (
              <div className="space-y-2 mt-4 p-3 border rounded-lg bg-blue-50 border-blue-200">
                <div className="flex justify-between text-xs font-semibold text-blue-900">
                  <span className="flex items-center gap-1.5 truncate max-w-[280px]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                    <span>Gönderiliyor: {bulkGibProgress.currentInvoiceName ? `${bulkGibProgress.currentInvoiceName} (${bulkGibProgress.currentInvoiceDate})` : 'İşleniyor...'}</span>
                  </span>
                  <span className="shrink-0 font-mono">{bulkGibProgress.current} / {bulkGibProgress.total}</span>
                </div>
                <div className="w-full bg-blue-200/60 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-300" 
                    style={{ width: `${(bulkGibProgress.current / (bulkGibProgress.total || 1)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsBulkGibModalOpen(false)} disabled={isBulkGibSending}>İptal</Button>
              <Button
                type="submit"
                className={cn("gap-2", autoSign ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700")}
                disabled={isBulkGibSending || selectedInvoiceIdsForGib.length === 0}
              >
                {isBulkGibSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isBulkGibSending ? 'İşleniyor...' : (autoSign ? 'Onayla ve Toplu Gönder' : 'Toplu Taslak Gönder')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* GİB Fetch Modal */}
      <Dialog open={isGibFetchModalOpen} onOpenChange={setIsGibFetchModalOpen}>
        <DialogContent className="sm:max-w-[880px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-amber-600" />
              GİB e-Arşiv Fatura Çekme (Matrah & KDV Destekli)
            </DialogTitle>
            <DialogDescription>
              Belirli tarih aralığında GİB e-Arşiv portalında kestiğiniz faturaları Matrah, KDV ve Toplam tutar detaylarıyla sorgulayın ve sisteme aktarın.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGibFetch} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="gib_fetch_user">Kullanıcı Kodu / VKN</Label>
                <Input id="gib_fetch_user" value={gibFetchCredentials.username} onChange={e => setGibFetchCredentials({...gibFetchCredentials, username: e.target.value})} placeholder="Kullanıcı Kodu" required className="h-9" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="gib_fetch_pass">Şifre</Label>
                <Input id="gib_fetch_pass" type="password" value={gibFetchCredentials.password} onChange={e => setGibFetchCredentials({...gibFetchCredentials, password: e.target.value})} placeholder="********" required className="h-9" />
              </div>
              <Button type="submit" disabled={isGibFetching} className="bg-amber-600 hover:bg-amber-700 h-9 gap-1 text-xs font-bold text-white">
                {isGibFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Sorgula & Detayları Getir
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Başlangıç Tarihi</Label>
                <Input type="date" value={gibDateRange.startDate} onChange={e => setGibDateRange({...gibDateRange, startDate: e.target.value})} className="h-9" />
              </div>
              <div className="grid gap-1.5">
                <Label>Bitiş Tarihi</Label>
                <Input type="date" value={gibDateRange.endDate} onChange={e => setGibDateRange({...gibDateRange, endDate: e.target.value})} className="h-9" />
              </div>
            </div>

            {/* Fatura Listesi */}
            {gibInvoices.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b pb-2 flex-wrap gap-2">
                  <span className="text-xs font-bold text-slate-700">{gibInvoices.length} fatura bulundu</span>
                  <div className="flex items-center gap-1.5">
                    <Button 
                      type="button" 
                      size="sm" 
                      onClick={() => matchAndApplyGibInvoices(gibInvoices)} 
                      className="h-7 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1 shadow-xs"
                      title="Listelenen bu faturaları sistemdeki kesilen faturalarla eşleştirip Fatura No ve GİB UUID'lerini kaydeder"
                    >
                      <Search className="w-3 h-3" /> Faturalarla Eşleştir & No Güncelle
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={importAllGibInvoices} className="h-7 text-[10px] font-bold bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white">
                      Tümünü Sisteme Aktar
                    </Button>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        if (confirm('GİB listesindeki tüm faturaları temizlemek istiyor musunuz?')) {
                          setGibInvoices([]);
                          toast.info('GİB listesi temizlendi.');
                        }
                      }} 
                      className="h-7 text-[10px] font-bold bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white"
                    >
                      <Trash2 className="w-3 h-3" /> Listeyi Temizle
                    </Button>
                  </div>
                </div>
                
                <div className="max-h-[340px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="text-xs py-2 font-bold text-slate-600">Tarih</TableHead>
                        <TableHead className="text-xs py-2 font-bold text-slate-600">Fatura No</TableHead>
                        <TableHead className="text-xs py-2 font-bold text-slate-600">Alıcı (VKN / Unvan)</TableHead>
                        <TableHead className="text-xs py-2 font-bold text-slate-600 text-right">Matrah</TableHead>
                        <TableHead className="text-xs py-2 font-bold text-slate-600 text-right">KDV</TableHead>
                        <TableHead className="text-xs py-2 font-bold text-slate-600 text-right">Toplam Tutar</TableHead>
                        <TableHead className="text-xs py-2 font-bold text-slate-600 text-right">İşlem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gibInvoices.map((inv) => {
                        const isAlreadyImported = inv.isImported || satisFaturalari.some(sf => sf.faturaNo === inv.belgeNumarasi);
                        const invTutar = extractGibAmount(inv);
                        const invMatrah = Number(inv.matrah) || (invTutar > 0 ? +(invTutar / 1.2).toFixed(2) : 0);
                        const invKdv = Number(inv.kdvTutari) || +(invTutar - invMatrah).toFixed(2);
                        const aliciUnvan = getAliciUnvan(inv);
                        const aliciVkn = inv.aliciVknTckn || inv.vknTckn || '';
                        
                        return (
                          <TableRow key={inv.ettn} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="text-xs py-2 whitespace-nowrap font-mono">{inv.belgeTarihi}</TableCell>
                            <TableCell className="text-xs py-2 font-mono font-bold text-blue-700">{inv.belgeNumarasi || 'Taslak'}</TableCell>
                            <TableCell className="text-xs py-2 max-w-[190px]">
                              <div className="truncate font-medium text-slate-800" title={aliciUnvan}>{aliciUnvan}</div>
                              {aliciVkn && <div className="text-[10px] font-mono text-slate-500">{aliciVkn}</div>}
                            </TableCell>
                            <TableCell className="text-xs py-2 text-right font-mono font-medium text-slate-600">{formatCurrency(invMatrah)}</TableCell>
                            <TableCell className="text-xs py-2 text-right font-mono font-medium text-blue-600">{formatCurrency(invKdv)}</TableCell>
                            <TableCell className="text-xs py-2 text-right font-mono font-bold text-slate-900">{formatCurrency(invTutar)}</TableCell>
                            <TableCell className="text-xs py-2 text-right">
                              <div className="flex justify-end items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadGibPdf(inv)}
                                  className="h-6 text-[10px] border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-2 flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3 text-red-500" /> PDF İndir
                                </Button>
                                {isAlreadyImported ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                    Aktarıldı
                                  </span>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => importGibInvoice(inv)}
                                    className="h-6 text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2"
                                  >
                                    Aktar
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {isGibFetching && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                <p className="text-xs font-semibold">GİB Portala bağlanılıyor, faturalar çekiliyor...</p>
              </div>
            )}

            {!isGibFetching && gibInvoices.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs italic">
                Sorgulama yapmak için VKN/Kullanıcı bilgilerini girip 'Sorgula' butonuna basın.
              </div>
            )}

            <DialogFooter className="pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setIsGibFetchModalOpen(false)}>Kapat</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* GİB Fatura Görüntüleyici Modal */}
      <Dialog open={isGibViewerOpen} onOpenChange={setIsGibViewerOpen}>
        <DialogContent className="max-w-[1000px] h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>GİB Fatura Görüntüleme</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full bg-white relative">
            {gibViewerHtml ? (
              <iframe 
                srcDoc={gibViewerHtml} 
                className="w-full h-full absolute inset-0 border-0" 
                title="GİB Fatura" 
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Fatura yükleniyor...
              </div>
            )}
          </div>
          <DialogFooter className="p-4 border-t bg-slate-50 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsGibViewerOpen(false)}>Kapat</Button>
            <Button onClick={() => {
              const iframe = document.querySelector('iframe[title="GİB Fatura"]') as HTMLIFrameElement;
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
              }
            }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Printer className="w-4 h-4" /> Yazdır / PDF Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GİB Sorgulama Giriş Modalı */}
      <Dialog open={isGibQueryModalOpen} onOpenChange={setIsGibQueryModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600" />
              GİB e-Arşiv Fatura Sorgulama
            </DialogTitle>
            <DialogDescription>
              Seçilen veya filtrelenen faturaların GİB e-Arşiv portalındaki resmi fatura numaralarını ve kesilme durumlarını sorgulamak için tarih aralığı ve giriş bilgilerinizi kontrol edin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleQueryGibForSelected(tempGibQueryCreds);
          }} className="space-y-4 py-2">
            {gibInvoices.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between gap-2 shadow-xs">
                <div className="text-xs text-amber-900">
                  <div className="font-bold flex items-center gap-1">
                    <Download className="w-3.5 h-3.5 text-amber-600" />
                    Hafızada Çekilmiş {gibInvoices.length} Adet GİB Faturası Var
                  </div>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    GİB portalına tekrar bağlanıp beklemeden doğrudan bu faturalarla eşleştirme yapabilirsiniz.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => matchAndApplyGibInvoices(gibInvoices)}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold h-8 shrink-0 shadow-xs"
                >
                  Hafızadakiyle Eşleştir
                </Button>
              </div>
            )}

            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-900 flex items-center justify-between">
              <span>Sorgulanacak Fatura:</span>
              <span className="font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                {selectedKesilenIds.length > 0 ? `${selectedKesilenIds.length} Seçili Fatura` : `${resolvedInvoices.length} Fatura (Tüm Liste)`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="gib_query_user" className="text-xs">Kullanıcı Kodu / VKN</Label>
                <Input
                  id="gib_query_user"
                  value={tempGibQueryCreds.username}
                  onChange={e => setTempGibQueryCreds({ ...tempGibQueryCreds, username: e.target.value })}
                  placeholder="Kullanıcı Kodu"
                  required
                  className="h-9 text-xs"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="gib_query_pass" className="text-xs">GİB Şifresi</Label>
                <Input
                  id="gib_query_pass"
                  type="password"
                  value={tempGibQueryCreds.password}
                  onChange={e => setTempGibQueryCreds({ ...tempGibQueryCreds, password: e.target.value })}
                  placeholder="********"
                  required
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Tarih Aralığı */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  GİB Sorgulama Tarih Aralığı
                </Label>
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                      const today = now.toISOString().split('T')[0];
                      setTempGibQueryCreds(p => ({ ...p, startDate: first, endDate: today }));
                    }}
                    className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded"
                  >
                    Bu Ay
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
                      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
                      setTempGibQueryCreds(p => ({ ...p, startDate: prevMonthStart, endDate: prevMonthEnd }));
                    }}
                    className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded"
                  >
                    Geçen Ay
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      const today = now.toISOString().split('T')[0];
                      setTempGibQueryCreds(p => ({ ...p, startDate: past, endDate: today }));
                    }}
                    className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded"
                  >
                    Son 30 Gün
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const past = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      const today = now.toISOString().split('T')[0];
                      setTempGibQueryCreds(p => ({ ...p, startDate: past, endDate: today }));
                    }}
                    className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded"
                  >
                    Son 60 Gün
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setTempGibQueryCreds(p => ({ ...p, startDate: today, endDate: today }));
                    }}
                    className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded"
                  >
                    Bugün
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <span className="text-[11px] text-slate-500">Başlangıç:</span>
                  <Input
                    type="date"
                    value={tempGibQueryCreds.startDate}
                    onChange={e => setTempGibQueryCreds({ ...tempGibQueryCreds, startDate: e.target.value })}
                    required
                    className="h-9 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <span className="text-[11px] text-slate-500">Bitiş:</span>
                  <Input
                    type="date"
                    value={tempGibQueryCreds.endDate}
                    onChange={e => setTempGibQueryCreds({ ...tempGibQueryCreds, endDate: e.target.value })}
                    required
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setIsGibQueryModalOpen(false)}>İptal</Button>
              <Button type="submit" disabled={isGibQuerying} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold">
                {isGibQuerying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {isGibQuerying ? 'Sorgulanıyor...' : 'GİB Sorgusunu Başlat'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* GİB Sorgulama Sonuçları Modalı */}
      <Dialog open={isGibResultModalOpen} onOpenChange={setIsGibResultModalOpen}>
        <DialogContent className="sm:max-w-[780px] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Search className="w-5 h-5 text-blue-600" />
              GİB e-Arşiv Sorgulama & Eşleşme Sonuçları
            </DialogTitle>
            <DialogDescription>
              {gibQueryResult?.queryRange ? (
                <span>Sorgulanan Tarih Aralığı: <strong className="text-slate-800">{gibQueryResult.queryRange.startDate} - {gibQueryResult.queryRange.endDate}</strong></span>
              ) : 'GİB e-Arşiv portalında sorgulanan faturaların sonuçları.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Özet Kartları */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setResultActiveTab('matched')}
                className={cn(
                  "p-3 border rounded-lg text-left transition-all cursor-pointer",
                  resultActiveTab === 'matched' 
                    ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300" 
                    : "bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800">Eşleşen & Güncellenen</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-emerald-700 mt-1">
                  {gibQueryResult?.matched.length || 0}
                </div>
                <p className="text-[11px] text-emerald-600 mt-0.5">Fatura numarası kaydedildi</p>
              </button>

              <button
                type="button"
                onClick={() => setResultActiveTab('unmatched')}
                className={cn(
                  "p-3 border rounded-lg text-left transition-all cursor-pointer",
                  resultActiveTab === 'unmatched' 
                    ? "bg-amber-50 border-amber-400 ring-2 ring-amber-300" 
                    : "bg-amber-50/50 border-amber-200 hover:bg-amber-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800">GİB'de Bulunamayan</span>
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold text-amber-700 mt-1">
                  {gibQueryResult?.unmatched.length || 0}
                </div>
                <p className="text-[11px] text-amber-600 mt-0.5">Kesilmemiş veya eşleşmedi</p>
              </button>

              <button
                type="button"
                onClick={() => setResultActiveTab('all')}
                className={cn(
                  "p-3 border rounded-lg text-left transition-all cursor-pointer",
                  resultActiveTab === 'all' 
                    ? "bg-blue-50 border-blue-400 ring-2 ring-blue-300" 
                    : "bg-blue-50/50 border-blue-200 hover:bg-blue-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-800">GİB'deki Tüm Faturalar</span>
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-700 mt-1">
                  {gibQueryResult?.allGib?.length || 0}
                </div>
                <p className="text-[11px] text-blue-600 mt-0.5">GİB'den dönen tüm liste</p>
              </button>
            </div>

            {/* TAB 1: Eşleşen Faturalar */}
            {resultActiveTab === 'matched' && (
              <div className="border border-emerald-200 bg-emerald-50/20 rounded-lg p-3 space-y-2">
                <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  GİB Numarası Alınan ve Eşleşen Faturalar ({gibQueryResult?.matched.length || 0})
                </h4>

                {(!gibQueryResult?.matched || gibQueryResult.matched.length === 0) ? (
                  <div className="text-center py-6 text-slate-400 text-xs italic">
                    Otomatik eşleşen fatura bulunamadı.
                  </div>
                ) : (
                  <div className="max-h-[260px] overflow-y-auto border border-emerald-200 rounded bg-white">
                    <Table>
                      <TableHeader className="bg-emerald-50/80">
                        <TableRow className="h-8">
                          <TableHead className="text-[11px] font-bold py-1">Müşteri</TableHead>
                          <TableHead className="text-[11px] font-bold py-1">GİB Fatura No</TableHead>
                          <TableHead className="text-[11px] font-bold py-1 text-right">Tutar</TableHead>
                          <TableHead className="text-[11px] font-bold py-1 text-center">Durum</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gibQueryResult.matched.map((m: any, idx: number) => (
                          <TableRow key={idx} className="h-9 hover:bg-emerald-50/40">
                            <TableCell className="text-xs py-1.5 font-medium">
                              <div>{m.systemInvoice.ad} {m.systemInvoice.soyad}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{m.systemInvoice.vknTckn}</div>
                            </TableCell>
                            <TableCell className="text-xs py-1.5 font-mono font-bold text-emerald-700">
                              {m.newFaturaNo || m.gibInvoice.belgeNumarasi || 'GİB Onaylı'}
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-right font-bold text-slate-800">
                              {formatCurrency(m.systemInvoice.tutar)}
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-center">
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Güncellendi
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Bulunamayan (Kesilmemiş) Faturalar */}
            {resultActiveTab === 'unmatched' && (
              <div className="border border-amber-200 bg-amber-50/30 rounded-lg p-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      GİB'de Kesilmemiş Görünen Faturalar ({gibQueryResult?.unmatched.length || 0})
                    </h4>
                    <p className="text-[11px] text-amber-700">
                      Bu faturalar GİB sisteminde bulunamadı. Kesilmemiş faturaları tekrar gönderebilmek için bekleyenler listesine çekebilirsiniz.
                    </p>
                  </div>
                  {gibQueryResult && gibQueryResult.unmatched.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => revertToPending(gibQueryResult.unmatched.map(u => u.id))}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 gap-1.5 shrink-0 shadow-sm"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Tümünü Bekleyenlere Geri Çek
                    </Button>
                  )}
                </div>

                {(!gibQueryResult?.unmatched || gibQueryResult.unmatched.length === 0) ? (
                  <div className="text-center py-6 text-slate-400 text-xs italic">
                    Tüm faturalar GİB ile eşleşti, kesilmemiş fatura bulunmuyor! 🎉
                  </div>
                ) : (
                  <div className="max-h-[260px] overflow-y-auto border border-amber-200 rounded bg-white">
                    <Table>
                      <TableHeader className="bg-amber-50/80">
                        <TableRow className="h-8">
                          <TableHead className="text-[11px] font-bold py-1">Müşteri / VKN</TableHead>
                          <TableHead className="text-[11px] font-bold py-1">Tarih</TableHead>
                          <TableHead className="text-[11px] font-bold py-1 text-right">Tutar</TableHead>
                          <TableHead className="text-[11px] font-bold py-1 text-right">İşlem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gibQueryResult.unmatched.map((inv: any) => (
                          <TableRow key={inv.id} className="h-9 hover:bg-amber-50/40">
                            <TableCell className="text-xs py-1.5 font-medium">
                              <div>{inv.ad} {inv.soyad}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{inv.vknTckn}</div>
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-slate-600">{inv.faturaTarihi}</TableCell>
                            <TableCell className="text-xs py-1.5 text-right font-bold text-slate-800">{formatCurrency(inv.tutar)}</TableCell>
                            <TableCell className="text-xs py-1.5 text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => revertToPending([inv.id])}
                                className="h-6 text-[10px] border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-600 hover:text-white px-2 gap-1 font-bold"
                              >
                                <Undo2 className="w-3 h-3" /> Bekleyenlere Al
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: GİB'den Dönen Tüm Faturalar */}
            {resultActiveTab === 'all' && (
              <div className="border border-blue-200 bg-blue-50/20 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      GİB Portalındaki Kayıtlı Tüm Faturalar ({gibQueryResult?.allGib?.length || 0})
                    </h4>
                    <p className="text-[11px] text-blue-700">
                      GİB e-Arşiv portalında bulunan faturalar aşağıdadır. İlgili bir faturanın numarasını doğrudan sistem faturasına bağlayabilirsiniz.
                    </p>
                  </div>
                </div>

                {(!gibQueryResult?.allGib || gibQueryResult.allGib.length === 0) ? (
                  <div className="text-center py-6 text-slate-400 text-xs italic">
                    GİB e-Arşiv portalında seçilen tarih aralığında hiçbir fatura bulunamadı.
                  </div>
                ) : (
                  <div className="max-h-[260px] overflow-y-auto border border-blue-200 rounded bg-white">
                    <Table>
                      <TableHeader className="bg-blue-50/80">
                        <TableRow className="h-8">
                          <TableHead className="text-[11px] font-bold py-1">Tarih</TableHead>
                          <TableHead className="text-[11px] font-bold py-1">Belge No</TableHead>
                          <TableHead className="text-[11px] font-bold py-1">Alıcı Ünvanı</TableHead>
                          <TableHead className="text-[11px] font-bold py-1 text-right">Tutar</TableHead>
                          <TableHead className="text-[11px] font-bold py-1 text-right">Manuel Eşle</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gibQueryResult.allGib.map((gibInv: any, idx: number) => {
                          const gTutar = parseGibAmount(gibInv.odenecek || gibInv.odenecekTutar || gibInv.belgeTutari || gibInv.toplamTutar || gibInv.tutar);
                          const gAlici = gibInv.aliciUnvanAdSoyad || gibInv.aliciUnvan || gibInv.unvan || gibInv.aliciAdi || 'Bilinmeyen Alıcı';
                          const isAlreadyMatched = gibQueryResult.matched.some(m => (m.gibInvoice?.ettn && m.gibInvoice.ettn === gibInv.ettn) || (m.newFaturaNo && m.newFaturaNo === gibInv.belgeNumarasi));

                          return (
                            <TableRow key={idx} className="h-9 hover:bg-blue-50/30">
                              <TableCell className="text-xs py-1.5 text-slate-600">{gibInv.belgeTarihi || gibInv.tarih}</TableCell>
                              <TableCell className="text-xs py-1.5 font-mono font-bold text-slate-800">
                                {gibInv.belgeNumarasi || 'Taslak'}
                              </TableCell>
                              <TableCell className="text-xs py-1.5 max-w-[180px] truncate" title={gAlici}>
                                {gAlici}
                              </TableCell>
                              <TableCell className="text-xs py-1.5 text-right font-bold text-slate-800">
                                {formatCurrency(gTutar)}
                              </TableCell>
                              <TableCell className="text-xs py-1.5 text-right">
                                {isAlreadyMatched ? (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3" /> Eşleşti
                                  </span>
                                ) : (
                                  gibQueryResult.unmatched.length > 0 ? (
                                    <select
                                      onChange={(e) => {
                                        const selectedTargetId = e.target.value;
                                        if (selectedTargetId) {
                                          handleManualBindGibInvoice(selectedTargetId, gibInv);
                                        }
                                      }}
                                      defaultValue=""
                                      className="h-6 text-[10px] font-bold rounded border border-blue-300 bg-blue-50 text-blue-800 px-1 focus:outline-none cursor-pointer"
                                    >
                                      <option value="" disabled>Bu faturaya bağla...</option>
                                      {gibQueryResult.unmatched.map(u => (
                                        <option key={u.id} value={u.id}>
                                          {u.ad} {u.soyad} ({formatCurrency(u.tutar)})
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">Bekleyen Yok</span>
                                  )
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t flex justify-between items-center">
            <span className="text-xs text-slate-500">
              GİB'de toplam <strong className="text-slate-800">{gibQueryResult?.allGib?.length || 0}</strong> fatura bulundu.
            </span>
            <Button type="button" onClick={() => setIsGibResultModalOpen(false)} className="bg-slate-900 text-white hover:bg-slate-800 font-medium">
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 8. Akıllı GİB Çapraz Kontrol & Excel İçe Aktarma Modalı */}
      <Dialog open={isCrossCheckModalOpen} onOpenChange={setIsCrossCheckModalOpen}>
        <DialogContent className="sm:max-w-[950px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                <GitCompare className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>GİB Çapraz Kontrol & Akıllı Fatura Yükleme</span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Akıllı Mutabakat
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Excel listenizi yükleyin; sistem <strong>Tarih + Tutar + VKN</strong> ile, <strong>11111111111 (Nihai Tüketiciler)</strong> için ise <strong>Tarih + Tutar + Müşteri Adı</strong> ile kontrol edip kesilmemiş faturaları otomatik listeler.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Dosya Yükleme ve Çapraz Kontrol Tetikleyici */}
            <div className="p-4 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50/70 transition-all text-center">
              <input
                type="file"
                id="cross-check-file-input"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleCrossCheckFileChange}
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-white shadow-xs border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {crossCheckFileName ? `Yüklenen Dosya: ${crossCheckFileName}` : 'Kesilecek Faturalar Excel / CSV Dosyasını Seçin'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Excel'deki Tarih, VKN, Müşteri Adı ve Tutar sütunları otomatik tanınır
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    type="button"
                    onClick={() => document.getElementById('cross-check-file-input')?.click()}
                    disabled={isCrossChecking}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 text-xs gap-1.5 shadow-xs"
                  >
                    {isCrossChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                    {crossCheckFileName ? 'Farklı Dosya Seç' : 'Excel Dosyası Yükle & Tara'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={downloadTemplate}
                    className="h-8 text-xs font-semibold text-slate-600 border-slate-300 hover:bg-white"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Şablon İndir
                  </Button>
                </div>
              </div>
            </div>

            {/* Analiz Sonuç Kartları */}
            {crossCheckResult.isCalculated && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Toplam Okunan */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Excel'den Okunan
                    </span>
                    <div className="mt-1 text-2xl font-black text-slate-900">
                      {crossCheckResult.totalUploaded} <span className="text-xs font-medium text-slate-500">Adet Fatura</span>
                    </div>
                  </div>

                  {/* Zaten Kesilmişler */}
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Zaten Kesilmiş (GİB'de Mevcut)
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                        {crossCheckResult.matchedList.length} Adet
                      </span>
                    </div>
                    <div className="mt-1 text-2xl font-black text-emerald-950">
                      {formatCurrency(crossCheckResult.matchedList.reduce((acc, curr) => acc + (Number(curr.excelRow.tutar) || 0), 0))}
                    </div>
                    <p className="text-[10px] text-emerald-700 mt-0.5">Mükerrer fatura kesimi otomatik engellendi</p>
                  </div>

                  {/* Henüz Kesilmemişler (Eklenecekler) */}
                  <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/70 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Kesilmemiş (Eklenecek)
                      </span>
                      <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                        {crossCheckResult.unmatchedList.length} Adet
                      </span>
                    </div>
                    <div className="mt-1 text-2xl font-black text-amber-950">
                      {formatCurrency(crossCheckResult.unmatchedList.reduce((acc, curr) => acc + (Number(curr.excelRow.tutar) || 0), 0))}
                    </div>
                    <p className="text-[10px] text-amber-800 mt-0.5">Kesilecekler listesine aktarılmaya hazır</p>
                  </div>
                </div>

                {/* Sekme Geçişi */}
                <div className="flex items-center justify-between border-b pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setCrossCheckActiveTab('unmatched')}
                      className={cn(
                        "px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                        crossCheckActiveTab === 'unmatched'
                          ? "bg-amber-500 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Kesilmemiş Faturalar ({crossCheckResult.unmatchedList.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCrossCheckActiveTab('matched')}
                      className={cn(
                        "px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                        crossCheckActiveTab === 'matched'
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Zaten Kesilmiş Olanlar ({crossCheckResult.matchedList.length})</span>
                    </button>
                  </div>

                  {crossCheckResult.unmatchedList.length > 0 && (
                    <Button
                      type="button"
                      onClick={handleImportUnmatchedToKesilecek}
                      disabled={isImportingUnmatched}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 gap-1.5 shadow-sm"
                    >
                      {isImportingUnmatched ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus className="w-3.5 h-3.5" />}
                      <span>Kesilmeyen {crossCheckResult.unmatchedList.length} Faturayı Kesilecek Listesine Ekle</span>
                    </Button>
                  )}
                </div>

                {/* Tablolar */}
                {crossCheckActiveTab === 'unmatched' ? (
                  <div className="border rounded-lg overflow-hidden max-h-[340px] overflow-y-auto">
                    {crossCheckResult.unmatchedList.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        Tebrikler! Yüklediğiniz listedeki tüm faturalar zaten kesilmiş veya sistemde kayıtlı.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader className="bg-amber-50/80 sticky top-0 z-10">
                          <TableRow>
                            <TableHead className="text-xs py-2 font-bold text-amber-900">Tarih</TableHead>
                            <TableHead className="text-xs py-2 font-bold text-amber-900">VKN / TCKN</TableHead>
                            <TableHead className="text-xs py-2 font-bold text-amber-900">Müşteri / Ünvan</TableHead>
                            <TableHead className="text-xs py-2 font-bold text-amber-900 text-right">Matrah</TableHead>
                            <TableHead className="text-xs py-2 font-bold text-amber-900 text-right">KDV</TableHead>
                            <TableHead className="text-xs py-2 font-bold text-amber-900 text-right">Toplam Tutar</TableHead>
                            <TableHead className="text-xs py-2 font-bold text-amber-900 text-center">Durum</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {crossCheckResult.unmatchedList.map((item, idx) => {
                            const r = item.excelRow;
                            const isRetail = cleanDigits(r.vknTckn) === '11111111111';
                            return (
                              <TableRow key={idx} className="hover:bg-amber-50/40">
                                <TableCell className="text-xs py-2 whitespace-nowrap font-mono">{r.faturaTarihi}</TableCell>
                                <TableCell className="text-xs py-2 font-mono">
                                  {isRetail ? (
                                    <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded border border-purple-200">
                                      11111111111 (Nihai)
                                    </span>
                                  ) : (
                                    r.vknTckn || '-'
                                  )}
                                </TableCell>
                                <TableCell className="text-xs py-2 font-medium text-slate-900 max-w-[220px] truncate" title={`${r.ad} ${r.soyad || ''}`}>
                                  {r.ad} {r.soyad || ''}
                                </TableCell>
                                <TableCell className="text-xs py-2 text-right font-mono text-slate-600">{formatCurrency(r.matrah || 0)}</TableCell>
                                <TableCell className="text-xs py-2 text-right font-mono text-blue-600">{formatCurrency(r.kdvTutari || 0)}</TableCell>
                                <TableCell className="text-xs py-2 text-right font-mono font-bold text-slate-900">{formatCurrency(r.tutar || 0)}</TableCell>
                                <TableCell className="text-xs py-2 text-center">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                                    KESİLECEK
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden max-h-[340px] overflow-y-auto">
                    {crossCheckResult.matchedList.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        Hiçbir fatura kesilenlerle eşleşmedi.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader className="bg-emerald-50/80 sticky top-0 z-10">
                          <TableRow>
                            <TableHead className="text-xs py-2 font-bold text-emerald-900">Tarih</TableHead>
                            <TableHead className="text-xs py-2 font-bold text-emerald-900">Müşteri / Ünvan</TableHead>
                            <TableHead className="text-xs py-2 font-bold text-emerald-900 text-right">Tutar</TableHead>
                            <TableHead className="text-xs py-2 font-bold text-emerald-900">Eşleşen Belge No</TableHead>
                            <TableHead className="text-xs py-2 font-bold text-emerald-900">Kaynak</TableHead>
                            <TableHead className="text-xs py-2 font-bold text-emerald-900 text-center">Eşleşme Kriteri</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {crossCheckResult.matchedList.map((item, idx) => {
                            const r = item.excelRow;
                            const m = item.matchedInvoice;
                            return (
                              <TableRow key={idx} className="hover:bg-emerald-50/30">
                                <TableCell className="text-xs py-2 whitespace-nowrap font-mono">{r.faturaTarihi}</TableCell>
                                <TableCell className="text-xs py-2 font-medium text-slate-900 max-w-[200px] truncate" title={`${r.ad} ${r.soyad || ''}`}>
                                  {r.ad} {r.soyad || ''}
                                </TableCell>
                                <TableCell className="text-xs py-2 text-right font-mono font-bold text-emerald-900">{formatCurrency(r.tutar || 0)}</TableCell>
                                <TableCell className="text-xs py-2 font-mono font-bold text-blue-700">{m.faturaNo || 'Kayıtlı Fatura'}</TableCell>
                                <TableCell className="text-xs py-2 text-[11px] text-slate-600">{m.source}</TableCell>
                                <TableCell className="text-xs py-2 text-center">
                                  {item.matchType === 'TC111_NAME_MATCH' ? (
                                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                                      Ad + Tutar + Tarih
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                                      VKN + Tutar + Tarih
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t flex justify-between items-center">
            <span className="text-xs text-slate-500">
              {crossCheckResult.isCalculated 
                ? `Toplam ${crossCheckResult.totalUploaded} fatura denetlendi: ${crossCheckResult.matchedList.length} kesilmiş, ${crossCheckResult.unmatchedList.length} kesilmeyi bekliyor.`
                : 'Lütfen karşılaştırmak istediğiniz Excel veya CSV dosyasını seçin.'}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCrossCheckModalOpen(false)}>
                Kapat
              </Button>
              {crossCheckResult.isCalculated && crossCheckResult.unmatchedList.length > 0 && (
                <Button 
                  type="button" 
                  onClick={handleImportUnmatchedToKesilecek}
                  disabled={isImportingUnmatched}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {isImportingUnmatched ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {crossCheckResult.unmatchedList.length} Faturayı Ekle
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
