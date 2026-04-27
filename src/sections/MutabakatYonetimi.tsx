import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FileSignature, FileUp, Download, CheckCircle2, XCircle, 
  Clock, FileText, UploadCloud, Search, Loader2, Sparkles, AlertTriangle
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export function MutabakatYonetimi() {
  const { apiFetch, cariler } = useApp();
  const [mutabakatlar, setMutabakatlar] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('liste');
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  
  // Detaylı / Basit mode
  const [importMode, setImportMode] = useState<'basit' | 'detayli'>('basit');
  
  const mizanFileRef = useRef<HTMLInputElement>(null);
  const muavinFileRef = useRef<HTMLInputElement>(null);
  const [mizanFile, setMizanFile] = useState<File | null>(null);
  const [muavinFile, setMuavinFile] = useState<File | null>(null);

  const fetchSettings = async () => {
    try {
      const resKey = await apiFetch('/api/settings/gemini_api_key');
      if (resKey.success) {
        setGeminiKey(resKey.value || '');
      }
    } catch (e) {}
  };

  const handleSaveGeminiKey = async () => {
    setIsSavingKey(true);
    try {
      const res = await apiFetch('/api/settings/gemini_api_key', {
        method: 'POST',
        body: JSON.stringify({ value: geminiKey })
      });
      if (res.success) {
        toast.success('Yapay zeka anahtarı kaydedildi.');
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error('Hata: ' + e.message);
    } finally {
      setIsSavingKey(false);
    }
  };

  const fetchMutabakatlar = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/mutabakatlar');
      if (res.success) {
        setMutabakatlar(res.data);
      }
    } catch (e: any) {
      toast.error('Mutabakatlar çekilemedi: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'liste') {
      fetchMutabakatlar();
    }
    if (activeTab === 'ayarlar') {
      fetchSettings();
    }
  }, [activeTab]);

  const handleAIAnalyze = async (id: string, existingResult?: string) => {
    if (existingResult) {
      try {
        setSelectedAnalysis(JSON.parse(existingResult));
        return;
      } catch (e) {
        console.error("Parse error:", e);
      }
    }

    setIsAnalyzing(id);
    try {
      const res = await apiFetch(`/api/mutabakatlar/analyze/${id}`, { method: 'POST' });
      if (res.success) {
        setSelectedAnalysis(res.analysis);
        fetchMutabakatlar();
        toast.success('Yapay zeka analizi tamamlandı.');
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error('Analiz sırasında hata: ' + e.message);
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleDownloadMizanTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Muhasebe Kodu': '120.01.001', 'Vergi veya T.C. No': '1234567890', 'Dönem': '2026/04', 'Müşteri/Tedarikçi Adı': 'Örnek Firma A.Ş.', 'Borç': 50000, 'Alacak': 10000, 'Bakiye': 40000, 'Açıklama': '1. Çeyrek Mutabakatı' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mutabakat Aktarım");
    XLSX.writeFile(wb, "mutabakat_mizan_sablonu.xlsx");
  };

  const handleDownloadMuavinTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Tarih': '2026-04-01', 'Evrak No': 'FTR12345', 'Açıklama': 'Satış Faturası', 'Borç': 10000, 'Alacak': 0, 'Bakiye': 10000 }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Muavin");
    XLSX.writeFile(wb, "kendi_muavin_sablonu.xlsx");
  };

  const processAndSendMutabakat = async () => {
    if (!mizanFile) {
      toast.error('Lütfen Mizan (Bakiye listesi) dosyasını yükleyin.');
      return;
    }

    if (importMode === 'detayli' && !muavinFile) {
      toast.error('Detaylı mod seçtiniz, lütfen kendi Muavin dosyanızı da ekleyin.');
      return;
    }

    setIsLoading(true);
    try {
      const mizanData = await mizanFile.arrayBuffer();
      const mizanWb = XLSX.read(mizanData);
      const mizanRows = XLSX.utils.sheet_to_json(mizanWb.Sheets[mizanWb.SheetNames[0]]);

      let muavinBase64 = null;
      if (muavinFile) {
        const reader = new FileReader();
        muavinBase64 = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(muavinFile);
        });
      }

      const payloadRows = mizanRows.map((row: any) => ({
        muhasebeKodu: String(row['Muhasebe Kodu'] || row['Hesap Kodu'] || ''),
        vknTckn: String(row['Vergi veya T.C. No'] || row['VKN'] || row['TCKN'] || ''),
        donem: String(row['Dönem'] || ''),
        borc: parseFloat(row['Borç']) || 0,
        alacak: parseFloat(row['Alacak']) || 0,
        bakiye: parseFloat(row['Bakiye']) || 0,
        aciklama: String(row['Açıklama'] || '')
      })).filter(r => r.muhasebeKodu || r.vknTckn);

      if (payloadRows.length === 0) {
        toast.error('Mizan dosyasında geçerli satır bulunamadı.');
        setIsLoading(false);
        return;
      }

      const res = await apiFetch('/api/mutabakatlar/bulk', {
        method: 'POST',
        body: JSON.stringify({ 
          mutabakatlar: payloadRows,
          bizeAitMuavinBase64: muavinBase64
        })
      });

      if (res.success) {
        let msg = `${res.sentCount} adet mutabakat maili başarıyla gönderildi!`;
        if (res.totalRows > 0) msg = `İşlenen ${res.totalRows} satırdan ${res.sentCount} tanesi gönderildi.`;
        if (res.notFoundCount > 0) msg += ` (${res.notFoundCount} cari sistemde bulunamadı)`;
        if (res.noEmailCount > 0) msg += ` (${res.noEmailCount} carinin e-postası eksik)`;
        
        toast.success(msg);
        setMizanFile(null);
        setMuavinFile(null);
        setActiveTab('liste');
      } else {
        toast.error(res.message || 'Gönderim sırasında hata oluştu.');
      }
    } catch (e: any) {
      toast.error('Hata: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getDurumBadge = (durum: string) => {
    switch(durum) {
      case 'Mutabık': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0"><CheckCircle2 className="w-3 h-3 mr-1"/> Mutabık</Badge>;
      case 'Onaysız': return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0"><XCircle className="w-3 h-3 mr-1"/> Mutabık Değil</Badge>;
      default: return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0"><Clock className="w-3 h-3 mr-1"/> Bekliyor</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-indigo-600" />
            Mutabakat Yönetimi
          </h2>
          <p className="text-sm text-slate-500 mt-1">Carilerinize e-mutabakat formları gönderin ve cevaplarını otomatik takip edin.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border p-1 rounded-xl shadow-sm">
          <TabsTrigger value="liste" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Aktif Mutabakatlar</TabsTrigger>
          <TabsTrigger value="gonder" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Mutabakat Gönder</TabsTrigger>
          <TabsTrigger value="sablon" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Şablonlar</TabsTrigger>
          <TabsTrigger value="ayarlar" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Ayarlar</TabsTrigger>
        </TabsList>

        <TabsContent value="liste" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Gönderilen Mutabakatlar</CardTitle>
              <Button variant="outline" size="sm" onClick={fetchMutabakatlar} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : null}
                Yenile
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Tarih & Dönem</TableHead>
                    <TableHead>Cari (Muhatap)</TableHead>
                    <TableHead>E-Posta</TableHead>
                    <TableHead className="text-right">Bakiye Bildirimi</TableHead>
                    <TableHead className="text-right">Durum</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mutabakatlar.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-slate-500">Gönderilmiş bir mutabakat bulunmuyor.</TableCell>
                    </TableRow>
                  ) : mutabakatlar.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">{new Date(m.gonderim_tarihi).toLocaleDateString('tr-TR')}</div>
                        <div className="text-xs text-slate-500">Dönem: {m.donem}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-800">{m.cariUnvan}</div>
                        <div className="text-xs text-slate-400">VKN: {m.cariVkn || '-'}</div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{m.cariEposta}</TableCell>
                      <TableCell className="text-right font-medium text-slate-800">
                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(m.bakiye)}
                      </TableCell>
                      <TableCell className="text-right">
                        {getDurumBadge(m.durum)}
                        {m.yanit_tarihi && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(m.yanit_tarihi).toLocaleDateString('tr-TR')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {m.durum === 'Onaysız' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            disabled={isAnalyzing === m.id}
                            onClick={() => handleAIAnalyze(m.id, m.ai_analiz_sonucu)}
                            className="text-xs h-7 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                          >
                            {isAnalyzing === m.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3 mr-1"/>}
                            {m.ai_analiz_sonucu ? 'Analizi Gör' : 'AI Analiz'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ayarlar">
           <Card className="border-0 shadow-sm max-w-2xl mx-auto">
             <CardHeader className="border-b">
               <CardTitle className="flex items-center gap-2">
                 <Sparkles className="w-5 h-5 text-indigo-600" />
                 Yapay Zeka Ayarları
               </CardTitle>
               <CardDescription>
                 Muavin karşılaştırma ve uyuşmazlık analizi için Google Gemini API anahtarınızı tanımlayın.
               </CardDescription>
             </CardHeader>
             <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Gemini API Key</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="password" 
                      placeholder="AIzaSy..." 
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="font-mono"
                    />
                    <Button 
                      onClick={handleSaveGeminiKey} 
                      disabled={isSavingKey}
                    >
                      {isSavingKey ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Kaydet'}
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    API anahtarınızı <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-600 hover:underline font-medium">Google AI Studio</a> üzerinden ücretsiz olarak alabilirsiniz.
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 space-y-1">
                    <p className="font-bold">Önemli Hatırlatma:</p>
                    <p>Yapay zeka analizi, müşterileriniz reddettiğinde ve kendi muavin dosyalarını yüklediklerinde aktif olur. Basit mutabakatlarda AI kullanılmaz.</p>
                  </div>
                </div>
             </CardContent>
           </Card>
        </TabsContent>

        {/* ... (Other TabsContent stay same as previously written) */}
        <TabsContent value="gonder">
          {/* Reuse the previous logic for 'gonder' tab content */}
          <Card className="border-0 shadow-sm max-w-4xl mx-auto">
            {/* Same as before... but integrated here */}
            <CardHeader className="border-b">
              <CardTitle>Toplu Mutabakat Gönderimi</CardTitle>
              <CardDescription>
                Mizan (toplam bakiye) dosyanızı yükleyerek tüm carilere tek tuşla mutabakat e-postası yollayabilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
               <div className="grid grid-cols-2 gap-4">
                 <div onClick={() => setImportMode('basit')} className={`border rounded-xl p-4 cursor-pointer ${importMode === 'basit' ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-indigo-300'}`}>
                   <div className="flex items-center gap-3 mb-2 font-semibold text-slate-900">
                     <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${importMode === 'basit' ? 'border-indigo-600' : 'border-slate-300'}`}>
                        {importMode === 'basit' && <div className="w-2 h-2 bg-indigo-600 rounded-full"/>}
                     </div>
                     Basit Gönderim
                   </div>
                   <p className="text-xs text-slate-500 ml-7">Sadece bakiye bildirimi yapılır.</p>
                 </div>
                 <div onClick={() => setImportMode('detayli')} className={`border rounded-xl p-4 cursor-pointer ${importMode === 'detayli' ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 hover:border-primary/50'}`}>
                   <div className="flex items-center gap-3 mb-2 font-semibold text-slate-900">
                     <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${importMode === 'detayli' ? 'border-primary' : 'border-slate-300'}`}>
                        {importMode === 'detayli' && <div className="w-2 h-2 bg-primary rounded-full"/>}
                     </div>
                     Detaylı (AI Destekli)
                   </div>
                   <p className="text-xs text-slate-500 ml-7">Muavin yükleyerek uyuşmazlık analizini aktifleştirin.</p>
                 </div>
               </div>

               <div className="space-y-4 pt-4 border-t">
                 <div>
                   <Label className="text-sm font-medium mb-1.5 block">1. Mizan Dosyası (Zorunlu)</Label>
                   <Button type="button" variant="outline" onClick={() => mizanFileRef.current?.click()} className="w-full flex justify-between border-dashed border-2 px-4 h-11">
                     <span className="flex items-center"><UploadCloud className="w-4 h-4 mr-2"/> {mizanFile ? mizanFile.name : 'Mizan Seç (.xlsx)'}</span>
                     {mizanFile && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                   </Button>
                   <input type="file" ref={mizanFileRef} onChange={(e) => setMizanFile(e.target.files?.[0] || null)} accept=".xlsx,.xls" className="hidden" />
                 </div>
                 {importMode === 'detayli' && (
                   <div>
                     <Label className="text-sm font-medium mb-1.5 block text-primary">2. Kendi Muavin Dosyanız (Zorunlu)</Label>
                     <Button type="button" variant="outline" onClick={() => muavinFileRef.current?.click()} className="w-full flex justify-between border-primary/30 border-dashed border-2 px-4 h-11 bg-primary/5 text-primary">
                       <span className="flex items-center"><FileText className="w-4 h-4 mr-2"/> {muavinFile ? muavinFile.name : 'Muavin Seç (.xlsx)'}</span>
                       {muavinFile && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                     </Button>
                     <input type="file" ref={muavinFileRef} onChange={(e) => setMuavinFile(e.target.files?.[0] || null)} accept=".xlsx,.xls" className="hidden" />
                   </div>
                 )}
               </div>

               <Button onClick={processAndSendMutabakat} disabled={isLoading} className="w-full h-12 text-base font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md">
                 {isLoading ? 'Gönderiliyor...' : "Mutabakat Mail'lerini Başlat"}
               </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sablon">
           <Card className="border-0 shadow-sm max-w-4xl mx-auto">
             <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded-2xl p-6 text-center hover:bg-slate-50 cursor-pointer" onClick={handleDownloadMizanTemplate}>
                  <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><FileUp className="w-8 h-8" /></div>
                  <h3 className="font-bold mb-2">Mizan Şablonu</h3>
                  <Button variant="outline" size="sm" className="w-full mt-2">İndir</Button>
                </div>
                <div className="border rounded-2xl p-6 text-center hover:bg-slate-50 cursor-pointer" onClick={handleDownloadMuavinTemplate}>
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><FileText className="w-8 h-8" /></div>
                  <h3 className="font-bold mb-2">Muavin Şablonu</h3>
                  <Button variant="outline" size="sm" className="w-full mt-2">İndir</Button>
                </div>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* AI Analysis Dialog */}
      <Dialog open={!!selectedAnalysis} onOpenChange={(open) => !open && setSelectedAnalysis(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-600">
              <Sparkles className="w-5 h-5" />
              Yapay Zeka Mutabakat Analizi
            </DialogTitle>
            <DialogDescription>
              İki firma arasındaki muavin kayıtları karşılaştırılmış ve aşağıdaki uyumsuzluklar tespit edilmiştir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {selectedAnalysis?.uyusmazliklar?.length > 0 ? (
              <div className="rounded-xl border border-red-100 bg-red-50/30 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-red-700">Tarih</TableHead>
                      <TableHead className="text-red-700">Açıklama</TableHead>
                      <TableHead className="text-red-700 text-right">Tutar</TableHead>
                      <TableHead className="text-red-700">Uyumsuzluk Nedeni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedAnalysis.uyusmazliklar.map((u: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-medium">{u.tarih}</TableCell>
                        <TableCell className="text-xs">{u.aciklama}</TableCell>
                        <TableCell className="text-xs text-right font-bold">{u.tutar}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="bg-white text-red-600 border-red-200">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {u.sebep}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed">
                 <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                 <h4 className="font-bold text-slate-800">Kayıtlar Eşleşiyor!</h4>
                 <p className="text-sm text-slate-500">Yapay zeka satırlar arasında kritik bir fark bulamadı.</p>
              </div>
            )}

            <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100">
               <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">AI Özeti / Tavsiye</h4>
               <p className="text-sm text-indigo-900 leading-relaxed italic">
                 "{selectedAnalysis?.ozet || 'Analiz özeti hazırlanamadı.'}"
               </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setSelectedAnalysis(null)} className="w-full bg-slate-900">Anladım, Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
