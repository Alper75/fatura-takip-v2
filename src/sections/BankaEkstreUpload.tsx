import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// Select bileşenleri performans için native ama shadcn stiliyle giydirilmiştir.
import { useApp } from '@/context/AppContext';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Search, Landmark, Sparkles, Loader2, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { IslemTuru } from '@/types';
import { LucaAccountSelect } from '@/components/LucaAccountSelect';

interface BankaEkstreUploadProps {
  bankaId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface EkstreSatiri {
  tarih: string;
  aciklama: string;
  tutar: number;
  tip: 'borc' | 'alacak'; // Borç (Bizden çıkan), Alacak (Bize gelen)
  eslesenCariId: string | null;
  önerilenTur: IslemTuru;
  durum: 'success' | 'warning' | 'pending';
  transferBankaId?: string | null;
  muhasebeKodu?: string;
  kategoriId?: string | null;
  dovizTuru?: string;
  dovizTutar?: number;
  dovizKuru?: number;
}

const SYSTEM_CATEGORIES = [
  { id: 'genel_gider', ad: 'Genel Gider' },
  { id: 'kira_odemesi', ad: 'Kira Ödemesi' },
  { id: 'maas_odemesi', ad: 'Maaş Ödemesi' },
  { id: 'ssk_odemesi', ad: 'SSK/Bağkur Ödemesi' },
  { id: 'vergi_kdv', ad: 'KDV Ödemesi' },
  { id: 'banka_masrafi', ad: 'Banka Masrafı' }
];

const CLASSIFICATION_KEYWORDS: Record<string, IslemTuru> = {
  'KDV': 'vergi_kdv',
  'MUHTASAR': 'vergi_muhtasar',
  'GECICI': 'vergi_gecici',
  'DAMGA': 'vergi_damga',
  'VERGI': 'vergi_kdv',
  'BSMV': 'banka_masrafi',
  'KOMISYON': 'banka_masrafi',
  'MASRAF': 'banka_masrafi',
  'UCRET': 'banka_masrafi',
  'FON': 'banka_masrafi',
  'MAAS': 'maas_odemesi',
  'PERSONEL': 'maas_odemesi',
  'HAKEDIS': 'maas_odemesi',
  'SGK': 'ssk_odemesi',
  'SSK': 'ssk_odemesi',
  'BAGKUR': 'ssk_odemesi',
  'KIRA': 'kira_odemesi',
  'STOPAJ': 'kira_odemesi',
  'ELEKTRIK': 'genel_gider',
  ' SU ': 'genel_gider',
  'DOGALGAZ': 'genel_gider',
  'TELEKOM': 'genel_gider',
  'INTERNET': 'genel_gider',
  'KREDI KARTI': 'kredi_karti_odemesi',
  'KK ODEME': 'kredi_karti_odemesi',
};

export function BankaEkstreUpload({ bankaId, isOpen, onClose }: BankaEkstreUploadProps) {
  const { apiFetch, cariler, bankaHesaplari, addCariHareket, masrafKurallari, lucaAccounts, giderKategorileri } = useApp();
  const [satirlar, setSatirlar] = useState<EkstreSatiri[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const banka = bankaHesaplari.find(b => b.id === bankaId);

  const normalizeString = (str: any) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/i/g, 'I')
      .replace(/ı/g, 'I')
      .replace(/ğ/g, 'G')
      .replace(/ü/g, 'U')
      .replace(/ş/g, 'S')
      .replace(/ö/g, 'O')
      .replace(/ç/g, 'C')
      .toUpperCase()
      .replace(/İ/g, 'I')
      .replace(/Ğ/g, 'G')
      .replace(/Ü/g, 'U')
      .replace(/Ş/g, 'S')
      .replace(/Ö/g, 'O')
      .replace(/Ç/g, 'C')
      .trim();
  };

