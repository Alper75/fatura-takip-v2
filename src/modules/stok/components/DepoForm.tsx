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
import { Switch } from '@/components/ui/switch';
import { useDepoMutations } from '../hooks/useStokQuery';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const depoSchema = z.object({
  kod: z.string().min(1, 'Depo kodu zorunludur'),
  ad: z.string().min(2, 'Depo adı en az 2 karakter olmalıdır'),
  adres: z.string().optional().or(z.literal('')),
  varsayilan: z.boolean().default(false),
});

type DepoFormValues = z.infer<typeof depoSchema>;

interface DepoFormProps {
  isOpen: boolean;
  onClose: () => void;
  editingDepo?: any | null;
}

export const DepoForm: React.FC<DepoFormProps> = ({ isOpen, onClose, editingDepo }) => {
  const { addDepo, updateDepo } = useDepoMutations();

  const form = useForm<DepoFormValues>({
    resolver: zodResolver(depoSchema) as Resolver<DepoFormValues>,
    defaultValues: {
      kod: '',
      ad: '',
      adres: '',
      varsayilan: false,
    },
  });

  useEffect(() => {
    if (editingDepo) {
      form.reset({
        kod: editingDepo.kod,
        ad: editingDepo.ad,
        adres: editingDepo.adres || '',
        varsayilan: !!editingDepo.varsayilan,
      });
    } else {
      form.reset({
        kod: `DEP-${Math.floor(100 + Math.random() * 900)}`,
        ad: '',
        adres: '',
        varsayilan: false,
      });
    }
  }, [editingDepo, form, isOpen]);

  const onSubmit: SubmitHandler<DepoFormValues> = async (values) => {
    try {
      if (editingDepo) {
        await updateDepo.mutateAsync({ id: editingDepo.id, data: values as any });
        toast.success('Depo başarıyla güncellendi.');
      } else {
        await addDepo.mutateAsync(values as any);
        toast.success('Yeni depo başarıyla eklendi.');
      }
      onClose();
    } catch (error: any) {
      toast.error('İşlem sırasında bir hata oluştu: ' + error.message);
    }
  };

  const isPending = addDepo.isPending || updateDepo.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editingDepo ? 'Depoyu Düzenle' : 'Yeni Depo Ekle'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="kod">Depo Kodu</Label>
            <Input id="kod" {...form.register('kod')} placeholder="DEP-001" />
            {form.formState.errors.kod && (
              <p className="text-xs text-red-500">{form.formState.errors.kod.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ad">Depo Adı *</Label>
            <Input id="ad" {...form.register('ad')} placeholder="Merkez Depo" />
            {form.formState.errors.ad && (
              <p className="text-xs text-red-500">{form.formState.errors.ad.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adres">Adres</Label>
            <Input id="adres" {...form.register('adres')} placeholder="Depo açık adresi..." />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Switch 
              id="varsayilan" 
              checked={form.watch('varsayilan')} 
              onCheckedChange={(val) => form.setValue('varsayilan', val)} 
            />
            <Label htmlFor="varsayilan">Varsayılan Depo Olarak Ayarla</Label>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingDepo ? 'Düzenlemeleri Kaydet' : 'Depoyu Kaydet'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
