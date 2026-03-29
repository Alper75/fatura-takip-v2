import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { Save, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import type { CekSenetFormData } from '@/types';

export function CekSenetDrawer() {
  const { isCekSenetDrawerOpen, closeCekSenetDrawer, selectedCekSenetId, cekSenetler, addCekSenet, updateCekSenet, cariler } = useApp();

  const [formData, setFormData] = useState<CekSenetFormData>({
    tip: 'cek',
    islemTipi: 'alinan',
    cariId: '',
    belgeNo: '',
    tutar: 0,
    vadeTarihi: '',
    verilisTarihi: new Date().toISOString().split('T')[0],
    durum: 'bekliyor',
    aciklama: ''
  });

  const [tutarGov, setTutarGov] = useState('');

  useEffect(() => {
    if (isCekSenetDrawerOpen) {
      if (selectedCekSenetId) {
        const existing = cekSenetler.find(c => c.id === selectedCekSenetId);
        if (existing) {
           setFormData({
             tip: existing.tip,
             islemTipi: existing.islemTipi,
             cariId: existing.cariId,
             belgeNo: existing.belgeNo,
             tutar: existing.tutar,
             vadeTarihi: existing.vadeTarihi,
             verilisTarihi: existing.verilisTarihi,
             durum: existing.durum,
             aciklama: existing.aciklama || ''
           });
           setTutarGov(existing.tutar.toString());
        }
      } else {
        setFormData({
            tip: 'cek',
            islemTipi: 'alinan',
            cariId: '',
            belgeNo: '',
            tutar: 0,
            vadeTarihi: '',
            verilisTarihi: new Date().toISOString().split('T')[0],
            durum: 'bekliyor',
            aciklama: ''
        });
        setTutarGov('');
      }
    }
  }, [isCekSenetDrawerOpen, selectedCekSenetId, cekSenetler]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cariId) { toast.error('Cari seçimi zorunludur.'); return; }
    if (!formData.belgeNo) { toast.error('Belge numarası zorunludur.'); return; }
    if (!formData.vadeTarihi) { toast.error('Vade tarihi zorunludur.'); return; }
    const t = parseFloat(tutarGov);
    if (!t || t <= 0) { toast.error('Geçerli bir tutar giriniz.'); return; }

    const finalData = { ...formData, tutar: t };
    if (selectedCekSenetId) {
      updateCekSenet(selectedCekSenetId, finalData);
      toast.success('Belge başarıyla güncellendi.');
    } else {
      addCekSenet(finalData);
      toast.success('Yeni belge kaydedildi.');
    }
    closeCekSenetDrawer();
  };

  return (
    <Sheet open={isCekSenetDrawerOpen} onOpenChange={closeCekSenetDrawer}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" side="right">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <WalletCards className="w-5 h-5 text-primary" />
            {selectedCekSenetId ? 'Çek/Senet Düzenle' : 'Yeni Çek/Senet Ekle'}
          </SheetTitle>
          <SheetDescription>Kasa ve bankaya yansımamış ileri vadeli belgelerinizi takip edin.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="py-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Belge Tipi</Label>
              <Select value={formData.tip} onValueChange={(v: 'cek' | 'senet') => setFormData({ ...formData, tip: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cek">Çek</SelectItem>
                  <SelectItem value="senet">Senet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>İşlem Yönü</Label>
              <Select value={formData.islemTipi} onValueChange={(v: 'alinan' | 'verilen') => setFormData({ ...formData, islemTipi: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alinan">Alınan (Tahsilat)</SelectItem>
                  <SelectItem value="verilen">Verilen (Ödeme)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>İlgili Cari (Müşteri/Tedarikçi)</Label>
            <Select value={String(formData.cariId ?? '')} onValueChange={(v) => setFormData({ ...formData, cariId: v })}>
              <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
              <SelectContent>
                {(cariler || []).filter(c => c && c.id !== undefined && c.id !== null && String(c.id).trim() !== '').map((c, idx) => (
                  <SelectItem key={c.id !== undefined && c.id !== null ? String(c.id) : `cari-${idx}`} value={String(c.id ?? '')}>{String(c.unvan ?? 'Bilinmiyor')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Belge No</Label>
              <Input value={formData.belgeNo} onChange={e => setFormData({ ...formData, belgeNo: e.target.value })} placeholder="örn: CEK-001" />
            </div>
            <div className="space-y-2">
              <Label>Tutar</Label>
              <Input type="number" step="0.01" min="0" value={tutarGov} onChange={e => setTutarGov(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Veriliş / Kayıt Tarihi</Label>
              <Input type="date" value={formData.verilisTarihi} onChange={e => setFormData({ ...formData, verilisTarihi: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Vade Tarihi</Label>
              <Input type="date" value={formData.vadeTarihi} onChange={e => setFormData({ ...formData, vadeTarihi: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Durum</Label>
            <Select value={formData.durum} onValueChange={(v: any) => setFormData({ ...formData, durum: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bekliyor">Bekliyor (Vadesi Gelmedi/Gecikti)</SelectItem>
                <SelectItem value="odendi">Ödendi / Tahsil Edildi</SelectItem>
                <SelectItem value="karsiliksiz">Karşılıksız / İptal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Açıklama (Opsiyonel)</Label>
            <Input value={formData.aciklama} onChange={e => setFormData({ ...formData, aciklama: e.target.value })} placeholder="Notlar..." />
          </div>

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={closeCekSenetDrawer}>İptal</Button>
            <Button type="submit" className="flex-1 border-0"><Save className="w-4 h-4 mr-2"/> Kaydet</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