  const classifyTransaction = (aciklama: string, tip: 'borc' | 'alacak'): { tur: IslemTuru; cariId: string | null; kategoriId?: string | null; transferBankaId?: string | null; muhasebeKodu?: string } => {
    const cleanDesc = normalizeString(aciklama);
    const trUpperDesc = aciklama.toLocaleUpperCase('tr-TR');
    
    // 0. Akıllı Kurallar (Masraf Kuralları) Kontrolü (En Yüksek Öncelik)
    for (const kural of masrafKurallari) {
      const keyword = (kural.anahtarKelime || '').toLocaleUpperCase('tr-TR');
      if (keyword && trUpperDesc.includes(keyword)) {
        let muhKodu = kural.muhasebeKodu;
        let tur = kural.islemTuru;
        if (!muhKodu && kural.kategoriId) {
          const cat = giderKategorileri.find(k => k.id === kural.kategoriId);
          if (cat?.muhasebeKodu) muhKodu = cat.muhasebeKodu;
          if (cat?.tip === 'GELIR' && tur === 'genel_gider') {
            tur = 'diger_gelir';
          }
        }
        return {
          tur: tur,
          cariId: null,
          kategoriId: kural.kategoriId,
          muhasebeKodu: muhKodu
        };
      }
    }

    const noSpaceDesc = cleanDesc.replace(/\s/g, '');

    // 1. Kendi Bankalarımız Arası Transfer Kontrolü (Virman) - Öncelikli Olarak IBAN Kontrolü
    for (const otherBanka of bankaHesaplari) {
      if (otherBanka.id === bankaId) continue;
      
      const hasIban = otherBanka.iban && noSpaceDesc.includes(normalizeString(otherBanka.iban).replace(/\s/g, ''));
      if (hasIban) {
        return { tur: 'transfer', cariId: null, transferBankaId: otherBanka.id, muhasebeKodu: otherBanka.muhasebeKodu };
      }
    }

    // 1.1 IBAN Eşleşmediyse Hesap No ve Kart No Kontrolü
    for (const otherBanka of bankaHesaplari) {
      if (otherBanka.id === bankaId) continue;
      
      const cHesapNo = otherBanka.hesapNo ? otherBanka.hesapNo.replace(/\s/g, '') : '';
      const cKartNo = otherBanka.kartNo ? otherBanka.kartNo.replace(/\s/g, '') : '';
      const hasHesapNo = cHesapNo.length > 4 && noSpaceDesc.includes(cHesapNo);
      const hasKartNo = cKartNo.length > 4 && noSpaceDesc.includes(cKartNo);

      if (hasHesapNo || hasKartNo) {
        return { tur: 'transfer', cariId: null, transferBankaId: otherBanka.id, muhasebeKodu: otherBanka.muhasebeKodu };
      }
    }

    // 2. Kredi Kartı Ödemesi Anahtar Kelime + Kart No Eşleşmesi
    if (cleanDesc.includes('KREDI KARTI') || cleanDesc.includes('KK ODEME')) {
       for (const b of bankaHesaplari) {
         if (b.kartNo && cleanDesc.includes(b.kartNo)) {
           return { tur: 'kredi_karti_odemesi', cariId: null, transferBankaId: b.id };
         }
       }
    }

    // 3. Cari Eşleştirme (Gelişmiş)
    for (const cari of cariler) {
      const v = String(cari.vknTckn || '').trim();
      if (v && v.length > 5 && cleanDesc.includes(v)) {
        return { 
          tur: tip === 'alacak' ? 'tahsilat' : 'odeme', 
          cariId: cari.id,
          muhasebeKodu: cari.muhasebeKodu
        };
      }
    }

    const isTransferKeyword = cleanDesc.includes('VIRMAN') || cleanDesc.includes('TRANSFER');
    for (const b of bankaHesaplari) {
      if (b.id === bankaId) continue;
      
      const bAdi = normalizeString(b.bankaAdi);
      const hAdi = normalizeString(b.hesapAdi);
      
      if (isTransferKeyword && ((bAdi && bAdi.length > 3 && cleanDesc.includes(bAdi)) || (hAdi && hAdi.length > 3 && cleanDesc.includes(hAdi)))) {
        return { tur: 'transfer', cariId: null, transferBankaId: b.id, muhasebeKodu: b.muhasebeKodu };
      }
    }

    // 2. IBAN Eşleştirmesi (Cari Listesinden)
    const ibanInDesc = cleanDesc.replace(/[^A-Z0-9]/g, '').match(/TR[0-9]{24}/);
    if (ibanInDesc) {
      const foundCari = cariler.find(c => (c.iban || '').replace(/\s/g, '') === ibanInDesc[0]);
      if (foundCari) {
        return { 
          tur: tip === 'alacak' ? 'tahsilat' : 'odeme', 
          cariId: foundCari.id, 
          muhasebeKodu: foundCari.muhasebeKodu 
        };
      }
    }

    // 3. Cari Ünvan Eşleştirmesi (Fuzzy)
    for (const cari of cariler) {
      if (!cari.unvan) continue;
      const cleanedU = normalizeString(cari.unvan)
        .replace(/\s+A\.?S\.?(\s|$)/g, ' ')
        .replace(/\s+ANONIM SIRKETI(\s|$)/g, ' ')
        .replace(/\s+LTD\.?\s*STI\.?(\s|$)/g, ' ')
        .replace(/\s+LIMITED SIRKETI(\s|$)/g, ' ')
        .replace(/\s+SAN\.?\s*VE\s*TIC\.?(\s|$)/g, ' ')
        .replace(/\s+SANAYI VE TICARET(\s|$)/g, ' ')
        .replace(/\s+SAN\.?\s*TIC\.?(\s|$)/g, ' ')
        .replace(/\s+SANAYI(\s|$)/g, ' ')
        .replace(/\s+TICARET(\s|$)/g, ' ')
        .replace(/\s+SAN\.?(\s|$)/g, ' ')
        .replace(/\s+TIC\.?(\s|$)/g, ' ')
        .replace(/\s+STI\.?(\s|$)/g, ' ')
        .trim();

      if (cleanedU.length >= 4 && cleanDesc.includes(cleanedU)) {
        return { 
          tur: tip === 'alacak' ? 'tahsilat' : 'odeme', 
          cariId: cari.id, 
          muhasebeKodu: cari.muhasebeKodu 
        };
      }

      // 3.3 Kelime bazlı arama
      const words = cleanedU.split(' ');
      if (words.length >= 2) {
        const firstTwoWords = words[0] + ' ' + words[1];
        if (firstTwoWords.length >= 5 && cleanDesc.includes(firstTwoWords)) {
           return { 
             tur: tip === 'alacak' ? 'tahsilat' : 'odeme', 
             cariId: cari.id, 
             muhasebeKodu: cari.muhasebeKodu 
           };
        }
      }

      if (words.length >= 1) {
        const firstWord = words[0];
        if (firstWord.length >= 5 && cleanDesc.includes(firstWord)) {
           return { 
             tur: tip === 'alacak' ? 'tahsilat' : 'odeme', 
             cariId: cari.id, 
             muhasebeKodu: cari.muhasebeKodu 
           };
        }
      }
    }

    // 4. Anahtar Kelime Eşleştirme (Vergi, Maaş vb.)
    for (const [key, tur] of Object.entries(CLASSIFICATION_KEYWORDS)) {
      if (cleanDesc.includes(key)) {
        const sysCat = giderKategorileri.find(cat => cat.id === tur || normalizeString(cat.ad).includes(key));
        return { tur, cariId: null, kategoriId: sysCat?.id, muhasebeKodu: sysCat?.muhasebeKodu };
      }
    }

    // 5. Luca Hesap Planı Eşleştirme (Eğer Cari ve diğerleri bulunamadıysa)
    for (const hesap of lucaAccounts) {
      if (!hesap.ad) continue;
      const hesapAdUpper = hesap.ad.toLocaleUpperCase('tr-TR');
      if (hesapAdUpper.length > 3 && trUpperDesc.includes(hesapAdUpper)) {
        return {
          tur: tip === 'alacak' ? 'tahsilat' : 'odeme',
          cariId: null,
          muhasebeKodu: hesap.kod
        };
      }
    }

    return { 
      tur: tip === 'alacak' ? 'tahsilat' : 'odeme', 
      cariId: null 
    };
  };

