import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUrunler, useDepolar } from '../hooks/useStokQuery';
import { 
  useStokGiris, 
  useStokCikis, 
  useStokTransfer 
} from '../hooks/useStokHareket';
import { Loader2, AlertCircle } from 'lucide-react';
import type { IUrun } from '../types/stok.types';

const hareketSchema = z.object({
  tip: z.enum(['GIRIS', 'CIKIS', 'TRANSFER']),
  tarih: z.string().min(1, 'Tarih zorunludur'),
  urunId: z.string().min(1, 'Ürün seçiniz'),
  depoId: z.string().min(1, 'Depo seçiniz'),
  hedefDepoId: z.string().default(''),
  miktar: z.coerce.number().min(0.01, 'Miktar 0 dan büyük olmalıdır'),
  birimFiyat: z.coerce.number().min(0, 'Birim fiyat 0 dan az olamaz'),
  referans: z.string().default(''),
  aciklama: z.string().default(''),
  lotNo: z.string().default(''),
  sonKullanmaTarihi: z.string().default(''),
});

interface HareketFormValues {
  tip: 'GIRIS' | 'CIKIS' | 'TRANSFER';
  tarih: string;
  urunId: string;
  depoId: string;
  hedefDepoId: string;
  miktar: number;
  birimFiyat: number;
  referans: string;
  aciklama: string;
  lotNo: string;
  sonKullanmaTarihi: string;
}

interface StokHareketFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'GIRIS' | 'CIKIS' | 'TRANSFER';
}

