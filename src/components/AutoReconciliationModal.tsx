import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  Dialog, 
  DialogContent, 
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
  ShieldCheck, 
  Clock, 
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
  faturaToplam: number;
  faturaKalan: number;
  isPartial: boolean;
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

  const getSatisMusteriAdi = (sf: SatisFatura) => {
    const anySf = sf as any;
    const adSoyad = [sf.ad, sf.soyad].filter(Boolean).join(' ').trim();
    return adSoyad || anySf.musteriAdi || anySf.unvan || 'Müşteri';
  };

  const getSatisVkn = (sf: SatisFatura) => {
    const anySf = sf as any;
    return String(sf.tcVkn || anySf.musteriVkn || '').trim();
  };

  const getSatisToplam = (sf: SatisFatura) => {
    const anySf = sf as any;
    return Number(sf.alinanUcret ?? anySf.toplamTutar) || 0;
  };

  const getKalanTutar = (f: SatisFatura | AlisFatura, toplam: number) => {
    if (f.kalanTutar !== undefined && f.kalanTutar !== null && Number(f.kalanTutar) > 0) {
      return Number(f.kalanTutar);
    }
    const odenen = Number(f.odenenTutar) || 0;
    return Math.max(0, Math.round((toplam - odenen) * 100) / 100);
  };

  const parseDateMs = (dStr: string) => {
    if (!dStr) return 0;
    if (dStr.includes('.')) {
      const [day, month, year] = dStr.split(' ')[0].split('.');
      return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
    }
    return new Date(dStr).getTime() || 0;
  };

  // 1. Akıllı Eşleştirme Motoru (Tam + Kısmi Ödeme + Cari Kart + VKN + Fatura No)
  const matches = useMemo<MatchCandidate[]>(() => {
    const list: MatchCandidate[] = [];

    // Açık faturalar
    const openSatis = satisFaturalari.filter(f => {
      const st = String(f.odemeDurumu || '').toLowerCase();
      return st !== 'odendi';
    });
    const openAlis = alisFaturalari.filter(f => {
      const st = String(f.odemeDurumu || '').toLowerCase();
      return st !== 'odendi';
    });

    // Henüz faturaya bağlanmamış gerçek banka tahsilat/ödeme hareketleri
    const ignoredTypes = new Set([
      'transfer',
      'banka_masrafi',
      'satis_faturasi',
      'alis_faturasi',
      'vergi_kdv',
      'vergi_muhtasar',
      'vergi_gecici',
      'vergi_damga',
      'ssk_odemesi',
      'maas_odemesi'
    ]);

    const unlinkedHareketler = cariHareketler.filter(h =>
      Boolean(h.bankaId) &&
      !h.bagliFaturaId &&
      !closedIds.has(h.id) &&
      !ignoredTypes.has(h.islemTuru)
    );

    const stopWords = new Set(['ltd', 'şti', 'sti', 'a.ş', 'aş', 'as', 'tic', 'san', 've', 'anonim', 'şirketi', 'sirketi', 'ticaret', 'sanayi']);

    for (const h of unlinkedHareketler) {
      const hAmount = Math.abs(Number(h.tutar) || 0);
      if (hAmount <= 0) continue;

      const hDesc = (h.aciklama || '').toLocaleLowerCase('tr-TR');
      const hDate = parseDateMs(h.tarih);
      const hCari = h.cariId ? cariler.find(c => c.id === h.cariId) : undefined;
      const hCariName = (hCari?.unvan || '').toLocaleLowerCase('tr-TR');

      // Gelen Para (Tahsilat) -> Satış Faturaları ile Eşle
      const isIncoming = h.islemTuru === 'tahsilat' || h.islemTuru === 'diger_gelir' || h.islemTuru === 'cek_senet_alinan';

      if (isIncoming) {
        let bestCandidate: { fatura: SatisFatura; score: number; reasons: string[]; toplam: number; kalan: number; isPartial: boolean } | null = null;

        for (const sf of openSatis) {
          const toplam = getSatisToplam(sf);
          const kalan = getKalanTutar(sf, toplam);
          if (kalan <= 0) continue;

          let score = 0;
          let identityScore = 0;
          const reasons: string[] = [];

          // 1) Cari Kart Eşleşmesi
          if (h.cariId && sf.cariId && h.cariId === sf.cariId) {
            score += 40;
            identityScore += 40;
            reasons.push('Cari Kart Eşleşti');
          }

          // 2) Fatura Numarası açıklamada geçiyor mu?
          const cleanFaturaNo = String(sf.faturaNo || '').trim().toLocaleLowerCase('tr-TR');
          if (cleanFaturaNo.length >= 4 && (hDesc.includes(cleanFaturaNo) || (cleanFaturaNo.length >= 8 && hDesc.includes(cleanFaturaNo.slice(-6))))) {
            score += 45;
            identityScore += 45;
            reasons.push(`Fatura No Eşleşti (${sf.faturaNo})`);
          }

          // 3) VKN / TCKN açıklamada geçiyor mu?
          const vkn = getSatisVkn(sf);
          if (vkn.length >= 8 && (hDesc.includes(vkn) || (hCari?.vknTckn && hCari.vknTckn === vkn))) {
            score += 35;
            identityScore += 35;
            reasons.push(`VKN/TCKN Eşleşti (${vkn})`);
          }

          // 4) Müşteri Ünvanı kontrolü
          const musteriAdi = getSatisMusteriAdi(sf);
          const musteriWords = musteriAdi
            .toLocaleLowerCase('tr-TR')
            .split(/[\s,.-]+/)
            .filter((w: string) => w.length > 3 && !stopWords.has(w));
          const nameMatched = musteriWords.some((w: string) => hDesc.includes(w) || (hCariName && hCariName.includes(w)));
          if (nameMatched) {
            score += 25;
            identityScore += 25;
            reasons.push('Müşteri Ünvanı Eşleşti');
          }

          // 5) Tutar kontrolü (Kalan tutar veya toplam tutar ile)
          const diffKalan = Math.abs(kalan - hAmount);
          const diffToplam = Math.abs(toplam - hAmount);
          const diff = Math.min(diffKalan, diffToplam);
          let isPartial = false;

          if (diff < 0.05) {
            score += 50;
            reasons.push('Tutar Birebir Eşleşti');
          } else if (diff <= 2.5) {
            score += 35;
            reasons.push('Tutar Kuruş/Masraf Farkıyla Eşleşti');
          } else if (hAmount < kalan - 2.5 && identityScore >= 35) {
            score += 25;
            isPartial = true;
            reasons.push('Kısmi Tahsilat / Mahsup');
          }

          // 6) Tarih Yakınlığı
          const fDate = parseDateMs(sf.faturaTarihi);
          if (hDate > 0 && fDate > 0) {
            const dayDiff = Math.abs(hDate - fDate) / (1000 * 60 * 60 * 24);
            if (dayDiff <= 15) {
              score += 15;
              reasons.push(`Tarih Yakın (${Math.round(dayDiff)} gün)`);
            } else if (dayDiff <= 45) {
              score += 5;
            }
          }

          if (score >= 55 && (!bestCandidate || score > bestCandidate.score)) {
            bestCandidate = { fatura: sf, score, reasons, toplam, kalan, isPartial };
          }
        }

        if (bestCandidate) {
          const confidence = bestCandidate.score >= 80 ? 'high' : bestCandidate.score >= 65 ? 'medium' : 'low';
          list.push({
            id: `satis_${h.id}_${bestCandidate.fatura.id}`,
            hareket: h,
            fatura: bestCandidate.fatura,
            faturaTipi: 'satis',
            faturaToplam: bestCandidate.toplam,
            faturaKalan: bestCandidate.kalan,
            isPartial: bestCandidate.isPartial,
            score: Math.min(bestCandidate.score, 100),
            matchReasons: bestCandidate.reasons,
            confidence
          });
        }
      } else {
        // Giden Para (Ödeme / Harcama) -> Alış Faturaları ile Eşle
        let bestCandidate: { fatura: AlisFatura; score: number; reasons: string[]; toplam: number; kalan: number; isPartial: boolean } | null = null;

        for (const af of openAlis) {
          const toplam = Number(af.toplamTutar) || 0;
          const kalan = getKalanTutar(af, toplam);
          if (kalan <= 0) continue;

          let score = 0;
          let identityScore = 0;
          const reasons: string[] = [];

          // 1) Cari Kart Eşleşmesi
          if (h.cariId && af.cariId && h.cariId === af.cariId) {
            score += 40;
            identityScore += 40;
            reasons.push('Cari Kart Eşleşti');
          }

          // 2) Fatura No
          const cleanFaturaNo = String(af.faturaNo || '').trim().toLocaleLowerCase('tr-TR');
          if (cleanFaturaNo.length >= 4 && (hDesc.includes(cleanFaturaNo) || (cleanFaturaNo.length >= 8 && hDesc.includes(cleanFaturaNo.slice(-6))))) {
            score += 45;
            identityScore += 45;
            reasons.push(`Fatura No Eşleşti (${af.faturaNo})`);
          }

          // 3) VKN / TCKN
          const vkn = String(af.tedarikciVkn || '').trim();
          if (vkn.length >= 8 && (hDesc.includes(vkn) || (hCari?.vknTckn && hCari.vknTckn === vkn))) {
            score += 35;
            identityScore += 35;
            reasons.push(`VKN/TCKN Eşleşti (${vkn})`);
          }

          // 4) Tedarikçi Firma Adı
          const tedarikciWords = (af.tedarikciAdi || '')
            .toLocaleLowerCase('tr-TR')
            .split(/[\s,.-]+/)
            .filter((w: string) => w.length > 3 && !stopWords.has(w));
          const nameMatched = tedarikciWords.some((w: string) => hDesc.includes(w) || (hCariName && hCariName.includes(w)));
          if (nameMatched) {
            score += 25;
            identityScore += 25;
            reasons.push('Tedarikçi Firma Adı Eşleşti');
          }

          // 5) Tutar Kontrolü
          const diffKalan = Math.abs(kalan - hAmount);
          const diffToplam = Math.abs(toplam - hAmount);
          const diff = Math.min(diffKalan, diffToplam);
          let isPartial = false;

          if (diff < 0.05) {
            score += 50;
            reasons.push('Tutar Birebir Eşleşti');
          } else if (diff <= 2.5) {
            score += 35;
            reasons.push('Tutar Kuruş/Masraf Farkıyla Eşleşti');
          } else if (hAmount < kalan - 2.5 && identityScore >= 35) {
            score += 25;
            isPartial = true;
            reasons.push('Kısmi Ödeme / Mahsup');
          }

          // 6) Tarih Yakınlığı
          const fDate = parseDateMs(af.faturaTarihi);
          if (hDate > 0 && fDate > 0) {
            const dayDiff = Math.abs(hDate - fDate) / (1000 * 60 * 60 * 24);
            if (dayDiff <= 15) {
              score += 15;
              reasons.push(`Tarih Yakın (${Math.round(dayDiff)} gün)`);
            } else if (dayDiff <= 45) {
              score += 5;
            }
          }

          if (score >= 55 && (!bestCandidate || score > bestCandidate.score)) {
            bestCandidate = { fatura: af, score, reasons, toplam, kalan, isPartial };
          }
        }

        if (bestCandidate) {
          const confidence = bestCandidate.score >= 80 ? 'high' : bestCandidate.score >= 65 ? 'medium' : 'low';
          list.push({
            id: `alis_${h.id}_${bestCandidate.fatura.id}`,
            hareket: h,
            fatura: bestCandidate.fatura,
            faturaTipi: 'alis',
            faturaToplam: bestCandidate.toplam,
            faturaKalan: bestCandidate.kalan,
            isPartial: bestCandidate.isPartial,
            score: Math.min(bestCandidate.score, 100),
            matchReasons: bestCandidate.reasons,
            confidence
          });
        }
      }
    }

    return list.sort((a, b) => b.score - a.score);
  }, [cariHareketler, satisFaturalari, alisFaturalari, cariler, closedIds]);

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      if (activeTab === 'high' && m.confidence !== 'high') return false;
      if (activeTab === 'satis' && m.faturaTipi !== 'satis') return false;
      if (activeTab === 'alis' && m.faturaTipi !== 'alis') return false;

      if (searchTerm) {
        const q = searchTerm.toLocaleLowerCase('tr-TR');
        const fName = m.faturaTipi === 'satis' ? getSatisMusteriAdi(m.fatura as SatisFatura) : (m.fatura as AlisFatura).tedarikciAdi;
        const fNo = m.fatura.faturaNo || '';
        const hDesc = m.hareket.aciklama || '';
        if (!fName?.toLocaleLowerCase('tr-TR').includes(q) && !fNo.toLocaleLowerCase('tr-TR').includes(q) && !hDesc.toLocaleLowerCase('tr-TR').includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [matches, activeTab, searchTerm]);

  const handleCloseSingle = async (candidate: MatchCandidate) => {
    setProcessing(true);
    try {
      const hAmount = Math.abs(Number(candidate.hareket.tutar) || 0);
      await apiFetch('/api/reconciliation/batch-close', {
        method: 'POST',
        body: JSON.stringify({
          matches: [{
            hareketId: candidate.hareket.id,
            faturaId: candidate.fatura.id,
            faturaTipi: candidate.faturaTipi,
            odemeTarihi: candidate.hareket.tarih,
            tutar: hAmount
          }]
        })
      });

      const newStatus = candidate.isPartial ? ('kismi_odendi' as any) : ('odendi' as any);
      if (candidate.faturaTipi === 'satis') {
        updateSatisFaturaOdeme(candidate.fatura.id, candidate.hareket.tarih, newStatus);
      } else {
        updateAlisFaturaOdeme(candidate.fatura.id, candidate.hareket.tarih, newStatus);
      }

      updateCariHareket(candidate.hareket.id, {
        bagliFaturaId: candidate.fatura.id,
        cariId: candidate.hareket.cariId || candidate.fatura.cariId || candidate.hareket.cariId
      });

      setClosedIds(prev => new Set([...prev, candidate.hareket.id]));
      toast.success(`Fatura (${candidate.fatura.faturaNo || '-'}) ve banka hareketi başarıyla eşleştirilip ${candidate.isPartial ? 'kısmi ödendi' : 'ödendi'} olarak güncellendi!`);
    } catch (e: any) {
      toast.error('Eşleştirme kapatılırken hata: ' + (e.message || 'Bilinmeyen hata'));
    } finally {
      setProcessing(false);
    }
  };

  const handleBatchCloseHighConfidence = async () => {
    // Aynı faturanın tam kapamada mükerrer kapatılmasını önle
    const usedFaturaIds = new Set<string>();
    const highMatches = matches.filter(m => {
      if (m.confidence !== 'high') return false;
      if (!m.isPartial && usedFaturaIds.has(m.fatura.id)) return false;
      usedFaturaIds.add(m.fatura.id);
      return true;
    });

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
        odemeTarihi: m.hareket.tarih,
        tutar: Math.abs(Number(m.hareket.tutar) || 0)
      }));

      const res = await apiFetch('/api/reconciliation/batch-close', {
        method: 'POST',
        body: JSON.stringify({ matches: payload })
      });

      highMatches.forEach(m => {
        const newStatus = m.isPartial ? ('kismi_odendi' as any) : ('odendi' as any);
        if (m.faturaTipi === 'satis') {
          updateSatisFaturaOdeme(m.fatura.id, m.hareket.tarih, newStatus);
        } else {
          updateAlisFaturaOdeme(m.fatura.id, m.hareket.tarih, newStatus);
        }
        updateCariHareket(m.hareket.id, {
          bagliFaturaId: m.fatura.id,
          cariId: m.hareket.cariId || m.fatura.cariId || m.hareket.cariId
        });
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
  const totalAmount = matches.reduce((acc, m) => acc + Math.abs(Number(m.hareket.tutar) || 0), 0);

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
                Otomatik Banka - Fatura Eşleştirme & Ödeme Kapama Motoru
                <Badge className="bg-yellow-400/20 text-yellow-200 border-yellow-300/40 text-xs font-semibold">
                  Tam & Kısmi Ödeme Destekli
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-emerald-100 text-sm mt-0.5">
                Banka ekstrelerindeki EFT/Havale hareketleri ile açık satış ve alış faturalarınızı otomatik eşleyip tek tıkla kapatın.
              </DialogDescription>
            </div>
          </div>

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
                ? getSatisMusteriAdi(item.fatura as SatisFatura)
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
                          {hBank ? hBank.hesapAdi || hBank.bankaAdi : 'Banka Hareketi'}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-500">{item.hareket.tarih}</span>
                    </div>
                    <div className="text-xs text-slate-600 font-medium line-clamp-2" title={item.hareket.aciklama}>
                      {item.hareket.aciklama || 'Açıklama yok'}
                    </div>
                    <div className="mt-2 text-sm font-bold text-blue-700">
                      {Math.abs(Number(item.hareket.tutar) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
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
                    {item.isPartial && (
                      <span className="mt-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                        Kısmi Ödeme
                      </span>
                    )}
                    <div className="text-[10px] text-slate-500 mt-1 max-w-[150px] leading-tight">
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
                      <div className="text-right">
                        <span className="text-sm font-bold text-emerald-700">
                          {item.faturaKalan.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </span>
                        {item.faturaKalan < item.faturaToplam - 0.05 && (
                          <div className="text-[10px] text-slate-400">
                            Toplam: {item.faturaToplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </div>
                        )}
                      </div>
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
                      {item.isPartial ? 'Kısmi Kapat' : 'Eşle & Kapat'}
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
            Eşlenen faturalar otomatik olarak <strong>'Ödendi / Kısmi Ödendi'</strong> durumuna geçer ve banka hareketiyle bağlanır.
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
