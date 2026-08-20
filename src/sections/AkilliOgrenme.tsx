import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { Loader2, BrainCircuit, UploadCloud, Trash2, Check, X, FileSpreadsheet } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function AkilliOgrenme() {
  const [muavinFile, setMuavinFile] = useState<File | null>(null);
  const [digerFile, setDigerFile] = useState<File | null>(null);
  const [kuralTipi, setKuralTipi] = useState<'fatura' | 'banka'>('fatura');
  
  const [loading, setLoading] = useState(false);
  const [generatedRules, setGeneratedRules] = useState<any[]>([]);
  const [savedRules, setSavedRules] = useState<any[]>([]);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/yapay-zeka-kurallari', {
        headers: { Authorization: \`Bearer \${token}\` }
      });
      const data = await res.json();
      if (data.success) {
        setSavedRules(data.kurallar);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleLearn = async () => {
    if (!muavinFile || !digerFile) {
      toast.error('Lütfen hem Muavin Defter hem de Dış Veri (Fatura/Banka) dosyalarını yükleyin.');
      return;
    }

    setLoading(true);
    setGeneratedRules([]);
    const token = localStorage.getItem('token');
    try {
      const muavinBase64 = await fileToBase64(muavinFile);
      const faturalarBase64 = await fileToBase64(digerFile);

      const response = await fetch('/api/ai/learn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({
          kuralTipi,
          muavinFileName: muavinFile.name,
          muavinBase64,
          faturalarFileName: digerFile.name,
          faturalarBase64
        })
      });

      const data = await response.json();
      if (data.success) {
        setGeneratedRules(data.rules || []);
        if (data.rules && data.rules.length > 0) {
          toast.success(\`\${data.rules.length} kural çıkarıldı!\`);
        } else {
          toast('Öğrenilecek kural bulunamadı veya veriler eşleşmedi.', { icon: 'ℹ️' });
        }
      } else {
        toast.error(data.message || 'Yapay zeka analiz hatası.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (rule: any, index: number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/yapay-zeka-kurallari', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({
          kural_tipi: kuralTipi,
          kural_adi: rule.kural_adi || \`\${kuralTipi.toUpperCase()} Kuralı\`,
          anahtar_kelime: rule.anahtar_kelime,
          muhasebe_kodu: rule.muhasebe_kodu
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Kural kaydedildi');
        setGeneratedRules(prev => prev.filter((_, i) => i !== index));
        fetchRules();
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      toast.error('Hata oluştu');
    }
  };

  const handleDeleteRule = async (id: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(\`/api/yapay-zeka-kurallari/\${id}\`, {
        method: 'DELETE',
        headers: { Authorization: \`Bearer \${token}\` }
      });
      if (res.ok) {
        toast.success('Kural silindi');
        fetchRules();
      }
    } catch (e) {
      toast.error('Hata oluştu');
    }
  };

  const handleSaveAllRules = async () => {
    for (let i = 0; i < generatedRules.length; i++) {
      await handleSaveRule(generatedRules[i], i);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Yapay Zeka & Akıllı Öğrenme
          </h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Geçmiş verilerinizi yükleyerek yapay zekanın muhasebe kurallarını öğrenmesini sağlayın.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-indigo-100 shadow-md">
            <CardHeader className="bg-indigo-50/50 pb-4 border-b border-indigo-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-indigo-600" />
                Öğrenme Modeli
              </CardTitle>
              <CardDescription>
                Hangi alan için kural çıkarmak istediğinizi seçin ve referans dosyaları yükleyin.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Öğrenme Hedefi (Kural Tipi)</Label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button 
                    className={\`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all \${kuralTipi === 'fatura' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}\`}
                    onClick={() => setKuralTipi('fatura')}
                  >
                    Faturalar (Alış/Satış)
                  </button>
                  <button 
                    className={\`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all \${kuralTipi === 'banka' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}\`}
                    onClick={() => setKuralTipi('banka')}
                  >
                    Banka Ekstreleri
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 transition-colors bg-slate-50 relative">
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setMuavinFile(e.target.files?.[0] || null)} />
                  <div className="flex flex-col items-center justify-center text-center gap-2">
                    <FileSpreadsheet className="h-8 w-8 text-slate-400" />
                    <div>
                      <p className="font-medium text-sm text-slate-700">Geçmiş Muavin Defteri</p>
                      <p className="text-xs text-slate-500">{muavinFile ? muavinFile.name : 'Excel dosyası yükle (.xlsx)'}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 transition-colors bg-slate-50 relative">
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setDigerFile(e.target.files?.[0] || null)} />
                  <div className="flex flex-col items-center justify-center text-center gap-2">
                    <UploadCloud className="h-8 w-8 text-slate-400" />
                    <div>
                      <p className="font-medium text-sm text-slate-700">{kuralTipi === 'fatura' ? 'Geçmiş Faturalar' : 'Banka Ekstresi'}</p>
                      <p className="text-xs text-slate-500">{digerFile ? digerFile.name : (kuralTipi === 'fatura' ? 'XML veya Excel yükle' : 'Excel dosyası yükle (.xlsx)')}</p>
                    </div>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleLearn} 
                disabled={loading || !muavinFile || !digerFile} 
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md transition-all group"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />}
                {loading ? 'Yapay Zeka Analiz Ediyor...' : 'Verilerden Öğren'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          
          {generatedRules.length > 0 && (
            <Card className="border-emerald-100 shadow-md bg-emerald-50/20">
              <CardHeader className="pb-3 border-b border-emerald-100/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-emerald-800">Öğrenilen Yeni Kurallar</CardTitle>
                  <CardDescription>Yapay zeka verilerinizi analiz etti ve aşağıdaki örüntüleri (kuralları) çıkardı. Onayladıklarınız kaydedilir.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveAllRules} className="bg-emerald-600 hover:bg-emerald-700">Tümünü Onayla</Button>
              </CardHeader>
              <CardContent className="pt-4 p-0">
                <div className="divide-y divide-emerald-100">
                  {generatedRules.map((rule, idx) => (
                    <div key={idx} className="p-4 flex items-center justify-between hover:bg-white transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-slate-800">{rule.anahtar_kelime}</span>
                          <span className="text-slate-400 text-sm">içeriyorsa ➔</span>
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                            {rule.muhasebe_kodu}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">{rule.kural_adi}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => handleSaveRule(rule, idx)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-rose-500 hover:bg-rose-50" onClick={() => setGeneratedRules(prev => prev.filter((_, i) => i !== idx))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">Kayıtlı Kurallar (Hafıza)</CardTitle>
              <CardDescription>Sistem bu kuralları kullanarak eşleşen kayıtların hesap kodunu otomatik doldurur.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {savedRules.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <BrainCircuit className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                  <p>Henüz kayıtlı bir kural bulunmuyor.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {savedRules.map((rule) => (
                    <div key={rule.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className={\`text-xs \${rule.kural_tipi === 'fatura' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}\`}>
                            {rule.kural_tipi.toUpperCase()}
                          </Badge>
                          <span className="font-semibold text-slate-800">{rule.anahtar_kelime}</span>
                          <span className="text-slate-400 text-sm">➔</span>
                          <span className="font-mono text-sm font-semibold text-indigo-700">{rule.muhasebe_kodu}</span>
                        </div>
                        <p className="text-xs text-slate-500">{rule.kural_adi}</p>
                      </div>
                      <Button size="icon" variant="ghost" className="text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteRule(rule.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
