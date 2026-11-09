import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  FileSpreadsheet,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Info,
  Wrench
} from 'lucide-react';
import { AYLAR } from '@/types';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function VergiRaporu() {
  const { satisFaturalari, alisFaturalari, getVergiRaporu, openAlisDrawer, updateAlisFatura, isIsletmeDefteri } = useApp();
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear());
  const [selectedAy, setSelectedAy] = useState(new Date().getMonth() + 1);

  const handleAutoSplitTelecomOiv = async (fatura: any, onerilenMatrah: number, onerilenOiv: number) => {
    try {
      await updateAlisFatura(fatura.id, {
        faturaNo: fatura.faturaNo || '',
        faturaTarihi: fatura.faturaTarihi || '',
        tedarikciAdi: fatura.tedarikciAdi || '',
        tedarikciVkn: fatura.tedarikciVkn || '',
        malHizmetAdi: fatura.malHizmetAdi || '',
        toplamTutar: String(fatura.toplamTutar || 0),
        kdvOrani: String(fatura.kdvOrani || 20),
        matrah: onerilenMatrah,
        kdvTutari: Number(fatura.kdvTutari) || 0,
        oivTutari: String(onerilenOiv),
        muhasebeKodu: fatura.muhasebeKodu || '770.03.001',
        karsiHesapKodu: fatura.karsiHesapKodu,
        kdvHesapKodu: fatura.kdvHesapKodu,
        cariId: fatura.cariId,
        vadeTarihi: fatura.vadeTarihi || undefined,
        aciklama: fatura.aciklama
      });
      toast.success(`${fatura.tedarikciAdi || 'Fatura'} için Matrah (${onerilenMatrah.toFixed(2)} TL) ve ÖİV/Telsiz (${onerilenOiv.toFixed(2)} TL) otomatik ayrıştırıldı!`);
    } catch {
      toast.error('ÖİV / Telsiz ayrıştırması kaydedilirken hata oluştu.');
    }
  };

  // Ay Sonu Beyanname & Muhasebe Denetim Asistanı (Seçili Ay Analizi)
  const denetimBulgulari = useMemo(() => {
    const donemPrefix = `${selectedYil}-${String(selectedAy).padStart(2, '0')}`;
    const donemAlis = (alisFaturalari || []).filter(f => f.faturaTarihi && f.faturaTarihi.startsWith(donemPrefix));
    const donemSatis = (satisFaturalari || []).filter(f => f.faturaTarihi && f.faturaTarihi.startsWith(donemPrefix));

    const tevsikIhlalleri: Array<{ fatura: any; aciklama: string }> = [];
    const eksikMuhasebeKodlari: Array<{ fatura: any; tur: 'Alış' | 'Satış'; aciklama: string }> = [];
    const kdvUyumsuzluklari: Array<{
      fatura: any;
      tur: 'Alış' | 'Satış';
      beklenenKdv: number;
      mevcutKdv: number;
      onerilenMatrah?: number;
      onerilenOiv?: number;
    }> = [];
    const mukerrerKayitlar: Array<{ fatura: any; sebep: string }> = [];
    const binekKkegUyarilari: Array<{ fatura: any; aciklama: string }> = [];

    const seenFaturaNo = new Map<string, any>();
    const seenFingerprints = new Map<string, any>();

    donemAlis.forEach(f => {
      const toplam = Number(f.toplamTutar) || 0;
      const matrah = Number(f.matrah) || 0;
      const kdv = Number(f.kdvTutari) || 0;
      const oran = Number(f.kdvOrani) || 0;
      const oiv = Number(f.oivTutari) || 0;
      const k1 = Number(f.kdv1) || 0;
      const k10 = Number(f.kdv10) || 0;
      const k20 = Number(f.kdv20) || 0;
      const hasMultiKdv = [k1 > 0.009, k10 > 0.009, k20 > 0.009].filter(Boolean).length > 1;
      const karsiKod = String(f.karsiHesapKodu || '').trim();
      const anaKod = String(f.muhasebeKodu || '').trim();

      // 1. 7.000 TL Tevsik (Nakit Ödeme) Sınırı Kontrolü
      if (toplam >= 7000 && (karsiKod.startsWith('100') || (!karsiKod && (f.aciklama || '').toLowerCase().includes('nakit')))) {
        tevsikIhlalleri.push({
          fatura: f,
          aciklama: `${f.tedarikciAdi || 'Tedarikçi'} (${f.faturaNo || 'Belgesiz'}) — ${toplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL tutarındaki fatura 7.000 TL tevsik sınırını aştığı halde Kasa (100) / Nakit seçilmiş.`
        });
      }

      // 2. Eksik Muhasebe Kodu Kontrolü
      if (!isIsletmeDefteri && !anaKod) {
        eksikMuhasebeKodlari.push({
          fatura: f,
          tur: 'Alış',
          aciklama: `${f.tedarikciAdi || 'Tedarikçi'} (${f.faturaNo || '-'}) — Ana gider/mal muhasebe hesap kodu (770/153 vb.) atanmamış.`
        });
      }

      // 3. Matrah x KDV Oranı Uyumsuzluğu veya Ayrıştırılmamış ÖİV / Telsiz Ücreti Kontrolü
      if (!hasMultiKdv && matrah > 0 && oran > 0) {
        const beklenen = Math.round((matrah * oran) / 100 * 100) / 100;
        const bakiyeFarki = Math.round((toplam - matrah - kdv - oiv) * 100) / 100;
        if ((oiv === 0 && Math.abs(beklenen - kdv) > 1.5) || Math.abs(bakiyeFarki) > 0.5) {
          const gercekMatrah = kdv > 0 ? Math.round((kdv / (oran / 100)) * 100) / 100 : matrah;
          const hesaplananOiv = Math.round((toplam - gercekMatrah - kdv) * 100) / 100;
          kdvUyumsuzluklari.push({
            fatura: f,
            tur: 'Alış',
            beklenenKdv: beklenen,
            mevcutKdv: kdv,
            onerilenMatrah: hesaplananOiv > 0 ? gercekMatrah : undefined,
            onerilenOiv: hesaplananOiv > 0 ? hesaplananOiv : undefined
          });
        }
      }

      // 4. Mükerrer Kayıt Kontrolü
      const cleanNo = String(f.faturaNo || '').trim().toUpperCase();
      const vendorKey = String(f.tedarikciVkn || f.tedarikciAdi || '').trim().toUpperCase();
      if (cleanNo.length >= 4) {
        const noKey = `${vendorKey}__${cleanNo}__${oran}`;
        if (seenFaturaNo.has(noKey)) {
          mukerrerKayitlar.push({
            fatura: f,
            sebep: `Aynı belge numarası (${cleanNo}) ve KDV oranıyla dönem içinde birden fazla kayıt mevcut.`
          });
        } else {
          seenFaturaNo.set(noKey, f);
        }
      }
      if (toplam > 0 && vendorKey) {
        const fpKey = `${f.faturaTarihi}__${vendorKey}__${toplam.toFixed(2)}__${oran}`;
        if (seenFingerprints.has(fpKey) && seenFingerprints.get(fpKey).id !== f.id) {
          mukerrerKayitlar.push({
            fatura: f,
            sebep: `Aynı gün (${f.faturaTarihi}), aynı firma ve aynı tutarda (${toplam.toFixed(2)} TL) çift kayıt tespit edildi.`
          });
        } else {
          seenFingerprints.set(fpKey, f);
        }
      }

      // 5. Binek Araç / Akaryakıt %70-%30 KKEG Uyarısı
      const desc = `${f.malHizmetAdi || ''} ${f.aciklama || ''} ${f.tedarikciAdi || ''}`.toLowerCase();
      const isFuelOrAuto = desc.includes('akaryakıt') || desc.includes('benzin') || desc.includes('motorin') || desc.includes('otopark') || !!f.vehiclePlate;
      const hasKkegNote = desc.includes('kkeg') || desc.includes('%70') || (Array.isArray(f.mahsupSatirlari) && f.mahsupSatirlari.some((r: any) => String(r.hesapKodu || '').startsWith('689')));
      if (isFuelOrAuto && !hasKkegNote && toplam > 0) {
        binekKkegUyarilari.push({
          fatura: f,
          aciklama: `${f.tedarikciAdi || 'Akaryakıt/Araç Gideri'} (${toplam.toFixed(2)} TL) — Binek araç gideri ise %70 Gider / %30 KKEG ayrımı kontrol edilmelidir.`
        });
      }
    });

    donemSatis.forEach(f => {
      const matrah = Number(f.matrah) || 0;
      const kdv = Number(f.kdvTutari) || 0;
      const oran = Number(f.kdvOrani) || 0;
      if (matrah > 0 && oran > 0) {
        const beklenen = Math.round((matrah * oran) / 100 * 100) / 100;
        if (Math.abs(beklenen - kdv) > 1.5) {
          kdvUyumsuzluklari.push({
            fatura: f,
            tur: 'Satış',
            beklenenKdv: beklenen,
            mevcutKdv: kdv
          });
        }
      }
    });

    const toplamUyari =
      tevsikIhlalleri.length +
      eksikMuhasebeKodlari.length +
      kdvUyumsuzluklari.length +
      mukerrerKayitlar.length +
      binekKkegUyarilari.length;

    return {
      donemAlisAdet: donemAlis.length,
      donemSatisAdet: donemSatis.length,
      toplamUyari,
      tevsikIhlalleri,
      eksikMuhasebeKodlari,
      kdvUyumsuzluklari,
      mukerrerKayitlar,
      binekKkegUyarilari
    };
  }, [alisFaturalari, satisFaturalari, selectedYil, selectedAy, isIsletmeDefteri]);

  // Mevcut yılları bul
  const availableYillar = useMemo(() => {
    const yillar = new Set<number>();
    satisFaturalari.forEach(f => {
      if (!f.faturaTarihi) return;
      const yil = parseInt(f.faturaTarihi.substring(0, 4), 10);
      if (!isNaN(yil)) yillar.add(yil);
    });
    alisFaturalari.forEach(f => {
      if (!f.faturaTarihi) return;
      const yil = parseInt(f.faturaTarihi.substring(0, 4), 10);
      if (!isNaN(yil)) yillar.add(yil);
    });
    // Her zaman mevcut yılı ekle
    yillar.add(new Date().getFullYear());
    return Array.from(yillar).sort((a, b) => b - a);
  }, [satisFaturalari, alisFaturalari]);

  const rapor = useMemo(() => {
    return getVergiRaporu(selectedYil, selectedAy);
  }, [getVergiRaporu, selectedYil, selectedAy]);

  const formatCurrency = (value: number) => {
    const safeValue = isNaN(value) || value === null || value === undefined ? 0 : value;
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(safeValue);
  };

  // Yıllık özet
  const yillikOzet = useMemo(() => {
    let toplamSatisMatrah = 0;
    let toplamSatisKDV = 0;
    let toplamSatisTevkifat = 0;
    let toplamAlisMatrah = 0;
    let toplamAlisKDV = 0;

    satisFaturalari
      .filter(f => {
        if (!f.faturaTarihi) return false;
        const yil = parseInt(f.faturaTarihi.substring(0, 4), 10);
        return !isNaN(yil) && yil === selectedYil;
      })
      .forEach(f => {
        toplamSatisMatrah += (Number(f.matrah) || 0);
        toplamSatisKDV += (Number(f.kdvTutari) || 0);
        toplamSatisTevkifat += (Number(f.tevkifatTutari) || 0);
      });

    alisFaturalari
      .filter(f => {
        if (!f.faturaTarihi) return false;
        const yil = parseInt(f.faturaTarihi.substring(0, 4), 10);
        return !isNaN(yil) && yil === selectedYil;
      })
      .forEach(f => {
        toplamAlisMatrah += (Number(f.matrah) || 0);
        toplamAlisKDV += (Number(f.kdvTutari) || 0);
      });

    const netSatisKDV = Math.max(0, toplamSatisKDV - toplamSatisTevkifat);

    return {
      toplamSatisMatrah,
      toplamSatisKDV: netSatisKDV,
      toplamAlisMatrah,
      toplamAlisKDV,
      odenecekKDVYillik: Math.max(0, netSatisKDV - toplamAlisKDV),
    };
  }, [satisFaturalari, alisFaturalari, selectedYil]);

  // Excel indirme
  const downloadExcel = () => {
    const d1 = rapor.kdvDagilimi?.find(d => d.oran === 1);
    const d10 = rapor.kdvDagilimi?.find(d => d.oran === 10);
    const d20 = rapor.kdvDagilimi?.find(d => d.oran === 20);

    const excelData = [{
      'Dönem': `${rapor.ayAdi} ${rapor.yil}`,
      'Satış Adedi': rapor.satisAdet,
      'Alış Adedi': rapor.alisAdet,
      'Aylık Satış Matrahı (TL)': rapor.aylikSatisMatrah || 0,
      'Hesaplanan Brüt KDV (TL)': rapor.hesaplananKDV,
      'Satış Tevkifatı (TL)': rapor.toplamSatisTevkifat,
      'Hesaplanan Net KDV (TL)': rapor.netHesaplananKDV,
      'Aylık Alış Matrahı (TL)': rapor.aylikAlisMatrah || 0,
      'İndirilecek KDV (TL)': rapor.indirilecekKDV,
      'Ödenecek KDV (TL)': rapor.odenecekKDV,
      '%1 Alış KDV (TL)': d1?.alisKdv || 0,
      '%10 Alış KDV (TL)': d10?.alisKdv || 0,
      '%20 Alış KDV (TL)': d20?.alisKdv || 0,
      'ÖİV / Telsiz KKEG 689.01 (TL)': rapor.toplamOivTutari || 0,
      'Kümülatif Matrah (TL)': rapor.toplamMatrah,
      'Gelir Vergisi Oranı (%)': rapor.gelirVergisiOrani,
      'Hesaplanan Gelir Vergisi (TL)': rapor.hesaplananGelirVergisi,
    }];

    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 25 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vergi Raporu');

    const fileName = `Vergi_Raporu_${rapor.ayAdi}_${rapor.yil}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast.success('Vergi raporu Excel olarak indirildi.');
  };

  return (
    <div className="space-y-6">
      {/* Başlık ve Filtreler */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                Vergi Raporu
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Aylık KDV ve Gelir Vergisi hesaplamaları
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedYil.toString()} onValueChange={(v) => setSelectedYil(parseInt(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(availableYillar || []).map((yil, idx) => (
                    <SelectItem key={yil ? String(yil) : `yil-${idx}`} value={String(yil)}>{String(yil)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedAy.toString()} onValueChange={(v) => setSelectedAy(parseInt(v))}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(AYLAR || []).map((ay, idx) => (
                    <SelectItem key={ay.value ? String(ay.value) : `ay-${idx}`} value={String(ay.value)}>{String(ay.label || '')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={downloadExcel}
                className="gap-2 text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Dönem Bilgisi */}
      <div className="flex items-center gap-2 text-slate-600">
        <Calendar className="w-4 h-4" />
        <span className="font-medium">Rapor Dönemi:</span>
        <Badge variant="secondary" className="text-base px-3 py-1">
          {rapor.ayAdi} {rapor.yil}
        </Badge>
      </div>

      {/* Ay Sonu Beyanname & Muhasebe Denetim Asistanı */}
      <Card className={denetimBulgulari.toplamUyari > 0 ? "border-2 border-amber-300 bg-amber-50/30 shadow-sm" : "border border-emerald-200 bg-emerald-50/30 shadow-sm"}>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
              <ShieldCheck className={denetimBulgulari.toplamUyari > 0 ? "w-5 h-5 text-amber-600" : "w-5 h-5 text-emerald-600"} />
              Ay Sonu Beyanname & Muhasebe Denetim Asistanı ({rapor.ayAdi} {rapor.yil})
            </CardTitle>
            {denetimBulgulari.toplamUyari > 0 ? (
              <Badge className="bg-amber-600 hover:bg-amber-700 text-white w-fit">
                {denetimBulgulari.toplamUyari} Denetim Bulgusu Tespit Edildi
              </Badge>
            ) : (
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white w-fit flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Beyannameye Hazır (Sorun Yok)
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-600">
            Seçili dönemdeki {denetimBulgulari.donemAlisAdet} alış ve {denetimBulgulari.donemSatisAdet} satış belgesi; 7.000 TL tevsik sınırı, eksik muhasebe kodu, Matrah×KDV tutarlılığı, mükerrer kayıt ve binek araç gider kısıtı açısından otomatik denetlendi.
          </p>
        </CardHeader>
        {denetimBulgulari.toplamUyari > 0 && (
          <CardContent className="space-y-3 pt-0 text-xs">
            {denetimBulgulari.tevsikIhlalleri.length > 0 && (
              <div className="bg-white border border-red-200 rounded-lg p-3 space-y-1.5">
                <div className="font-bold text-red-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  1. Tevsik Zorunluluğu Sınırı (7.000 TL Üzeri Nakit/Kasa Ödeme) ({denetimBulgulari.tevsikIhlalleri.length} Adet)
                </div>
                {denetimBulgulari.tevsikIhlalleri.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-slate-700 pl-5 py-0.5 border-b last:border-0 border-slate-100">
                    <span>• {item.aciklama}</span>
                    <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 shrink-0" onClick={() => openAlisDrawer(item.fatura)}>
                      <Wrench className="w-3 h-3 mr-1" /> Düzelt
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {denetimBulgulari.eksikMuhasebeKodlari.length > 0 && (
              <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-1.5">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  2. Eksik Muhasebe Hesap Kodu ({denetimBulgulari.eksikMuhasebeKodlari.length} Adet)
                </div>
                {denetimBulgulari.eksikMuhasebeKodlari.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-slate-700 pl-5 py-0.5 border-b last:border-0 border-slate-100">
                    <span>• {item.aciklama}</span>
                    <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 shrink-0" onClick={() => openAlisDrawer(item.fatura)}>
                      <Wrench className="w-3 h-3 mr-1" /> Kod Ata
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {denetimBulgulari.kdvUyumsuzluklari.length > 0 && (
              <div className="bg-white border border-purple-200 rounded-lg p-3 space-y-1.5">
                <div className="font-bold text-purple-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-purple-600 shrink-0" />
                  3. Matrah × KDV Oranı Uyumsuzluğu / Vodafone-Telekom ÖİV & Telsiz Ücreti ({denetimBulgulari.kdvUyumsuzluklari.length} Adet)
                </div>
                {denetimBulgulari.kdvUyumsuzluklari.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-slate-700 pl-5 py-1 border-b last:border-0 border-slate-100">
                    <div>
                      <span>
                        • [{item.tur}] <b>{item.fatura.tedarikciAdi || item.fatura.musteriAdi || 'Belge'}</b> ({item.fatura.faturaNo || '-'}) — Beklenen KDV: {formatCurrency(item.beklenenKdv)}, Kayıtlı KDV: {formatCurrency(item.mevcutKdv)}
                      </span>
                      {item.onerilenMatrah !== undefined && item.onerilenOiv !== undefined && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-semibold text-[11px]">
                          Öneri: Gerçek Matrah {formatCurrency(item.onerilenMatrah)} + ÖİV/Telsiz (689.01) {formatCurrency(item.onerilenOiv)}
                        </span>
                      )}
                    </div>
                    {item.tur === 'Alış' && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.onerilenMatrah !== undefined && item.onerilenOiv !== undefined && (
                          <Button
                            size="sm"
                            className="h-6 text-[11px] px-2 bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={() => handleAutoSplitTelecomOiv(item.fatura, item.onerilenMatrah!, item.onerilenOiv!)}
                          >
                            ⚡ Otomatik Ayrıştır (ÖİV/Telsiz)
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 shrink-0" onClick={() => openAlisDrawer(item.fatura)}>
                          <Wrench className="w-3 h-3 mr-1" /> İncele
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {denetimBulgulari.mukerrerKayitlar.length > 0 && (
              <div className="bg-white border border-rose-200 rounded-lg p-3 space-y-1.5">
                <div className="font-bold text-rose-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  4. Mükerrer Fiş / Fatura Şüphesi ({denetimBulgulari.mukerrerKayitlar.length} Adet)
                </div>
                {denetimBulgulari.mukerrerKayitlar.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-slate-700 pl-5 py-0.5 border-b last:border-0 border-slate-100">
                    <span>• <b>{item.fatura.tedarikciAdi || 'Tedarikçi'}</b>: {item.sebep}</span>
                    <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 shrink-0" onClick={() => openAlisDrawer(item.fatura)}>
                      <Wrench className="w-3 h-3 mr-1" /> İncele
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {denetimBulgulari.binekKkegUyarilari.length > 0 && (
              <div className="bg-white border border-indigo-200 rounded-lg p-3 space-y-1.5">
                <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                  5. Binek Araç %70 Gider / %30 KKEG Kontrolü ({denetimBulgulari.binekKkegUyarilari.length} Adet)
                </div>
                {denetimBulgulari.binekKkegUyarilari.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-slate-700 pl-5 py-0.5 border-b last:border-0 border-slate-100">
                    <span>• {item.aciklama}</span>
                    <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 shrink-0" onClick={() => openAlisDrawer(item.fatura)}>
                      <Wrench className="w-3 h-3 mr-1" /> İncele
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* KDV Raporu */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Katma Değer Vergisi (KDV)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm bg-blue-50/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                    Hesaplanan KDV {rapor.toplamSatisTevkifat > 0 && <span className="text-xs text-blue-600 font-semibold">(Net)</span>}
                    {rapor.toplamSatisTevkifat > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3.5 h-3.5 text-slate-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Brüt KDV: {formatCurrency(rapor.hesaplananKDV)}</p>
                            <p>Satış Tevkifatı: -{formatCurrency(rapor.toplamSatisTevkifat)}</p>
                            <p className="font-bold border-t mt-1 pt-1">Net Beyan KDV: {formatCurrency(rapor.netHesaplananKDV)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(rapor.toplamSatisTevkifat > 0 ? rapor.netHesaplananKDV : rapor.hesaplananKDV)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {rapor.toplamSatisTevkifat > 0 ? (
                      <span>Brüt: {formatCurrency(rapor.hesaplananKDV)} (Tevkifat düşüldü)</span>
                    ) : (
                      <span>{rapor.satisAdet} adet satış faturası</span>
                    )}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-orange-50/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">İndirilecek KDV</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(rapor.indirilecekKDV)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {rapor.alisAdet} adet alış faturası
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-green-50/50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                    Ödenecek KDV
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3.5 h-3.5 text-slate-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>(Hesaplanan KDV - Satış Tevkifatı) - İndirilecek KDV</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(rapor.odenecekKDV)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {rapor.odenecekKDV > 0 ? 'Ödeme gerekiyor' : 'İade hakkı doğabilir'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KDV-1 Beyanname Oran Bazlı (%1, %10, %20) ve ÖİV / Telsiz (689.01) Mutabakat Tablosu */}
        {rapor.kdvDagilimi && (
          <Card className="border border-slate-200 shadow-sm bg-white mt-3">
            <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-indigo-600" />
                  KDV-1 Beyanname & Luca Mizan Mutabakat Tablosu (%1 / %10 / %20 Oran Dağılımı)
                </CardTitle>
                {(rapor.toplamOivTutari || 0) > 0 && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300 font-mono text-xs w-fit">
                    689.01 ÖİV / Telsiz (KKEG) Toplamı: {formatCurrency(rapor.toplamOivTutari || 0)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">KDV Oranı</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Satış Matrahı (600)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Hesaplanan KDV (391)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Alış Matrahı (153/770)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">İndirilecek KDV (191)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {rapor.kdvDagilimi.map((row) => (
                    <tr key={row.oran} className="hover:bg-slate-50/70">
                      <td className="py-2 px-4 font-sans font-bold text-slate-800">
                        %{row.oran} KDV Dilimi
                        <span className="ml-1.5 text-[10px] font-mono text-slate-400">
                          (391.{String(row.oran).padStart(2, '0')} / 191.{String(row.oran).padStart(2, '0')})
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right text-slate-700">{formatCurrency(row.satisMatrah)}</td>
                      <td className="py-2 px-4 text-right font-semibold text-blue-700">{formatCurrency(row.satisKdv)}</td>
                      <td className="py-2 px-4 text-right text-slate-700">{formatCurrency(row.alisMatrah)}</td>
                      <td className="py-2 px-4 text-right font-semibold text-orange-700">{formatCurrency(row.alisKdv)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-200">
                    <td className="py-2.5 px-4 font-sans">DÖNEM TOPLAMI</td>
                    <td className="py-2.5 px-4 text-right">{formatCurrency(rapor.aylikSatisMatrah || 0)}</td>
                    <td className="py-2.5 px-4 text-right text-blue-800">{formatCurrency(rapor.hesaplananKDV)}</td>
                    <td className="py-2.5 px-4 text-right">{formatCurrency(rapor.aylikAlisMatrah || 0)}</td>
                    <td className="py-2.5 px-4 text-right text-orange-800">{formatCurrency(rapor.indirilecekKDV)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tevkifat ve Stopaj Raporu */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-2">
        {/* Tevkifat Özeti */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-amber-600" />
            Tevkifat Kesintileri
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm bg-amber-50/50">
              <CardContent className="p-4">
                <p className="text-sm text-slate-500 mb-1">Satışlardan Kesilen</p>
                <p className="text-2xl font-bold text-amber-700">{formatCurrency(rapor.toplamSatisTevkifat)}</p>
                <p className="text-xs text-slate-400 mt-1">Sizden kesilen (Devreden)</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-red-50/50 border-red-200">
              <CardContent className="p-4">
                <p className="text-sm text-slate-500 mb-1">Alışlardan Kesilen</p>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(rapor.toplamAlisTevkifat)}</p>
                <p className="text-xs text-red-600 mt-1">Sizin kestiğiniz (KDV 2)</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Stopaj Özeti */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-rose-600" />
            Stopaj Kesintileri
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm bg-rose-50/50">
              <CardContent className="p-4">
                <p className="text-sm text-slate-500 mb-1">Peşin Ödenen (Satış)</p>
                <p className="text-2xl font-bold text-rose-700">{formatCurrency(rapor.toplamSatisStopaj)}</p>
                <p className="text-xs text-slate-400 mt-1">Elde edemediğiniz tutar</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-fuchsia-50/50 border-fuchsia-200">
              <CardContent className="p-4">
                <p className="text-sm text-slate-500 mb-1">Muhtasar (Alış)</p>
                <p className="text-2xl font-bold text-fuchsia-700">{formatCurrency(rapor.toplamAlisStopaj)}</p>
                <p className="text-xs text-fuchsia-600 mt-1">Sizin ödeyeceğiniz stopaj</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Gelir Vergisi Raporu */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-purple-600" />
          Gelir Vergisi (Kümülatif)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm bg-purple-50/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                    Kümülatif Matrah
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3.5 h-3.5 text-slate-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Yılbaşından itibaren toplam matrah</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(rapor.toplamMatrah)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Ocak - {rapor.ayAdi} dönemi
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-indigo-50/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Vergi Oranı</p>
                  <p className="text-2xl font-bold text-slate-900">
                    %{rapor.gelirVergisiOrani}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Kümülatif matraha göre
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Calculator className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-rose-50/50 border-rose-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Hesaplanan Gelir Vergisi</p>
                  <p className="text-2xl font-bold text-rose-700">
                    {formatCurrency(rapor.hesaplananGelirVergisi)}
                  </p>
                  <p className="text-xs text-rose-600 mt-1">
                    Kümülatif hesaplama
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-rose-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Yıllık Özet */}
      <Card className="border-0 shadow-sm bg-slate-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-600" />
            {selectedYil} Yılı Özeti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-white rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Toplam Satış Matrahı</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(yillikOzet.toplamSatisMatrah)}
              </p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Toplam Alış Matrahı</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(yillikOzet.toplamAlisMatrah)}
              </p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Yıllık KDV</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(yillikOzet.odenecekKDVYillik)}
              </p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Net Kar (Tahmini)</p>
              <p className="text-xl font-bold text-green-700">
                {formatCurrency(yillikOzet.toplamSatisMatrah - yillikOzet.toplamAlisMatrah)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bilgi Notu */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-1">Önemli Bilgiler:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>KDV hesaplamaları aylık bazda yapılır.</li>
            <li>Gelir vergisi hesaplaması kümülatif (yılbaşından itibaren) yapılır.</li>
            <li>2024 gelir vergisi dilimleri: 15% (0-110K), 20% (110-230K), 27% (230-580K), 35% (580K-3M), 40% (3M+)</li>
            <li>Bu hesaplamalar tahmini değerlerdir, kesin vergi tutarı için mali müşavirinize danışınız.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
