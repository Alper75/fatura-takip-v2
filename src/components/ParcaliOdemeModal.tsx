import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  Calendar,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  Upload,
  Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { useApp } from '@/context/AppContext';
import { ODEME_DURUMU_LABELS, ODEME_DURUMU_COLORS } from '@/types';
import type { SatisFatura, AlisFatura, FaturaOdemeKaydi } from '@/types';

interface ParcaliOdemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  fatura: SatisFatura | AlisFatura | null;
  faturaTipi: 'satis' | 'alis';
  onSuccess?: () => void;
}

export function ParcaliOdemeModal({
  isOpen,
  onClose,
  fatura,
  faturaTipi,
  onSuccess
}: ParcaliOdemeModalProps) {
  const { bankaHesaplari, fetchSatisFaturalari, fetchAlisFaturalari, fetchCariHareketler } = useApp();

  const [odemeler, setOdemeler] = useState<FaturaOdemeKaydi[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [tutar, setTutar] = useState<string>('');
  const [tarih, setTarih] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bankaId, setBankaId] = useState<string>('nakit');
  const [aciklama, setAciklama] = useState<string>('');

  // Toplam ve Kalan Hesaplama
  const toplamTutar = fatura 
    ? Number((fatura as any).alinanUcret || (fatura as any).toplamTutar || 0) 
    : 0;

  const odenenTutar = odemeler.reduce((acc, o) => acc + Number(o.tutar || 0), 0);
  const kalanTutar = Math.max(0, Math.round((toplamTutar - odenenTutar) * 100) / 100);
  const yuzde = toplamTutar > 0 ? Math.min(100, Math.round((odenenTutar / toplamTutar) * 100)) : 0;

  useEffect(() => {
    if (isOpen && fatura) {
      loadOdemeler();
      setTarih(new Date().toISOString().split('T')[0]);
      setAciklama('');
      setBankaId('nakit');
    }
  }, [isOpen, fatura]);

  // Kalan tutar değiştikçe inputu otomatik kalan tutarla doldur
  useEffect(() => {
    if (kalanTutar > 0) {
      setTutar(kalanTutar.toString());
    } else {
      setTutar('');
    }
  }, [kalanTutar, isOpen]);

  const loadOdemeler = async () => {
    if (!fatura) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/faturalar/${fatura.id}/odemeler`);
      if (res.success && res.data) {
        setOdemeler(res.data);
      }
    } catch (e) {
      console.error('Ödemeler yüklenemedi:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fatura) return;

    const numTutar = parseFloat(tutar);
    if (!numTutar || numTutar <= 0) {
      toast.error('Lütfen geçerli bir tutar girin.');
      return;
    }

    if (numTutar > kalanTutar + 0.05) {
      toast.error(`Girilen tutar kalan bakiyeden (${kalanTutar.toLocaleString('tr-TR')} ₺) büyük olamaz.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/faturalar/${fatura.id}/odeme-ekle`, {
        method: 'POST',
        body: JSON.stringify({
          tutar: numTutar,
          tarih,
          bankaId: bankaId === 'nakit' ? null : bankaId,
          aciklama: aciklama || (faturaTipi === 'satis' ? 'Kısmi Tahsilat' : 'Kısmi Ödeme'),
          faturaTipi
        })
      });

      if (res.success) {
        toast.success(
          res.odemeDurumu === 'odendi' 
            ? '🎉 Faturanın tamamı tahsil edildi ve kapatıldı!' 
            : `Kısmi ödeme kaydedildi. Kalan Bakiye: ${res.kalanTutar?.toLocaleString('tr-TR')} ₺`
        );
        await loadOdemeler();
        if (faturaTipi === 'satis' && fetchSatisFaturalari) fetchSatisFaturalari();
        if (faturaTipi === 'alis' && fetchAlisFaturalari) fetchAlisFaturalari();
        if (fetchCariHareketler) fetchCariHareketler();
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.message || 'Ödeme eklenemedi.');
      }
    } catch (e: any) {
      toast.error('Hata: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!fatura) return;
    try {
      const res = await apiFetch(`/api/faturalar/${fatura.id}/odemeler/${paymentId}`, {
        method: 'DELETE'
      });
      if (res.success) {
        toast.success('Ödeme kaydı silindi, bakiye güncellendi.');
        await loadOdemeler();
        if (faturaTipi === 'satis' && fetchSatisFaturalari) fetchSatisFaturalari();
        if (faturaTipi === 'alis' && fetchAlisFaturalari) fetchAlisFaturalari();
        if (fetchCariHareketler) fetchCariHareketler();
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.message || 'Silinemedi.');
      }
    } catch (e: any) {
      toast.error('Hata: ' + e.message);
    }
  };

  if (!fatura) return null;

  const cariUnvan = (fatura as any).musteriAdi || (fatura as any).tedarikciAdi || (fatura as any).ad ? `${(fatura as any).ad} ${(fatura as any).soyad || ''}` : 'Cari Kart';
  const belgeNo = fatura.faturaNo || 'Belge No Yok';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Parçalı Ödeme & Açık Bakiye Takibi
                  <Badge className="bg-indigo-500 text-white text-xs">
                    {faturaTipi === 'satis' ? 'Tahsilat' : 'Ödeme'}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs mt-0.5">
                  {cariUnvan} • Belge No: <span className="font-mono text-slate-200">{belgeNo}</span>
                </DialogDescription>
              </div>
            </div>

            {/* Fatura Durumu Rozeti */}
            <Badge className={ODEME_DURUMU_COLORS[fatura.odemeDurumu] || 'bg-slate-100 text-slate-700'}>
              {ODEME_DURUMU_LABELS[fatura.odemeDurumu] || fatura.odemeDurumu}
            </Badge>
          </div>

          {/* İlerleme Çubuğu & Tutar Özeti */}
          <div className="mt-5 bg-white/5 rounded-xl p-4 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400">Toplam Fatura: </span>
                <span className="font-bold text-white text-sm">
                  {toplamTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </span>
              </div>
              <div>
                <span className="text-slate-400">Tahsil/Ödenen: </span>
                <span className="font-bold text-emerald-400 text-sm">
                  {odenenTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </span>
              </div>
              <div>
                <span className="text-slate-400">Kalan Bakiye: </span>
                <span className={`font-bold text-sm ${kalanTutar > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {kalanTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 flex">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${yuzde}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 text-right">
              %{yuzde} Tamamlandı
            </div>
          </div>
        </div>

        {/* Gövde */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Yeni Ödeme Ekleme Formu */}
          {kalanTutar > 0 ? (
            <form onSubmit={handleAddPayment} className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Plus className="w-4 h-4 text-emerald-600" />
                Yeni {faturaTipi === 'satis' ? 'Tahsilat' : 'Ödeme'} Ekle
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="payment-amount" className="text-xs font-semibold">Tutar (₺)</Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    step="0.01"
                    value={tutar}
                    onChange={(e) => setTutar(e.target.value)}
                    placeholder="0.00"
                    className="text-xs h-9 bg-white font-bold text-slate-800"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payment-date" className="text-xs font-semibold">İşlem Tarihi</Label>
                  <Input
                    id="payment-date"
                    type="date"
                    value={tarih}
                    onChange={(e) => setTarih(e.target.value)}
                    className="text-xs h-9 bg-white"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Hesap / Banka</Label>
                  <Select value={bankaId} onValueChange={setBankaId}>
                    <SelectTrigger className="text-xs h-9 bg-white">
                      <SelectValue placeholder="Seçiniz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nakit">Nakit / Elden</SelectItem>
                      {bankaHesaplari.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.bankaAdi} - {b.hesapAdi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={aciklama}
                  onChange={(e) => setAciklama(e.target.value)}
                  placeholder="İşlem açıklaması (örn: 1. Taksit, EFT, Havale)..."
                  className="text-xs h-9 bg-white flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 shrink-0 gap-1.5 shadow-sm font-medium"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1.5" />
              <h4 className="text-sm font-bold text-emerald-900">Bu Fatura Tamamen Ödenmiştir</h4>
              <p className="text-xs text-emerald-700 mt-0.5">Kalan açık bakiye bulunmamaktadır.</p>
            </div>
          )}

          {/* Ödeme Geçmişi Listesi */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-slate-500" />
                Ödeme Geçmişi ({odemeler.length} İşlem)
              </h4>
            </div>

            {loading ? (
              <div className="text-center py-6 text-xs text-slate-400">Yükleniyor...</div>
            ) : odemeler.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border rounded-xl border-dashed">
                Bu faturaya henüz yapılmış bir tahsilat veya ödeme kaydı bulunmuyor.
              </div>
            ) : (
              <div className="border rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                {odemeler.map((item, idx) => {
                  const bank = bankaHesaplari.find(b => b.id === item.banka_id);

                  return (
                    <div key={item.id || idx} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          {faturaTipi === 'satis' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            {Number(item.tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{item.tarih}</span>
                            <span>•</span>
                            <span>{bank ? bank.bankaAdi : 'Nakit / Kasa'}</span>
                            {item.aciklama && (
                              <>
                                <span>•</span>
                                <span className="italic text-slate-600">{item.aciklama}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeletePayment(item.id)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Ödeme Kaydını Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Yapılan ödemeler cari hareketlere ve nakit akışına otomatik yansır.
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
