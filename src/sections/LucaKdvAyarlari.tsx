import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LucaAccountSelect } from '@/components/LucaAccountSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Save, RefreshCw, SlidersHorizontal, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function LucaKdvAyarlari() {
  const { apiFetch } = useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isMatrahModalOpen, setIsMatrahModalOpen] = useState(false);
  
  // State for KDV & Muhasebe Settings
  const [settings, setSettings] = useState<any>({
    alis: { '1': '', '10': '', '20': '' },
    alis_matrah: { '1': '', '10': '', '20': '' },
    alis_iade: { '1': '', '10': '', '20': '' },
    satis: { '1': '', '10': '', '20': '' },
    satis_matrah: { '0': '', '1': '', '10': '', '20': '' },
    satis_tevkifat_matrah: { '1': '', '10': '', '20': '', 'varsayilan': '' },
    satis_iade: { '1': '', '10': '', '20': '' },
    tevkifat: '',
    stopaj: '',
    satisStopaj: '',
    alisStopaj: '',
    oivKodu: '',
    aracGiderKkegKodu: '',
    varsayilanSatisKodu: '',
    varsayilanAlisKodu: '',
    varsayilanKasaKodu: '',
    varsayilanKrediKartiKodu: ''
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/settings/luca_kdv_ayarlari');
      if (res.success && res.value) {
        const parsed = JSON.parse(res.value);
        setSettings((prev: any) => ({
          ...prev,
          ...parsed,
          satis_matrah: { ...prev.satis_matrah, ...(parsed.satis_matrah || {}) },
          satis_tevkifat_matrah: { ...prev.satis_tevkifat_matrah, ...(parsed.satis_tevkifat_matrah || {}) },
          alis_matrah: { ...prev.alis_matrah, ...(parsed.alis_matrah || {}) },
        }));
      }
    } catch (e: any) {
      toast.error('Ayarlar yüklenirken hata oluştu: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/settings/luca_kdv_ayarlari', {
        method: 'POST',
        body: JSON.stringify({ value: JSON.stringify(settings) })
      });
      if (res.success) {
        toast.success('KDV ve Muhasebe ayarları başarıyla kaydedildi.');
        setIsMatrahModalOpen(false);
      } else {
        toast.error('Kaydetme başarısız: ' + res.message);
      }
    } catch (e: any) {
      toast.error('Hata: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (category: string, rate: string, value: string) => {
    setSettings((prev: any) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [rate]: value
      }
    }));
  };

  const updateRootSetting = (key: string, value: string) => {
    setSettings((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Ayarlar yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Üst Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Fatura KDV ve Muhasebe Bağlantıları</h2>
          <p className="text-sm text-slate-500">Faturaların Luca'ya aktarılırken kullanılacak 600 Gelir, 391/191 KDV ve Tevkifat/Stopaj hesap kodlarını belirleyin.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setIsMatrahModalOpen(true)} 
            variant="outline" 
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-2 whitespace-nowrap"
          >
            <SlidersHorizontal className="w-4 h-4" />
            600'lü Gelir Hesapları (Aç)
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 gap-2 whitespace-nowrap text-white">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Ayarları Kaydet
          </Button>
        </div>
      </div>

      {/* 600'lü Hesaplar Özet Banner */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            600
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800 text-sm">600'lü Gelir & Tevkifat Hesap Planı Eşleştirmesi</h3>
              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Akıllı Cari Hafızası
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Normal satışlar için: <span className="font-mono font-semibold text-indigo-700">{settings.satis_matrah?.['20'] || '600'}</span> (%20) | 
              Tevkifatlı satışlar için: <span className="font-mono font-semibold text-amber-700">{settings.satis_tevkifat_matrah?.['20'] || settings.satis_matrah?.['20'] || '600'}</span> (%20 Tevkifat)
            </p>
          </div>
        </div>
        <Button 
          size="sm" 
          onClick={() => setIsMatrahModalOpen(true)} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Hesapları Düzenle
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Satış Faturaları KDV (391) */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 mb-4">
            <CardTitle className="text-md text-indigo-700">Satış Faturaları KDV Hesapları (391)</CardTitle>
            <CardDescription>Satış işlemlerinde hesaplanan KDV alt hesapları</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%20 KDV Hesabı</label>
              <LucaAccountSelect value={settings.satis?.['20']} onChange={(val) => updateSetting('satis', '20', val)} placeholder="Örn: 391.20" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%10 KDV Hesabı</label>
              <LucaAccountSelect value={settings.satis?.['10']} onChange={(val) => updateSetting('satis', '10', val)} placeholder="Örn: 391.10" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%1 KDV Hesabı</label>
              <LucaAccountSelect value={settings.satis?.['1']} onChange={(val) => updateSetting('satis', '1', val)} placeholder="Örn: 391.01" />
            </div>
          </CardContent>
        </Card>

        {/* Alış Faturaları KDV (191) */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 mb-4">
            <CardTitle className="text-md text-slate-800">Alış Faturaları KDV Hesapları (191)</CardTitle>
            <CardDescription>Gelen alış faturalarında indirilecek KDV alt hesapları</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%20 KDV Hesabı</label>
              <LucaAccountSelect value={settings.alis?.['20']} onChange={(val) => updateSetting('alis', '20', val)} placeholder="Örn: 191.20" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%10 KDV Hesabı</label>
              <LucaAccountSelect value={settings.alis?.['10']} onChange={(val) => updateSetting('alis', '10', val)} placeholder="Örn: 191.10" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%1 KDV Hesabı</label>
              <LucaAccountSelect value={settings.alis?.['1']} onChange={(val) => updateSetting('alis', '1', val)} placeholder="Örn: 191.01" />
            </div>
          </CardContent>
        </Card>

        {/* Tevkifat ve Stopaj Hesapları */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 border-b border-slate-100 mb-4">
            <CardTitle className="text-md text-amber-700">Tevkifat ve Stopaj Hesapları</CardTitle>
            <CardDescription>Uygulanacak kesintilerin muhasebe alt hesapları (193 Satış Stopajı, 360 Alış Stopajı ve Tevkifat)</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Satış Stopajı Hesabı (Borç - 193)</label>
              <LucaAccountSelect value={settings.satisStopaj} onChange={(val) => updateRootSetting('satisStopaj', val)} placeholder="Örn: 193 veya 193.01" />
              <p className="text-[10px] text-slate-500 mt-1">Bizim kestiğimiz stopajlı satış faturalarında borçlu yazılır.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Alış Stopajı Hesabı (Alacak - 360)</label>
              <LucaAccountSelect value={settings.alisStopaj || settings.stopaj} onChange={(val) => updateRootSetting('alisStopaj', val)} placeholder="Örn: 360 veya 360.02" />
              <p className="text-[10px] text-slate-500 mt-1">Bize kesilen stopajlı alış faturalarında alacaklı yazılır.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">KDV Tevkifat Hesabı (Alacak - 360)</label>
              <LucaAccountSelect value={settings.tevkifat} onChange={(val) => updateRootSetting('tevkifat', val)} placeholder="Örn: 360 veya 360.01" />
              <p className="text-[10px] text-slate-500 mt-1">Alış tevkifatında alacaklı yazılır.</p>
            </div>
          </CardContent>
        </Card>

        {/* İade KDV Hesapları */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 mb-4">
            <CardTitle className="text-md text-emerald-700">Alış İade Faturaları (Bizim Kestiğimiz)</CardTitle>
            <CardDescription>Satıcıya iade edilen mallar (Örn: 391 İlave Edilecek KDV)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%1 İade KDV Hesabı</label>
              <LucaAccountSelect value={settings.alis_iade?.['1']} onChange={(val) => updateSetting('alis_iade', '1', val)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%10 İade KDV Hesabı</label>
              <LucaAccountSelect value={settings.alis_iade?.['10']} onChange={(val) => updateSetting('alis_iade', '10', val)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%20 İade KDV Hesabı</label>
              <LucaAccountSelect value={settings.alis_iade?.['20']} onChange={(val) => updateSetting('alis_iade', '20', val)} />
            </div>
          </CardContent>
        </Card>

        {/* Satış İade Faturaları */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 mb-4">
            <CardTitle className="text-md text-emerald-700">Satış İade Faturaları (Bize Kesilen)</CardTitle>
            <CardDescription>Müşteriden iade alınan mallar (Örn: 191 İndirilecek KDV)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%1 İade KDV Hesabı</label>
              <LucaAccountSelect value={settings.satis_iade?.['1']} onChange={(val) => updateSetting('satis_iade', '1', val)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%10 İade KDV Hesabı</label>
              <LucaAccountSelect value={settings.satis_iade?.['10']} onChange={(val) => updateSetting('satis_iade', '10', val)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%20 İade KDV Hesabı</label>
              <LucaAccountSelect value={settings.satis_iade?.['20']} onChange={(val) => updateSetting('satis_iade', '20', val)} />
            </div>
          </CardContent>
        </Card>

        {/* Özel Gider ve KKEG Hesapları */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 border-b border-slate-100 mb-4">
            <CardTitle className="text-md text-red-700">Özel Gider ve KKEG Hesapları</CardTitle>
            <CardDescription>Özel İletişim Vergisi (ÖİV) ve Araç Gider Kısıtlamasından doğan KKEG hesapları</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">ÖİV (Özel İletişim Vergisi) Hesabı</label>
              <LucaAccountSelect value={settings.oivKodu} onChange={(val) => updateRootSetting('oivKodu', val)} placeholder="Örn: 689.01" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Araç Gider Kısıtlaması (%30 KKEG) Hesabı</label>
              <LucaAccountSelect value={settings.aracGiderKkegKodu} onChange={(val) => updateRootSetting('aracGiderKkegKodu', val)} placeholder="Örn: 689.02" />
            </div>
          </CardContent>
        </Card>

        {/* Diğer Kesintiler (Tevkifat / Stopaj) */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 border-b border-slate-100 mb-4">
            <CardTitle className="text-md text-amber-700">Tevkifat ve Stopaj Hesapları</CardTitle>
            <CardDescription>Uygulanacak kesintilerin muhasebe alt hesapları (Örn: 193 Satış Stopajı, 360 Alış Stopajı ve Tevkifat)</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Satış Stopajı Hesabı (Borç)</label>
              <LucaAccountSelect value={settings.satisStopaj} onChange={(val) => updateRootSetting('satisStopaj', val)} placeholder="Örn: 193 veya 193.01" />
              <p className="text-[10px] text-slate-500 mt-1">Bizim kestiğimiz stopajlı satış faturalarında borçlu yazılır.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Alış Stopajı Hesabı (Alacak)</label>
              <LucaAccountSelect value={settings.alisStopaj || settings.stopaj} onChange={(val) => updateRootSetting('alisStopaj', val)} placeholder="Örn: 360 veya 360.02" />
              <p className="text-[10px] text-slate-500 mt-1">Bize kesilen stopajlı alış faturalarında alacaklı yazılır.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">KDV Tevkifat Hesabı</label>
              <LucaAccountSelect value={settings.tevkifat} onChange={(val) => updateRootSetting('tevkifat', val)} placeholder="Örn: 360 veya 360.01" />
              <p className="text-[10px] text-slate-500 mt-1">Alış tevkifatında alacaklı yazılır.</p>
            </div>
          </CardContent>
        </Card>

        {/* Varsayılan Ödeme Hesapları */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 border-b border-slate-100 mb-4">
            <CardTitle className="text-md text-cyan-700">Varsayılan Ödeme Hesapları (Yapay Zeka İçin)</CardTitle>
            <CardDescription>Fiş/fatura yapay zeka tarafından okunurken otomatik olarak atanacak ödeme hesapları.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Varsayılan Kasa Hesabı (Nakit)</label>
              <LucaAccountSelect value={settings.varsayilanKasaKodu} onChange={(val) => updateRootSetting('varsayilanKasaKodu', val)} placeholder="Örn: 100.01" />
              <p className="text-[10px] text-slate-500 mt-1">Yapay zeka "Nakit" ödeme tespit ettiğinde bu hesap kullanılır.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Varsayılan Kredi Kartı Hesabı</label>
              <LucaAccountSelect value={settings.varsayilanKrediKartiKodu} onChange={(val) => updateRootSetting('varsayilanKrediKartiKodu', val)} placeholder="Örn: 300.01 veya 329.01" />
              <p className="text-[10px] text-slate-500 mt-1">Yapay zeka Kredi Kartı tespit eder ancak Banka Hesapları listesinde eşleşen kart bulamazsa bu hesap kullanılır.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 600'LÜ GELİR & MATRAH HESAPLARI MODAL DİALOG */}
      <Dialog open={isMatrahModalOpen} onOpenChange={setIsMatrahModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-indigo-900">
              <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
              600'lü Gelir ve Matrah Hesap Ayarları
            </DialogTitle>
            <DialogDescription>
              Normal faturalar, tevkifatlı faturalar ve alış giderleri için kullanılacak matrah alt hesaplarını belirleyin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Akıllı Hafıza Bilgilendirmesi */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Akıllı Cari Hafızası Etkindir:</p>
                <p>Belirli bir müşteri faturasında özel bir 600 kodu seçtiğinizde, sistem o müşterinin sonraki (tevkifatlı veya normal) faturalarında bu tercihi otomatik hatırlar ve öncelikli olarak atar.</p>
              </div>
            </div>

            {/* Normal Satışlar için 600'lü Hesaplar */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                Normal Satış Faturaları (Standart 600'lü Hesaplar)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">%20 Normal Satış Hesabı (600)</label>
                  <LucaAccountSelect value={settings.satis_matrah?.['20']} onChange={(val) => updateSetting('satis_matrah', '20', val)} placeholder="Örn: 600.20 veya 600.01.020" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">%10 Normal Satış Hesabı (600)</label>
                  <LucaAccountSelect value={settings.satis_matrah?.['10']} onChange={(val) => updateSetting('satis_matrah', '10', val)} placeholder="Örn: 600.10 veya 600.01.010" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">%1 Normal Satış Hesabı (600)</label>
                  <LucaAccountSelect value={settings.satis_matrah?.['1']} onChange={(val) => updateSetting('satis_matrah', '1', val)} placeholder="Örn: 600.01 veya 600.01.001" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">%0 / İstisna Satış Hesabı (600)</label>
                  <LucaAccountSelect value={settings.satis_matrah?.['0']} onChange={(val) => updateSetting('satis_matrah', '0', val)} placeholder="Örn: 600.00 veya 600.01.000" />
                </div>
              </div>
            </div>

            {/* Tevkifatlı Satışlar için 600'lü Hesaplar */}
            <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/40 space-y-3">
              <h4 className="font-semibold text-sm text-amber-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                Tevkifatlı Satış Faturaları (Tevkifatlı 600'lü Hesaplar)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">%20 Tevkifatlı Satış Hesabı (600)</label>
                  <LucaAccountSelect value={settings.satis_tevkifat_matrah?.['20']} onChange={(val) => updateSetting('satis_tevkifat_matrah', '20', val)} placeholder="Örn: 600.20.002 (Tevkifatlı)" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">%10 Tevkifatlı Satış Hesabı (600)</label>
                  <LucaAccountSelect value={settings.satis_tevkifat_matrah?.['10']} onChange={(val) => updateSetting('satis_tevkifat_matrah', '10', val)} placeholder="Örn: 600.10.002 (Tevkifatlı)" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">%1 Tevkifatlı Satış Hesabı (600)</label>
                  <LucaAccountSelect value={settings.satis_tevkifat_matrah?.['1']} onChange={(val) => updateSetting('satis_tevkifat_matrah', '1', val)} placeholder="Örn: 600.01.002 (Tevkifatlı)" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Genel Tevkifatlı Satış Hesabı (Varsayılan)</label>
                  <LucaAccountSelect value={settings.satis_tevkifat_matrah?.['varsayilan']} onChange={(val) => updateSetting('satis_tevkifat_matrah', 'varsayilan', val)} placeholder="Örn: 600.01.099" />
                </div>
              </div>
            </div>

            {/* Alış Matrah Hesapları (153 / 770) */}
            <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/40 space-y-3">
              <h4 className="font-semibold text-sm text-emerald-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                Alış Faturaları Matrah Hesapları (153 / 770)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">%20 Alış Hesabı</label>
                  <LucaAccountSelect value={settings.alis_matrah?.['20']} onChange={(val) => updateSetting('alis_matrah', '20', val)} placeholder="Örn: 153.20" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">%10 Alış Hesabı</label>
                  <LucaAccountSelect value={settings.alis_matrah?.['10']} onChange={(val) => updateSetting('alis_matrah', '10', val)} placeholder="Örn: 153.10" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">%1 Alış Hesabı</label>
                  <LucaAccountSelect value={settings.alis_matrah?.['1']} onChange={(val) => updateSetting('alis_matrah', '1', val)} placeholder="Örn: 153.01" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t pt-3">
            <Button variant="outline" onClick={() => setIsMatrahModalOpen(false)}>Kapat</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Kaydet ve Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