export const StokHareketForm: React.FC<StokHareketFormProps> = ({ 
  isOpen, 
  onClose, 
  initialType = 'GIRIS' 
}) => {
  const { data: urunler } = useUrunler();
  const { data: depolar } = useDepolar();
  
  const girisMut = useStokGiris();
  const cikisMut = useStokCikis();
  const transferMut = useStokTransfer();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUrun, setSelectedUrun] = useState<IUrun | null>(null);

  const form = useForm<HareketFormValues>({
    resolver: zodResolver(hareketSchema) as any,
    defaultValues: {
      tip: initialType,
      tarih: new Date().toISOString().slice(0, 16), // datetime-local format
      urunId: '',
      depoId: depolar?.find(d => d.varsayilan)?.id || '',
      hedefDepoId: '',
      miktar: 1,
      birimFiyat: 0,
      referans: '',
      aciklama: '',
    }
  });

  const currentTip = form.watch('tip');
  const currentUrunId = form.watch('urunId');

  useEffect(() => {
    if (urunler && currentUrunId) {
      setSelectedUrun(urunler.find(u => u.id === currentUrunId) || null);
    }
  }, [currentUrunId, urunler]);

  useEffect(() => {
    form.setValue('tip', initialType);
  }, [initialType, form]);

  const filteredUrunler = useMemo(() => {
    if (!urunler || searchTerm.length < 2) return [];
    const lowSearch = searchTerm.toLowerCase();
    return urunler.filter(u => 
      u.urunAdi.toLowerCase().includes(lowSearch) || 
      u.stokKodu.toLowerCase().includes(lowSearch)
    );
  }, [urunler, searchTerm]);

  const onSubmit = async (data: any) => {
    try {
      const values = data as HareketFormValues;
      const { tip, urunId, depoId, miktar, birimFiyat, tarih, ...rest } = values;
      const tutar = miktar * birimFiyat;

      if (tip === 'GIRIS') {
        await girisMut.mutateAsync({
          urunId, depoId, tip: 'GIRIS', miktar, birimFiyat, tutar, tarih: new Date(tarih).toISOString(), ...rest
        });
      } else if (tip === 'CIKIS') {
        await cikisMut.mutateAsync({
          urunId, depoId, tip: 'CIKIS', miktar, birimFiyat, tutar, tarih: new Date(tarih).toISOString(), ...rest
        });
      } else if (tip === 'TRANSFER') {
        if (!values.hedefDepoId) throw new Error('Hedef depo seçiniz.');
        if (values.hedefDepoId === depoId) throw new Error('Kaynak ve hedef depo aynı olamaz.');
        
        await transferMut.mutateAsync({
          sourceDepoId: depoId,
          targetDepoId: values.hedefDepoId,
          itemData: { urunId, miktar, birimFiyat }
        });
      }
      onClose();
      form.reset();
      setSearchTerm('');
    } catch (error: any) {
      // Errors handled by mutation's onError hooks or local try-catch
    }
  };

  const isPending = girisMut.isPending || cikisMut.isPending || transferMut.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl font-bold">
            {currentTip === 'GIRIS' && <span className="text-emerald-600">Stok Giriş Fişi</span>}
            {currentTip === 'CIKIS' && <span className="text-red-600">Stok Çıkış Fişi</span>}
            {currentTip === 'TRANSFER' && <span className="text-blue-600">Stok Transfer Fişi</span>}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Movement Type Selection (Only if not fixed by initialType) */}
          <div className="grid grid-cols-3 gap-2">
             {['GIRIS', 'CIKIS', 'TRANSFER'].map((t) => (
               <Button
                key={t}
                type="button"
                variant={currentTip === t ? 'default' : 'outline'}
                className={`rounded-xl font-bold h-9 text-xs transition-all ${
                  currentTip === t 
                  ? (t === 'GIRIS' ? 'bg-emerald-600' : t === 'CIKIS' ? 'bg-red-600' : 'bg-blue-600') 
                  : ''
                }`}
                onClick={() => form.setValue('tip', t as any)}
               >
                 {t === 'GIRIS' && 'GİRİŞ'}
                 {t === 'CIKIS' && 'ÇIKIŞ'}
                 {t === 'TRANSFER' && 'TRANSFER'}
               </Button>
             ))}
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label>Ürün Ara/Seç *</Label>
            {!selectedUrun ? (
              <div className="relative">
                <Input 
                  placeholder="Kod veya ad ile ara (min 2 karakter)..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-xl pr-10"
                />
                {filteredUrunler.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {filteredUrunler.map(u => (
                      <div 
                        key={u.id}
                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex flex-col border-b border-slate-100 last:border-0"
                        onClick={() => {
                          form.setValue('urunId', u.id);
                          setSelectedUrun(u);
                        }}
                      >
                        <span className="text-sm font-bold">{u.urunAdi}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{u.stokKodu}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">{selectedUrun.urunAdi}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{selectedUrun.stokKodu}</span>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 font-bold"
                  onClick={() => {
                    setSelectedUrun(null);
                    form.setValue('urunId', '');
                  }}
                >
                  Değiştir
                </Button>
              </div>
            )}
            {form.formState.errors.urunId && (
              <p className="text-xs text-red-500 font-medium">{form.formState.errors.urunId.message}</p>
            )}
          </div>

          {/* Source/Target Warehouse */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{currentTip === 'TRANSFER' ? 'Kaynak Depo' : 'Depo'} *</Label>
              <Select value={form.watch('depoId')} onValueChange={(val) => form.setValue('depoId', val)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Depo seçin" />
                </SelectTrigger>
                <SelectContent>
                  {depolar?.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.ad}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentTip === 'TRANSFER' && (
              <div className="space-y-2">
                <Label>Hedef Depo *</Label>
                <Select value={form.watch('hedefDepoId')} onValueChange={(val) => form.setValue('hedefDepoId', val)}>
                  <SelectTrigger className="rounded-xl border-blue-200 bg-blue-50/30">
                    <SelectValue placeholder="Hedef depo" />
                  </SelectTrigger>
                  <SelectContent>
                    {depolar?.filter(d => d.id !== form.watch('depoId')).map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.ad}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {currentTip !== 'TRANSFER' && (
              <div className="space-y-2">
                <Label>Tarih</Label>
                <Input type="datetime-local" {...form.register('tarih')} className="rounded-xl" />
              </div>
            )}
          </div>

          {/* Amount and Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Miktar ({selectedUrun?.anaBirim || 'Birim'}) *</Label>
              <Input type="number" step="0.01" {...form.register('miktar')} className="rounded-xl font-bold text-lg" />
            </div>
            
            <div className="space-y-2">
              <Label>Birim Fiyat (TL)</Label>
              <div className="relative">
                 <Input type="number" step="0.01" {...form.register('birimFiyat')} className="rounded-xl font-bold pr-8" />
                 <div className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">₺</div>
              </div>
            </div>
          </div>

          {/* Additional Info (Conditional based on product/type) */}
          {(selectedUrun?.lotTakibi || selectedUrun?.sonKullanmaTarihli) && (
             <div className="grid grid-cols-2 gap-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                {selectedUrun.lotTakibi && (
                  <div className="space-y-2">
                    <Label className="text-amber-800">Lot Numarası</Label>
                    <Input {...form.register('lotNo')} className="bg-white border-amber-200" placeholder="L-2024-..." />
                  </div>
                )}
                {selectedUrun.sonKullanmaTarihli && (
                  <div className="space-y-2">
                    <Label className="text-amber-800">S.K.T</Label>
                    <Input type="date" {...form.register('sonKullanmaTarihi')} className="bg-white border-amber-200" />
                  </div>
                )}
             </div>
          )}

          <div className="space-y-2">
            <Label>Referans (Fatura/İrsaliye No)</Label>
            <Input {...form.register('referans')} placeholder="Örn: FTP-2024-00123" className="rounded-xl" />
          </div>

          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Textarea {...form.register('aciklama')} placeholder="İşlem detayları..." className="rounded-xl resize-none h-20" />
          </div>

          {currentTip === 'CIKIS' && (
            <div className="flex gap-2 p-3 bg-red-50 rounded-xl text-red-700 text-xs font-medium">
               <AlertCircle className="w-4 h-4 shrink-0" />
               <span>Yetersiz stok durumunda işlem engellenecektir. FIFO maliyeti otomatik yansıtılır.</span>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="rounded-xl">
              Vazgeç
            </Button>
            <Button type="submit" disabled={isPending} className={`rounded-xl shadow-lg px-8 ${
               currentTip === 'GIRIS' ? 'bg-emerald-600 shadow-emerald-200' : 
               currentTip === 'CIKIS' ? 'bg-red-600 shadow-red-200' : 
               'bg-blue-600 shadow-blue-200'
            }`}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Fişi Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
