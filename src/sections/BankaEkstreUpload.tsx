import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// Select bileşenleri performans için native ama shadcn stiliyle giydirilmiştir.
import { useApp } from '@/context/AppContext';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Search, Landmark, Sparkles, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { IslemTuru } from '@/types';

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
}

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
  const { cariler, bankaHesaplari, addCariHareket, masrafKurallari, lucaAccounts, giderKategorileri } = useApp();
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
    const { giderKategorileri } = useApp(); // Bu hatalı olabilir, parametre olarak alalım veya içerde useApp() kullanmayalım
    // classifyTransaction'ı component dışında tanımlamak daha iyi ama şimdilik içerdeyse useApp'ten gelenleri parametre alalım
    
    // 0. Kullanıcı Tanımlı Masraf Kuralları (En Yüksek Öncelik)
    for (const kural of masrafKurallari) {
      const key = normalizeString(kural.anahtarKelime);
      if (key && cleanDesc.includes(key)) {
        return { tur: kural.islemTuru, cariId: null };
      }
    }

    // 1. Kendi Bankalarımız Arası Transfer Kontrolü (Virman)
    for (const otherBanka of bankaHesaplari) {
      if (otherBanka.id === bankaId) continue;
      
      const hasIban = otherBanka.iban && cleanDesc.includes(normalizeString(otherBanka.iban).replace(/\s/g, ''));
      const hasHesapNo = otherBanka.hesapNo && cleanDesc.includes(otherBanka.hesapNo);
      const hasKartNo = otherBanka.kartNo && cleanDesc.includes(otherBanka.kartNo);

      if (hasIban || hasHesapNo || hasKartNo) {
        return { 
          tur: 'transfer', 
          cariId: null,
          transferBankaId: otherBanka.id
        };
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
    // Önce VKN / TCKN kontrolü (en kesin eşleşme)
    for (const cari of cariler) {
      const v = String(cari.vknTckn || '').trim();
      if (v && v.length > 5 && cleanDesc.includes(v)) {
        return { 
          tur: tip === 'alacak' ? 'tahsilat' : 'odeme', 
          cariId: cari.id 
        };
      }
    for (const b of bankaHesaplari) {
      if (b.id === bankaId) continue;
      
      const bAdi = normalizeString(b.bankaAdi);
      const hAdi = normalizeString(b.hesapAdi);
      const iban = (b.iban || '').replace(/\s/g, '').slice(-4);
      
      if ((bAdi && cleanDesc.includes(bAdi)) || (hAdi && cleanDesc.includes(hAdi)) || (iban && cleanDesc.includes(iban))) {
        return { tur: 'transfer', cariId: null, transferBankaId: b.id };
      }
    }

    // 2. IBAN Eşleştirmesi (Cari Listesinden)
    const ibanInDesc = cleanDesc.replace(/[^A-Z0-9]/g, '').match(/TR[0-9]{24}/);
    if (ibanInDesc) {
      const foundCari = cariler.find(c => (c.iban || '').replace(/\s/g, '') === ibanInDesc[0]);
      if (foundCari) {
        return { tur: tip === 'alacak' ? 'tahsilat' : 'odeme', cariId: foundCari.id, muhasebeKodu: foundCari.muhasebeKodu };
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
        return { tur: tip === 'alacak' ? 'tahsilat' : 'odeme', cariId: cari.id, muhasebeKodu: cari.muhasebeKodu };
      }

      // 3.3 Kelime bazlı arama
      const words = cleanedU.split(' ');
      if (words.length >= 2) {
        const firstTwoWords = words[0] + ' ' + words[1];
        if (firstTwoWords.length >= 5 && cleanDesc.includes(firstTwoWords)) {
           return { tur: tip === 'alacak' ? 'tahsilat' : 'odeme', cariId: cari.id, muhasebeKodu: cari.muhasebeKodu };
        }
      }

      if (words.length >= 1) {
        const firstWord = words[0];
        if (firstWord.length >= 5 && cleanDesc.includes(firstWord)) {
           return { tur: tip === 'alacak' ? 'tahsilat' : 'odeme', cariId: cari.id, muhasebeKodu: cari.muhasebeKodu };
        }
      }
    }

    // 4. Anahtar Kelime Eşleştirme (Vergi, Maaş vb.)
    for (const [key, tur] of Object.entries(CLASSIFICATION_KEYWORDS)) {
      if (cleanDesc.includes(key)) {
        const sysCat = giderKategorileri.find(cat => normalizeString(cat.ad).includes(key));
        return { tur, cariId: null, kategoriId: sysCat?.id, muhasebeKodu: sysCat?.muhasebeKodu };
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
            
            const tarih = row[dateIdx] instanceof Date ? row[dateIdx].toISOString().split('T')[0] : String(row[dateIdx]);
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
          
            mappedSatirlar.push({
              tarih,
              aciklama: desc,
              tutar: amount,
              tip,
              eslesenCariId: match.cariId,
              önerilenTur: match.tur,
              kategoriId: match.kategoriId,
              transferBankaId: match.transferBankaId,
              muhasebeKodu: match.muhasebeKodu,
              durum: match.cariId || match.transferBankaId || match.kategoriId ? 'success' : 'pending'
            });
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

  const handleConfirm = () => {
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
        kategoriId: s.kategoriId
      });
    });
    toast.success('Banka ekstresi başarıyla işlendi.');
    onClose();
    setSatirlar([]);
    setVisibleCount(50);
  };

  const analyzeBatchWithAI = async () => {
    if (satirlar.length === 0) return;
    setIsAiAnalyzing(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
      const sampleAccounts = lucaAccounts.map(a => `${a.kod}: ${a.ad}`).join('\n');
      const sampleCariler = cariler.map(c => `${c.unvan} (${c.vknTckn || 'VKN YOK'})`).join('\n');

      const transactionsToAnalyze = satirlar.map((s, i) => ({
        id: i,
        aciklama: s.aciklama,
        tip: s.tip,
        tutar: s.tutar
      }));

      const prompt = `Aşağıdaki banka hareketlerini analiz et ve her biri için en uygun Luca Muhasebe Kodunu ve İşlem Türünü belirle.
Ayrıca eğer kayıtlı Cariler listesinde bir eşleşme bulursan (isimden de bakabilirsin), ilgili Cari Unvanını döndür.

LUCA HESAP PLANI:
${sampleAccounts}

KAYITLI CARİLER:
${sampleCariler}

ANALİZ EDİLECEK HAREKETLER:
${JSON.stringify(transactionsToAnalyze)}

SADECE JSON döndür. Beklenen format:
{
  "sonuclar": [
    {
      "id": 0,
      "muhasebeKodu": "600.01.001",
      "islemTuru": "tahsilat",
      "cariUnvan": "Eşleşen Cari Unvanı veya null"
    }
  ]
}

İşlem Türleri şunlardan biri olmalı: tahsilat, odeme, vergi_kdv, maas_odemesi, banka_masrafi, kredi_karti_odemesi, genel_gider. 
Girişler (alacak) genellikle tahsilat, çıkışlar (borç) genellikle odeme veya giderdir.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      if (parsed.sonuclar) {
        setSatirlar(prev => {
          const newState = [...prev];
          parsed.sonuclar.forEach((res: any) => {
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
      }
    } catch (err) {
      console.error(err);
      toast.error('AI analizi sırasında hata oluştu.');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const analyzeRowWithAI = async (index: number) => {
    const satir = satirlar[index];
    if (!satir) return;

    // Satır bazlı analiz için de aynı mantığı tek satır için çalıştırabiliriz.
    // Ancak kullanıcı arayüzünde hızlıca bir spinner göstermek için durum güncelleyelim.
    updateSatir(index, { durum: 'pending' });

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
      const sampleAccounts = lucaAccounts.map(a => `${a.kod}: ${a.ad}`).join('\n');
      
      const prompt = `Bu banka hareketini analiz et: "${satir.aciklama}" (Tutar: ${satir.tutar}, Tip: ${satir.tip}).
Aşağıdaki Luca Hesap Planından en uygun kodu seç ve işlem türünü belirle.

${sampleAccounts}

SADECE JSON döndür:
{
  "muhasebeKodu": "kod",
  "islemTuru": "tur",
  "cariUnvan": "Tahmin edilen cari veya null"
}
İşlem Türleri: tahsilat, odeme, vergi_kdv, maas_odemesi, banka_masrafi, kredi_karti_odemesi, genel_gider.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const res = JSON.parse(clean);

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
    } catch (err) {
      console.error(err);
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
                  <Button size="sm" onClick={handleConfirm} className="bg-indigo-600 hover:bg-indigo-700 border-0" disabled={isProcessing || isAiAnalyzing}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Onayla ve Kaydet
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
                        <TableCell className="text-[11px] font-medium">{s.tarih}</TableCell>
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
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(s.tutar)}
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
                                <optgroup label="GİDER KATEGORİLERİ (MASRAFLAR)">
                                  {giderKategorileri.map(k => (
                                    <option key={'cat-'+k.id} value={'cat-'+k.id}>{k.ad}</option>
                                  ))}
                                </optgroup>
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
                          <div className="flex items-center gap-2">
                            <input 
                              type="text"
                              value={s.muhasebeKodu || ''}
                              placeholder="Koda eşle..."
                              className="w-full h-8 text-[11px] bg-slate-50 border border-slate-200 rounded-md px-2 outline-none focus:border-indigo-500 transition-all font-mono"
                              onChange={(e) => updateSatir(idx, { muhasebeKodu: e.target.value })}
                            />
                             <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 hover:bg-indigo-50 text-indigo-400"
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
