import { useState, useEffect } from 'react';
import { 
  Building2, 
  RefreshCw, 
  ShieldCheck, 
  Download, 
  FileText, 
  Search, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  KeyRound,
  ExternalLink,
  Sparkles,
  Inbox
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TebligatItem {
  id?: number | string;
  tebligId: string | number;
  tebligSecureId: string;
  belgeTuru?: string;
  gonderenBirimAdi?: string;
  vergiDairesiAdi?: string;
  belgeTarihi?: string;
  tebligTarihi?: string;
  okunmaTarihi?: string | null;
  arsivDurum?: string | number;
  durum?: string;
  konu?: string;
  [key: string]: any;
}

export function DijitalVergiDairesi() {
  const [userid, setUserid] = useState(() => localStorage.getItem('gib_dvd_userid') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('gib_dvd_password') || '');
  const [rememberCredentials, setRememberCredentials] = useState(true);
  
  const [token, setToken] = useState(() => sessionStorage.getItem('gib_dvd_token') || '');
  const [activeUser, setActiveUser] = useState<any>(null);

  // Captcha State
  const [captchaImg, setCaptchaImg] = useState<string>('');
  const [captchaCid, setCaptchaCid] = useState<string>('');
  const [captchaText, setCaptchaText] = useState<string>('');
  const [isCaptchaLoading, setIsCaptchaLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMessage, setLoginMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Tebligat State
  const [tebligatlar, setTebligatlar] = useState<TebligatItem[]>([]);
  const [isLoadingTebligatlar, setIsLoadingTebligatlar] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedTebligat, setSelectedTebligat] = useState<TebligatItem | null>(null);
  const [tebligatBelgeleri, setTebligatBelgeleri] = useState<any[]>([]);
  const [isLoadingBelgeler, setIsLoadingBelgeler] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // İlk açılışta Captcha yükle
  useEffect(() => {
    if (!token) {
      loadCaptcha();
    }
  }, [token]);

  const loadCaptcha = async () => {
    setIsCaptchaLoading(true);
    setCaptchaText('');
    setLoginMessage(null);
    try {
      const res = await fetch('/api/gib/dijital/captcha');
      const data = await res.json();
      if (data.success && data.imageBase64) {
        setCaptchaImg(`data:image/png;base64,${data.imageBase64}`);
        setCaptchaCid(data.cid);
      } else {
        setLoginMessage({ type: 'error', text: data.message || 'Captcha alınamadı.' });
      }
    } catch (err: any) {
      setLoginMessage({ type: 'error', text: 'GİB Captcha servisine erişilemedi: ' + err.message });
    } finally {
      setIsCaptchaLoading(false);
    }
  };

  const handleLogin = async (autoSolve: boolean = false) => {
    if (!userid || !password) {
      setLoginMessage({ type: 'error', text: 'Kullanıcı kodu ve şifre zorunludur.' });
      return;
    }
    if (!autoSolve && (!captchaText || !captchaCid)) {
      setLoginMessage({ type: 'error', text: 'Lütfen ekrandaki güvenlik kodunu giriniz.' });
      return;
    }

    setIsLoggingIn(true);
    setLoginMessage(null);

    try {
      const res = await fetch('/api/gib/dijital/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userid,
          password,
          captchaText,
          captchaCid,
          autoSolve
        })
      });

      const data = await res.json();
      if (data.success && data.token) {
        setToken(data.token);
        sessionStorage.setItem('gib_dvd_token', data.token);
        setActiveUser(data.user || { userid });
        setLoginMessage({ type: 'success', text: 'GİB Dijital Vergi Dairesi oturumu başarıyla açıldı.' });

        if (rememberCredentials) {
          localStorage.setItem('gib_dvd_userid', userid);
          localStorage.setItem('gib_dvd_password', password);
        }

        // Giriş yapınca tebligatları hemen yükle
        fetchTebligatlar(data.token);
      } else {
        setLoginMessage({ type: 'error', text: data.message || 'Giriş başarısız oldu.' });
        loadCaptcha(); // Yenisini al
      }
    } catch (err: any) {
      setLoginMessage({ type: 'error', text: 'Giriş hatası: ' + err.message });
      loadCaptcha();
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    sessionStorage.removeItem('gib_dvd_token');
    setActiveUser(null);
    setTebligatlar([]);
    loadCaptcha();
  };

  const fetchTebligatlar = async (authToken?: string) => {
    const t = authToken || token;
    setIsLoadingTebligatlar(true);
    try {
      const res = await fetch('/api/gib/dijital/tebligatlar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: t,
          userid,
          password,
          pageNo: 1,
          pageSize: 100
        })
      });

      const data = await res.json();
      if (data.success) {
        // GİB dönen liste formatı (backend items veya doğrudan DTO listesi)
        const list = data.data?.items || data.data?.tebligatDtoList || data.data?.data?.tebligatDtoList || data.data?.list || (Array.isArray(data.data) ? data.data : []);
        setTebligatlar(Array.isArray(list) ? list : []);
      } else {
        if (data.message?.includes('oturum') || data.message?.includes('token')) {
          handleLogout();
        }
      }
    } catch (err) {
      console.error('Tebligat listeleme hatası:', err);
    } finally {
      setIsLoadingTebligatlar(false);
    }
  };

  const openTebligatDetails = async (tebligat: TebligatItem) => {
    setSelectedTebligat(tebligat);
    setIsDetailOpen(true);
    setIsLoadingBelgeler(true);
    setTebligatBelgeleri([]);

    try {
      const res = await fetch('/api/gib/dijital/tebligat-belgeleri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          tebligId: tebligat.tebligId || tebligat.id,
          tebligSecureId: tebligat.tebligSecureId
        })
      });

      const data = await res.json();
      if (data.success) {
        const belgeler = data.data?.belgeler || (data.data?.tebligBelge ? [data.data.tebligBelge] : []);
        if (Array.isArray(data.data?.ekler)) {
          belgeler.push(...data.data.ekler);
        }
        setTebligatBelgeleri(belgeler);
      }
    } catch (err) {
      console.error('Belgeler yüklenemedi:', err);
    } finally {
      setIsLoadingBelgeler(false);
    }
  };

  const downloadBelge = async (belgeParam: any, dosyaAdi?: string) => {
    try {
      const res = await fetch('/api/gib/dijital/tebligat-indir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          params: belgeParam,
          dosyaAdi: dosyaAdi || 'tebligat_belgesi'
        })
      });

      if (!res.ok) {
        alert('Belge indirilemedi.');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (dosyaAdi || 'tebligat_belgesi').replace(/\.imz$/i, '') + '.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('İndirme hatası: ' + err.message);
    }
  };

  // Filtrelenmiş liste
  const filteredTebligatlar = tebligatlar.filter((item) => {
    const isUnread = !item.okunmaTarihi;
    if (activeTab === 'unread' && !isUnread) return false;
    if (activeTab === 'read' && isUnread) return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const gonderen = (item.gonderenBirimAdi || item.vergiDairesiAdi || '').toLowerCase();
    const konu = (item.konu || item.belgeTuru || '').toLowerCase();
    const no = String(item.tebligId || item.id || '').toLowerCase();
    return gonderen.includes(q) || konu.includes(q) || no.includes(q);
  });

  const unreadCount = tebligatlar.filter(t => !t.okunmaTarihi).length;

  return (
    <div className="space-y-6">
      {/* Üst Başlık Kartı */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-600/10 text-red-600 border border-red-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                GİB Dijital Vergi Dairesi & e-Tebligat
                <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
                  Resmi Portal
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                GİB Dijital Vergi Dairesi üzerinden e-tebligatları sorgulayın, indirin ve takip edin.
              </p>
            </div>
          </div>
        </div>

        {token && (
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchTebligatlar()}
              disabled={isLoadingTebligatlar}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingTebligatlar ? 'animate-spin' : ''}`} />
              Tebligatları Yenile
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleLogout}
              className="gap-2"
            >
              Güvenli Çıkış
            </Button>
          </div>
        )}
      </div>

      {/* Oturum Kapalıysa: Giriş Paneli */}
      {!token ? (
        <Card className="max-w-xl mx-auto shadow-sm border border-border/60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-600" />
              Dijital Vergi Dairesi Girişi
            </CardTitle>
            <CardDescription>
              İnternet Vergi Dairesi / Dijital Vergi Dairesi kullanıcı kodu ve şifrenizle giriş yapınız.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loginMessage && (
              <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                loginMessage.type === 'error' 
                  ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800' 
                  : 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800'
              }`}>
                {loginMessage.type === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>{loginMessage.text}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Kullanıcı Kodu (VKN / TCKN)</label>
              <div className="relative">
                <Input 
                  placeholder="Kullanıcı Kodu" 
                  value={userid} 
                  onChange={(e) => setUserid(e.target.value)}
                  className="pl-9 font-mono"
                />
                <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Şifre / Parola</label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Captcha Bölümü */}
            <div className="p-3 bg-muted/40 rounded-xl border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Güvenlik Doğrulaması</span>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={loadCaptcha} 
                  disabled={isCaptchaLoading}
                  className="h-7 text-xs gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCaptchaLoading ? 'animate-spin' : ''}`} />
                  Kodu Yenile
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-44 h-14 bg-white dark:bg-zinc-900 rounded-lg border border-border flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  {captchaImg ? (
                    <img src={captchaImg} alt="GİB Captcha" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Yükleniyor...</span>
                  )}
                </div>
                <Input 
                  placeholder="Resimdeki Kod" 
                  value={captchaText}
                  onChange={(e) => setCaptchaText(e.target.value)}
                  className="font-mono text-center tracking-widest text-lg font-bold uppercase"
                  maxLength={7}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={rememberCredentials} 
                  onChange={(e) => setRememberCredentials(e.target.checked)} 
                  className="rounded border-gray-300"
                />
                Giriş bilgilerimi bu tarayıcıda hatırla
              </label>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={() => handleLogin(false)} 
                disabled={isLoggingIn || !captchaText}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
              >
                {isLoggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Giriş Yap
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleLogin(true)} 
                disabled={isLoggingIn}
                className="gap-2 border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                title="Yapay zeka veya yerel model ile güvenlik kodunu otomatik çözerek girer"
              >
                <Sparkles className="w-4 h-4" />
                Otomatik Giriş
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Oturum Açık: Tebligatlar Paneli */
        <div className="space-y-6">
          {/* İstatistik & Arama Barı */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-red-500/5 to-transparent border border-red-500/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Toplam Tebligat</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{tebligatlar.length}</p>
                </div>
                <div className="p-3 bg-red-500/10 text-red-600 rounded-xl">
                  <Inbox className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/5 to-transparent border border-amber-500/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Okunmamış Tebligatlar</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{unreadCount}</p>
                </div>
                <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent border border-emerald-500/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Oturum Durumu</p>
                  <p className="text-sm font-semibold text-emerald-600 mt-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Aktif ({activeUser?.userid || userid})
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtre ve Sekmeler */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full sm:w-auto">
              <TabsList>
                <TabsTrigger value="all">Tümü ({tebligatlar.length})</TabsTrigger>
                <TabsTrigger value="unread" className="gap-1.5">
                  Okunmamış
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] bg-amber-500/20 text-amber-700">
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="read">Okunmuş</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative w-full sm:w-72">
              <Input 
                placeholder="Birim, konu veya tebliğ no ara..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
            </div>
          </div>

          {/* Tebligat Tablosu */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Tebliğ No</TableHead>
                    <TableHead>Gönderen Birim / Vergi Dairesi</TableHead>
                    <TableHead>Belge Türü / Konu</TableHead>
                    <TableHead className="w-36">Tebliğ Tarihi</TableHead>
                    <TableHead className="w-28 text-center">Durum</TableHead>
                    <TableHead className="w-32 text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTebligatlar ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-600" />
                        GİB üzerinden tebligatlar taranıyor...
                      </TableCell>
                    </TableRow>
                  ) : filteredTebligatlar.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        Herhangi bir tebligat kaydı bulunamadı.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTebligatlar.map((t) => {
                      const isUnread = !t.okunmaTarihi;
                      return (
                        <TableRow key={t.tebligId || t.id} className={isUnread ? 'bg-amber-500/5' : ''}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {t.tebligId || t.id}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {t.gonderenBirimAdi || t.vergiDairesiAdi || 'Gelir İdaresi Başkanlığı'}
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="font-semibold block">{t.belgeTuru || 'Resmi Tebligat'}</span>
                            {t.konu && <span className="text-xs text-muted-foreground line-clamp-1">{t.konu}</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {t.tebligTarihi || t.belgeTarihi || '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {isUnread ? (
                              <Badge variant="outline" className="text-[11px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                                Okunmadı
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[11px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                Okundu
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => openTebligatDetails(t)}
                              className="h-8 gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              İncele
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tebligat Belge Detay Modalı */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-600" />
              Tebligat Belgeleri ve Ekleri
            </DialogTitle>
            <DialogDescription>
              Tebliğ No: #{selectedTebligat?.tebligId || selectedTebligat?.id} — {selectedTebligat?.gonderenBirimAdi || 'Gelir İdaresi Başkanlığı'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl text-xs">
              <div>
                <span className="text-muted-foreground block">Belge Türü</span>
                <span className="font-semibold text-foreground">{selectedTebligat?.belgeTuru || 'Resmi Yazı'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Tebliğ Tarihi</span>
                <span className="font-semibold text-foreground">{selectedTebligat?.tebligTarihi || '-'}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">İndirilebilir Belgeler</h4>
              {isLoadingBelgeler ? (
                <div className="py-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-red-600" />
                  Belge bağlantıları hazırlanıyor...
                </div>
              ) : tebligatBelgeleri.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-xs bg-muted/20 rounded-lg">
                  Bu tebligata ait ek belge bulunamadı.
                </div>
              ) : (
                <div className="space-y-2">
                  {tebligatBelgeleri.map((belge, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 rounded-lg">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{belge.dosyaAdi || `Tebligat_Belgesi_${idx + 1}.pdf`}</p>
                          <p className="text-xs text-muted-foreground">{belge.boyut ? `${(belge.boyut / 1024).toFixed(1)} KB` : 'PDF Belgesi'}</p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => downloadBelge(belge, belge.dosyaAdi)}
                        className="gap-1.5 text-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        İndir (PDF)
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
