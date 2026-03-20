import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Search, Landmark, X } from 'lucide-react';
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
  const { cariler, bankaHesaplari, addCariHareket, masrafKurallari } = useApp();
  const [satirlar, setSatirlar] = useState<EkstreSatiri[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const banka = bankaHesaplari.find(b => b.id === bankaId);

  const normalizeString = (str: string) => {
    return str
      .toUpperCase()
      .replace(/İ/g, 'I')
      .replace(/Ğ/g, 'G')
      .replace(/Ü/g, 'U')
      .replace(/Ş/g, 'S')
      .replace(/Ö/g, 'O')
      .replace(/Ç/g, 'C')
      .trim();
  };

  const classifyTransaction = (aciklama: string, tip: 'borc' | 'alacak'): { tur: IslemTuru; cariId: string | null; transferBankaId?: string | null } => {
    const cleanDesc = normalizeString(aciklama);
    
    // 0. Kullanıcı Tanımlı Masraf Kuralları (En Yüksek Öncelik)
    for (const kural of masrafKurallari) {
      if (cleanDesc.includes(normalizeString(kural.anahtarKelime))) {
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

    // 3. Cari Eşleştirme
    for (const cari of cariler) {
      if (cleanDesc.includes(normalizeString(cari.unvan)) || (cari.vknTckn && cleanDesc.includes(cari.vknTckn))) {
        return { 
          tur: tip === 'alacak' ? 'tahsilat' : 'odeme', 
          cariId: cari.id 
        };
      }
    }

    // 4. Anahtar Kelime Eşleştirme
    for (const [key, tur] of Object.entries(CLASSIFICATION_KEYWORDS)) {
      if (cleanDesc.includes(key)) {
        return { tur, cariId: null };
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

    // Sadece rakam, nokta ve virgül olan kısmı al
    s = s.replace(/[^0-9,.-]/g, '');

    // Eğer hem nokta hem virgül varsa kesin Türk formatıdır: 1.234,56
    if (s.includes('.') && s.includes(',')) {
      return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    }
    // Sadece virgül varsa: 1234,56
    if (s.includes(',')) {
      return parseFloat(s.replace(',', '.'));
    }
    // Sadece nokta varsa: Bu 1234.56 da olabilir 1.234 de olabilir (binlik ayracı olarak)
    // Bankalarda genellikle kuruş hanesi olduğu için (noktadan sonra 2 hane geliyorsa) 
    // bunu standart JS sayısı (1234.56) gibi görelim
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
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        let headerRowIdx = -1;
        let dateIdx = -1;
        let descIdx = -1;
        let amountIdx = -1;
        let debitIdx = -1;
        let creditIdx = -1;

        for (let i = 0; i < Math.min(data.length, 30); i++) {
          const row = (data[i] || []).map(cell => normalizeString(String(cell || '')));
          const hasTarih = row.some(cell => cell.includes('TARIH'));
          const hasAciklama = row.some(cell => cell.includes('ACIKLAMA'));
          const hasIslemTutari = row.some(cell => cell.includes('ISLEM TUTARI') || cell.includes('TUTAR'));
          const hasBorc = row.some(cell => cell.includes('BORC'));
          const hasAlacak = row.some(cell => cell.includes('ALACAK'));

          if (hasTarih && hasAciklama && (hasIslemTutari || (hasBorc && hasAlacak))) {
            headerRowIdx = i;
            dateIdx = row.findIndex(cell => cell.includes('TARIH'));
            descIdx = row.findIndex(cell => cell.includes('ACIKLAMA'));
            amountIdx = row.findIndex(cell => cell.includes('ISLEM TUTARI') || (cell === 'TUTAR'));
            debitIdx = row.findIndex(cell => cell === 'BORC');
            creditIdx = row.findIndex(cell => cell === 'ALACAK');
            break;
          }
        }

        if (headerRowIdx === -1) {
          toast.error('Excel formatı anlaşılamadı. Başlıklar bulunamadı.');
          setIsProcessing(false);
          return;
        }

        const mappedSatirlar: EkstreSatiri[] = data.slice(headerRowIdx + 1).map(row => {
          if (!row[dateIdx]) return null;
          
          let tarih = '';
          const rawDate = row[dateIdx];
          if (rawDate instanceof Date) {
            tarih = rawDate.toISOString().split('T')[0];
          } else {
            const parts = String(rawDate).split('.');
            tarih = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : String(rawDate);
          }

          const aciklama = String(row[descIdx] || '');
          let tutar = 0;
          let tip: 'borc' | 'alacak' = 'alacak';

          if (amountIdx !== -1) {
            const val = parseTurkishNumber(row[amountIdx]);
            tutar = Math.abs(val);
            tip = val < 0 ? 'borc' : 'alacak';
          } else if (debitIdx !== -1 && creditIdx !== -1) {
            const borc = parseTurkishNumber(row[debitIdx]);
            const alacak = parseTurkishNumber(row[creditIdx]);
            tutar = borc > 0 ? borc : alacak;
            tip = borc > 0 ? 'borc' : 'alacak';
          }

          if (!tutar || isNaN(tutar)) return null;

          const { tur, cariId, transferBankaId } = classifyTransaction(aciklama, tip);

          return {
            tarih,
            aciklama,
            tutar,
            tip,
            eslesenCariId: cariId,
            önerilenTur: tur,
            transferBankaId: transferBankaId,
            durum: (cariId || transferBankaId) ? 'success' : (tur !== 'tahsilat' && tur !== 'odeme' ? 'warning' : 'pending')
          } as EkstreSatiri;
        }).filter((s): s is EkstreSatiri => s !== null && s.tutar > 0);

        setSatirlar(mappedSatirlar);
        toast.success(`${mappedSatirlar.length} adet hareket yüklendi.`);
      } catch (err) {
        toast.error('Excel dosyası işlenirken hata oluştu.');
        console.error(err);
      } finally {
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
        bankaId: bankaId
      });

      // Eğer virman ise ve diğer taraf da sistemdeyse, oraya da karşı kaydı atabiliriz.
      // Ancak mükerrerlikten kaçınmak için şimdilik sadece mevcut bankayı işliyoruz.
      // Kullanıcı diğer bankanın ekstresini yüklediğinde o da buradaki mantıkla işlenecek.
    });
    toast.success('Banka ekstresi başarıyla işlendi.');
    onClose();
    setSatirlar([]);
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
                  <Button variant="outline" size="sm" onClick={() => setSatirlar([])} disabled={isProcessing}>
                    <X className="w-4 h-4 mr-2" /> Temizle
                  </Button>
                  <Button size="sm" onClick={handleConfirm} className="bg-indigo-600 hover:bg-indigo-700 border-0" disabled={isProcessing}>
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
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {satirlar.map((s, idx) => (
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
                          <div className="space-y-1">
                            <Select 
                              value={s.eslesenCariId || (s.transferBankaId ? 'transfer-' + s.transferBankaId : 'sistem')} 
                              onValueChange={(v) => {
                                if (v.startsWith('transfer-')) {
                                  updateSatir(idx, { eslesenCariId: null, transferBankaId: v.replace('transfer-', ''), önerilenTur: 'transfer' });
                                } else {
                                  updateSatir(idx, { eslesenCariId: v === 'sistem' ? null : v, transferBankaId: null });
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 text-[10px]">
                                <SelectValue placeholder="Cari/Hesap Seç" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sistem">Diğer (Kategori Seçin)</SelectItem>
                                <SelectContent className="font-bold text-[10px] py-1 px-2 border-b">BANAKLAR (TRANSFER)</SelectContent>
                                {bankaHesaplari.filter(b => b.id !== bankaId).map(b => (
                                  <SelectItem key={'transfer-'+b.id} value={'transfer-'+b.id}>{b.hesapAdi} (Transfer)</SelectItem>
                                ))}
                                <SelectContent className="font-bold text-[10px] py-1 px-2 border-b">CARİLER</SelectContent>
                                {cariler.map(c => (
                                  <SelectItem key={c.id} value={c.id}>{c.unvan}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select 
                              value={s.önerilenTur} 
                              onValueChange={(v: any) => updateSatir(idx, { önerilenTur: v })}
                            >
                              <SelectTrigger className="h-7 text-[10px] border-dashed">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="tahsilat">Müşteri Tahsilatı</SelectItem>
                                <SelectItem value="odeme">Tedarikçi Ödemesi</SelectItem>
                                <SelectItem value="transfer">Hesaplar Arası Transfer</SelectItem>
                                <SelectItem value="vergi_kdv">KDV Ödemesi</SelectItem>
                                <SelectItem value="maas_odemesi">Maaş Ödemesi</SelectItem>
                                <SelectItem value="banka_masrafi">Banka Masrafı</SelectItem>
                                <SelectItem value="kredi_karti_odemesi">Kredi Kartı Ödemesi</SelectItem>
                                <SelectItem value="genel_gider">Genel Gider</SelectItem>
                              </SelectContent>
                            </Select>
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
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
