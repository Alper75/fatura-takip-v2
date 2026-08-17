import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Save, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';

export default function LogoEntegrasyonAyarlari() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isTest, setIsTest] = useState(true);
  
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
      const res = await fetch('http://localhost:5000/api/elogo/ayarlar', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setUsername(data.settings.elogo_username || '');
        setPassword(data.settings.elogo_password || '');
        setIsTest(data.settings.elogo_is_test === 'true');
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
      const res = await fetch('http://localhost:5000/api/elogo/ayarlar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          elogo_username: username,
          elogo_password: password,
          elogo_is_test: isTest
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: 'Ayarlar başarıyla kaydedildi.', type: 'success' });
      } else {
        setMessage({ text: data.message || 'Kaydetme başarısız.', type: 'error' });
      }
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      setMessage({ text: 'Sunucuya bağlanılamadı.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  if (loading) {
    return <div className="p-4">Ayarlar yükleniyor...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Logo e-Fatura Ayarları</h2>
          <p className="text-muted-foreground mt-1">eLogo servis bilgilerini buradan yönetebilirsiniz.</p>
        </div>
      </div>

      <Card className="border-none shadow-md bg-white">
        <CardHeader className="border-b bg-gray-50/50 pb-4">
          <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
            API Kimlik Bilgileri
          </CardTitle>
          <CardDescription>
            Logo'dan aldığınız web servis kullanıcı adı ve şifrenizi girin.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="username">eLogo Kullanıcı Adı</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Örn: 1234567890"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">eLogo Şifre</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifreniz"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 p-4 rounded-lg border">
            <Switch
              id="test-mode"
              checked={isTest}
              onCheckedChange={setIsTest}
            />
            <Label htmlFor="test-mode" className="flex flex-col cursor-pointer">
              <span className="font-medium text-slate-900">Test Modu (Demo)</span>
              <span className="text-sm text-slate-500 font-normal">
                Açık olduğunda e-faturalarınız GİB canlı ortamına gitmez, pb-demo.elogo.com.tr adresine iletilir.
              </span>
            </Label>
          </div>

          <Alert variant="warning" className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Önemli Bilgi</AlertTitle>
            <AlertDescription className="text-yellow-700">
              Bu bilgileri sadece Logo Destek ekibinden veya eLogo portalınızdan temin edebilirsiniz. Test şifreleriyle deneme yapmadan canlı ortama geçmeyiniz.
            </AlertDescription>
          </Alert>

        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => loadSettings()}>
          İptal Et
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
        >
          {saving ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Kaydediliyor</span>
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
