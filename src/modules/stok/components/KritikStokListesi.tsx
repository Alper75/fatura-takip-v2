import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Search, 
  ShoppingCart, 
  Copy, 
  Check, 
  PackageX, 
  TrendingDown, 
  ShieldAlert, 
  ArrowDownLeft,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCriticalProducts } from '../hooks/useStokQuery';

interface Props {
  onQuickGiris?: (urunId: string) => void;
}

export const KritikStokListesi: React.FC<Props> = ({ onQuickGiris }) => {
  const { data: criticalList = [], isLoading, refetch } = useCriticalProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  // Search filter
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return criticalList;
    const q = searchTerm.toLowerCase();
    return criticalList.filter((item: any) => 
      (item.ad || '').toLowerCase().includes(q) ||
      (item.kod || '').toLowerCase().includes(q) ||
      (item.barkod || '').toLowerCase().includes(q)
    );
  }, [criticalList, searchTerm]);

  // Aggregate stats
  const stats = useMemo(() => {
    let outOfStock = 0;
    let criticalCount = 0;
    let totalDeficit = 0;

    criticalList.forEach((item: any) => {
      if (item.mevcutStok <= 0) {
        outOfStock++;
      } else {
        criticalCount++;
      }
      totalDeficit += (item.fark || 0);
    });

    return { outOfStock, criticalCount, totalDeficit, total: criticalList.length };
  }, [criticalList]);

  // Copy order list to clipboard for supplier WhatsApp or email
  const handleCopyOrderDraft = () => {
    if (!criticalList.length) return;

    const dateStr = new Date().toLocaleDateString('tr-TR');
    let text = `📦 KRİTİK STOK VE SİPARİŞ İHTİYAÇ LİSTESİ (${dateStr})\n`;
    text += `Toplam ${criticalList.length} kalem acil tedarik gerektiriyor:\n`;
    text += `-------------------------------------------\n`;

    criticalList.forEach((item: any, idx: number) => {
      text += `${idx + 1}. ${item.ad} (Kod: ${item.kod || '-'})\n`;
      text += `   Mevcut: ${item.mevcutStok} ${item.birim || 'Adet'} | Güvenlik Sınırı: ${item.minimumStok} | İhtiyaç: +${item.fark} ${item.birim || 'Adet'}\n`;
    });

    text += `-------------------------------------------\n`;
    text += `Oluşturuldu: Fatura & Stok Otomasyonu`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Kritik stok seviyeleri taranıyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-red-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-red-700">Tükenmiş Ürünler (0 Stok)</CardTitle>
            <PackageX className="w-5 h-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">{stats.outOfStock}</div>
            <p className="text-xs text-red-600 mt-1 font-medium">Acil satış kaybı riski</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-700">Güvenlik Sınırı Altında</CardTitle>
            <ShieldAlert className="w-5 h-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">{stats.criticalCount}</div>
            <p className="text-xs text-amber-600 mt-1 font-medium">Asgari stok adedinin altında</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-indigo-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-indigo-700">Toplam İhtiyaç Adedi</CardTitle>
            <ShoppingCart className="w-5 h-5 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">+{stats.totalDeficit.toLocaleString('tr-TR')}</div>
            <p className="text-xs text-indigo-600 mt-1 font-medium">Sınırı tamamlamak için gereken miktar</p>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar: Search & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Kritik ürünlerde ara (ad, kod, barkod)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 rounded-xl border-slate-200 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleCopyOrderDraft}
            disabled={!criticalList.length}
            variant="outline"
            className="rounded-xl border-slate-200 hover:bg-slate-50 font-bold text-slate-700"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2 text-emerald-600" /> Panoya Kopyalandı!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2 text-indigo-600" /> Sipariş Taslağını Kopyala
              </>
            )}
          </Button>

          <Button
            onClick={() => refetch()}
            variant="ghost"
            size="sm"
            className="rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Yenile
          </Button>
        </div>
      </div>

      {/* Products Table or Empty State */}
      {criticalList.length === 0 ? (
        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-emerald-50/50 to-white p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mb-4">
            <Check className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-1">Tüm Stok Seviyeleriniz Güvende!</h3>
          <p className="text-slate-500 max-w-md mx-auto text-sm">
            Depolarınızdaki hiçbir ürün kritik asgari limitinin altına inmedi. Satış ve alış faturalarınız kesildikçe stoklarınız otomatik izlenmeye devam eder.
          </p>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
          Arama kriterinize uygun kritik stok kaydı bulunamadı.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Durum</th>
                  <th className="py-3.5 px-4">Ürün Bilgisi</th>
                  <th className="py-3.5 px-4 text-center">Güvenlik Sınırı</th>
                  <th className="py-3.5 px-4 text-center">Mevcut Stok</th>
                  <th className="py-3.5 px-4 text-center">İhtiyaç (+Açık)</th>
                  <th className="py-3.5 px-4 text-right">Doluluk Oranı</th>
                  <th className="py-3.5 px-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item: any) => {
                  const isZero = item.mevcutStok <= 0;
                  const ratio = item.minimumStok > 0 
                    ? Math.max(0, Math.min(100, Math.round((item.mevcutStok / item.minimumStok) * 100))) 
                    : 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        {isZero ? (
                          <Badge className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase px-2.5 py-0.5 rounded-lg shadow-sm shadow-red-200">
                            TÜKENDİ
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase px-2.5 py-0.5 rounded-lg shadow-sm shadow-amber-200">
                            KRİTİK
                          </Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{item.ad}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          {item.kod && <span>Kod: <span className="font-medium text-slate-600">{item.kod}</span></span>}
                          {item.barkod && <span>Barkod: <span className="font-mono text-slate-600">{item.barkod}</span></span>}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="font-semibold text-slate-700">
                          {item.minimumStok} {item.birim || 'Adet'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`font-black text-base ${isZero ? 'text-red-600' : 'text-amber-600'}`}>
                          {item.mevcutStok} {item.birim || 'Adet'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-xs bg-red-50 text-red-700 border border-red-200">
                          +{item.fark} {item.birim || 'Adet'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="w-24 ml-auto space-y-1">
                          <div className="text-xs font-semibold text-slate-500">%{ratio}</div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isZero ? 'bg-red-500 w-0' : ratio < 30 ? 'bg-red-500' : 'bg-amber-500'
                              }`} 
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {onQuickGiris ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onQuickGiris(item.id)}
                            className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold text-xs"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5 mr-1" /> Stok Gir
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
