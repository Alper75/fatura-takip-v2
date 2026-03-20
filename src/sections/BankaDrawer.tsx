import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { Save, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import type { BankaHesabiFormData } from '@/types';

export function BankaDrawer() {
  const { isBankaDrawerOpen, closeBankaDrawer, selectedBankaId, bankaHesaplari, addBankaHesabi, updateBankaHesabi } = useApp();

  const [formData, setFormData] = useState<BankaHesabiFormData>({
    hesapAdi: '',
    bankaAdi: '',
    iban: '',
    hesapNo: '',
    kartNo: '',
    dovizTuru: 'TRY',
    guncelBakiye: 0
  });

  const [bakiyeValue, setBakiyeValue] = useState('0');

  useEffect(() => {
    if (isBankaDrawerOpen) {
      if (selectedBankaId) {
        const banka = bankaHesaplari.find(b => b.id === selectedBankaId);
        if (banka) {
          setFormData({
            hesapAdi: banka.hesapAdi,
            bankaAdi: banka.bankaAdi,
            iban: banka.iban,
            hesapNo: banka.hesapNo || '',
            kartNo: banka.kartNo || '',
            dovizTuru: banka.dovizTuru,
            guncelBakiye: banka.guncelBakiye
          });
          setBakiyeValue(banka.guncelBakiye.toString());
        }
      } else {
        setFormData({
          hesapAdi: '',
          bankaAdi: '',
          iban: '',
          hesapNo: '',
          kartNo: '',
          dovizTuru: 'TRY',
          guncelBakiye: 0
        });
        setBakiyeValue('0');
      }
    }
  }, [isBankaDrawerOpen, selectedBankaId, bankaHesaplari]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hesapAdi || !formData.bankaAdi || !formData.iban) {
      toast.error('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }

    const finalData = { ...formData, guncelBakiye: parseFloat(bakiyeValue) || 0 };

    if (selectedBankaId) {
      updateBankaHesabi(selectedBankaId, finalData);
      toast.success('Banka hesabı güncellendi.');
    } else {
      addBankaHesabi(finalData);
      toast.success('Yeni banka hesabı eklendi.');
    }
    closeBankaDrawer();
  };

  return (
    <Sheet open={isBankaDrawerOpen} onOpenChange={closeBankaDrawer}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" side="right">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" />
            {selectedBankaId ? 'Hesabı Düzenle' : 'Yeni Banka Hesabı'}
          </SheetTitle>
          <SheetDescription>İşletmenizin banka hesaplarını tanımlayın.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="py-6 space-y-4">
          <div className="space-y-2">
            <Label>Hesap Adı (Kısa Ad)</Label>
            <Input 
              value={formData.hesapAdi} 
              onChange={e => setFormData({ ...formData, hesapAdi: e.target.value })} 
              placeholder="Örn: Ziraat Ticari, İş Bankası Şahsi"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Banka Adı</Label>
            <Input 
              value={formData.bankaAdi} 
              onChange={e => setFormData({ ...formData, bankaAdi: e.target.value })} 
              placeholder="Örn: Ziraat Bankası"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>IBAN</Label>
            <Input 
              value={formData.iban} 
              onChange={e => setFormData({ ...formData, iban: e.target.value })} 
              placeholder="TR00..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hesap No (Opsiyonel)</Label>
              <Input 
                value={formData.hesapNo} 
                onChange={e => setFormData({ ...formData, hesapNo: e.target.value })} 
                placeholder="Örn: 69618062"
              />
            </div>
            <div className="space-y-2">
              <Label>Kart No (Opsiyonel)</Label>
              <Input 
                value={formData.kartNo} 
                onChange={e => setFormData({ ...formData, kartNo: e.target.value })} 
                placeholder="Son 4 hane: 7795"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Döviz Türü</Label>
              <Select value={formData.dovizTuru} onValueChange={(v: any) => setFormData({ ...formData, dovizTuru: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRY">TRY (₺)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Açılış Bakiyesi</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={bakiyeValue} 
                onChange={e => setBakiyeValue(e.target.value)} 
              />
            </div>
          </div>

          <div className="pt-6 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={closeBankaDrawer}>İptal</Button>
            <Button type="submit" className="flex-1 border-0">
              <Save className="w-4 h-4 mr-2" />
              {selectedBankaId ? 'Güncelle' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
