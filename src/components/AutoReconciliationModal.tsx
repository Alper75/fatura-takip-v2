import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Zap, 
  CheckCircle2, 
  ArrowRight, 
  Landmark, 
  FileText, 
  Filter, 
  ShieldCheck, 
  Clock, 
  AlertCircle,
  Search,
  Sparkles,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import type { CariHareket, SatisFatura, AlisFatura } from '@/types';

interface AutoReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MatchCandidate {
  id: string;
  hareket: CariHareket;
  fatura: SatisFatura | AlisFatura;
  faturaTipi: 'satis' | 'alis';
  score: number;
  matchReasons: string[];
  confidence: 'high' | 'medium' | 'low';
}

export function AutoReconciliationModal({ isOpen, onClose }: AutoReconciliationModalProps) {
  const { 
    cariHareketler, 
    satisFaturalari, 
    alisFaturalari, 
    bankaHesaplari,
    cariler,
    updateSatisFaturaOdeme,
    updateAlisFaturaOdeme,
    updateCariHareket
  } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'high' | 'satis' | 'alis'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [processing, setProcessing] = useState(false);
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set());

  // 1. Akıllı Eşleştirme Motoru
  const matches = useMemo<MatchCandidate[]>(() => {
    const list: MatchCandidate[] = [];

    // Açık faturalar
    const openSatis = satisFaturalari.filter(f => f.odemeDurumu !== 'ODENDI' && f.odemeDurumu !== 'odendi' as any);
    const openAlis = alisFaturalari.filter(f => f.odemeDurumu !== 'odendi');

    // Henüz faturaya bağlanmamış banka hareketleri
    const unlinkedHareketler = cariHareketler.filter(h => !h.bagliFaturaId && !closedIds.has(h.id));

    for (const h of unlinkedHareketler) {
      const hAmount = Math.abs(h.tutar);
      const hDesc = (h.aciklama || '').toLowerCase();
      const hDate = new Date(h.tarih).getTime();

      // Gelen Para (Tahsilat) -> Satış Faturaları ile Eşle
      const isIncoming = h.islemTuru === 'tahsilat' || h.islemTuru === 'gelen_havale' || (h.tutar > 0 && h.islemTuru !== 'odeme');
      
      if (isIncoming) {
        let bestCandidate: { fatura: SatisFatura; score: number; reasons: string[] } | null = null;

        for (const sf of openSatis) {
          let score = 0;
          const reasons: string[] = [];

          // Tutar kontrolü (Tam eşleşme veya 5 kuruş tolerans)
          const diff = Math.abs(sf.toplamTutar - hAmount);
          if (diff < 0.05) {
            score += 50;
            reasons.push('Tutar Birebir Eşleşti');
          } else if (diff <= 1.0) {
            score += 35;
            reasons.push('Tutar Kuruş Farkıyla Eşleşti (±1 TL)');
          }

          // Fatura Numarası açıklamada geçiyor mu?
          if (sf.faturaNo && sf.faturaNo.length >= 4 && hDesc.includes(sf.faturaNo.toLowerCase())) {
            score += 40;
            reasons.push(`Açıklamada Fatura No Geçiyor (${sf.faturaNo})`);
          }

          // VKN / TCKN açıklamada geçiyor mu?
          if (sf.musteriVkn && sf.musteriVkn.length >= 8 && hDesc.includes(sf.musteriVkn)) {
            score += 30;
            reasons.push(`Açıklamada VKN/TCKN Geçiyor (${sf.musteriVkn})`);
          }

          // Müşteri Ünvanı kontrolü
          const musteriNameWords = (sf.musteriAdi || '').toLowerCase().split(/[\s,.-]+/).filter(w => w.length > 3 && !['ltd', 'şti', 'a.ş', 'as', 'tic', 'san'].includes(w));
          const nameMatched = musteriNameWords.some(w => hDesc.includes(w));
          if (nameMatched) {
            score += 25;
            reasons.push('Cari / Firma Adı Eşleşti');
          }

          // Tarih Yakınlığı (±30 gün)
          const fDate = new Date(sf.faturaTarihi).getTime();
          const dayDiff = Math.abs(hDate - fDate) / (1000 * 60 * 60 * 24);
          if (dayDiff <= 15) {
            score += 15;
            reasons.push(`Tarih Çok Yakın (${Math.round(dayDiff)} gün)`);
          } else if (dayDiff <= 45) {
            score += 5;
          }

          if (score >= 50 && (!bestCandidate || score > bestCandidate.score)) {
            bestCandidate = { fatura: sf, score, reasons };
          }
        }

        if (bestCandidate) {
          const confidence = bestCandidate.score >= 80 ? 'high' : bestCandidate.score >= 60 ? 'medium' : 'low';
          list.push({
            id: `satis_${h.id}_${bestCandidate.fatura.id}`,
            hareket: h,
            fatura: bestCandidate.fatura,
            faturaTipi: 'satis',
            score: Math.min(bestCandidate.score, 100),
            matchReasons: bestCandidate.reasons,
            confidence
          });
        }
      } else {
        // Giden Para (Tediye / Harcama) -> Alış Faturaları ile Eşle
        let bestCandidate: { fatura: AlisFatura; score: number; reasons: string[] } | null = null;

        for (const af of openAlis) {
          let score = 0;
          const reasons: string[] = [];

          const diff = Math.abs(af.toplamTutar - hAmount);
          if (diff < 0.05) {
            score += 50;
            reasons.push('Tutar Birebir Eşleşti');
          } else if (diff <= 1.0) {
            score += 35;
            reasons.push('Tutar Kuruş Farkıyla Eşleşti (±1 TL)');
          }

          if (af.faturaNo && af.faturaNo.length >= 4 && hDesc.includes(af.faturaNo.toLowerCase())) {
            score += 40;
            reasons.push(`Açıklamada Fatura No Geçiyor (${af.faturaNo})`);
          }

          if (af.tedarikciVkn && af.tedarikciVkn.length >= 8 && hDesc.includes(af.tedarikciVkn)) {
            score += 30;
            reasons.push(`Açıklamada VKN/TCKN Geçiyor (${af.tedarikciVkn})`);
          }

          const tedarikciWords = (af.tedarikciAdi || '').toLowerCase().split(/[\s,.-]+/).filter(w => w.length > 3 && !['ltd', 'şti', 'a.ş', 'as', 'tic', 'san'].includes(w));
          const nameMatched = tedarikciWords.some(w => hDesc.includes(w));
          if (nameMatched) {
            score += 25;
            reasons.push('Tedarikçi Firma Adı Eşleşti');
          }

          const fDate = new Date(af.faturaTarihi).getTime();
          const dayDiff = Math.abs(hDate - fDate) / (1000 * 60 * 60 * 24);
          if (dayDiff <= 15) {
            score += 15;
            reasons.push(`Tarih Çok Yakın (${Math.round(dayDiff)} gün)`);
          } else if (dayDiff <= 45) {
            score += 5;
          }

          if (score >= 50 && (!bestCandidate || score > bestCandidate.score)) {
            bestCandidate = { fatura: af, score, reasons };
          }
        }

        if (bestCandidate) {
          const confidence = bestCandidate.score >= 80 ? 'high' : bestCandidate.score >= 60 ? 'medium' : 'low';
          list.push({
            id: `alis_${h.id}_${bestCandidate.fatura.id}`,
            hareket: h,
            fatura: bestCandidate.fatura,
            faturaTipi: 'alis',
            score: Math.min(bestCandidate.score, 100),
            matchReasons: bestCandidate.reasons,
            confidence
          });
        }
      }
    }

    // Skora göre sırala (en yüksekler en üstte)
    return list.sort((a, b) => b.score - a.score);
  }, [cariHareketler, satisFaturalari, alisFaturalari, closedIds]);

  // Filtrelenmiş liste
  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      if (activeTab === 'high' && m.confidence !== 'high') return false;
      if (activeTab === 'satis' && m.faturaTipi !== 'satis') return false;
      if (activeTab === 'alis' && m.faturaTipi !== 'alis') return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const fName = m.faturaTipi === 'satis' ? (m.fatura as SatisFatura).musteriAdi : (m.fatura as AlisFatura).tedarikciAdi;
        const fNo = m.fatura.faturaNo || '';
        const hDesc = m.hareket.aciklama || '';
        if (!fName?.toLowerCase().includes(q) && !fNo.toLowerCase().includes(q) && !hDesc.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [matches, activeTab, searchTerm]);

  // Tekli Eşleme ve Fatura Kapama
  const handleCloseSingle = async (candidate: MatchCandidate) => {
    setProcessing(true);
    try {
      // Backend çağrısı
      await apiFetch('/api/reconciliation/batch-close', {
        method: 'POST',
        body: JSON.stringify({
          matches: [{
            hareketId: candidate.hareket.id,
            faturaId: candidate.fatura.id,
            faturaTipi: candidate.faturaTipi,
            odemeTarihi: candidate.hareket.tarih
          }]
        })
      });

      // AppContext State Güncelleme
      if (candidate.faturaTipi === 'satis') {
        updateSatisFaturaOdeme(candidate.fatura.id, candidate.hareket.tarih, 'ODENDI' as any, candidate.hareket.bankaId || undefined);
      } else {
        updateAlisFaturaOdeme(candidate.fatura.id, candidate.hareket.tarih, 'odendi', candidate.hareket.bankaId || undefined);
      }

      updateCariHareket(candidate.hareket.id, {
        bagliFaturaId: candidate.fatura.id
      });

      setClosedIds(prev => new Set([...prev, candidate.hareket.id]));
      toast.success(`Fatura (${candidate.fatura.faturaNo}) ve banka hareketi başarıyla kapatıldı!`);
    } catch (e: any) {
      toast.error('Eşleştirme kapatılırken hata: ' + (e.message || 'Bilinmeyen hata'));
    } finally {
      setProcessing(false);
    }
  };

  // Toplu Yüksek Güvenilirlikli Eşleşmeleri Kapatma
  const handleBatchCloseHighConfidence = async () => {
    const highMatches = matches.filter(m => m.confidence === 'high');
    if (highMatches.length === 0) {
      toast.info('Yüksek güvenilirlikte kapatılacak eşleşme bulunamadı.');
      return;
    }

    setProcessing(true);
    try {
      const payload = highMatches.map(m => ({
        hareketId: m.hareket.id,
        faturaId: m.fatura.id,
        faturaTipi: m.faturaTipi,
        odemeTarihi: m.hareket.tarih
      }));

      const res = await apiFetch('/api/reconciliation/batch-close', {
        method: 'POST',
        body: JSON.stringify({ matches: payload })
      });

      // React State Güncelleme
      highMatches.forEach(m => {
        if (m.faturaTipi === 'satis') {
          updateSatisFaturaOdeme(m.fatura.id, m.hareket.tarih, 'ODENDI' as any, m.hareket.bankaId || undefined);
        } else {
          updateAlisFaturaOdeme(m.fatura.id, m.hareket.tarih, 'odendi', m.hareket.bankaId || undefined);
        }
        updateCariHareket(m.hareket.id, { bagliFaturaId: m.fatura.id });
      });

      setClosedIds(prev => new Set([...prev, ...highMatches.map(m => m.hareket.id)]));
      toast.success(`🎉 ${res.closedCount || highMatches.length} adet fatura tek tıkla otomatik kapatıldı!`);
    } catch (e: any) {
      toast.error('Toplu kapatma sırasında hata: ' + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const highCount = matches.filter(m => m.confidence === 'high').length;
  const totalAmount = matches.reduce((acc, m) => acc + Math.abs(m.hareket.tutar), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-lg">
              <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                Otomatik Banka - Fatura Eşleştirme Motoru
                <Badge className="bg-yellow-400/20 text-yellow-200 border-yellow-300/40 text-xs font-semibold">
                  Yapay Zeka Destekli
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-emerald-100 text-sm mt-0.5">
                Banka ekstrelerindeki hareketler ile açık satış ve alış faturalarınızı otomatik eşleyip tek tıkla kapatın.
              </DialogDescription>
            </div>
          </div>

          {/* İstatistik Çubuğu */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/15">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5">
              <div className="text-xs text-emerald-100">Önerilen Eşleşmeler</div>
              <div className="text-xl font-bold text-white">{matches.length} Kayıt</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5">
              <div className="text-xs text-emerald-100">Yüksek Güvenilirlik (%80+)</div>
              <div className="text-xl font-bold text-yellow-300">{highCount} Kayıt</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5">
              <div className="text-xs text-emerald-100">Eşleşen Toplam Tutar</div>
              <div className="text-xl font-bold text-white">
                {totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
            </div>
          </div>
        </div>

        {/* Araç Çubuğu & Filtreler */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            <Button 
              size="sm" 
              variant={activeTab === 'all' ? 'default' : 'outline'}
              onClick={() => setActiveTab('all')}
              className="text-xs h-8 rounded-lg"
            >
              Tümü ({matches.length})
            </Button>
            <Button 
              size="sm" 
              variant={activeTab === 'high' ? 'default' : 'outline'}
              onClick={() => setActiveTab('high')}
              className="text-xs h-8 rounded-lg gap-1 text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Yüksek Güven ({highCount})
            </Button>
            <Button 
              size="sm" 
              variant={activeTab === 'satis' ? 'default' : 'outline'}
              onClick={() => setActiveTab('satis')}
              className="text-xs h-8 rounded-lg"
            >
              Satış Faturaları
            </Button>
            <Button 
              size="sm" 
              variant={activeTab === 'alis' ? 'default' : 'outline'}
              onClick={() => setActiveTab('alis')}
              className="text-xs h-8 rounded-lg"
            >
              Alış Faturaları
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <Input 
                placeholder="Firma, no veya açıklama ara..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs bg-white"
              />
            </div>
            {highCount > 0 && (
              <Button 
                size="sm" 
                onClick={handleBatchCloseHighConfidence}
                disabled={processing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-8 shrink-0 shadow-sm gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                {processing ? 'Kapatılıyor...' : `Yüksekleri Otomatik Kapat (${highCount})`}
              </Button>
            )}
          </div>
        </div>

        {/* Eşleşme Listesi */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
          {filteredMatches.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <h4 className="text-base font-semibold text-slate-800">Eşleştirilecek Kayıt Bulunamadı</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Banka ekstrelerinizdeki tüm hareketler faturalarla eşleşmiş veya açıkta eşleşebilecek uygun fatura bulunmuyor.
              </p>
            </div>
          ) : (
            filteredMatches.map(item => {
              const fName = item.faturaTipi === 'satis' 
                ? (item.fatura as SatisFatura).musteriAdi 
                : (item.fatura as AlisFatura).tedarikciAdi;
              const fNo = item.fatura.faturaNo || 'No Belirtilmemiş';
              const hBank = bankaHesaplari.find(b => b.id === item.hareket.bankaId);

              return (
                <div 
                  key={item.id}
                  className="bg-white border rounded-xl p-4 shadow-sm hover:border-emerald-300 transition-all flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4"
                >
                  {/* Sol: Banka Hareketi */}
                  <div className="flex-1 bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs font-semibold text-slate-700">
                          {hBank ? hBank.bankaAdi : 'Banka Hareketi'}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-500">{item.hareket.tarih}</span>
                    </div>
                    <div className="text-xs text-slate-600 font-medium line-clamp-2" title={item.hareket.aciklama}>
                      {item.hareket.aciklama || 'Açıklama yok'}
                    </div>
                    <div className="mt-2 text-sm font-bold text-blue-700">
                      {Math.abs(item.hareket.tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </div>
                  </div>

                  {/* Orta: Eşleşme Skoru & Nedenleri */}
                  <div className="flex flex-col items-center justify-center shrink-0 px-2 text-center">
                    <div className="flex items-center gap-1.5">
                      <ArrowRight className="w-4 h-4 text-slate-400 hidden md:block" />
                      <Badge 
                        className={
                          item.confidence === 'high' 
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 text-xs' 
                            : 'bg-yellow-100 text-yellow-800 border-yellow-300 text-xs'
                        }
                      >
                        %{item.score} Uyum
                      </Badge>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 max-w-[140px] leading-tight">
                      {item.matchReasons.slice(0, 2).join(' • ')}
                    </div>
                  </div>

                  {/* Sağ: Eşleşen Fatura */}
                  <div className="flex-1 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-900">
                          {item.faturaTipi === 'satis' ? 'Satış Faturası' : 'Alış Faturası'}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-semibold text-slate-600">{fNo}</span>
                    </div>
                    <div className="text-xs font-medium text-slate-800 truncate" title={fName}>
                      {fName}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-500">{item.fatura.faturaTarihi}</span>
                      <span className="text-sm font-bold text-emerald-700">
                        {item.fatura.toplamTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </span>
                    </div>
                  </div>

                  {/* Aksiyon */}
                  <div className="shrink-0 flex items-center justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleCloseSingle(item)}
                      disabled={processing}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-3.5 rounded-lg shadow-sm font-medium gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Eşle & Kapat
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Eşlenen faturalar otomatik olarak <strong>'Ödendi'</strong> durumuna geçer ve dekont bağlanır.
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
