import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useApp } from '@/context/AppContext';
import { 
  ClipboardList, 
  Search, 
  Trash2,
  CheckCircle,
  Clock,
  Package,
  ArrowRightCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { FileDown, Undo2 } from 'lucide-react';

export function SiparisListesi() {
  const { siparisler, updateSiparis, deleteSiparis, addKesilecekFatura } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSiparisler = (siparisler || []).filter(s => 
    s.siparis_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.musteri_adi || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Bekliyor':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 animate-pulse"><Clock className="w-3 h-3 mr-1" /> Bekliyor</Badge>;
      case 'Hazırlanıyor':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100"><Package className="w-3 h-3 mr-1" /> Hazırlanıyor</Badge>;
      case 'Tamamlandı':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" /> Tamamlandı</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleStatusChange = (id: string, currentStatus: string) => {
    let next = currentStatus;
    if (currentStatus === 'Bekliyor') next = 'Hazırlanıyor';
    else if (currentStatus === 'Hazırlanıyor') next = 'Tamamlandı';
    // Tamamlandı ise ilerlemez.

    if (next !== currentStatus) {
      updateSiparis(id, { durum: next });
      toast.success(`Sipariş durumu "${next}" olarak güncellendi.`);
    } else if (currentStatus === 'Tamamlandı') {
      toast.info('Sipariş zaten tamamlanmış durumda.');
    }
  };

  const handleRevertStatus = (id: string, currentStatus: string) => {
    let prev = 'Bekliyor';
    if (currentStatus === 'Tamamlandı') prev = 'Hazırlanıyor';
    else if (currentStatus === 'Hazırlanıyor') prev = 'Bekliyor';

    updateSiparis(id, { durum: prev });
    toast.success(`Sipariş durumu bir adım geriye (${prev}) alındı.`);
  };

  const handleConvertToInvoice = async (siparis: any) => {
    try {
      // Sipariş kalemlerini FaturaKalemi formatına dönüştür
      const kalemler = (siparis.kalemler || []).map((k: any) => ({
        id: 'k' + Date.now() + Math.random().toString(36).slice(2),
        urunId: k.urun_id || '',
        ad: k.urun_adi || '',
        miktar: k.miktar || 1,
        birim: 'C62', // Adet
        birimFiyat: k.birim_fiyat || 0,
        kdvOrani: k.kdv_orani || 20,
        tevkifatOrani: 0,
      }));

      await addKesilecekFatura({
        // Müşteri bilgileri (siparis snake_case → KesilecekFatura camelCase)
        ad: siparis.musteri_adi || '',
        soyad: '',
        vknTckn: siparis.musteri_vkn || siparis.musteri_vkn || '',
        adres: siparis.musteri_adres || '',
        // Cari bağlantısı
        cariId: siparis.cari_id || undefined,
        // Tutar
        tutar: siparis.toplam_tutar || 0,
        kdvDahil: true,
        faturaTarihi: new Date().toISOString().split('T')[0],
        // Açıklama
        aciklama: `Sipariş No: ${siparis.siparis_no} faturaya dönüştürüldü.`,
        // Ürün kalemleri (stok bağlantısı burada taşınıyor)
        kalemler: kalemler.length > 0 ? kalemler : undefined,
      });

      // Sipariş durumunu Tamamlandı yap
      if (siparis.durum !== 'Tamamlandı') {
        updateSiparis(siparis.id, { durum: 'Tamamlandı' });
      }
      toast.success('Sipariş başarıyla Kesilecek Faturalar havuzuna eklendi!');
    } catch (e: any) {
      toast.error('Faturaya dönüştürme başarısız: ' + e.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Sipariş Yönetimi
          </h1>
          <p className="text-slate-500 text-sm mt-1">Onaylanan tekliflerden gelen siparişlerinizi buradan takip edin.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl shadow-slate-200/50 bg-white">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2 relative max-w-sm flex-1">
            <Search className="w-4 h-4 absolute left-3 text-slate-400" />
            <Input 
              placeholder="Sipariş no veya müşteri ara..." 
              className="pl-9 bg-slate-50 border-none h-11"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 rounded-full border border-primary/10">
               <span className="text-xs font-semibold text-primary">{siparisler.length}</span>
               <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">Toplam Sipariş</span>
             </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50 border-b">
              <TableRow>
                <TableHead className="font-semibold text-slate-700">Sipariş No</TableHead>
                <TableHead className="font-semibold text-slate-700">Tarih</TableHead>
                <TableHead className="font-semibold text-slate-700">Müşteri</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Tutar</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">Durum</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSiparisler.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                     <div className="flex flex-col items-center justify-center gap-2 text-slate-300">
                        <Package className="w-12 h-12 opacity-20" />
                        <p className="text-sm font-medium">Henüz sipariş kaydı bulunmuyor.</p>
                     </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSiparisler.map((siparis) => (
                  <TableRow key={siparis.id} className="group hover:bg-slate-50 transition-colors">
                    <TableCell className="font-mono font-bold text-slate-600">{siparis.siparis_no}</TableCell>
                    <TableCell className="text-slate-500 text-sm">
                        {new Date(siparis.tarih).toLocaleDateString('tr-TR')}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">{siparis.musteri_adi || '-'}</TableCell>
                    <TableCell className="text-right font-bold text-slate-900">
                      {formatCurrency(siparis.toplam_tutar)}
                    </TableCell>
                    <TableCell className="text-center">
                      <button onClick={() => handleStatusChange(siparis.id, siparis.durum)}>
                        {getStatusBadge(siparis.durum)}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {siparis.durum !== 'Bekliyor' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Bir Adım Geri Al"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-orange-600 hover:bg-orange-50"
                            onClick={() => handleRevertStatus(siparis.id, siparis.durum)}
                          >
                            <Undo2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost" 
                          size="sm" 
                          className="h-8 gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 mr-1"
                          onClick={() => handleConvertToInvoice(siparis)}
                        >
                          <FileDown className="w-3.5 h-3.5" /> Fatura Gönder
                        </Button>
                        <Button 
                          variant={siparis.durum === 'Tamamlandı' ? 'ghost' : 'default'}
                          size="sm" 
                          disabled={siparis.durum === 'Tamamlandı'}
                          className={`h-8 gap-2 text-xs font-semibold ${siparis.durum === 'Tamamlandı' ? 'text-slate-400 cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                          onClick={() => handleStatusChange(siparis.id, siparis.durum)}
                        >
                          İlerlet <ArrowRightCircle className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-slate-300 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            if(confirm('Siparişi silmek istediğinize emin misiniz?')) deleteSiparis(siparis.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-sm bg-yellow-50/50 p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-yellow-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                  <p className="text-xs font-semibold text-yellow-600 uppercase">Bekleyen</p>
                  <p className="text-2xl font-bold text-slate-900">{siparisler.filter(s => s.durum === 'Bekliyor').length}</p>
              </div>
          </Card>
          <Card className="border-none shadow-sm bg-blue-50/50 p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase">Hazırlanan</p>
                  <p className="text-2xl font-bold text-slate-900">{siparisler.filter(s => s.durum === 'Hazırlanıyor').length}</p>
              </div>
          </Card>
          <Card className="border-none shadow-sm bg-green-50/50 p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                  <p className="text-xs font-semibold text-green-600 uppercase">Tamamlanan</p>
                  <p className="text-2xl font-bold text-slate-900">{siparisler.filter(s => s.durum === 'Tamamlandı').length}</p>
              </div>
          </Card>
      </div>
    </div>
  );
}
