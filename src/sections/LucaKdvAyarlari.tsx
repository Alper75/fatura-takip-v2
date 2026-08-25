import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LucaAccountSelect } from '@/components/LucaAccountSelect';
import { Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function LucaKdvAyarlari() {
  const { apiFetch } = useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // State for KDV & Muhasebe Settings
  const [settings, setSettings] = useState<any>({
    alis: { '1': '', '10': '', '20': '' },
    alis_iade: { '1': '', '10': '', '20': '' },
    satis: { '1': '', '10': '', '20': '' },
    satis_iade: { '1': '', '10': '', '20': '' },
    tevkifat: '',
    stopaj: '',
    varsayilanKasaKodu: '',
    varsayilanKrediKartiKodu: ''
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/settings/luca_kdv_ayarlari');
      if (res.success && res.value) {
        setSettings(JSON.parse(res.value));
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Fatura KDV ve Muhasebe Bağlantıları</h2>
          <p className="text-sm text-slate-500">Faturaların Luca'ya mahsup fişi olarak aktarılırken kullanılacak hesap kodlarını belirleyin.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 gap-2 whitespace-nowrap">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Ayarları Kaydet
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Alış Faturaları */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 mb-4">
            <CardTitle className="text-md text-indigo-700">Alış Faturaları KDV Hesapları</CardTitle>
            <CardDescription>Normal alım işlemleri için İndirilecek KDV (Örn: 191)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%1 KDV Hesabı</label>
              <LucaAccountSelect value={settings.alis?.['1']} onChange={(val) => updateSetting('alis', '1', val)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%10 KDV Hesabı</label>
              <LucaAccountSelect value={settings.alis?.['10']} onChange={(val) => updateSetting('alis', '10', val)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%20 KDV Hesabı</label>
              <LucaAccountSelect value={settings.alis?.['20']} onChange={(val) => updateSetting('alis', '20', val)} />
            </div>
          </CardContent>
        </Card>

        {/* Satış Faturaları */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 mb-4">
            <CardTitle className="text-md text-indigo-700">Satış Faturaları KDV Hesapları</CardTitle>
            <CardDescription>Normal satış işlemleri için Hesaplanan KDV (Örn: 391)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%1 KDV Hesabı</label>
              <LucaAccountSelect value={settings.satis?.['1']} onChange={(val) => updateSetting('satis', '1', val)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%10 KDV Hesabı</label>
              <LucaAccountSelect value={settings.satis?.['10']} onChange={(val) => updateSetting('satis', '10', val)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">%20 KDV Hesabı</label>
              <LucaAccountSelect value={settings.satis?.['20']} onChange={(val) => updateSetting('satis', '20', val)} />
            </div>
          </CardContent>
        </Card>

        {/* Alış İade Faturaları */}
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
    </div>
  );
}
