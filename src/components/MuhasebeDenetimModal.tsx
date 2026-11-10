import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ShieldAlert,
  CheckCircle2,
  Trash2,
  Download,
  AlertTriangle,
  Copy,
  Hash,
  Scale,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface MuhasebeDenetimModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MuhasebeDenetimModal({ open, onOpenChange }: MuhasebeDenetimModalProps) {
  const {
    satisFaturalari,
    alisFaturalari,
    cariHareketler,
    cariler,
    deleteSatisFatura,
    deleteAlisFatura,
    deleteCariHareket,
  } = useApp();

  const [activeTab, setActiveTab] = useState('mukerrer-fatura');

  // 1) Mükerrer Faturalar (Aynı Fatura No veya Aynı VKN+Tarih+Tutar)
  const duplicateInvoices = useMemo(() => {
    const results: Array<{
      key: string;
      tip: 'satis' | 'alis';
      reason: string;
      faturaNo: string;
      tarih: string;
      unvan: string;
      tutar: number;
      duplicateId: string;
      originalId: string;
    }> = [];

    const checkList = (
      items: any[],
      tip: 'satis' | 'alis',
      getAmount: (x: any) => number,
      getUnvan: (x: any) => string,
      getVkn: (x: any) => string
    ) => {
      const byNo = new Map<string, any>();
      const bySignature = new Map<string, any>();

      for (const item of items) {
        if (item.durum === 'iptal') continue;
        const fNo = String(item.faturaNo || '').trim().toUpperCase();
        const tutar = Math.round((getAmount(item) || 0) * 100) / 100;
        const unvan = getUnvan(item);
        const vkn = getVkn(item);
        const tarih = String(item.faturaTarihi || '').slice(0, 10);

        if (fNo && fNo.length >= 4) {
          if (byNo.has(fNo)) {
            const orig = byNo.get(fNo);
            results.push({
              key: `${tip}_no_${item.id}`,
              tip,
              reason: `Aynı Fatura Numarası (${fNo})`,
              faturaNo: fNo,
              tarih,
              unvan,
              tutar,
              duplicateId: item.id,
              originalId: orig.id,
            });
            continue;
          }
          byNo.set(fNo, item);
        }

        if (tutar > 0 && tarih && (vkn || unvan)) {
          const sig = `${vkn || unvan.toLowerCase()}|${tarih}|${tutar.toFixed(2)}`;
          if (bySignature.has(sig)) {
            const orig = bySignature.get(sig);
            results.push({
              key: `${tip}_sig_${item.id}`,
              tip,
              reason: 'Aynı Gün, Aynı Cari ve Aynı Tutar',
              faturaNo: fNo || '-',
              tarih,
              unvan,
              tutar,
              duplicateId: item.id,
              originalId: orig.id,
            });
          } else {
            bySignature.set(sig, item);
          }
        }
      }
    };

    checkList(
      satisFaturalari || [],
      'satis',
      (x) => Number(x.alinanUcret) || 0,
      (x) => `${x.ad || ''} ${x.soyad || ''}`.trim(),
      (x) => String(x.tcVkn || '').trim()
    );
    checkList(
      alisFaturalari || [],
      'alis',
      (x) => Number(x.toplamTutar) || 0,
      (x) => String(x.tedarikciAdi || '').trim(),
      (x) => String(x.tedarikciVkn || '').trim()
    );

    return results;
  }, [satisFaturalari, alisFaturalari]);

  // 2) Mükerrer Banka Hareketleri
  const duplicateBankMovements = useMemo(() => {
    const results: Array<{
      id: string;
      tarih: string;
      tutar: number;
      aciklama: string;
      islemTuru: string;
    }> = [];
    const seen = new Map<string, any>();

    for (const h of cariHareketler || []) {
      const tarih = String(h.tarih || '').slice(0, 10);
      const tutar = Math.round((Number(h.tutar) || 0) * 100) / 100;
      const desc = String(h.aciklama || '').trim().toLowerCase();
      if (!tarih || tutar <= 0) continue;
      const sig = `${h.bankaId || ''}|${tarih}|${h.islemTuru}|${tutar.toFixed(2)}|${desc}`;
      if (seen.has(sig)) {
        results.push({
          id: h.id,
          tarih,
          tutar,
          aciklama: h.aciklama || '-',
          islemTuru: h.islemTuru,
        });
      } else {
        seen.set(sig, h);
      }
    }
    return results;
  }, [cariHareketler]);

  // 3) Satış Faturalarında Eksik / Atlamış Müteselsil Sıra Numaraları
  const missingSequenceNumbers = useMemo(() => {
    const groups = new Map<string, Array<{ num: number; raw: string; digitsLen: number; tarih: string }>>();

    for (const sf of satisFaturalari || []) {
      if (sf.durum === 'iptal') continue;
      const raw = String(sf.faturaNo || '').trim().toUpperCase();
      // E-Fatura / E-Arşiv formatı: 3 harf + 4 yıl + 9 hane sıra no (Örn: GIB2026000000015) veya genel seri+no
      const match = raw.match(/^([A-Z]{2,5}\d{4})(\d{5,12})$/);
      if (!match) continue;
      const prefix = match[1];
      const seqStr = match[2];
      const num = parseInt(seqStr, 10);
      if (isNaN(num)) continue;
      if (!groups.has(prefix)) groups.set(prefix, []);
      groups.get(prefix)!.push({
        num,
        raw,
        digitsLen: seqStr.length,
        tarih: sf.faturaTarihi || '',
      });
    }

    const gaps: Array<{
      prefix: string;
      missingNo: string;
      prevNo: string;
      nextNo: string;
      prevDate: string;
      nextDate: string;
    }> = [];

    for (const [prefix, list] of groups.entries()) {
      const sorted = [...list].sort((a, b) => a.num - b.num);
      for (let i = 0; i < sorted.length - 1; i++) {
        const curr = sorted[i];
        const next = sorted[i + 1];
        const diff = next.num - curr.num;
        if (diff > 1 && diff <= 25) {
          for (let m = curr.num + 1; m < next.num; m++) {
            gaps.push({
              prefix,
              missingNo: `${prefix}${String(m).padStart(curr.digitsLen, '0')}`,
              prevNo: curr.raw,
              nextNo: next.raw,
              prevDate: curr.tarih,
              nextDate: next.tarih,
            });
          }
        }
      }
    }

    return gaps;
  }, [satisFaturalari]);

  // 4) Ters Bakiye Veren Cariler & Muhasebe Kodu Eksik Kayıtlar
  const accountWarnings = useMemo(() => {
    const warnings: Array<{
      id: string;
      kategori: string;
      unvan: string;
      detay: string;
      seviye: 'high' | 'medium';
    }> = [];

    for (const c of cariler || []) {
      const kod = String(c.muhasebeKodu || '').trim();
      if (!kod) {
        warnings.push({
          id: `cari_kod_${c.id}`,
          kategori: 'Eksik Muhasebe Kodu',
          unvan: c.unvan,
          detay: `Cari kartta 120 / 320 muhasebe hesap kodu tanımlanmamış (VKN: ${c.vknTckn || 'Yok'})`,
          seviye: 'medium',
        });
      }
      if (!c.vknTckn || String(c.vknTckn).trim().length < 10) {
        warnings.push({
          id: `cari_vkn_${c.id}`,
          kategori: 'Eksik VKN / TCKN',
          unvan: c.unvan,
          detay: `Cari kartta geçerli 10/11 haneli VKN/TCKN bulunmuyor (${c.vknTckn || 'Boş'})`,
          seviye: 'medium',
        });
      }
    }

    for (const af of alisFaturalari || []) {
      if (af.durum === 'iptal') continue;
      const matrah = Number(af.matrah) || 0;
      const kdv = Number(af.kdvTutari) || 0;
      const oiv = Number(af.oivTutari) || 0;
      const telsiz = Number(af.telsizKullanimUcreti) || 0;
      const toplam = Number(af.toplamTutar) || 0;
      if (matrah > 0 && toplam > 0 && Math.abs(matrah + kdv + oiv + telsiz - toplam) > 2.0) {
        warnings.push({
          id: `alis_math_${af.id}`,
          kategori: 'Matrah + Vergi != Toplam',
          unvan: `${af.faturaNo || '-'} - ${af.tedarikciAdi || ''}`,
          detay: `Matrah (${matrah.toFixed(2)}) + KDV/Ek Vergi (${(kdv + oiv + telsiz).toFixed(2)}) toplamı Fatura Toplamına (${toplam.toFixed(2)}) eşit değil.`,
          seviye: 'high',
        });
      }
    }

    return warnings;
  }, [cariler, alisFaturalari]);

  const totalIssueCount =
    duplicateInvoices.length +
    duplicateBankMovements.length +
    missingSequenceNumbers.length +
    accountWarnings.length;

  const handleExportAuditExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        duplicateInvoices.map((d) => ({
          Tür: d.tip === 'satis' ? 'Satış Faturası' : 'Alış Faturası',
          'Fatura No': d.faturaNo,
          Tarih: d.tarih,
          Cari: d.unvan,
          Tutar: d.tutar,
          'Mükerrer Nedeni': d.reason,
        }))
      ),
      'Mukerrer_Faturalar'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        missingSequenceNumbers.map((m) => ({
          Seri: m.prefix,
          'Eksik Fatura No': m.missingNo,
          'Önceki Fatura': `${m.prevNo} (${m.prevDate})`,
          'Sonraki Fatura': `${m.nextNo} (${m.nextDate})`,
        }))
      ),
      'Eksik_Sira_Numaralari'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        accountWarnings.map((w) => ({
          Kategori: w.kategori,
          'Cari / Evrak': w.unvan,
          Açıklama: w.detay,
        }))
      ),
      'Muhasebe_Uyarilari'
    );
    XLSX.writeFile(wb, `Muhasebe_Denetim_Raporu_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Muhasebe denetim raporu Excel olarak indirildi.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[960px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span className="flex items-center gap-2 text-slate-900">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              🛡️ Muhasebe Denetim & Kontrol Paneli (Mükerrer Kayıt, Eksik Sıra No & Kod Denetçisi)
            </span>
            <Button size="sm" variant="outline" onClick={handleExportAuditExcel} className="h-8 text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Denetim Raporu İndir (.xlsx)
            </Button>
          </DialogTitle>
          <DialogDescription>
            Ay sonu beyanname ve Luca aktarımı öncesinde çift girilmiş faturaları, mükerrer banka hareketlerini, atlamış satış faturası sıra numaralarını ve eksik muhasebe kodlarını otomatik denetler.
          </DialogDescription>
        </DialogHeader>

        {/* Özet Kartlar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
          <div className="p-3 rounded-xl border bg-red-50/60 border-red-200">
            <div className="text-[11px] font-bold text-red-700 flex items-center gap-1">
              <Copy className="w-3.5 h-3.5" /> Mükerrer Fatura
            </div>
            <div className="text-2xl font-bold text-red-900 mt-1">{duplicateInvoices.length}</div>
          </div>
          <div className="p-3 rounded-xl border bg-amber-50/60 border-amber-200">
            <div className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
              <Copy className="w-3.5 h-3.5" /> Mükerrer Banka Hareketi
            </div>
            <div className="text-2xl font-bold text-amber-900 mt-1">{duplicateBankMovements.length}</div>
          </div>
          <div className="p-3 rounded-xl border bg-indigo-50/60 border-indigo-200">
            <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" /> Atlamış Fatura Sıra No
            </div>
            <div className="text-2xl font-bold text-indigo-900 mt-1">{missingSequenceNumbers.length}</div>
          </div>
          <div className="p-3 rounded-xl border bg-slate-50 border-slate-200">
            <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Scale className="w-3.5 h-3.5" /> Kod & Tutar Uyarısı
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{accountWarnings.length}</div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
          <TabsList className="bg-slate-100 p-1 rounded-xl w-full justify-start overflow-x-auto">
            <TabsTrigger value="mukerrer-fatura" className="text-xs">
              🔁 Mükerrer Faturalar ({duplicateInvoices.length})
            </TabsTrigger>
            <TabsTrigger value="mukerrer-banka" className="text-xs">
              🏦 Mükerrer Banka ({duplicateBankMovements.length})
            </TabsTrigger>
            <TabsTrigger value="eksik-sira" className="text-xs">
              🔢 Eksik Fatura Sıra No ({missingSequenceNumbers.length})
            </TabsTrigger>
            <TabsTrigger value="kod-uyari" className="text-xs">
              ⚠️ Kod & Matrah Uyarıları ({accountWarnings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mukerrer-fatura">
            <div className="border rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2.5 text-left">Tür & Fatura No</th>
                    <th className="p-2.5 text-left">Tarih</th>
                    <th className="p-2.5 text-left">Cari Unvan</th>
                    <th className="p-2.5 text-right">Tutar</th>
                    <th className="p-2.5 text-left">Tespit Nedeni</th>
                    <th className="p-2.5 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {duplicateInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-emerald-600 font-medium">
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-1" />
                        Mükerrer (çift girilmiş) alış veya satış faturası bulunmadı.
                      </td>
                    </tr>
                  ) : (
                    duplicateInvoices.map((d) => (
                      <tr key={d.key} className="hover:bg-red-50/30">
                        <td className="p-2.5 font-mono font-bold">
                          <Badge variant="outline" className="mr-1.5 text-[10px]">
                            {d.tip === 'satis' ? 'SATIŞ' : 'ALIŞ'}
                          </Badge>
                          {d.faturaNo}
                        </td>
                        <td className="p-2.5">{d.tarih}</td>
                        <td className="p-2.5">{d.unvan}</td>
                        <td className="p-2.5 text-right font-bold">
                          {d.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </td>
                        <td className="p-2.5 text-red-600 font-medium">{d.reason}</td>
                        <td className="p-2.5 text-right">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-[11px]"
                            onClick={async () => {
                              if (d.tip === 'satis') await deleteSatisFatura(d.duplicateId);
                              else await deleteAlisFatura(d.duplicateId);
                              toast.success('Mükerrer fatura kaydı silindi.');
                            }}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Çift Kaydı Sil
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="mukerrer-banka">
            <div className="border rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2.5 text-left">Tarih</th>
                    <th className="p-2.5 text-left">Açıklama</th>
                    <th className="p-2.5 text-right">Tutar</th>
                    <th className="p-2.5 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {duplicateBankMovements.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-emerald-600 font-medium">
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-1" />
                        Mükerrer banka hareketi bulunmadı.
                      </td>
                    </tr>
                  ) : (
                    duplicateBankMovements.map((h) => (
                      <tr key={h.id} className="hover:bg-amber-50/40">
                        <td className="p-2.5">{h.tarih}</td>
                        <td className="p-2.5">{h.aciklama}</td>
                        <td className="p-2.5 text-right font-bold">
                          {h.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </td>
                        <td className="p-2.5 text-right">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-[11px]"
                            onClick={async () => {
                              await deleteCariHareket(h.id);
                              toast.success('Mükerrer banka hareketi silindi.');
                            }}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Sil
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="eksik-sira">
            <div className="border rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2.5 text-left">Seri</th>
                    <th className="p-2.5 text-left">Arada Eksik (Atlamış) Fatura No</th>
                    <th className="p-2.5 text-left">Önceki Fatura</th>
                    <th className="p-2.5 text-left">Sonraki Fatura</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {missingSequenceNumbers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-emerald-600 font-medium">
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-1" />
                        Satış faturalarında müteselsil sıra numarası atlaması tespit edilmedi.
                      </td>
                    </tr>
                  ) : (
                    missingSequenceNumbers.map((g, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/30">
                        <td className="p-2.5 font-bold">{g.prefix}</td>
                        <td className="p-2.5 font-mono font-bold text-red-600">{g.missingNo}</td>
                        <td className="p-2.5 font-mono text-slate-600">
                          {g.prevNo} ({g.prevDate})
                        </td>
                        <td className="p-2.5 font-mono text-slate-600">
                          {g.nextNo} ({g.nextDate})
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="kod-uyari">
            <div className="border rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2.5 text-left">Kategori</th>
                    <th className="p-2.5 text-left">Cari / Evrak</th>
                    <th className="p-2.5 text-left">Detay</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {accountWarnings.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-emerald-600 font-medium">
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-1" />
                        Tüm cari kodları ve fatura matrah/toplam dengeleri tam uyumlu.
                      </td>
                    </tr>
                  ) : (
                    accountWarnings.map((w) => (
                      <tr key={w.id}>
                        <td className="p-2.5">
                          <Badge
                            variant="outline"
                            className={
                              w.seviye === 'high'
                                ? 'border-red-200 text-red-700 bg-red-50'
                                : 'border-amber-200 text-amber-700 bg-amber-50'
                            }
                          >
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {w.kategori}
                          </Badge>
                        </td>
                        <td className="p-2.5 font-semibold text-slate-800">{w.unvan}</td>
                        <td className="p-2.5 text-slate-600">{w.detay}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-500">
              Toplam Denetim Bulgusu: <b>{totalIssueCount}</b>
            </span>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Kapat
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
