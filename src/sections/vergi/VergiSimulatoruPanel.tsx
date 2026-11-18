import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { AYLAR, GELIR_VERGISI_DILIMLERI } from '@/types';
import { Calculator, Sparkles, TrendingDown, TrendingUp, ArrowRightLeft, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VergiSimulatoruPanelProps {
  selectedYil: number;
  selectedAy: number;
}

const QUARTERS = [
  { id: 1, label: '1. Dönem (Ocak – Mart)', months: [1, 2, 3] },
  { id: 2, label: '2. Dönem (Nisan – Haziran)', months: [4, 5, 6] },
  { id: 3, label: '3. Dönem (Temmuz – Eylül)', months: [7, 8, 9] },
  { id: 4, label: '4. Dönem (Ekim – Aralık)', months: [10, 11, 12] },
];

function hesaplaDilimliGelirVergisi(matrah: number): number {
  if (matrah <= 0) return 0;
  let kalan = matrah;
  let toplamVergi = 0;
  let prevLimit = 0;
  for (const d of GELIR_VERGISI_DILIMLERI) {
    if (kalan <= 0) break;
    const aralik = d.limit === Infinity ? kalan : d.limit - prevLimit;
    const vergilenecek = Math.min(kalan, aralik);
    toplamVergi += vergilenecek * (d.oran / 100);
    kalan -= vergilenecek;
    prevLimit = d.limit;
  }
  return toplamVergi;
}

export function VergiSimulatoruPanel({ selectedYil, selectedAy }: VergiSimulatoruPanelProps) {
  const { satisFaturalari, alisFaturalari, getVergiRaporu, activeCompany, isIsletmeDefteri } = useApp();

  // Yıl başı devreden KDV (localStorage kalıcı)
  const storageKey = `devreden_kdv_baslangic_${activeCompany?.id || 'default'}_${selectedYil}`;
  const [baslangicDevredenKdv, setBaslangicDevredenKdv] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) || '0';
    } catch {
      return '0';
    }
  });

  useEffect(() => {
    try {
      setBaslangicDevredenKdv(localStorage.getItem(storageKey) || '0');
    } catch {
      setBaslangicDevredenKdv('0');
    }
  }, [storageKey]);

  const handleDevredenChange = (val: string) => {
    setBaslangicDevredenKdv(val);
    try {
      localStorage.setItem(storageKey, val);
    } catch {
      // ignore storage errors
    }
  };

  // Mükellefiyet / Vergi Rejimi
  const defaultTaxType = useMemo(() => {
    const t = String(activeCompany?.company_type || '').toUpperCase();
    if (isIsletmeDefteri || t.includes('ŞAHIS') || t.includes('SAHIS')) return 'gelir';
    return 'kurumlar';
  }, [activeCompany?.company_type, isIsletmeDefteri]);

  const [taxRegime, setTaxRegime] = useState<'kurumlar' | 'gelir'>(defaultTaxType);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(() => Math.ceil(selectedAy / 3));

  useEffect(() => {
    setSelectedQuarter(Math.ceil(selectedAy / 3));
  }, [selectedAy]);

  // "Ne Olur?" Simülatör Girişleri
  const [simEkGiderMatrah, setSimEkGiderMatrah] = useState<string>('0');
  const [simEkGiderKdvOran, setSimEkGiderKdvOran] = useState<string>('20');
  const [simEkSatisMatrah, setSimEkSatisMatrah] = useState<string>('0');
  const [simEkSatisKdvOran, setSimEkSatisKdvOran] = useState<string>('20');

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v);

  // 1. 12 Aylık Devreden KDV Zinciri
  const kdvZinciri = useMemo(() => {
    const baslangic = Math.max(0, parseFloat(baslangicDevredenKdv) || 0);
    let devreden = baslangic;
    const rows = [];

    for (let ay = 1; ay <= 12; ay++) {
      const r = getVergiRaporu(selectedYil, ay);
      const oncekiDevreden = devreden;
      const netHesaplanan = r.netHesaplananKDV;
      const indirilecek = r.indirilecekKDV;
      const fark = netHesaplanan - (indirilecek + oncekiDevreden);

      const odenecek = fark > 0 ? fark : 0;
      const sonrakiDevreden = fark < 0 ? Math.abs(fark) : 0;
      devreden = sonrakiDevreden;

      rows.push({
        ay,
        ayAdi: AYLAR[ay - 1]?.label || `${ay}. Ay`,
        netHesaplanan,
        indirilecek,
        oncekiDevreden,
        odenecek,
        sonrakiDevreden,
        satisTevkifat: r.toplamSatisTevkifat,
        satisAdet: r.satisAdet,
        alisAdet: r.alisAdet,
      });
    }
    return rows;
  }, [selectedYil, baslangicDevredenKdv, getVergiRaporu]);

  const seciliAyKdv = kdvZinciri[selectedAy - 1] || kdvZinciri[0];
  const yillikTevkifatIade = useMemo(
    () => kdvZinciri.slice(0, selectedAy).reduce((acc, r) => acc + r.satisTevkifat, 0),
    [kdvZinciri, selectedAy]
  );

  // 2. Çeyreklik Geçici Vergi Hesabı (Kümülatif yıl başından çeyrek sonuna kadar)
  const geciciVergiOzet = useMemo(() => {
    const endMonth = selectedQuarter * 3;
    let kumulatifSatisMatrah = 0;
    let kumulatifAlisMatrah = 0;
    let kumulatifKkegOiv = 0;
    let kumulatifSatisStopaj = 0;

    for (const f of satisFaturalari) {
      if (!f.faturaTarihi) continue;
      const d = new Date(f.faturaTarihi);
      if (d.getFullYear() === selectedYil && d.getMonth() + 1 <= endMonth) {
        kumulatifSatisMatrah += Number(f.matrah) || 0;
        kumulatifSatisStopaj += Number(f.stopajTutari) || 0;
      }
    }

    for (const f of alisFaturalari) {
      if (!f.faturaTarihi) continue;
      const d = new Date(f.faturaTarihi);
      if (d.getFullYear() === selectedYil && d.getMonth() + 1 <= endMonth) {
        kumulatifAlisMatrah += Number(f.matrah) || 0;
        kumulatifKkegOiv += Number(f.oivTutari) || 0;
      }
    }

    const ticariKar = kumulatifSatisMatrah - kumulatifAlisMatrah;
    const maliKar = ticariKar + kumulatifKkegOiv;
    const vergiMatrahi = Math.max(0, maliKar);
    const hesaplananVergi =
      taxRegime === 'kurumlar'
        ? vergiMatrahi * 0.25
        : hesaplaDilimliGelirVergisi(vergiMatrahi);
    const netOdenecekGecici = Math.max(0, hesaplananVergi - kumulatifSatisStopaj);

    return {
      endMonth,
      kumulatifSatisMatrah,
      kumulatifAlisMatrah,
      kumulatifKkegOiv,
      kumulatifSatisStopaj,
      ticariKar,
      maliKar,
      hesaplananVergi,
      netOdenecekGecici,
    };
  }, [satisFaturalari, alisFaturalari, selectedYil, selectedQuarter, taxRegime]);

  // 3. "Ne Olur?" Simülasyonu
  const simulasyon = useMemo(() => {
    const ekGider = Math.max(0, parseFloat(simEkGiderMatrah) || 0);
    const ekGiderKdv = ekGider * ((parseFloat(simEkGiderKdvOran) || 0) / 100);
    const ekSatis = Math.max(0, parseFloat(simEkSatisMatrah) || 0);
    const ekSatisKdv = ekSatis * ((parseFloat(simEkSatisKdvOran) || 0) / 100);

    // KDV Etkisi (Seçili ay bazında)
    const mevcutKdvFark =
      seciliAyKdv.netHesaplanan - (seciliAyKdv.indirilecek + seciliAyKdv.oncekiDevreden);
    const simKdvFark =
      seciliAyKdv.netHesaplanan +
      ekSatisKdv -
      (seciliAyKdv.indirilecek + ekGiderKdv + seciliAyKdv.oncekiDevreden);

    const mevcutOdenecekKdv = mevcutKdvFark > 0 ? mevcutKdvFark : 0;
    const simOdenecekKdv = simKdvFark > 0 ? simKdvFark : 0;
    const simDevredenKdv = simKdvFark < 0 ? Math.abs(simKdvFark) : 0;

    // Geçici Vergi Etkisi
    const simMaliKar = Math.max(0, geciciVergiOzet.maliKar + ekSatis - ekGider);
    const simHesaplananGecici =
      taxRegime === 'kurumlar'
        ? simMaliKar * 0.25
        : hesaplaDilimliGelirVergisi(simMaliKar);
    const simNetGecici = Math.max(0, simHesaplananGecici - geciciVergiOzet.kumulatifSatisStopaj);

    return {
      ekGider,
      ekGiderKdv,
      ekSatis,
      ekSatisKdv,
      mevcutOdenecekKdv,
      simOdenecekKdv,
      simDevredenKdv,
      kdvFark: simOdenecekKdv - mevcutOdenecekKdv,
      mevcutNetGecici: geciciVergiOzet.netOdenecekGecici,
      simNetGecici,
      geciciFark: simNetGecici - geciciVergiOzet.netOdenecekGecici,
    };
  }, [
    simEkGiderMatrah,
    simEkGiderKdvOran,
    simEkSatisMatrah,
    simEkSatisKdvOran,
    seciliAyKdv,
    geciciVergiOzet,
    taxRegime,
  ]);

  return (
    <div className="space-y-6">
      {/* Üst Özet Kartları: Devreden KDV & Tevkifat & Geçici Vergi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-indigo-200 bg-indigo-50/40 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                {AYLAR[selectedAy - 1]?.label} Net KDV Durumu
              </span>
              <Badge variant="outline" className="bg-white text-indigo-700 border-indigo-200">
                Zincirli Hesap
              </Badge>
            </div>
            {seciliAyKdv.odenecek > 0 ? (
              <>
                <p className="text-2xl font-bold text-red-700">
                  {formatCurrency(seciliAyKdv.odenecek)}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Ödenecek KDV (Önceki devir: {formatCurrency(seciliAyKdv.oncekiDevreden)})
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatCurrency(seciliAyKdv.sonrakiDevreden)}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Sonraki Aya Devreden KDV (Ödenecek: 0,00 TL)
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                Kümülatif Tevkifat İade / Mahsup
              </span>
              <ArrowRightLeft className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-900">{formatCurrency(yillikTevkifatIade)}</p>
            <p className="text-xs text-slate-600 mt-1">
              Oca – {AYLAR[selectedAy - 1]?.label} arası kesilen tevkifatlı satış toplamı
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                {selectedQuarter}. Dönem Geçici Vergi
              </span>
              <Badge className="bg-slate-900 text-white">
                {taxRegime === 'kurumlar' ? 'Kurumlar %25' : 'Gelir Dilimli'}
              </Badge>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(geciciVergiOzet.netOdenecekGecici)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Mali Kâr: {formatCurrency(geciciVergiOzet.maliKar)} (KKEG: {formatCurrency(geciciVergiOzet.kumulatifKkegOiv)})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Canlı "Ne Olur?" Simülatörü + Geçici Vergi Detayı */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 border-0 shadow-sm bg-white">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Canlı "Ne Olur?" Vergi Simülatörü ({AYLAR[selectedAy - 1]?.label} &amp; {selectedQuarter}. Çeyrek)
            </CardTitle>
            <CardDescription className="text-xs">
              Dönem kapanmadan önce ek gider/alış veya ek satış faturası kesildiğinde KDV ve Geçici Vergi yükünüzün nasıl değişeceğini anlık test edin.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2.5">
                <Label className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5" /> Ek Alış / Gider Faturası (Matrah)
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={simEkGiderMatrah}
                    onChange={(e) => setSimEkGiderMatrah(e.target.value)}
                    placeholder="Örn: 50000"
                    className="bg-white h-9"
                  />
                  <Select value={simEkGiderKdvOran} onValueChange={setSimEkGiderKdvOran}>
                    <SelectTrigger className="w-24 bg-white h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">%0</SelectItem>
                      <SelectItem value="1">%1</SelectItem>
                      <SelectItem value="10">%10</SelectItem>
                      <SelectItem value="20">%20</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-emerald-700">
                  İndirilecek KDV katkısı: <b>+{formatCurrency(simulasyon.ekGiderKdv)}</b>
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2.5">
                <Label className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Ek Satış Faturası (Matrah)
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={simEkSatisMatrah}
                    onChange={(e) => setSimEkSatisMatrah(e.target.value)}
                    placeholder="Örn: 100000"
                    className="bg-white h-9"
                  />
                  <Select value={simEkSatisKdvOran} onValueChange={setSimEkSatisKdvOran}>
                    <SelectTrigger className="w-24 bg-white h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">%0</SelectItem>
                      <SelectItem value="1">%1</SelectItem>
                      <SelectItem value="10">%10</SelectItem>
                      <SelectItem value="20">%20</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-blue-700">
                  Hesaplanan KDV etkisi: <b>+{formatCurrency(simulasyon.ekSatisKdv)}</b>
                </p>
              </div>
            </div>

            {/* Simülasyon Sonuç Kıyaslaması */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-xl border bg-slate-50 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{AYLAR[selectedAy - 1]?.label} Ödenecek KDV</span>
                  {simulasyon.kdvFark !== 0 && (
                    <Badge
                      className={cn(
                        'text-[11px]',
                        simulasyon.kdvFark < 0
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                          : 'bg-red-100 text-red-800 hover:bg-red-100'
                      )}
                    >
                      {simulasyon.kdvFark > 0 ? '+' : ''}
                      {formatCurrency(simulasyon.kdvFark)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[11px] text-slate-400">Mevcut</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {formatCurrency(simulasyon.mevcutOdenecekKdv)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-indigo-600 font-medium">Simülasyon</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(simulasyon.simOdenecekKdv)}
                    </p>
                  </div>
                </div>
                {simulasyon.simDevredenKdv > 0 && (
                  <p className="text-[11px] text-emerald-700 font-medium">
                    Yeni Devreden KDV: {formatCurrency(simulasyon.simDevredenKdv)}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl border bg-slate-50 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{selectedQuarter}. Dönem Geçici Vergi</span>
                  {simulasyon.geciciFark !== 0 && (
                    <Badge
                      className={cn(
                        'text-[11px]',
                        simulasyon.geciciFark < 0
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                          : 'bg-red-100 text-red-800 hover:bg-red-100'
                      )}
                    >
                      {simulasyon.geciciFark > 0 ? '+' : ''}
                      {formatCurrency(simulasyon.geciciFark)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[11px] text-slate-400">Mevcut</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {formatCurrency(simulasyon.mevcutNetGecici)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-indigo-600 font-medium">Simülasyon</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(simulasyon.simNetGecici)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Geçici Vergi Hesaplama Parametreleri & Döküm */}
        <Card className="lg:col-span-5 border-0 shadow-sm bg-white">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="w-5 h-5 text-slate-700" />
              Geçici Vergi Dönem Dökümü
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500">Çeyrek Dönem</Label>
                <Select
                  value={selectedQuarter.toString()}
                  onValueChange={(v) => setSelectedQuarter(parseInt(v, 10))}
                >
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUARTERS.map((q) => (
                      <SelectItem key={q.id} value={q.id.toString()}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Vergi Rejimi</Label>
                <Select value={taxRegime} onValueChange={(v: 'kurumlar' | 'gelir') => setTaxRegime(v)}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kurumlar">Kurumlar (%25)</SelectItem>
                    <SelectItem value="gelir">Gelir (Dilimli %15–40)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="divide-y pt-2 text-xs">
              <div className="py-2 flex justify-between">
                <span className="text-slate-600">Kümülatif Satış Matrahı (1–{geciciVergiOzet.endMonth}. Ay)</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(geciciVergiOzet.kumulatifSatisMatrah)}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-600">İndirilebilir Alış / Gider Matrahı</span>
                <span className="font-semibold text-red-600">
                  -{formatCurrency(geciciVergiOzet.kumulatifAlisMatrah)}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-600">Ticari Kâr / Zarar</span>
                <span className="font-semibold">{formatCurrency(geciciVergiOzet.ticariKar)}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-600">KKEG İlavesi (ÖİV / Özel Vergiler)</span>
                <span className="font-semibold text-amber-700">
                  +{formatCurrency(geciciVergiOzet.kumulatifKkegOiv)}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-700 font-medium">Mali Kâr (Vergi Matrahı)</span>
                <span className="font-bold text-slate-900">{formatCurrency(geciciVergiOzet.maliKar)}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-600">Mahsup Edilecek Stopaj</span>
                <span className="font-semibold text-emerald-700">
                  -{formatCurrency(geciciVergiOzet.kumulatifSatisStopaj)}
                </span>
              </div>
              <div className="py-2.5 flex justify-between bg-slate-50 px-2 rounded mt-1">
                <span className="font-bold text-slate-900">Tahmini Ödenecek Geçici Vergi</span>
                <span className="font-bold text-indigo-700 text-sm">
                  {formatCurrency(geciciVergiOzet.netOdenecekGecici)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 12 Aylık Devreden KDV Zincir Tablosu */}
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              {selectedYil} Yılı Aylık Devreden KDV Zinciri
            </CardTitle>
            <CardDescription className="text-xs">
              Bir ayda eksi çıkan KDV otomatik olarak sonraki ayın indirilecek KDV hesabına devreder.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label className="text-xs text-slate-600 whitespace-nowrap">
              {selectedYil - 1}'den Devreden KDV (TL):
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={baslangicDevredenKdv}
              onChange={(e) => handleDevredenChange(e.target.value)}
              className="w-32 h-8 text-xs font-mono"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr>
                <th className="text-left py-2.5 px-4 font-semibold">Ay</th>
                <th className="text-right py-2.5 px-3 font-semibold">Hesaplanan Net KDV</th>
                <th className="text-right py-2.5 px-3 font-semibold">İndirilecek KDV</th>
                <th className="text-right py-2.5 px-3 font-semibold">Önceki Devir</th>
                <th className="text-right py-2.5 px-3 font-semibold">Ödenecek KDV</th>
                <th className="text-right py-2.5 px-4 font-semibold">Sonraki Aya Devir</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {kdvZinciri.map((r) => (
                <tr
                  key={r.ay}
                  className={cn(
                    'hover:bg-slate-50 transition-colors',
                    r.ay === selectedAy && 'bg-indigo-50/60 font-medium'
                  )}
                >
                  <td className="py-2.5 px-4">
                    <span className="font-medium text-slate-900">{r.ayAdi}</span>
                    {r.ay === selectedAy && (
                      <Badge variant="outline" className="ml-2 text-[10px] py-0 border-indigo-300 text-indigo-700">
                        Seçili
                      </Badge>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(r.netHesaplanan)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                    {formatCurrency(r.indirilecek)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                    {formatCurrency(r.oncekiDevreden)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-red-700">
                    {r.odenecek > 0 ? formatCurrency(r.odenecek) : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-indigo-700">
                    {r.sonrakiDevreden > 0 ? formatCurrency(r.sonrakiDevreden) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
