import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useApp } from '@/context/AppContext';
import { useUrunler } from '@/modules/stok/hooks/useStokQuery';
import { Plus, Trash2, Calculator, Save, Search, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TeklifDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
}

export function TeklifDrawer({ isOpen, onClose, initialData }: TeklifDrawerProps) {
  const { cariler, addTeklif, updateTeklif } = useApp();
  const { data: urunlerRs } = useUrunler();
  const urunler = Array.isArray(urunlerRs) ? urunlerRs : [];

  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [vadeTarihi, setVadeTarihi] = useState('');
  const [selectedCariId, setSelectedCariId] = useState<string>('manual');
  
  // Manuel Müşteri Bilgileri
  const [musteriAdi, setMusteriAdi] = useState('');
  const [musteriVkn, setMusteriVkn] = useState('');
  const [musteriAdres, setMusteriAdres] = useState('');
  const [musteriEposta, setMusteriEposta] = useState('');
  
  const [notlar, setNotlar] = useState('');
  const [kalemler, setKalemler] = useState<any[]>([
    { urun_id: '', urun_adi: '', miktar: 1, birim: 'Adet', birim_fiyat: 0, iskonto_orani: 0, iskonto_tutari: 0, kdv_orani: 20, toplam_tutar: 0 }
  ]);
  
  // Stok Geçmişi State'leri
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any>(null);
  const [historyUrunAd, setHistoryUrunAd] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTarih(initialData.tarih);
      setVadeTarihi(initialData.vade_tarihi || '');
      setSelectedCariId(initialData.cari_id ? String(initialData.cari_id) : 'manual');
      setMusteriAdi(initialData.musteri_adi || '');
      setMusteriVkn(initialData.musteri_vkn || '');
      setMusteriAdres(initialData.musteri_adres || '');
      setMusteriEposta(initialData.musteri_eposta || '');
      setNotlar(initialData.notlar || '');
      setKalemler(initialData.kalemler || []);
    } else {
      resetForm();
    }
  }, [initialData, isOpen]);

  const resetForm = () => {
    setTarih(new Date().toISOString().split('T')[0]);
    setVadeTarihi('');
    setSelectedCariId('manual');
    setMusteriAdi('');
    setMusteriVkn('');
    setMusteriAdres('');
    setMusteriEposta('');
    setNotlar('');
    setKalemler([{ urun_id: '', urun_adi: '', miktar: 1, birim: 'Adet', birim_fiyat: 0, iskonto_orani: 0, iskonto_tutari: 0, kdv_orani: 20, toplam_tutar: 0 }]);
  };

  const handleCariChange = (val: string) => {
    setSelectedCariId(val);
    if (val !== 'manual') {
      const cari = cariler.find(c => String(c.id) === val);
      if (cari) {
        setMusteriAdi(cari.unvan);
        setMusteriVkn(cari.vknTckn);
        setMusteriAdres(cari.adres || '');
        setMusteriEposta(cari.eposta || '');
      }
    }
  };

  const handleUrunChange = (index: number, urunId: string) => {
    const urun = urunler.find((u: any) => String(u.id) === urunId);
    if (!urun) return;

    const newKalemler = [...kalemler];
    newKalemler[index] = {
      ...newKalemler[index],
      urun_id: urun.id,
      urun_adi: urun.urunAdi,
      birim: urun.anaBirim || 'Adet',
      birim_fiyat: Number(urun.birimFiyat) || 0,
    };
    calculateRowTotal(newKalemler, index);
  };

  const openStockHistory = async (urunId: string, urunAdi: string) => {
    if (!urunId) return toast.info('Geçmişi sorgulamak için önce ürün seçmelisiniz.');
    setHistoryUrunAd(urunAdi);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
       const res = await apiFetch(`/api/stok/${urunId}/history`);
       if (res.success) {
           setHistoryData(res);
       } else {
           toast.error(res.message);
       }
    } catch (e: any) {
       toast.error('Stok sorgulanırken bir hata oluştu.');
    }
    setHistoryLoading(false);
  };

  const calculateRowTotal = (rows: any[], index: number) => {
    const row = rows[index];
    const matrahAra = (Number(row.miktar) || 0) * (Number(row.birim_fiyat) || 0);
    const iskontoOrani = Number(row.iskonto_orani) || 0;
    const iskontoTutari = matrahAra * (iskontoOrani / 100);
    row.iskonto_tutari = Number(iskontoTutari.toFixed(2));
    
    const matrah = matrahAra - iskontoTutari;
    const kdv = matrah * (Number(row.kdv_orani) / 100);
    row.toplam_tutar = Number((matrah + kdv).toFixed(2));
    setKalemler(rows);
  };

  const addRow = () => {
    setKalemler([...kalemler, { urun_id: '', urun_adi: '', miktar: 1, birim: 'Adet', birim_fiyat: 0, iskonto_orani: 0, iskonto_tutari: 0, kdv_orani: 20, toplam_tutar: 0 }]);
  };

  const removeRow = (index: number) => {
    if (kalemler.length === 1) return;
    setKalemler(kalemler.filter((_, i) => i !== index));
  };

  const updateRowField = (index: number, field: string, value: any) => {
    const newKalemler = [...kalemler];
    newKalemler[index][field] = value;
    calculateRowTotal(newKalemler, index);
  };

  const calculateSubtotal = () => {
    return kalemler.reduce((sum, k) => sum + (Number(k.miktar) * Number(k.birim_fiyat)), 0);
  };

  const calculateTotalIskonto = () => {
    return kalemler.reduce((sum, k) => sum + (Number(k.iskonto_tutari) || 0), 0);
  };

  const calculateTotalKdv = () => {
    return kalemler.reduce((sum, k) => {
      const matrahAra = (Number(k.miktar) * Number(k.birim_fiyat));
      const indirimliMatrah = matrahAra - (Number(k.iskonto_tutari) || 0);
      return sum + (indirimliMatrah * (Number(k.kdv_orani) / 100));
    }, 0);
  };

  const calculateGrandTotal = () => {
    return calculateSubtotal() - calculateTotalIskonto() + calculateTotalKdv();
  };

  const handleSave = async () => {
    if (!musteriAdi) return toast.error("Müşteri adı gereklidir.");
    if (kalemler.some(k => !k.urun_adi)) return toast.error("Tüm ürün alanlarını doldurun.");

    const data = {
      tarih,
      vade_tarihi: vadeTarihi,
      cari_id: selectedCariId === 'manual' ? null : selectedCariId,
      musteri_adi: musteriAdi,
      musteri_vkn: musteriVkn,
      musteri_adres: musteriAdres,
      musteri_eposta: musteriEposta,
      notlar,
      kalemler
    };

    let res;
    if (initialData?.id) {
      res = await updateTeklif(initialData.id, data);
    } else {
      res = await addTeklif(data);
    }

    if (res.success) {
      onClose();
      resetForm();
    }
  };

  return (
    <>
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-4xl overflow-y-auto bg-slate-50/95 backdrop-blur-md">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-primary" />
            {initialData ? 'Teklifi Düzenle' : 'Yeni Teklif Hazırla'}
          </SheetTitle>
          <SheetDescription>
            Teklif bilgilerini ve ürün detaylarını aşağıdan girebilirsiniz.
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="p-4 border-none shadow-sm bg-white">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Genel Bilgiler</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Teklif Tarihi</Label>
                  <Input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Geçerlilik (Vade)</Label>
                  <Input type="date" value={vadeTarihi} onChange={(e) => setVadeTarihi(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Müşteri Seçimi</Label>
                <Select value={selectedCariId} onValueChange={handleCariChange}>
                  <SelectTrigger className="bg-slate-50 border-slate-100">
                    <SelectValue placeholder="Müşteri seçin veya manuel girin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manuel Giriş</SelectItem>
                    {cariler.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.unvan}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-none shadow-sm bg-white">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Müşteri Detayları</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Ünvan / Ad Soyad</Label>
                  <Input value={musteriAdi} onChange={(e) => setMusteriAdi(e.target.value)} placeholder="Müşteri Ünvanı" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">VKN / TCKN</Label>
                  <Input value={musteriVkn} onChange={(e) => setMusteriVkn(e.target.value)} placeholder="Vergi No" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Adres</Label>
                <Input value={musteriAdres} onChange={(e) => setMusteriAdres(e.target.value)} placeholder="Açık Adres" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">E-Posta</Label>
                <Input value={musteriEposta} onChange={(e) => setMusteriEposta(e.target.value)} placeholder="mail@musteri.com" />
              </div>
            </div>
          </Card>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">Teklif Kalemleri</h3>
            <Button variant="outline" size="sm" onClick={addRow} className="gap-2 text-primary border-primary/20 hover:bg-primary/5">
              <Plus className="w-4 h-4" /> Satır Ekle
            </Button>
          </div>

          <div className="space-y-3">
            {kalemler.map((kalem, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-white p-3 rounded-xl shadow-sm border border-slate-100 group animate-in slide-in-from-right-4 duration-300">
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-[10px] text-slate-400">Ürün / Hizmet Seçimi</Label>
                  <Select 
                    value={String(kalem.urun_id || '')} 
                    onValueChange={(val) => handleUrunChange(idx, val)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Ürün seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                      {urunler.map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.urunAdi}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-[10px] text-slate-400">Miktar</Label>
                  <Input 
                    type="number" 
                    className="h-9" 
                    value={kalem.miktar} 
                    onChange={(e) => updateRowField(idx, 'miktar', e.target.value)} 
                  />
                </div>
                <div className="col-span-2 space-y-1.5 flex flex-col">
                  <Label className="text-[10px] text-slate-400">Birim Fiyat / Geçmiş</Label>
                  <div className="flex items-center gap-1">
                    <Input 
                      type="number" 
                      className="h-9 flex-1" 
                      value={kalem.birim_fiyat} 
                      onChange={(e) => updateRowField(idx, 'birim_fiyat', e.target.value)} 
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openStockHistory(kalem.urun_id, kalem.urun_adi)} 
                      className="h-9 w-9 p-0 bg-slate-50 border-input text-primary hover:bg-primary/10 transition-colors shrink-0"
                      title="Geçmiş Fiyat ve Stok Sorgula"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="col-span-1 space-y-1.5">
                  <Label className="text-[10px] text-slate-400">İskonto %</Label>
                  <Input 
                    type="number" 
                    className="h-9 px-2" 
                    value={kalem.iskonto_orani} 
                    onChange={(e) => updateRowField(idx, 'iskonto_orani', e.target.value)} 
                    max="100"
                    min="0"
                  />
                </div>
                <div className="col-span-1 space-y-1.5">
                  <Label className="text-[10px] text-slate-400">KDV %</Label>
                  <Select 
                    value={String(kalem.kdv_orani)} 
                    onValueChange={(val) => updateRowField(idx, 'kdv_orani', val)}
                  >
                    <SelectTrigger className="h-9 px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="0">0</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5 text-right px-2">
                  <Label className="text-[10px] text-slate-400">Toplam</Label>
                  <div className="flex flex-col items-end">
                    {Number(kalem.iskonto_tutari) > 0 && (
                       <span className="text-[9px] text-red-400 line-through">
                         {new Intl.NumberFormat('tr-TR').format(Number(kalem.miktar) * Number(kalem.birim_fiyat))} ₺
                       </span>
                    )}
                    <div className="h-9 flex items-center justify-end font-bold text-slate-700">
                      {new Intl.NumberFormat('tr-TR').format(kalem.toplam_tutar)} ₺
                    </div>
                  </div>
                </div>
                <div className="col-span-1 flex justify-center pb-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeRow(idx)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 items-start mb-8">
          <div className="space-y-4">
             <Label className="text-sm font-semibold text-slate-700">Teklif Notları (Müşteriye özel mesaj vb.)</Label>
             <textarea 
               className="w-full min-h-[100px] p-3 rounded-xl border border-slate-100 bg-white shadow-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
               value={notlar}
               onChange={(e) => setNotlar(e.target.value)}
               placeholder="Teklif şartları, ödeme bilgileri veya özel mesajınız..."
             />
          </div>
          <Card className="p-6 border-none shadow-xl bg-slate-900 text-white">
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Ara Toplam</span>
                <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between text-sm text-red-400">
                <span>Toplam İskonto</span>
                <span>- {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(calculateTotalIskonto())}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-400">
                <span>Toplam KDV</span>
                <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(calculateTotalKdv())}</span>
              </div>
              <div className="h-px bg-slate-800 my-2" />
              <div className="flex justify-between text-xl font-bold text-white">
                <span>Genel Toplam</span>
                <span className="text-primary-foreground bg-primary px-3 py-1 rounded-lg">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(calculateGrandTotal())}
                </span>
              </div>
            </div>
          </Card>
        </div>

        <SheetFooter className="mt-8 border-t pt-6 gap-3">
          <Button variant="outline" onClick={onClose} className="px-8 border-slate-200 text-slate-500">Vazgeç</Button>
          <Button onClick={handleSave} className="px-10 gap-2 shadow-lg shadow-primary/25">
            <Save className="w-4 h-4" /> Teklifi Kaydet ve Oluştur
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
    
    <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
             <Clock className="w-5 h-5 text-primary" />
             Stok ve Giriş Sorgusu
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
           <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-sm font-medium text-slate-700">
             Ürün: <span className="font-bold text-slate-900">{historyUrunAd}</span>
           </div>
           
           {historyLoading ? (
             <div className="py-8 text-center text-slate-400 text-sm animate-pulse">
               Önceki girişler ve stok kalan bakiyesi hesaplanıyor...
             </div>
           ) : historyData ? (
             <>
               <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                 {historyData.history?.length === 0 ? (
                   <p className="text-sm text-slate-500 text-center py-4">Bu ürünle ilgili geçmiş bir stok giriş kaydı bulunamadı.</p>
                 ) : (
                   historyData.history?.map((h: any, i: number) => (
                     <div key={i} className="flex justify-between items-center p-3 text-sm bg-white border border-slate-200 rounded-lg shadow-sm hover:border-slate-300 transition-colors">
                        <div>
                          <p className="font-medium text-slate-800">
                            {new Date(h.tarih).toLocaleDateString('tr-TR')}
                          </p>
                          <p className="text-xs text-slate-500">Miktar: {h.miktar}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">
                             {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(h.birim_fiyat)}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">{h.tip}</p>
                        </div>
                     </div>
                   ))
                 )}
               </div>
               
               <div className="mt-4 pt-3 border-t border-slate-200">
                 <div className="flex justify-between items-center bg-primary/5 p-4 rounded-xl border border-primary/10">
                   <span className="font-medium text-primary">Güncel Kalan Toplam Stok:</span>
                   <span className="text-xl font-black text-slate-900">{historyData.kalan_stok}</span>
                 </div>
               </div>
             </>
           ) : null}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