  const parseTurkishNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    let s = String(val || '0').trim();
    if (!s) return 0;
    s = s.replace(/[^0-9,.-]/g, '');
    if (s.includes('.') && s.includes(',')) {
      return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    }
    if (s.includes(',')) {
      return parseFloat(s.replace(',', '.'));
    }
    return parseFloat(s);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        let headerRowIdx = -1;
        let dateIdx = -1;
        let descIdx = -1;
        let amountIdx = -1;
        let debitIdx = -1;
        let creditIdx = -1;

        for (let i = 0; i < Math.min(data.length, 30); i++) {
          const row = (data[i] || []).map(cell => normalizeString(String(cell || '')));
          if (row.some(c => c.includes('TARIH')) && row.some(c => c.includes('ACIKLAMA'))) {
            headerRowIdx = i;
            dateIdx = row.findIndex(c => c.includes('TARIH'));
            descIdx = row.findIndex(c => c.includes('ACIKLAMA'));
            amountIdx = row.findIndex(c => c.includes('ISLEM TUTARI') || c === 'TUTAR');
            debitIdx = row.findIndex(c => c === 'BORC');
            creditIdx = row.findIndex(c => c === 'ALACAK');
            break;
          }
        }

        if (headerRowIdx === -1) {
          toast.error('Excel formatı anlaşılamadı.');
          setIsProcessing(false);
          return;
        }

        const mappedSatirlar: EkstreSatiri[] = [];
        for (let i = headerRowIdx + 1; i < data.length; i++) {
          try {
            const row = data[i];
            if (!row || !row[dateIdx]) continue;
            
            let tarih = String(row[dateIdx]);
            if (row[dateIdx] instanceof Date) {
              tarih = row[dateIdx].toISOString().split('T')[0];
            } else if (tarih.includes('/')) {
              const parts = tarih.split('/');
              if (parts.length === 3) {
                 const [day, month, year] = parts;
                 tarih = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              }
            } else if (tarih.includes('.')) {
              const parts = tarih.split('.');
              if (parts.length === 3) {
                 const [day, month, year] = parts;
                 tarih = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              }
            }
            const desc = String(row[descIdx] || '');
            let amount = 0;
            let tip: 'borc' | 'alacak' = 'alacak';

            if (amountIdx !== -1) {
              const val = parseTurkishNumber(row[amountIdx]);
              amount = Math.abs(val);
              tip = val < 0 ? 'borc' : 'alacak';
            } else if (debitIdx !== -1 && creditIdx !== -1) {
              const borc = parseTurkishNumber(row[debitIdx]);
              const alacak = parseTurkishNumber(row[creditIdx]);
              amount = borc > 0 ? borc : alacak;
              tip = borc > 0 ? 'borc' : 'alacak';
            }

            if (!amount || isNaN(amount)) continue;

            const match = classifyTransaction(desc, tip);
            const isForeign = banka?.dovizTuru !== 'TRY';
          
            mappedSatirlar.push({
              tarih,
              aciklama: desc,
              tutar: isForeign ? 0 : amount,
              tip,
              eslesenCariId: match.cariId,
              önerilenTur: match.tur,
              kategoriId: match.kategoriId,
              transferBankaId: match.transferBankaId,
              muhasebeKodu: match.muhasebeKodu,
              durum: (match.cariId || match.transferBankaId || match.kategoriId || match.muhasebeKodu) ? 'success' : 'pending',
              dovizTuru: banka?.dovizTuru || 'TRY',
              dovizTutar: isForeign ? amount : undefined,
              dovizKuru: undefined
            });
          } catch (rowErr) {
            console.error('Satır işleme hatası:', rowErr);
          }
        }

