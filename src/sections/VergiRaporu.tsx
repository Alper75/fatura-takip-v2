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
  Info
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
  const { satisFaturalari, alisFaturalari, getVergiRaporu } = useApp();
  const [selectedYil, setSelectedYil] = useState(2024);
  const [selectedAy, setSelectedAy] = useState(new Date().getMonth() + 1);

  // Mevcut yılları bul
  const availableYillar = useMemo(() => {
    const yillar = new Set<number>();
    satisFaturalari.forEach(f => {
      const yil = new Date(f.faturaTarihi).getFullYear();
      if (!isNaN(yil)) yillar.add(yil);
    });
    alisFaturalari.forEach(f => {
      const yil = new Date(f.faturaTarihi).getFullYear();
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
    let toplamAlisMatrah = 0;
    let toplamAlisKDV = 0;

    satisFaturalari
      .filter(f => {
        const d = new Date(f.faturaTarihi);
        return !isNaN(d.getTime()) && d.getFullYear() === selectedYil;
      })
      .forEach(f => {
        toplamSatisMatrah += (Number(f.matrah) || 0);
        toplamSatisKDV += (Number(f.kdvTutari) || 0);
      });

    alisFaturalari
      .filter(f => {
        const d = new Date(f.faturaTarihi);
        return !isNaN(d.getTime()) && d.getFullYear() === selectedYil;
      })
      .forEach(f => {
        toplamAlisMatrah += (Number(f.matrah) || 0);
        toplamAlisKDV += (Number(f.kdvTutari) || 0);
      });

    return {
      toplamSatisMatrah,
      toplamSatisKDV,
      toplamAlisMatrah,
      toplamAlisKDV,
      odenecekKDVYillik: Math.max(0, toplamSatisKDV - toplamAlisKDV),
    };
  }, [satisFaturalari, alisFaturalari, selectedYil]);

  // Excel indirme
  const downloadExcel = () => {
    const excelData = [{
      'Dönem': `${rapor.ayAdi} ${rapor.yil}`,
      'Satış Adedi': rapor.satisAdet,
      'Alış Adedi': rapor.alisAdet,
      'Hesaplanan KDV (TL)': rapor.hesaplananKDV,
      'İndirilecek KDV (TL)': rapor.indirilecekKDV,
      'Ödenecek KDV (TL)': rapor.odenecekKDV,
      'Kümülatif Matrah (TL)': rapor.toplamMatrah,
      'Gelir Vergisi Oranı (%)': rapor.gelirVergisiOrani,
      'Hesaplanan Gelir Vergisi (TL)': rapor.hesaplananGelirVergisi,
    }];

    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 },
      { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 25 }
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
                  <p className="text-sm text-slate-500 mb-1">Hesaplanan KDV</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(rapor.hesaplananKDV)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {rapor.satisAdet} adet satış faturası
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
                          <p>Hesaplanan KDV - İndirilecek KDV</p>
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
