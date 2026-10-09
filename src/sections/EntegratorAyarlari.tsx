import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { 
  Save, 
  AlertCircle, 
  Server, 
  Download, 
  CheckCircle2, 
  Send, 
  Bot, 
  Play, 
  Square, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Sparkles,
  HelpCircle,
  Clock,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

export default function EntegratorAyarlari() {
  // Integrator selection
  const [activeIntegrator, setActiveIntegrator] = useState('elogo');

  // eLogo Settings
  const [elogoUsername, setElogoUsername] = useState('');
  const [elogoPassword, setElogoPassword] = useState('');
  const [elogoIsTest, setElogoIsTest] = useState(true);

  // Uyumsoft Settings
  const [uyumsoftUsername, setUyumsoftUsername] = useState('');
  const [uyumsoftPassword, setUyumsoftPassword] = useState('');
  const [uyumsoftIsTest, setUyumsoftIsTest] = useState(true);

  // Telegram Bot Settings & State
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramAllowedChatIds, setTelegramAllowedChatIds] = useState('');
  const [telegramTargetMode, setTelegramTargetMode] = useState('alis_faturasi');
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<{
    isRunning: boolean;
    botInfo: any;
    targetMode?: string;
    lastError?: string | null;
    logs?: Array<{ id: string; timestamp: string; type: string; message: string }>;
  }>({
    isRunning: false,
    botInfo: null,
    logs: []
  });
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [togglingTelegram, setTogglingTelegram] = useState(false);
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [verifiedBot, setVerifiedBot] = useState<any>(null);

  // Auto-Sync States
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncProvider, setAutoSyncProvider] = useState<'elogo' | 'uyumsoft' | 'gib'>('elogo');
  const [autoSyncIntervalMins, setAutoSyncIntervalMins] = useState('60');
  const [autoSyncNotifyTelegram, setAutoSyncNotifyTelegram] = useState(true);
  const [autoSyncLastRun, setAutoSyncLastRun] = useState<string | null>(null);
  const [autoSyncLastStatus, setAutoSyncLastStatus] = useState<string | null>(null);
  const [gibUsername, setGibUsername] = useState('');
  const [gibPassword, setGibPassword] = useState('');
  const [showGibPassword, setShowGibPassword] = useState(false);
  const [autoSyncLogs, setAutoSyncLogs] = useState<any[]>([]);
  const [runningManualScan, setRunningManualScan] = useState(false);
  const [savingAutoSync, setSavingAutoSync] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    loadSettings();
    loadTelegramData();
    loadAutoSyncData();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/integrator/ayarlar', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setActiveIntegrator(data.settings.active_integrator || 'elogo');
        setElogoUsername(data.settings.elogo_username || '');
        setElogoPassword(data.settings.elogo_password || '');
        setElogoIsTest(data.settings.elogo_is_test === 'true' || data.settings.elogo_is_test === true);
        setUyumsoftUsername(data.settings.uyumsoft_username || '');
        setUyumsoftPassword(data.settings.uyumsoft_password || '');
        setUyumsoftIsTest(data.settings.uyumsoft_is_test === 'true' || data.settings.uyumsoft_is_test === true);
      }
    } catch (error) {
      console.error('Ayarlar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTelegramData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [settRes, statRes] = await Promise.all([
        fetch('/api/telegram/settings', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/telegram/status', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const settData = await settRes.json();
      if (settData.success && settData.settings) {
        setTelegramToken(settData.settings.telegram_bot_token || '');
        setTelegramEnabled(settData.settings.telegram_bot_enabled === 'true');
        setTelegramAllowedChatIds(settData.settings.telegram_allowed_chat_ids || '');
        setTelegramTargetMode(settData.settings.telegram_target_mode || 'alis_faturasi');
      }

      const statData = await statRes.json();
      if (statData.success) {
        setTelegramStatus(statData);
        if (statData.botInfo) setVerifiedBot(statData.botInfo);
      }
    } catch (e) {
      console.warn('Telegram verileri yüklenemedi:', e);
    }
  };

  const loadAutoSyncData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auto-sync/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setAutoSyncEnabled(data.settings.auto_sync_enabled === 'true');
        setAutoSyncProvider(data.settings.auto_sync_provider || 'elogo');
        setAutoSyncIntervalMins(data.settings.auto_sync_interval_mins || '60');
        setAutoSyncNotifyTelegram(data.settings.auto_sync_notify_telegram !== 'false');
        setAutoSyncLastRun(data.settings.auto_sync_last_run || null);
        setAutoSyncLastStatus(data.settings.auto_sync_last_status || null);
        setGibUsername(data.settings.gib_username || '');
        setGibPassword(data.settings.gib_password || '');
      }
      if (data.logs) {
        setAutoSyncLogs(data.logs);
      }
    } catch (e) {
      console.warn('Otomatik tarama verileri alınamadı:', e);
    }
  };

  const handleSaveAutoSync = async () => {
    setSavingAutoSync(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auto-sync/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          auto_sync_enabled: autoSyncEnabled ? 'true' : 'false',
          auto_sync_provider: autoSyncProvider,
          auto_sync_interval_mins: autoSyncIntervalMins,
          auto_sync_notify_telegram: autoSyncNotifyTelegram ? 'true' : 'false',
          gib_username: gibUsername,
          gib_password: gibPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Otomatik tarama ayarları başarıyla kaydedildi.');
        await loadAutoSyncData();
      } else {
        toast.error(data.message || 'Ayarlar kaydedilemedi.');
      }
    } catch (e: any) {
      toast.error('Hata: ' + e.message);
    } finally {
      setSavingAutoSync(false);
    }
  };

  const handleRunManualScan = async () => {
    setRunningManualScan(true);
    toast.loading('Entegratör sorgulanıyor, yeni faturalar taranıyor...', { id: 'manual-scan' });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auto-sync/run-now', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        if (data.newCount > 0) {
          toast.success(`🎉 ${data.newCount} adet yeni alış faturası sisteme aktarıldı!`, { id: 'manual-scan' });
        } else {
          toast.info(data.message || 'Kontrol edildi, yeni gelen fatura bulunmuyor.', { id: 'manual-scan' });
        }
        await loadAutoSyncData();
      } else {
        toast.error('Tarama başarısız: ' + (data.message || 'Hata oluştu.'), { id: 'manual-scan' });
      }
    } catch (e: any) {
      toast.error('Hata: ' + e.message, { id: 'manual-scan' });
    } finally {
      setRunningManualScan(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/integrator/ayarlar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          active_integrator: activeIntegrator,
          elogo_username: elogoUsername,
          elogo_password: elogoPassword,
          elogo_is_test: elogoIsTest,
          uyumsoft_username: uyumsoftUsername,
          uyumsoft_password: uyumsoftPassword,
          uyumsoft_is_test: uyumsoftIsTest
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: 'Tüm entegratör ayarları başarıyla kaydedildi.', type: 'success' });
        toast.success('Entegratör ayarları kaydedildi.');
      } else {
        setMessage({ text: data.message || 'Kaydetme başarısız.', type: 'error' });
      }
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      setMessage({ text: 'Sunucuya bağlanılamadı.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    }
  };

  // Telegram Test
  const handleTestTelegramToken = async () => {
    if (!telegramToken) {
      toast.error('Lütfen önce Telegram Bot Token girin.');
      return;
    }
    setTestingTelegram(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token: telegramToken })
      });
      const data = await res.json();
      if (data.success && data.botInfo) {
        setVerifiedBot(data.botInfo);
        toast.success(`Bağlantı Başarılı! Bot: @${data.botInfo.username} (${data.botInfo.first_name})`);
      } else {
        toast.error('Token doğrulanamadı: ' + (data.message || 'Geçersiz token'));
      }
    } catch (e: any) {
      toast.error('Test sırasında hata: ' + e.message);
    } finally {
      setTestingTelegram(false);
    }
  };

  // Telegram Bot Başlat / Durdur
  const handleToggleTelegramBot = async (action: 'start' | 'stop') => {
    setTogglingTelegram(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/telegram/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'start' ? 'Bot başlatıldı ve dinlemeye geçti!' : 'Bot durduruldu.');
        setTelegramEnabled(action === 'start');
        await loadTelegramData();
      } else {
        toast.error(data.message || 'İşlem başarısız.');
      }
    } catch (e: any) {
      toast.error('İşlem hatası: ' + e.message);
    } finally {
      setTogglingTelegram(false);
    }
  };

  // Telegram Ayarlarını Kaydet
  const handleSaveTelegram = async () => {
    setSavingTelegram(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/telegram/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          token: telegramToken,
          enabled: telegramEnabled,
          allowedChatIds: telegramAllowedChatIds,
          targetMode: telegramTargetMode
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Telegram ayarları kaydedildi.');
        await loadTelegramData();
      } else {
        toast.error(data.message || 'Kaydedilemedi.');
      }
    } catch (e: any) {
      toast.error('Hata: ' + e.message);
    } finally {
      setSavingTelegram(false);
    }
  };

  if (loading) {
    return <div className="p-4 flex justify-center py-20 text-slate-500">Ayarlar yükleniyor...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Fatura & Entegrasyon Ayarları</h2>
          <p className="text-muted-foreground mt-1">e-Fatura entegratörlerinizi ve yapay zeka Telegram botunuzu buradan yönetebilirsiniz.</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Ayarlar Sekmeleri */}
        <Tabs defaultValue="elogo" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6 p-1 bg-slate-100 rounded-xl gap-1">
            <TabsTrigger value="elogo" className="rounded-lg font-medium text-xs sm:text-sm">
              eLogo API
            </TabsTrigger>
            <TabsTrigger value="uyumsoft" className="rounded-lg font-medium text-xs sm:text-sm">
              Uyumsoft API
            </TabsTrigger>
            <TabsTrigger value="telegram" className="rounded-lg font-medium text-xs sm:text-sm gap-1.5 flex items-center">
              <Send className="w-3.5 h-3.5 text-sky-500" />
              Telegram Bot
            </TabsTrigger>
            <TabsTrigger value="auto_sync" className="rounded-lg font-medium text-xs sm:text-sm gap-1.5 flex items-center">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
              Otomatik Tarama
              <Badge className="bg-emerald-600 text-white text-[10px] px-1 py-0 h-4 rounded-full ml-0.5 font-semibold">
                OTOMATİK
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* ==================== 1. eLogo TAB ==================== */}
          <TabsContent value="elogo" className="space-y-6">
            {/* Aktif Entegratör Seçimi Kartı */}
            <Card className="border-none shadow-md bg-white overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-500" />
                  Aktif Entegratör Seçimi
                </CardTitle>
                <CardDescription>
                  Fatura alma ve gönderme işlemlerinde varsayılan olarak hangi sistemin kullanılacağını seçin.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div 
                    className={`flex-1 flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${activeIntegrator === 'elogo' ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}
                    onClick={() => setActiveIntegrator('elogo')}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeIntegrator === 'elogo' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Download className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className={`font-semibold ${activeIntegrator === 'elogo' ? 'text-blue-900' : 'text-slate-700'}`}>eLogo (Logo)</h3>
                        <p className="text-xs text-slate-500">Logo Yazılım Entegrasyonu</p>
                      </div>
                    </div>
                    {activeIntegrator === 'elogo' && <CheckCircle2 className="w-6 h-6 text-blue-600" />}
                  </div>

                  <div 
                    className={`flex-1 flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${activeIntegrator === 'uyumsoft' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}
                    onClick={() => setActiveIntegrator('uyumsoft')}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeIntegrator === 'uyumsoft' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className={`font-semibold ${activeIntegrator === 'uyumsoft' ? 'text-indigo-900' : 'text-slate-700'}`}>Uyumsoft</h3>
                        <p className="text-xs text-slate-500">Uyumsoft e-Uyum Entegrasyonu</p>
                      </div>
                    </div>
                    {activeIntegrator === 'uyumsoft' && <CheckCircle2 className="w-6 h-6 text-indigo-600" />}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white">
              <CardHeader className="border-b bg-slate-50/50 pb-4">
                <CardTitle className="text-lg text-slate-800">eLogo Kimlik Bilgileri</CardTitle>
                <CardDescription>
                  eLogo portalından aldığınız web servis kullanıcı adı ve şifrenizi girin.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="elogo-username">Kullanıcı Adı</Label>
                    <Input
                      id="elogo-username"
                      value={elogoUsername}
                      onChange={(e) => setElogoUsername(e.target.value)}
                      placeholder="Örn: 1234567890"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="elogo-password">Şifre</Label>
                    <Input
                      id="elogo-password"
                      type="password"
                      value={elogoPassword}
                      onChange={(e) => setElogoPassword(e.target.value)}
                      placeholder="Şifreniz"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 bg-slate-50 p-4 rounded-lg border">
                  <Switch
                    id="elogo-test-mode"
                    checked={elogoIsTest}
                    onCheckedChange={setElogoIsTest}
                  />
                  <Label htmlFor="elogo-test-mode" className="flex flex-col cursor-pointer">
                    <span className="font-medium text-slate-900">Test Modu</span>
                    <span className="text-sm text-slate-500 font-normal mt-1">
                      Açık olduğunda işlemler Logo test sunucularında gerçekleşir.
                    </span>
                  </Label>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3 mt-4">
              <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white min-w-[140px]">
                {saving ? 'Kaydediliyor...' : 'eLogo Ayarlarını Kaydet'}
              </Button>
            </div>
          </TabsContent>

          {/* ==================== 2. UYUMSOFT TAB ==================== */}
          <TabsContent value="uyumsoft" className="space-y-6">
            <Card className="border-none shadow-md bg-white">
              <CardHeader className="border-b bg-slate-50/50 pb-4">
                <CardTitle className="text-lg text-slate-800">Uyumsoft Kimlik Bilgileri</CardTitle>
                <CardDescription>
                  Uyumsoft e-Uyum portalından aldığınız web servis kullanıcı adı ve şifrenizi girin.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="uyumsoft-username">Kullanıcı Adı</Label>
                    <Input
                      id="uyumsoft-username"
                      value={uyumsoftUsername}
                      onChange={(e) => setUyumsoftUsername(e.target.value)}
                      placeholder="Örn: UYUM_WS_USER"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="uyumsoft-password">Şifre</Label>
                    <Input
                      id="uyumsoft-password"
                      type="password"
                      value={uyumsoftPassword}
                      onChange={(e) => setUyumsoftPassword(e.target.value)}
                      placeholder="Şifreniz"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 bg-slate-50 p-4 rounded-lg border">
                  <Switch
                    id="uyumsoft-test-mode"
                    checked={uyumsoftIsTest}
                    onCheckedChange={setUyumsoftIsTest}
                  />
                  <Label htmlFor="uyumsoft-test-mode" className="flex flex-col cursor-pointer">
                    <span className="font-medium text-slate-900">Test Modu (Sandbox)</span>
                    <span className="text-sm text-slate-500 font-normal mt-1">
                      Açık olduğunda işlemleriniz efatura-test.uyumsoft.com.tr adresinde test olarak gerçekleşir.
                    </span>
                  </Label>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3 mt-4">
              <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white min-w-[140px]">
                {saving ? 'Kaydediliyor...' : 'Uyumsoft Ayarlarını Kaydet'}
              </Button>
            </div>
          </TabsContent>

          {/* ==================== 3. TELEGRAM BOT TAB ==================== */}
          <TabsContent value="telegram" className="space-y-6">
            {/* Canlı Durum Kartı */}
            <Card className="border-none shadow-md bg-white overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600" />
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0 shadow-sm">
                      <Send className="w-7 h-7 text-sky-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">Telegram Fiş & Masraf Asistanı</h3>
                        {telegramStatus.isRunning ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            Aktif Çalışıyor
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            Durduruldu
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {verifiedBot ? (
                          <span>Bağlı Bot: <strong>@{verifiedBot.username}</strong> ({verifiedBot.first_name})</span>
                        ) : (
                          <span>Saha personeli fiş fotoğrafı attığında AI ile okunup otomatik sisteme kaydedilir.</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadTelegramData}
                      className="text-xs h-9 text-slate-600"
                      title="Durumu Yenile"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>

                    {telegramStatus.isRunning ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleToggleTelegramBot('stop')}
                        disabled={togglingTelegram}
                        className="text-xs h-9 gap-1.5 shadow-sm"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        {togglingTelegram ? 'Durduruluyor...' : 'Botu Durdur'}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleToggleTelegramBot('start')}
                        disabled={togglingTelegram || !telegramToken}
                        className="text-xs h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        {togglingTelegram ? 'Başlatılıyor...' : 'Botu Başlat'}
                      </Button>
                    )}
                  </div>
                </div>

                {telegramStatus.lastError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Hata: {telegramStatus.lastError}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Token ve Ayarlar Formu */}
            <Card className="border-none shadow-md bg-white">
              <CardHeader className="border-b bg-slate-50/50 pb-4">
                <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-sky-500" />
                  Bot Kimlik ve Çalışma Ayarları
                </CardTitle>
                <CardDescription>
                  @BotFather'dan aldığınız API Token'ı ve yetkilendirme tercihlerini yapılandırın.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Bot Token Input */}
                <div className="space-y-2">
                  <Label htmlFor="telegram-token" className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                    <span>Telegram Bot Token (HTTP API)</span>
                    {verifiedBot && (
                      <span className="text-xs text-emerald-600 font-normal flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Doğrulandı: @{verifiedBot.username}
                      </span>
                    )}
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="telegram-token"
                        type={showTelegramToken ? 'text' : 'password'}
                        value={telegramToken}
                        onChange={(e) => setTelegramToken(e.target.value)}
                        placeholder="Örn: 1234567890:ABCdefGhIJKlmNoPQRstuVWXyz"
                        className="font-mono text-xs pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTelegramToken(!showTelegramToken)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showTelegramToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestTelegramToken}
                      disabled={testingTelegram || !telegramToken}
                      className="text-xs shrink-0 border-sky-200 text-sky-700 hover:bg-sky-50"
                    >
                      {testingTelegram ? 'Test Ediliyor...' : 'Bağlantıyı Test Et'}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Telegram'da <strong>@BotFather</strong> ile konuşup <code>/newbot</code> diyerek aldığınız token.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Yetkili Chat ID'leri */}
                  <div className="space-y-2">
                    <Label htmlFor="allowed-chat-ids" className="text-sm font-semibold text-slate-700">
                      Yetkili Chat / Grup ID'leri (Opsiyonel)
                    </Label>
                    <Input
                      id="allowed-chat-ids"
                      value={telegramAllowedChatIds}
                      onChange={(e) => setTelegramAllowedChatIds(e.target.value)}
                      placeholder="Örn: 12345678, 98765432"
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Virgülle ayırarak girin. Boş bırakırsanız şirket personeli herkes bota fiş gönderebilir. 
                      Kişiler bota <code>/chatid</code> yazarak ID'lerini öğrenebilir.
                    </p>
                  </div>

                  {/* Hedef Kayıt Modülü */}
                  <div className="space-y-2">
                    <Label htmlFor="target-mode" className="text-sm font-semibold text-slate-700">
                      Okunan Fişlerin Kaydedileceği Modül
                    </Label>
                    <select
                      id="target-mode"
                      value={telegramTargetMode}
                      onChange={(e) => setTelegramTargetMode(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="alis_faturasi">Alış Faturaları Modülü (Önerilen)</option>
                      <option value="personel_masraf">Personel Harcamaları / Masraflar</option>
                    </select>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Gelen fişler otomatik olarak seçilen modüle 'İncelenmeyi Bekliyor' statüsünde aktarılır.
                    </p>
                  </div>
                </div>

                {/* Buton */}
                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleSaveTelegram}
                    disabled={savingTelegram}
                    className="bg-sky-600 hover:bg-sky-700 text-white text-xs h-9 px-4 rounded-lg shadow-sm font-medium gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingTelegram ? 'Kaydediliyor...' : 'Telegram Ayarlarını Kaydet'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 3 Adımda Hızlı Başlangıç Rehberi */}
            <Card className="border border-sky-100 bg-sky-50/50 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <HelpCircle className="w-4 h-4 text-sky-600" />
                  <h4 className="text-sm font-bold text-sky-950">1 Dakikada Telegram Bot Kurulumu</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700">
                  <div className="bg-white p-3 rounded-lg border border-sky-100 shadow-2xs">
                    <div className="font-bold text-sky-700 mb-1">1. @BotFather'ı Açın</div>
                    <p>Telegram uygulamanızdan <strong>@BotFather</strong> hesabını bulun ve <code>/start</code> ardından <code>/newbot</code> yazın.</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-sky-100 shadow-2xs">
                    <div className="font-bold text-sky-700 mb-1">2. İsim & Kullanıcı Adı Verin</div>
                    <p>Botunuza bir ad (örn: <em>Bizim Şirket Fiş Asistanı</em>) ve sonu <code>bot</code> ile biten bir kullanıcı adı belirleyin.</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-sky-100 shadow-2xs">
                    <div className="font-bold text-sky-700 mb-1">3. Token'ı Yapıştırın</div>
                    <p>BotFather'ın verdiği <code>12345:ABC...</code> kodunu buradaki alana yapıştırıp <strong>'Botu Başlat'</strong>a basın.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Canlı Olay Günlüğü (Logs) */}
            <Card className="border-none shadow-md bg-white">
              <CardHeader className="border-b bg-slate-50/50 pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    Son Bot Hareketleri ve İşlem Günlüğü
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Telegram'dan gelen fişler ve sistem yanıtları gerçek zamanlı listelenir.
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={loadTelegramData} className="h-7 text-xs gap-1 text-slate-500">
                  <RefreshCw className="w-3 h-3" /> Yenile
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {!telegramStatus.logs || telegramStatus.logs.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Henüz kaydedilmiş bir Telegram bot aktivitesi bulunmuyor.
                    </div>
                  ) : (
                    telegramStatus.logs.map((log) => (
                      <div key={log.id} className="p-3 text-xs flex items-start gap-2.5 hover:bg-slate-50/50">
                        <span className="shrink-0 mt-0.5">
                          {log.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                          {log.type === 'warn' && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                          {log.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                          {log.type === 'info' && <Clock className="w-3.5 h-3.5 text-sky-500" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-700 font-medium break-words">{log.message}</p>
                          <span className="text-[10px] text-slate-400">
                            {new Date(log.timestamp).toLocaleTimeString('tr-TR')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== 4. OTOMATİK FATURA TARAMA TAB ==================== */}
          <TabsContent value="auto_sync" className="space-y-6">
            {/* Canlı Durum & Hızlı Aksiyon Kartı */}
            <Card className="border-none shadow-md bg-white overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-600" />
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 text-emerald-600" />
                      Arka Plan Fatura Tarama & Bildirim Servisi
                    </CardTitle>
                    <CardDescription className="mt-1">
                      GİB, eLogo veya Uyumsoft sisteminizdeki yeni gelen alış faturalarını periyodik olarak otomatik çeker ve Telegram ile bilgilendirir.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleRunManualScan}
                      disabled={runningManualScan}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${runningManualScan ? 'animate-spin' : ''}`} />
                      {runningManualScan ? 'Taranıyor...' : 'Şimdi Tara & Fatura Çek'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-500 block mb-1">Servis Durumu:</span>
                    {autoSyncEnabled ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold text-emerald-800 bg-emerald-100">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Aktif / Periyodik Tarama Açık
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold text-slate-600 bg-slate-200">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        Pasif (Manuel Çalıştırılabilir)
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-500 block mb-1">Aktif Sağlayıcı & Periyot:</span>
                    <span className="font-semibold text-slate-800">
                      {autoSyncProvider.toUpperCase()} • Her {autoSyncIntervalMins} dakikada bir
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block mb-1">Son Tarama:</span>
                    <span className="font-semibold text-slate-800">
                      {autoSyncLastRun ? new Date(autoSyncLastRun).toLocaleString('tr-TR') : 'Henüz çalıştırılmadı'}
                    </span>
                    {autoSyncLastStatus && (
                      <Badge className={`ml-2 text-[10px] ${autoSyncLastStatus === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {autoSyncLastStatus === 'success' ? 'Başarılı' : 'Hata'}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Yapılandırma Formu */}
            <Card className="border-none shadow-md bg-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Tarama Parametreleri
                </CardTitle>
                <CardDescription>
                  Hangi sağlayıcıdan, hangi sıklıkla fatura çekileceğini ve Telegram bildirimlerini yapılandırın.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 1. Aktif/Pasif Anahtarı */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <Label className="text-sm font-semibold text-slate-900">Periyodik Otomatik Taramayı Etkinleştir</Label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Açık olduğunda arka plandaki servis belirlenen aralıklarla sisteme yeni faturaları ekler.
                    </p>
                  </div>
                  <Switch
                    checked={autoSyncEnabled}
                    onCheckedChange={setAutoSyncEnabled}
                  />
                </div>

                {/* 2. Sağlayıcı Seçimi */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Tarama Yapılacak Entegratör / Portal</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'elogo', label: 'eLogo Entegratör', desc: 'eLogo API bilgileriyle gelen kutusunu tarar' },
                      { id: 'uyumsoft', label: 'Uyumsoft Entegratör', desc: 'Uyumsoft API ile gelen faturaları sorgular' },
                      { id: 'gib', label: 'GİB e-Arşiv / Portal', desc: 'GİB portalından gelen/düzenlenen faturaları çeker' }
                    ].map(p => (
                      <div
                        key={p.id}
                        onClick={() => setAutoSyncProvider(p.id as any)}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${autoSyncProvider === p.id ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="font-semibold text-xs text-slate-900">{p.label}</div>
                        <div className="text-[11px] text-slate-500 mt-1">{p.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* GİB Seçiliyse Giriş Bilgileri */}
                {autoSyncProvider === 'gib' && (
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                    <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      GİB Portal Oturum Bilgileri
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      GİB Portalı için kullanıcı kodu ve şifrenizi giriniz. Güvenli Session Manager otomatik olarak oturumu açıp faturaları çekecektir.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs">GİB Kullanıcı Kodu</Label>
                        <Input
                          placeholder="Örn: 12345678"
                          value={gibUsername}
                          onChange={e => setGibUsername(e.target.value)}
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">GİB Şifre</Label>
                        <div className="relative">
                          <Input
                            type={showGibPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={gibPassword}
                            onChange={e => setGibPassword(e.target.value)}
                            className="bg-white pr-9"
                          />
                          <button
                            type="button"
                            onClick={() => setShowGibPassword(!showGibPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showGibPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Tarama Sıklığı & Telegram Bildirimi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700">Tarama Sıklığı</Label>
                    <select
                      value={autoSyncIntervalMins}
                      onChange={e => setAutoSyncIntervalMins(e.target.value)}
                      className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="15">Her 15 Dakikada Bir (Çok Hızlı)</option>
                      <option value="30">Her 30 Dakikada Bir</option>
                      <option value="60">Her 1 Saatte Bir (Önerilen)</option>
                      <option value="360">Her 6 Saatte Bir</option>
                      <option value="1440">Günde 1 Kez (24 Saat)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 self-end h-10">
                    <div className="flex items-center gap-2">
                      <Send className="w-3.5 h-3.5 text-sky-500" />
                      <Label className="text-xs font-semibold text-slate-800 cursor-pointer">
                        Telegram'a Bildir
                      </Label>
                    </div>
                    <Switch
                      checked={autoSyncNotifyTelegram}
                      onCheckedChange={setAutoSyncNotifyTelegram}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSaveAutoSync}
                    disabled={savingAutoSync}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {savingAutoSync ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tarama Geçmişi & Log Tablosu */}
            <Card className="border-none shadow-md bg-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Son Tarama Geçmişi & Loglar
                </CardTitle>
                <CardDescription>
                  Arka planda veya manuel gerçekleştirilen son tarama işlemleri ve aktarılan fatura adetleri.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {autoSyncLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Henüz kayıtlı bir tarama logu bulunmamaktadır. "Şimdi Tara" butonunu kullanarak ilk taramayı başlatabilirsiniz.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="p-2.5">Zaman</th>
                          <th className="p-2.5">Entegratör</th>
                          <th className="p-2.5 text-center">Durum</th>
                          <th className="p-2.5 text-center">Yeni Fatura</th>
                          <th className="p-2.5">Açıklama</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {autoSyncLogs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 text-slate-600 font-mono whitespace-nowrap">
                              {new Date(log.run_at).toLocaleString('tr-TR')}
                            </td>
                            <td className="p-2.5 font-semibold text-slate-800 uppercase">
                              {log.provider}
                            </td>
                            <td className="p-2.5 text-center">
                              {log.status === 'success' ? (
                                <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Başarılı</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-700 text-[10px]">Hata</Badge>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {log.new_count > 0 ? (
                                <Badge className="bg-emerald-600 text-white font-bold text-[10px]">+{log.new_count}</Badge>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-600 max-w-xs truncate" title={log.details}>
                              {log.details || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Alert variant="default" className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Güvenlik Uyarısı</AlertTitle>
          <AlertDescription className="text-amber-700">
            Entegratör ve bot kimlik bilgileriniz API entegrasyonu dışında başka bir ortamda kullanılmamalıdır.
          </AlertDescription>
        </Alert>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg shadow-sm border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
