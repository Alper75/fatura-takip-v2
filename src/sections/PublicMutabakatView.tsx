import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, UploadCloud, Loader2, Building2, Calendar, AlertCircle, FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

interface PublicMutabakatViewProps {
  token: string;
}

export function PublicMutabakatView({ token }: PublicMutabakatViewProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responseMode, setResponseMode] = useState<'none' | 'mutabik' | 'onaysiz'>('none');
  const [aciklama, setAciklama] = useState('');
  const [muavinBase64, setMuavinBase64] = useState<string | null>(null);
  const [muavinFileName, setMuavinFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const res = await apiFetch(`/api/public/mutabakat/${token}`);
      if (res.success) {
        setData(res.data);
      } else {
        toast.error(res.message);
      }
      setIsLoading(false);
    };
    fetchData();
  }, [token]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMuavinFileName(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setMuavinBase64(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (durum: 'Mutabık' | 'Onaysız') => {
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/public/mutabakat/${token}/respond`, {
        method: 'POST',
        body: JSON.stringify({
          durum,
          aciklama,
          muavinBase64
        })
      });

      if (res.success) {
        toast.success(durum === 'Mutabık' ? 'Mutabakat onaylandı.' : 'Mutabık olunmadığı bilgisi iletildi.');
        // Refresh data to show final state
        const refresh = await apiFetch(`/api/public/mutabakat/${token}`);
        if (refresh.success) setData(refresh.data);
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error('Bağlantı hatası: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg border-0 text-center p-8">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Geçersiz Link</h2>
          <p className="text-slate-500 mt-2">Bu mutabakat formu bulunamadı veya süresi dolmuş olabilir.</p>
        </Card>
      </div>
    );
  }

  const isCompleted = data.durum !== 'Bekliyor';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 py-8">
      {/* Şirket Logosu / Başlık */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <FileSignature className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{data.company_name}</h1>
        <p className="text-slate-500 text-sm mt-1">Mutabakat Formu</p>
      </div>

      <Card className="max-w-2xl w-full shadow-2xl border-0 overflow-hidden bg-white">
        <div className="h-2 bg-indigo-600 w-full" />
        
        <CardHeader className="bg-slate-50/50 border-b p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl text-slate-900">Cari Hesap Mutabakatı</CardTitle>
              <CardDescription className="text-indigo-600 font-medium">Dönem: {data.donem}</CardDescription>
            </div>
            {isCompleted && (
              <Badge className={data.durum === 'Mutabık' ? 'bg-emerald-100 text-emerald-700 py-1.5 px-3' : 'bg-red-100 text-red-700 py-1.5 px-3'}>
                {data.durum === 'Mutabık' ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                {data.durum}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-8">
          {/* Müşteri Bilgileri */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-slate-400 mt-1" />
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Gönderen Şirket</label>
                  <p className="font-semibold text-slate-800 leading-tight">{data.company_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">VKN: {data.company_vkn || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-slate-400 mt-1" />
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mutabakat Tarihi</label>
                  <p className="font-medium text-slate-700">{new Date(data.gonderim_tarihi).toLocaleDateString('tr-TR')}</p>
                </div>
              </div>
            </div>
            <div className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-100">
               <label className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Muhatap Firma (Siz)</label>
               <p className="font-bold text-indigo-900 mt-1">{data.unvan}</p>
               <p className="text-xs text-indigo-600 mt-1">Hesap No: {data.muhasebe_kodu || '-'}</p>
            </div>
          </div>

          {/* Bakiye Özeti */}
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
             <h3 className="text-sm font-semibold opacity-60 mb-1">Bakiye Bildirimi ({data.donem})</h3>
             <div className="text-3xl md:text-4xl font-bold">
               {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(data.bakiye)}
             </div>
             <p className="text-xs mt-3 opacity-60 italic text-slate-300">
               * Yukarıdaki tutar bizim kayıtlarımıza göre olan bakiyenizdir.
             </p>
          </div>

          {isCompleted ? (
            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 text-center">
               <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
                 {data.durum === 'Mutabık' ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <XCircle className="w-6 h-6 text-red-500" />}
               </div>
               <h4 className="font-bold text-slate-900">Yanıt İletildi</h4>
               <p className="text-sm text-slate-600 mt-1">Bu mutabakat formu için yanıtınız başarıyla sisteme kaydedilmiştir.</p>
               {data.yanit_tarihi && (
                 <p className="text-[10px] text-slate-400 mt-4 italic">Cevap Zamanı: {new Date(data.yanit_tarihi).toLocaleString('tr-TR')}</p>
               )}
            </div>
          ) : (
            <div className="space-y-6">
              {responseMode === 'none' ? (
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    onClick={() => setResponseMode('mutabik')} 
                    className="h-16 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200"
                  >
                    Mutabıkız
                  </Button>
                  <Button 
                    onClick={() => setResponseMode('onaysiz')} 
                    variant="outline" 
                    className="h-16 text-lg font-bold border-red-200 text-red-700 hover:bg-red-50"
                  >
                    Mutabık Değiliz
                  </Button>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-500">
                   <div className="flex items-center gap-3">
                     <Button variant="ghost" size="sm" onClick={() => setResponseMode('none')} className="text-slate-400 text-xs">Vazgeç</Button>
                     <p className="text-sm font-semibold text-slate-900">
                       {responseMode === 'mutabik' ? 'Onay İncelemesi' : 'Uyuşmazlık Bildirimi'}
                     </p>
                   </div>
                   
                   <div className="space-y-4">
                     <div className="space-y-2">
                       <Label className="text-sm font-medium">Açıklama (Opsiyonel)</Label>
                       <Textarea 
                          placeholder={responseMode === 'mutabik' ? 'Varsa eklemek istediğiniz not...' : 'Lütfen uyuşmazlığın nedenini belirtiniz (Tutar farkı, kayıp fatura vb.)...'} 
                          value={aciklama}
                          onChange={(e) => setAciklama(e.target.value)}
                       />
                     </div>
                     
                     {responseMode === 'onaysiz' && (
                       <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
                          <Label className="text-sm font-semibold mb-2 block">Kendi Muavin Dosyanız (.xlsx)</Label>
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white border rounded-lg p-4 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all"
                          >
                             <UploadCloud className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                             <p className="text-xs font-medium text-slate-600">{muavinFileName || 'Dosya seçin veya sürükleyin'}</p>
                             <p className="text-[10px] text-slate-400 mt-1">Yapay zeka ile karşılaştırma yapabilmemiz için dosyayı yüklemeniz önerilir.</p>
                             <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls" className="hidden" />
                          </div>
                       </div>
                     )}

                     <Button 
                        onClick={() => handleSubmit(responseMode === 'mutabik' ? 'Mutabık' : 'Onaysız')} 
                        disabled={isSubmitting}
                        className={`w-full h-12 text-base font-bold ${responseMode === 'mutabik' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                     >
                       {isSubmitting ? 'Gönderiliyor...' : 'Yanıtı Kesinleştir ve Gönder'}
                     </Button>
                   </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="bg-slate-50 p-4 border-t flex justify-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex items-center gap-2">
              <Building2 className="w-3 h-3" /> Güvenli Mutabakat Altyapısı
            </p>
        </CardFooter>
      </Card>

      <p className="text-slate-400 text-xs mt-12">© 2024 Mutabakat Yönetim Sistemi</p>
    </div>
  );
}
