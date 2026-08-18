import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Save, AlertCircle, Server, Download, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

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
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/integrator/ayarlar', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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

  if (loading) {
    return <div className="p-4 flex justify-center py-20 text-slate-500">Ayarlar yükleniyor...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Fatura Entegratör Ayarları</h2>
          <p className="text-muted-foreground mt-1">Sistemde kullanacağınız e-Fatura entegratörlerini buradan yönetebilirsiniz.</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Aktif Entegratör Seçimi */}
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

        {/* Ayarlar Sekmeleri */}
        <Tabs defaultValue="elogo" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 p-1 bg-slate-100 rounded-lg">
            <TabsTrigger value="elogo" className="rounded-md">eLogo API Ayarları</TabsTrigger>
            <TabsTrigger value="uyumsoft" className="rounded-md">Uyumsoft API Ayarları</TabsTrigger>
          </TabsList>
          
          <TabsContent value="elogo">
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
                    <span className="font-medium text-slate-900">Test Modu (Demo)</span>
                    <span className="text-sm text-slate-500 font-normal mt-1">
                      Açık olduğunda e-faturalarınız GİB canlı ortamına gitmez, pb-demo.elogo.com.tr adresine iletilir.
                    </span>
                  </Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="uyumsoft">
            <Card className="border-none shadow-md bg-white">
              <CardHeader className="border-b bg-slate-50/50 pb-4">
                <CardTitle className="text-lg text-slate-800">Uyumsoft Kimlik Bilgileri</CardTitle>
                <CardDescription>
                  Uyumsoft sistemine bağlanmak için gerekli Servis Kullanıcı Adı ve Şifresini girin.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="uyumsoft-username">Servis Kullanıcı Adı</Label>
                    <Input
                      id="uyumsoft-username"
                      value={uyumsoftUsername}
                      onChange={(e) => setUyumsoftUsername(e.target.value)}
                      placeholder="Uyumsoft API Kullanıcısı"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="uyumsoft-password">Servis Şifresi</Label>
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
          </TabsContent>
        </Tabs>

        <Alert variant="default" className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Güvenlik Uyarısı</AlertTitle>
          <AlertDescription className="text-amber-700">
            Entegratör kimlik bilgileriniz (kullanıcı adı ve şifre) API entegrasyonu dışında başka bir ortamda kullanılmamalıdır.
          </AlertDescription>
        </Alert>
      </div>

      <div className="flex justify-end gap-3 mt-8">
        <Button variant="outline" onClick={() => loadSettings()} className="bg-white">
          İptal Et
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-slate-900 hover:bg-slate-800 text-white min-w-[140px]"
        >
          {saving ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Kaydediliyor...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              <span>Ayarları Kaydet</span>
            </div>
          )}
        </Button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg shadow-sm border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