        setTimeout(() => {
          if (mappedSatirlar.length === 0) {
             toast.error('Excel içinde işlenebilir bir veri bulunamadı.');
          } else {
             setSatirlar(mappedSatirlar);
             toast.success(`${mappedSatirlar.length} adet hareket yüklendi.`);
          }
          setIsProcessing(false);
        }, 100);
      } catch (err) {
        toast.error('Excel dosyası işlenirken kritik hata oluştu.');
        console.error(err);
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const formatDateForLuca = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('.')) {
      const [datePart] = dateStr.split(' ');
      const [day, month, year] = datePart.split('.');
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    return dateStr;
  };

  const handleConfirm = (sendToLuca = false) => {
    const payloadRows: any[] = [];
    satirlar.forEach(s => {
      const finalAciklama = s.önerilenTur === 'transfer' 
        ? `${s.aciklama} [${s.tip === 'alacak' ? 'GELEN' : 'GİDEN'} TRANSFER]`
        : s.aciklama;

      addCariHareket({
        cariId: s.eslesenCariId || (s.önerilenTur === 'tahsilat' || s.önerilenTur === 'odeme' ? 'genel-cari' : 'sistem'),
        tarih: s.tarih,
        islemTuru: s.önerilenTur,
        tutar: s.tutar,
        aciklama: finalAciklama,
        bankaId: bankaId,
        muhasebeKodu: s.muhasebeKodu,
        kategoriId: s.kategoriId,
        dovizTuru: s.dovizTuru as any,
        dovizTutar: s.dovizTutar,
        dovizKuru: s.dovizKuru
      });

      if (sendToLuca) {
        const cari = cariler.find(c => c.id === s.eslesenCariId);
        const isGiris = s.tip === 'alacak' || s.önerilenTur === 'tahsilat';
        const formattedTarih = formatDateForLuca(s.tarih);
        const cleanAciklama = (finalAciklama || '')
          .replace(/[\r\n\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 50);

        payloadRows.push(
          {
            tarih: formattedTarih,
            evrakNo: '',
            aciklama: cleanAciklama,
            tutar: s.tutar,
            tur: isGiris ? 'alacak' : 'borc',
            islemTuru: s.önerilenTur,
            banka: banka?.hesapAdi || '',
            cari: cari?.unvan || '',
            muhasebeKodu: s.muhasebeKodu || '',
            dovizTuru: s.dovizTuru,
            dovizTutar: s.dovizTutar,
            dovizKuru: s.dovizKuru
          },
          {
            tarih: formattedTarih,
            evrakNo: '',
            aciklama: cleanAciklama,
            tutar: s.tutar,
            tur: isGiris ? 'borc' : 'alacak',
            islemTuru: s.önerilenTur,
            banka: banka?.hesapAdi || '',
            cari: cari?.unvan || '',
            muhasebeKodu: banka?.muhasebeKodu || '',
            dovizTuru: s.dovizTuru,
            dovizTutar: s.dovizTutar,
            dovizKuru: s.dovizKuru
          }
        );
      }
    });

    if (sendToLuca && payloadRows.length > 0) {
      const transferPayload = {
        isIsletme: false,
        bankTransactions: payloadRows,
        mahsupRows: payloadRows,
        count: satirlar.length
      };

      try {
        localStorage.setItem('fatura_app_luca_banka', JSON.stringify(payloadRows));
        localStorage.setItem('fatura_app_luca_mahsup', JSON.stringify(payloadRows));
        localStorage.setItem('fatura_app_luca_data', JSON.stringify(transferPayload));
        localStorage.setItem('transferData', JSON.stringify(transferPayload));
      } catch (e) {
        console.error('LocalStorage transfer error:', e);
      }

      window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SEND_BANKA_HAREKETLERI', { detail: transferPayload }));
      document.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_SEND_BANKA_HAREKETLERI', { detail: transferPayload }));
      window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_DATA', { detail: transferPayload }));
      window.postMessage({ type: 'FATURA_APP_LUCA_SEND_BANKA_HAREKETLERI', detail: transferPayload, data: transferPayload }, '*');
      window.postMessage({ type: 'FATURA_APP_LUCA_DATA', detail: transferPayload, data: transferPayload }, '*');

      toast.success(`${satirlar.length} hareket kaydedildi ve Luca eklentisine gönderildi!`, {
        description: 'Luca eklentisi açık ise Banka / Mahsup kuyruğundan aktarabilirsiniz.'
      });
    } else {
      toast.success('Banka ekstresi başarıyla işlendi.');
    }

    onClose();
    setSatirlar([]);
    setVisibleCount(50);
  };

  const fetchKurlar = async () => {
    if (!banka || banka.dovizTuru === 'TRY') return;
    setIsProcessing(true);
    const updatedSatirlar = [...satirlar];
    const uniqueDates = [...new Set(updatedSatirlar.map(s => s.tarih))];
    const ratesByDate: Record<string, number> = {};

    for (const d of uniqueDates) {
      try {
        const res = await fetch(`/api/kur?date=${d}`);
        const data = await res.json();
        if (data.success && data.rates && data.rates[banka.dovizTuru]) {
          ratesByDate[d] = data.rates[banka.dovizTuru].ForexBuying;
        }
      } catch (e) {
        console.error(e);
      }
    }

    let calculatedCount = 0;
    for (let i = 0; i < updatedSatirlar.length; i++) {
      const kur = ratesByDate[updatedSatirlar[i].tarih];
      if (kur) {
        updatedSatirlar[i].dovizKuru = kur;
        if (updatedSatirlar[i].dovizTutar) {
          updatedSatirlar[i].tutar = parseFloat((updatedSatirlar[i].dovizTutar! * kur).toFixed(2));
          calculatedCount++;
        }
      }
    }
    setSatirlar(updatedSatirlar);
    setIsProcessing(false);
    toast.success(`${calculatedCount} hareketin döviz kurları çekildi ve TL tutarları hesaplandı.`);
  };

  const getAiConfig = async () => {
    let activeProvider = 'openai';
    let apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    let aiModel = 'gemini-2.5-flash';
    let nvidiaApiKey = '';
    let nvidiaModelName = 'stepfun-ai/step-5-preview';
    let openaiApiKey = '';
    let openaiModelName = 'gpt-4o-mini';

    let xaiApiKey = '';
    let xaiModelName = 'grok-2-vision-1212';

    try {
      const [provRes, keyRes, modelRes, nKeyRes, nModelRes, oKeyRes, oModelRes, xKeyRes, xModelRes] = await Promise.all([
        apiFetch('/api/settings/ai_provider').catch(() => null),
        apiFetch('/api/settings/gemini_api_key').catch(() => null),
        apiFetch('/api/settings/gemini_model').catch(() => null),
        apiFetch('/api/settings/nvidia_api_key').catch(() => null),
        apiFetch('/api/settings/nvidia_model').catch(() => null),
        apiFetch('/api/settings/openai_api_key').catch(() => null),
        apiFetch('/api/settings/openai_model').catch(() => null),
        apiFetch('/api/settings/xai_api_key').catch(() => null),
        apiFetch('/api/settings/xai_model').catch(() => null),
      ]);

      if (provRes?.success && provRes.value) activeProvider = provRes.value;
      if (keyRes?.success && keyRes.value) apiKey = keyRes.value;
      if (modelRes?.success && modelRes.value) aiModel = modelRes.value;
      if (nKeyRes?.success && nKeyRes.value) nvidiaApiKey = nKeyRes.value;
      if (nModelRes?.success && nModelRes.value) nvidiaModelName = nModelRes.value;
      if (oKeyRes?.success && oKeyRes.value) openaiApiKey = oKeyRes.value;
      if (oModelRes?.success && oModelRes.value) openaiModelName = oModelRes.value;
      if (xKeyRes?.success && xKeyRes.value) xaiApiKey = xKeyRes.value;
      if (xModelRes?.success && xModelRes.value) xaiModelName = xModelRes.value;
    } catch (err) {
      console.warn('AI ayarları alınamadı:', err);
    }

    // Google tarafından engellenmiş sızdırılmış anahtar tespiti
    if (apiKey.includes('AIzaSyDOAnAKwOlBR4uWpEn8IYvZcHGx3XCI1UY')) {
      apiKey = '';
    }

    // Mutabakattaki gibi aktif sağlayıcıyı kontrol et ve anahtar yoksa akıllıca fallback yap
    if ((activeProvider === 'grok' || activeProvider === 'xai') && !xaiApiKey) {
      if (openaiApiKey) activeProvider = 'openai';
      else if (apiKey) activeProvider = 'gemini';
      else if (nvidiaApiKey) activeProvider = 'nvidia';
    } else if (activeProvider === 'openai' && !openaiApiKey) {
      if (xaiApiKey) activeProvider = 'grok';
      else if (apiKey) activeProvider = 'gemini';
      else if (nvidiaApiKey) activeProvider = 'nvidia';
    } else if (activeProvider === 'nvidia' && !nvidiaApiKey) {
      if (xaiApiKey) activeProvider = 'grok';
      else if (openaiApiKey) activeProvider = 'openai';
      else if (apiKey) activeProvider = 'gemini';
    } else if (activeProvider === 'gemini' && !apiKey) {
      if (xaiApiKey) activeProvider = 'grok';
      else if (openaiApiKey) activeProvider = 'openai';
      else if (nvidiaApiKey) activeProvider = 'nvidia';
    }

    return {
      activeProvider,
      apiKey: (apiKey || '').trim(),
      aiModel: (aiModel || 'gemini-2.5-flash').trim(),
      nvidiaApiKey: (nvidiaApiKey || '').trim(),
      nvidiaModelName: (nvidiaModelName || 'stepfun-ai/step-5-preview').trim(),
      openaiApiKey: (openaiApiKey || '').trim(),
      openaiModelName: (openaiModelName || 'gpt-4o-mini').trim(),
      xaiApiKey: (xaiApiKey || '').trim(),
      xaiModelName: (xaiModelName || 'grok-2-vision-1212').trim(),
    };
  };

  const executeAiAnalysis = async (prompt: string) => {
    const config = await getAiConfig();
    const hasKey = (config.activeProvider === 'grok' || config.activeProvider === 'xai')
      ? !!config.xaiApiKey
      : (config.activeProvider === 'openai' 
        ? !!config.openaiApiKey 
        : (config.activeProvider === 'nvidia' ? !!config.nvidiaApiKey : !!config.apiKey));

    if (!hasKey) {
      throw new Error(
        'Yapay zeka anahtarı bulunamadı. Lütfen Mutabakat Yönetimi -> Ayarlar sayfasından API anahtarınızı tanımlayın.'
      );
    }

    // 1. Mutabakat ve Fatura taramada kullanılan güvenilir sunucu proxy'sini çağır
    const proxyRes = await apiFetch('/api/ai/analyze-invoice', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        provider: config.activeProvider,
        openaiApiKey: config.openaiApiKey,
        openaiModel: config.openaiModelName,
        xaiApiKey: config.xaiApiKey,
        xaiModel: config.xaiModelName,
        nvidiaApiKey: config.nvidiaApiKey,
        nvidiaModel: config.nvidiaModelName,
        geminiApiKey: config.apiKey,
        geminiModel: config.aiModel
      })
    });

    if (proxyRes?.success && proxyRes.data) {
      if (proxyRes.data.hata) throw new Error(proxyRes.data.hata);
      return proxyRes.data;
    }

    if (proxyRes?.message?.includes('leaked')) {
      throw new Error('Google Gemini API anahtarınız Google tarafından sızdırıldığı (leaked) gerekçesiyle engellenmiş. Lütfen Ayarlar sayfasından NVIDIA sağlayıcısını seçin veya yeni bir Gemini anahtarı tanımlayın.');
    }

    // 2. Eğer backend proxy bir hata verdiyse ve Gemini anahtarı varsa doğrudan tarayıcıdan Google API çağrısı yap
    if (config.apiKey && !config.apiKey.includes('AIzaSyDOAnAKwOlBR4uWpEn8IYvZcHGx3XCI1UY')) {
      let safeModel = config.aiModel;
      if (safeModel === 'gemini-3.8-flash' || safeModel === 'gemini-3.6-flash') {
        safeModel = 'gemini-2.5-flash';
      }
      const candidateModels = Array.from(new Set([
        safeModel,
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash'
      ].filter(Boolean)));

      for (const model of candidateModels) {
        try {
          const directRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" }
            })
          });
          const dData = await directRes.json();
          if (dData.error) {
            if (dData.error.message?.includes('leaked')) {
              throw new Error('Google Gemini anahtarınız Google tarafından güvenlik nedeniyle bloke edilmiştir. Lütfen Ayarlar sayfasından yeni bir anahtar girin.');
            }
            continue;
          }
          const raw = dData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const clean = raw.replace(/```json|```/g, '').trim();
          return JSON.parse(clean);
        } catch (e: any) {
          if (e.message?.includes('bloke') || e.message?.includes('leaked')) throw e;
          // Bir sonraki modeli dene
        }
      }
    }

    throw new Error(proxyRes?.message || 'Yapay zeka analiz sonucu alınamadı.');
  };

  const analyzeBatchWithAI = async () => {
    if (satirlar.length === 0) return;
    setIsAiAnalyzing(true);

    try {
      const pendingRows = satirlar.map((s, i) => ({ originalIndex: i, row: s })).filter(s => s.row.durum !== 'success');
      
      if (pendingRows.length === 0) {
        toast.info('Tüm satırlar zaten eşleştirildi. Analiz edilecek kayıt yok.');
        setIsAiAnalyzing(false);
        return;
      }

      const sampleAccounts = lucaAccounts.map(a => `${a.kod}: ${a.ad}`).join('\n');
      const sampleCariler = cariler.map(c => `${c.unvan} (${c.vknTckn || 'VKN YOK'})`).join('\n');

      const transactionsToAnalyze = pendingRows.map(s => ({
        id: s.originalIndex,
        aciklama: s.row.aciklama,
        tip: s.row.tip,
        tutar: s.row.tutar
      }));

      const prompt = `Sen Türkiye Cumhuriyeti Tekdüzen Hesap Planı'na ve vergi mevzuatına üst düzeyde hâkim uzman ve kıdemli bir Mali Müşavirsin (SMMM).
Görevin: Bir işletmenin banka ekstresi hareketlerini bir mali müşavir titizliğiyle analiz etmek, her işlem için en doğru Luca Muhasebe Kodunu ve İşlem Türünü belirlemektir.

TEMEL MUHASEBE VE BANKA KAYIT KURALLARI:
1. Müşteriden Tahsilat (Para Girişi / Alacak): Borç 102 Bankalar, Alacak 120 Alıcılar. İşlem Türü: "tahsilat"
2. Tedarikçiye/Satıcıya Ödeme (Para Çıkışı / Borç): Borç 320 Satıcılar, Alacak 102 Bankalar. İşlem Türü: "odeme"
3. Banka Masrafı, POS Komisyonu, EFT/Havale Ücreti, BSMV: Borç 770/780 Giderler, Alacak 102 Bankalar. İşlem Türü: "banka_masrafi"
4. Maaş ve Personel Ödemeleri: Borç 335 Personele Borçlar, Alacak 102 Bankalar. İşlem Türü: "maas_odemesi"
5. Vergi, Harç, SGK ve KDV Ödemeleri: Borç 360/361 Ödenecek Yükümlülükler, Alacak 102 Bankalar. İşlem Türü: "vergi_kdv"
6. Kredi Kartı / Kredi Geri Ödemeleri: Borç 300/400 Banka Kredileri veya Kredi Kartı Hesabı, Alacak 102. İşlem Türü: "kredi_karti_odemesi"
7. Diğer Şirket Genel Giderleri: Borç 770 Genel Yönetim Giderleri. İşlem Türü: "genel_gider"

Eğer kayıtlı Cariler listesinde bir firma unvanı ile açıklamadaki unvan/isim/VKN eşleşiyorsa (kısmi isim benzerliklerini de gözet), ilgili Cari Unvanını döndür.

LUCA HESAP PLANI:
${sampleAccounts}

KAYITLI CARİLER:
${sampleCariler}

ANALİZ EDİLECEK HAREKETLER:
${JSON.stringify(transactionsToAnalyze)}

SADECE geçerli bir JSON döndür. Beklenen format:
{
  "sonuclar": [
    {
      "id": 0,
      "muhasebeKodu": "Luca hesap planından seçilen en uygun kod (örn: 120.01.001 veya 320.01.001 veya 770.01.005)",
      "islemTuru": "tahsilat",
      "cariUnvan": "Eşleşen Cari Unvanı veya null"
    }
  ]
}`;

      const parsed = await executeAiAnalysis(prompt);

      const sonuclar = parsed.sonuclar || (Array.isArray(parsed) ? parsed : null);

      if (sonuclar) {
        setSatirlar(prev => {
          const newState = [...prev];
          sonuclar.forEach((res: any) => {
            const idx = res.id;
            if (newState[idx]) {
              let cariId = newState[idx].eslesenCariId;
              if (!cariId && res.cariUnvan) {
                const found = cariler.find(c => c.unvan === res.cariUnvan);
                if (found) cariId = found.id;
              }

              newState[idx] = {
                ...newState[idx],
                muhasebeKodu: res.muhasebeKodu,
                önerilenTur: res.islemTuru,
                eslesenCariId: cariId,
                durum: 'success'
              };
            }
          });
          return newState;
        });
        toast.success('Toplu AI analizi tamamlandı.');
      } else {
        toast.warning('Yapay zekadan uygun formatta sonuç alınamadı.');
      }
    } catch (err: any) {
      console.error('Banka ekstre AI analiz hatası:', err);
      toast.error(`AI analizi hatası: ${err.message || 'Bilinmeyen hata'}`);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const analyzeRowWithAI = async (index: number) => {
    const satir = satirlar[index];
    if (!satir) return;

    // Satır bazlı analiz için de aynı mantığı tek satır için çalıştırabiliriz.
    updateSatir(index, { durum: 'pending' });

    try {
      const sampleAccounts = lucaAccounts.map(a => `${a.kod}: ${a.ad}`).join('\n');
      
      const prompt = `Sen Türkiye Tekdüzen Hesap Planı'na ve banka muhasebe kayıtlarına tam hâkim kıdemli bir Mali Müşavirsin (SMMM).
Aşağıdaki banka hareketini bir mali müşavir titizliğiyle analiz et: "${satir.aciklama}" (Tutar: ${satir.tutar}, Tip: ${satir.tip}).

TEMEL KURALLAR:
- Para Girişi ise genelde müşteriden tahsilat (120 Alıcılar) veya POS tahsilatıdır.
- Para Çıkışı ise tedarikçi ödemesi (320 Satıcılar), vergi/sgk (360/361), maaş (335), kredi kartı veya banka masrafıdır (770/780).
- Verilen Luca Hesap Planından bu işleme en uygun alt hesap kodunu seç ve işlem türünü belirle.

LUCA HESAP PLANI:
${sampleAccounts}

SADECE JSON döndür:
{
  "muhasebeKodu": "Luca listesinden en uygun kod",
  "islemTuru": "tahsilat | odeme | vergi_kdv | maas_odemesi | banka_masrafi | kredi_karti_odemesi | genel_gider",
  "cariUnvan": "Tahmin edilen cari unvanı veya null"
}`;

      const res = await executeAiAnalysis(prompt);

      let cariId = satir.eslesenCariId;
      if (!cariId && res.cariUnvan) {
        const found = cariler.find(c => c.unvan && c.unvan.toLowerCase().includes(res.cariUnvan.toLowerCase()));
        if (found) cariId = found.id;
      }

      updateSatir(index, {
        muhasebeKodu: res.muhasebeKodu,
        önerilenTur: res.islemTuru,
        eslesenCariId: cariId,
        durum: 'success'
      });
      toast.success('Satır analizi tamamlandı.');
    } catch (err: any) {
      console.error('Satır AI analiz hatası:', err);
      toast.error(`Satır analiz hatası: ${err.message || 'Bilinmeyen hata'}`);
      updateSatir(index, { durum: 'warning' });
    }
  };

  const updateSatir = (index: number, updates: Partial<EkstreSatiri>) => {
    setSatirlar(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      if (updates.eslesenCariId || updates.transferBankaId) copy[index].durum = 'success';
      return copy;
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto" side="right">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Akıllı Ekstre Yükle - {banka?.hesapAdi}
          </SheetTitle>
          <SheetDescription>
            Sistem transferleri, kredi kartı ödemelerini ve carileri otomatik eşleştirir.
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {satirlar.length === 0 ? (
            <div 
              className="border-2 border-dashed rounded-2xl p-12 text-center hover:bg-slate-50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-700">Excel Dosyasını Seçin</p>
              <p className="text-sm text-slate-400 mt-2">Ziraat Bankası ve diğer tüm formatlar desteklenir.</p>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-3">
                  <Landmark className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="text-sm font-bold text-indigo-900">{satirlar.length} Hareket Bekliyor</p>
                    <p className="text-xs text-indigo-700 font-medium">Virmanlar ve kredi kartları otomatik tespit edildi.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={analyzeBatchWithAI} disabled={isAiAnalyzing || isProcessing} className="bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-200">
                    {isAiAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    AI ile Tümünü Analiz Et
                  </Button>
                  {banka?.dovizTuru !== 'TRY' && (
                    <Button size="sm" onClick={fetchKurlar} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700 border-0 text-white">
                      {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Landmark className="w-4 h-4 mr-2" />}
                      TCMB Kurları Çek
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleConfirm(false)} className="bg-white hover:bg-slate-50 border-slate-300 text-slate-700" disabled={isProcessing || isAiAnalyzing}>
                    <CheckCircle2 className="w-4 h-4 mr-2 text-slate-500" /> Sadece Kaydet
                  </Button>
                  <Button size="sm" onClick={() => handleConfirm(true)} className="bg-indigo-600 hover:bg-indigo-700 border-0 text-white shadow-sm" disabled={isProcessing || isAiAnalyzing}>
                    <ExternalLink className="w-4 h-4 mr-2" /> Kaydet ve Luca'ya Gönder
                  </Button>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-24">Tarih</TableHead>
                      <TableHead>Açıklama</TableHead>
                       <TableHead className="text-right">Tutar</TableHead>
                      <TableHead className="w-48">Cari / Hesap</TableHead>
                      <TableHead className="w-40">Muhasebe Kodu</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {satirlar.slice(0, visibleCount).map((s, idx) => (
                      <TableRow key={idx} className={cn(
                        s.durum === 'success' ? 'bg-blue-50/30' : 
                        s.durum === 'warning' ? 'bg-amber-50/30' : ''
                      )}>
                        <TableCell className="text-[11px] font-medium">{s.tarih?.split('-').reverse().join('.')}</TableCell>
                        <TableCell>
                          <p className="text-xs font-semibold truncate max-w-[200px]" title={s.aciklama}>{s.aciklama}</p>
                          <span className={cn(
                            "text-[9px] uppercase font-bold px-1.5 py-0.5 rounded",
                            s.tip === 'borc' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                          )}>
                            {s.tip === 'borc' ? 'ÇIKIŞ' : 'GİRİŞ'}
                          </span>
                        </TableCell>
                        <TableCell className={cn("text-right font-bold text-sm", s.tip === 'borc' ? 'text-slate-900' : 'text-green-700')}>
                          {s.dovizTutar && (
                            <div className="text-xs text-slate-500 font-normal mb-1 whitespace-nowrap">
                              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: s.dovizTuru || 'USD' }).format(s.dovizTutar)}
                              {s.dovizKuru && <span className="block text-[10px] mt-0.5">Kur: {s.dovizKuru}</span>}
                            </div>
                          )}
                          <div className="whitespace-nowrap">
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(s.tutar)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5 min-w-[140px]">
                            {/* Cari / Banka Seçimi - Styled Native Select */}
                            <div className="relative group">
                              <select 
                                className="w-full h-8 text-[11px] bg-white border border-slate-200 rounded-md px-2 pr-6 outline-none focus:border-indigo-500 cursor-pointer hover:bg-slate-50 shadow-sm appearance-none transition-all"
                                value={s.eslesenCariId ? s.eslesenCariId : s.kategoriId ? 'cat-' + s.kategoriId : s.transferBankaId ? 'transfer-' + s.transferBankaId : 'sistem'} 
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v.startsWith('transfer-')) {
                                    updateSatir(idx, { eslesenCariId: null, kategoriId: null, transferBankaId: v.replace('transfer-', ''), önerilenTur: 'transfer' });
                                  } else if (v.startsWith('cat-')) {
                                    const catId = v.replace('cat-', '');
                                    const cat = giderKategorileri.find(k => k.id === catId);
                                    updateSatir(idx, { 
                                      eslesenCariId: null, 
                                      kategoriId: catId, 
                                      transferBankaId: null, 
                                      önerilenTur: 'genel_gider',
                                      muhasebeKodu: cat?.muhasebeKodu || s.muhasebeKodu
                                    });
                                  } else {
                                    const foundCari = cariler.find(c => c.id === v);
                                    updateSatir(idx, { 
                                      eslesenCariId: v === 'sistem' ? null : v, 
                                      kategoriId: null, 
                                      transferBankaId: null,
                                      muhasebeKodu: foundCari?.muhasebeKodu || s.muhasebeKodu
                                    });
                                  }
                                }}
                              >
                                <option value="sistem">Eşleşme Yok (Seçin)</option>
                                <optgroup label="SİSTEM KATEGORİLERİ">
                                  {SYSTEM_CATEGORIES.map(cat => (
                                    <option key={'cat-'+cat.id} value={'cat-'+cat.id}>{cat.ad}</option>
                                  ))}
                                </optgroup>
                                {giderKategorileri.filter(k => !SYSTEM_CATEGORIES.some(s => s.id === k.id)).length > 0 && (
                                  <optgroup label="ÖZEL GİDER KATEGORİLERİ">
                                    {giderKategorileri.filter(k => !SYSTEM_CATEGORIES.some(s => s.id === k.id)).map(k => (
                                      <option key={'cat-'+k.id} value={'cat-'+k.id}>{k.ad}</option>
                                    ))}
                                  </optgroup>
                                )}
                                <optgroup label="BANKALAR (TRANSFER)">
                                  {bankaHesaplari.filter(b => b.id !== bankaId).map(b => (
                                    <option key={'transfer-'+b.id} value={'transfer-'+b.id}>{b.hesapAdi}</option>
                                  ))}
                                </optgroup>
                                <optgroup label="CARİLER (MÜŞTERİ/TEDARİKÇİ)">
                                  {cariler.map(c => (
                                    <option key={c.id} value={c.id}>{c.unvan}</option>
                                  ))}
                                </optgroup>
                                <optgroup label="CARİLER">
                                  {(cariler || []).filter(c => c && c.id !== undefined && c.id !== null && String(c.id).trim() !== '').map((c, idx) => (
                                    <option key={c.id !== undefined && c.id !== null ? String(c.id) : `cari-${idx}`} value={String(c.id ?? '')}>
                                      {String(c.unvan ?? 'Bilinmiyor')} ({String(c.vknTckn ?? '')})
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-hover:opacity-60 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                              </div>
                            </div>

                            {/* İşlem Türü Seçimi - Styled Native Select */}
                            <div className="relative group">
                              <select 
                                className="w-full h-8 text-[11px] bg-indigo-50/50 border border-slate-200 border-dashed rounded-md px-2 pr-6 outline-none focus:border-indigo-500 cursor-pointer hover:bg-white transition-all appearance-none"
                                value={s.önerilenTur} 
                                onChange={(e) => updateSatir(idx, { önerilenTur: e.target.value as any })}
                              >
                                <option value="tahsilat">Müşteri Tahsilatı</option>
                                <option value="odeme">Tedarikçi Ödemesi</option>
                                <option value="transfer">Hesaplar Arası Transfer</option>
                                <option value="vergi_kdv">KDV Ödemesi</option>
                                <option value="maas_odemesi">Maaş Ödemesi</option>
                                <option value="banka_masrafi">Banka Masrafı</option>
                                <option value="kredi_karti_odemesi">Kredi Kartı Ödemesi</option>
                                <option value="genel_gider">Genel Gider</option>
                              </select>
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-hover:opacity-60 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[170px]">
                            <LucaAccountSelect 
                              value={s.muhasebeKodu || ''} 
                              onChange={(code: string) => updateSatir(idx, { muhasebeKodu: code })}
                              placeholder="Koda eşle..."
                              className="h-8 text-[11px]"
                            />
                             <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 hover:bg-indigo-50 text-indigo-400 shrink-0"
                              onClick={() => analyzeRowWithAI(idx)}
                              disabled={isAiAnalyzing}
                              title="Yapay Zeka ile Analiz Et"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {s.durum === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : s.durum === 'warning' ? (
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Search className="w-4 h-4 text-slate-300" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {satirlar.length > visibleCount && (
                <div className="flex justify-center pt-2">
                  <Button 
                    variant="outline" 
                    className="w-full py-6 text-slate-500 border-dashed hover:bg-slate-50"
                    onClick={() => setVisibleCount(prev => prev + 100)}
                  >
                    Daha Fazla Hareket Göster ({satirlar.length - visibleCount} kaldı)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
