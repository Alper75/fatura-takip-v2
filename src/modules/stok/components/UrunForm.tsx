import React, { useEffect } from 'react';
import { useForm, type SubmitHandler, type Resolver } from 'react-hook-form';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useKategoriler, useUrunMutations } from '../hooks/useStokQuery';
import type { IUrun, IStokKategori } from '../types/stok.types';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';

const urunSchema = z.object({
  stokKodu: z.string().min(1, 'Stok kodu zorunludur'),
  barkod: z.string().optional().or(z.literal('')),
  urunAdi: z.string().min(2, 'Ürün adı en az 2 karakter olmalıdır'),
  kategoriId: z.string().optional().nullable().or(z.literal('')),
  anaBirim: z.string().min(1, 'Birim seçiniz'),
  minimumStok: z.coerce.number().min(0, 'Minimum stok 0 veya daha fazla olmalıdır'),
  aktif: z.boolean().default(true),
  aciklama: z.string().optional().or(z.literal('')),
});

type UrunFormValues = z.infer<typeof urunSchema>;

interface UrunFormProps {
  isOpen: boolean;
  onClose: () => void;
  editingUrun?: IUrun | null;
}

export const UrunForm: React.FC<UrunFormProps> = ({ isOpen, onClose, editingUrun }) => {
  const { data: kategoriler } = useKategoriler();
  const { addUrun, updateUrun } = useUrunMutations();

  const form = useForm<UrunFormValues>({
    resolver: zodResolver(urunSchema) as Resolver<UrunFormValues>,
    defaultValues: {
      stokKodu: '',
      barkod: '',
      urunAdi: '',
      kategoriId: '',
      anaBirim: 'Adet',
      minimumStok: 0,
      aktif: true,
      aciklama: '',
    },
  });

  useEffect(() => {
    if (editingUrun) {
      form.reset({
        stokKodu: editingUrun.stokKodu,
        barkod: editingUrun.barkod || '',
        urunAdi: editingUrun.urunAdi,
        kategoriId: editingUrun.kategoriId || '',
        anaBirim: editingUrun.anaBirim,
        minimumStok: editingUrun.minimumStok,
        aktif: editingUrun.aktif,
        aciklama: editingUrun.aciklama || '',
      });
    } else {
      // Yeni ürün için otomatik kod üret
      const year = new Date().getFullYear();
      const randomId = Math.floor(1000 + Math.random() * 9000);
      form.reset({
        stokKodu: `STK-${year}-${randomId}`,
        barkod: '',
        urunAdi: '',
        kategoriId: '',
        anaBirim: 'Adet',
        minimumStok: 0,
        aktif: true,
        aciklama: '',
      });
    }
  }, [editingUrun, form, isOpen]);

  const generateBarcode = () => {
    // Basit bir EAN-13 benzeri barkod üretimi (rastgele)
    const randomBarcode = '869' + Math.random().toString().slice(2, 12);
    form.setValue('barkod', randomBarcode);
  };

  const onSubmit: SubmitHandler<UrunFormValues> = async (values) => {
    try {
      if (editingUrun) {
        await updateUrun.mutateAsync({ id: editingUrun.id, data: values as any });
        toast.success('Ürün başarıyla güncellendi.');
      } else {
        await addUrun.mutateAsync(values as any);
        toast.success('Yeni ürün başarıyla eklendi.');
      }
      onClose();
    } catch (error: any) {
      toast.error('İşlem sırasında bir hata oluştu: ' + error.message);
    }
  };

  const isPending = addUrun.isPending || updateUrun.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingUrun ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stokKodu">Stok Kodu</Label>
              <Input id="stokKodu" {...form.register('stokKodu')} placeholder="STK-2024-001" />
              {form.formState.errors.stokKodu && (
                <p className="text-xs text-red-500">{form.formState.errors.stokKodu.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="barkod">Barkod</Label>
              <div className="flex gap-2">
                <Input id="barkod" {...form.register('barkod')} placeholder="869..." />
                <Button type="button" variant="outline" size="icon" onClick={generateBarcode} title="Barkod Üret">
                   <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="urunAdi">Ürün Adı *</Label>
            <Input id="urunAdi" {...form.register('urunAdi')} placeholder="Ürün adını giriniz..." />
            {form.formState.errors.urunAdi && (
              <p className="text-xs text-red-500">{form.formState.errors.urunAdi.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select 
                value={form.watch('kategoriId') || ''} 
                onValueChange={(val) => form.setValue('kategoriId', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>
                <SelectContent>
                  {kategoriler?.map((cat: IStokKategori) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.ad}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Birim</Label>
              <Select 
                value={form.watch('anaBirim')} 
                onValueChange={(val) => form.setValue('anaBirim', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Birim seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Adet">Adet</SelectItem>
                  <SelectItem value="Kg">Kilogram (Kg)</SelectItem>
                  <SelectItem value="Lt">Litre (Lt)</SelectItem>
                  <SelectItem value="Mt">Metre (Mt)</SelectItem>
                  <SelectItem value="Koli">Koli</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minimumStok">Minimum Stok Seviyesi</Label>
              <Input type="number" id="minimumStok" {...form.register('minimumStok')} />
            </div>

            <div className="flex items-center gap-2 pt-8">
              <Switch 
                id="aktif" 
                checked={form.watch('aktif')} 
                onCheckedChange={(val) => form.setValue('aktif', val)} 
              />
              <Label htmlFor="aktif">Ürün Satışa Aktif</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aciklama">Açıklama</Label>
            <Textarea id="aciklama" {...form.register('aciklama')} placeholder="Ürün hakkında kısa notlar..." />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingUrun ? 'Düzenlemeleri Kaydet' : 'Ürünü Kaydet'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
