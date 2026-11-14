import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LucaAccountSelect } from '@/components/LucaAccountSelect';
import { cn } from '@/lib/utils';
import { AlertCircle, AlertTriangle, Eye, FileText, Trash2 } from 'lucide-react';
import type { AlisFaturaFormData } from '@/types';
import { KDV_ORANLARI, TEVKIFAT_ORANLARI, formatCurrency, type FormEntry } from './alisFaturaHelpers';

interface AlisFaturaFormCardProps {
  form: FormEntry;
  actualIndex: number;
  hes: {
    matrah: number;
    kdvTutari: number;
    oivTutari: number;
    tevkifatTutari: number;
    stopajTutari: number;
    toplamNet: number;
  };
  isMultiple: boolean;
  duplicateMatch: any;
  isFocusedCard: boolean;
  hasValidationErrors: boolean;
  isIsletmeDefteri: boolean;
  activeCompany: any;
  cariler: any[];
  urunler: any[] | undefined;
  depolar: any[] | undefined;
  varsayilanDepoId: string;
  setActiveFormId: (id: number) => void;
  setForms: React.Dispatch<React.SetStateAction<FormEntry[]>>;
  updateForm: (id: number, field: keyof AlisFaturaFormData | 'tutarTuru', value: string) => void;
  handleVknChange: (formId: number, val: string) => void;
  removeForm: (id: number) => void;
  setPreviewImage: (img: { url: string; name: string } | null) => void;
  setIsUrunFormOpen: (open: boolean) => void;
}

export function AlisFaturaFormCard({
  form,
  actualIndex,
  hes,
  isMultiple,
  duplicateMatch,
  isFocusedCard,
  hasValidationErrors,
  isIsletmeDefteri,
  activeCompany,
  cariler,
  urunler,
  depolar,
  varsayilanDepoId,
  setActiveFormId,
  setForms,
  updateForm,
  handleVknChange,
  removeForm,
  setPreviewImage,
  setIsUrunFormOpen,
}: AlisFaturaFormCardProps) {
  return (
                      <div
                                                id={`alis-form-card-${form.id}`}
                        onClick={() => { if (form.data.dosyaBase64) setActiveFormId(form.id); }}
                        className={cn(
                          "bg-white rounded-xl p-4 shadow-sm relative group transition-all scroll-mt-6",
                          form.aiError || hasValidationErrors
                            ? "border-2 border-red-500 bg-red-50/20 ring-2 ring-red-300/60 shadow-md" 
                            : duplicateMatch
                              ? "border-2 border-amber-400 bg-amber-50/10 ring-2 ring-amber-200/50"
                              : isFocusedCard
                                ? "border-2 border-indigo-500 ring-2 ring-indigo-200/60 shadow-md"
                                : "border border-slate-200"
                        )}
                      >
                        <div className="flex items-center justify-between pb-3 border-b mb-4 gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            {form.data.dosyaBase64 && !form.data.dosyaBase64.startsWith('data:application/pdf') && (
                              <img
                                src={form.data.dosyaBase64}
                                alt={`Satır #${actualIndex + 1}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveFormId(form.id);
                                  setPreviewImage({ url: form.data.dosyaBase64!, name: form.data.dosyaAdi || `Fiş #${actualIndex + 1}` });
                                }}
                                title="Büyütmek için tıklayın"
                                className="w-9 h-9 rounded object-cover border border-slate-300 cursor-zoom-in hover:ring-2 hover:ring-indigo-500 shrink-0"
                              />
                            )}
                            <span className={cn(
                              "text-xs font-bold uppercase",
                              form.aiError || hasValidationErrors ? "text-red-700 font-extrabold" : isFocusedCard ? "text-indigo-700 font-extrabold" : "text-slate-500"
                            )}>
                              Satır #{actualIndex + 1}
                            </span>
                            {isFocusedCard && (
                              <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-300 px-2 py-0.5 rounded-full font-bold">
                                👁️ Soldaki Görselde Açık
                              </span>
                            )}
                            {form.data.dosyaAdi && (
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1",
                                form.aiError ? "bg-red-100 text-red-900 border border-red-200" : "bg-slate-100 text-slate-700"
                              )}>
                                <FileText className={cn("w-3 h-3", form.aiError ? "text-red-500" : "text-slate-500")} />
                                {form.data.dosyaAdi}
                              </span>
                            )}
                            {form.aiError && (
                              <span className="text-xs bg-red-100 text-red-700 border border-red-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse">
                                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                                ⚠️ Okunamadı • Manuel Giriş Gerekli
                              </span>
                            )}
                            {hasValidationErrors && !form.aiError && (
                              <span className="text-xs bg-red-100 text-red-700 border border-red-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                                Eksik Zorunlu Alanlar Var
                              </span>
                            )}
                            {duplicateMatch && (
                              <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Mükerrer Kayıt Şüphesi
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 ml-auto">
                            {form.data.dosyaBase64 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "h-7 text-xs gap-1.5 font-medium",
                                  form.aiError 
                                    ? "text-red-700 border-red-300 hover:bg-red-100 bg-red-50/60" 
                                    : "text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                                )}
                                onClick={() => setPreviewImage({ url: form.data.dosyaBase64!, name: form.data.dosyaAdi || `Fiş #${actualIndex + 1}` })}
                              >
                                <Eye className="w-3.5 h-3.5" /> Fişi Gör
                              </Button>
                            )}
                            {isMultiple && (
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" 
                                onClick={() => removeForm(form.id)}
                                title="Bu fişi listeden çıkar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {duplicateMatch && (
                          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 mb-4 text-xs text-amber-950 flex items-start justify-between gap-2.5 shadow-xs">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <div className="font-bold text-amber-900">
                                  ⚠️ Mükerrer Fiş / Fatura Uyarısı ({duplicateMatch.type === 'existing' ? 'Sistemde Zaten Kayıtlı' : 'Bu Listede Çift Satır'})
                                </div>
                                <p className="text-amber-800 mt-0.5">
                                  {duplicateMatch.reason} — <b>{duplicateMatch.invoice.tedarikciAdi || 'Firma'}</b> ({duplicateMatch.invoice.faturaTarihi}, Fatura No: <b>{duplicateMatch.invoice.faturaNo || '-'}</b>)
                                </p>
                              </div>
                            </div>
                            {isMultiple && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); removeForm(form.id); }}
                                className="h-7 text-[11px] border-amber-400 text-amber-900 hover:bg-amber-200 shrink-0"
                              >
                                Mükerreri Kaldır
                              </Button>
                            )}
                          </div>
                        )}

                        {form.aiError && (
                          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3.5 mb-4 text-xs text-red-950 flex items-start gap-2.5 shadow-xs">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <div className="font-bold flex items-center justify-between">
                                <span className="text-red-900 font-bold">Yapay Zeka Bu Fişi Okuyamadı</span>
                                {form.data.dosyaBase64 && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewImage({ url: form.data.dosyaBase64!, name: form.data.dosyaAdi || `Fiş #${actualIndex + 1}` })}
                                    className="text-red-700 hover:text-red-900 underline font-bold flex items-center gap-1 text-[11px]"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> Fiş Görselini Aç ve İncele
                                  </button>
                                )}
                              </div>
                              <p className="text-red-800 mt-0.5 font-medium">Hata Nedeni: {form.aiError}</p>
                              <p className="text-slate-600 mt-1">
                                Görsel kaybolmaması için listeye eklendi. "Fiş Görselini Aç" butonuna basarak fişteki <b>Tutar, KDV, Tarih ve Firma Adı</b> bilgilerini aşağıdaki alanlara doldurabilirsiniz.
                              </p>
                            </div>
                          </div>
                        )}

                    <div className={cn("grid gap-4 mb-4", !isIsletmeDefteri ? "grid-cols-2" : "grid-cols-1")}>
                      <div>
                        <Label className="text-xs font-medium text-emerald-600 mb-1 block">Kayıtlı Tedarikçi Seç (Cari)</Label>
                        <Select
                          value={String(form.data.cariId ?? 'yok')}
                          onValueChange={(val) => {
                            if (val === 'yok') {
                              setForms(prev => prev.map(fp => fp.id === form.id ? { ...fp, data: { ...fp.data, cariId: undefined } } : fp));
                              return;
                            }
                            const c = (cariler || []).find(x => String(x.id ?? '') === val);
                            if (c) {
                              setForms(prev => prev.map(fp => {
                                if (fp.id === form.id) {
                                  return {
                                    ...fp,
                                    data: {
                                      ...fp.data,
                                      cariId: c.id,
                                      tedarikciAdi: c.unvan,
                                      tedarikciVkn: c.vknTckn
                                    },
                                    errors: {}
                                  };
                                }
                                return fp;
                              }));
                            }
                          }}
                        >
                          <SelectTrigger className="w-full h-9 bg-emerald-50/30 border-emerald-100">
                            <SelectValue placeholder="Tedarikçilerinizden seçin..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yok" className="text-slate-500 font-medium">-- Serbest Devam Et --</SelectItem>
                            {(cariler || []).filter(c => c && c.tip !== 'musteri' && c.id !== undefined && c.id !== null && String(c.id).trim() !== '').map((c, idx) => (
                               <SelectItem key={c.id !== undefined && c.id !== null ? String(c.id) : `cari-${idx}`} value={String(c.id ?? '')}>
                                 {String(c.unvan ?? 'Bilinmiyor')} ({String(c.vknTckn ?? '')})
                               </SelectItem>
                             ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {!isIsletmeDefteri && (
                        <div>
                          <Label className="text-xs font-medium text-amber-600 mb-1 block">Ödeme / Karşı Hesap (Fişler İçin)</Label>
                          <LucaAccountSelect
                            value={form.data.karsiHesapKodu || ''}
                            onChange={(val) => updateForm(form.id, 'karsiHesapKodu', val)}
                            placeholder="Kasa / Banka hesabı seçin..."
                            className="h-9 bg-amber-50/30 border-amber-100"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Belge/Fatura No <span className="text-red-500">*</span></Label>
                        <Input data-field="faturaNo" value={form.data.faturaNo} onChange={(e) => updateForm(form.id, 'faturaNo', e.target.value)} className={form.errors.faturaNo ? 'border-red-500 ring-2 ring-red-200 h-9' : 'h-9'} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Fatura Tarihi <span className="text-red-500">*</span></Label>
                        <Input data-field="faturaTarihi" type="date" value={form.data.faturaTarihi} onChange={(e) => updateForm(form.id, 'faturaTarihi', e.target.value)} className={form.errors.faturaTarihi ? 'border-red-500 ring-2 ring-red-200 h-9' : 'h-9'} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Vade Tarihi</Label>
                        <Input type="date" value={form.data.vadeTarihi || ''} onChange={(e) => updateForm(form.id, 'vadeTarihi', e.target.value)} className="h-9" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Firma / Tedarikçi<span className="text-red-500">*</span></Label>
                        <Input data-field="tedarikciAdi" value={form.data.tedarikciAdi} onChange={(e) => updateForm(form.id, 'tedarikciAdi', e.target.value)} className={form.errors.tedarikciAdi ? 'border-red-500 ring-2 ring-red-200 h-9' : 'h-9'} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">VKN / T.C.<span className="text-red-500">*</span></Label>
                        <Input data-field="tedarikciVkn" value={form.data.tedarikciVkn} onChange={(e) => handleVknChange(form.id, e.target.value)} className={form.errors.tedarikciVkn ? 'border-red-500 ring-2 ring-red-200 h-9' : 'h-9'} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-blue-600 mb-1 flex items-center justify-between">
                          Stok Kartı Bağla (Opsiyonel)
                          <Button 
                            type="button" 
                            variant="link" 
                            className="h-auto p-0 text-[10px] font-bold h-4" 
                            onClick={() => setIsUrunFormOpen(true)}
                          >
                            + Yeni Stok Kartı
                          </Button>
                        </Label>
                        <Select
                          value={form.data.urunId || 'yok'}
                          onValueChange={(val) => {
                            const selectedUrun = urunler?.find(u => u.id === val);
                            updateForm(form.id, 'urunId', val === 'yok' ? '' : val);
                            if (selectedUrun) {
                               updateForm(form.id, 'malHizmetAdi', selectedUrun.urunAdi || 'İsimsiz Ürün');
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 border-blue-100 bg-blue-50/20">
                            <SelectValue placeholder="Stok seçiniz..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yok">Bağlama Yapma</SelectItem>
                            {(!urunler || urunler.length === 0) ? (
                              <SelectItem value="none" disabled className="text-slate-400 italic">Sistemde hiç stok kartınız yok (+ Yeni ekleyin)</SelectItem>
                            ) : urunler.map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.urunAdi || 'İsimsiz'} ({u.stokKodu})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                         <Label className="text-xs font-medium text-slate-500">Hedef Depo</Label>
                         <Select
                          value={form.data.depoId || varsayilanDepoId}
                          onValueChange={(val) => updateForm(form.id, 'depoId', val)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Depo seçiniz..." />
                          </SelectTrigger>
                          <SelectContent>
                            {depolar?.map(d => (
                              <SelectItem key={d.id} value={d.id}>{d.ad}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <Label className="text-xs font-medium text-slate-500">Hizmet/Ürün Açıklaması<span className="text-red-500">*</span></Label>
                      <Input data-field="malHizmetAdi" value={form.data.malHizmetAdi} onChange={(e) => updateForm(form.id, 'malHizmetAdi', e.target.value)} className={form.errors.malHizmetAdi ? 'border-red-500 ring-2 ring-red-200 h-9' : 'h-9'} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Belge Notu / Genel Açıklama</Label>
                        <Input value={form.data.aciklama} onChange={(e) => updateForm(form.id, 'aciklama', e.target.value)} placeholder="Örn: Proje bazlı alım" className="h-9" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-indigo-600">Araç Plakası (Gider Kısıtı İçin)</Label>
                        <Select
                          value={form.data.vehiclePlate || 'yok'}
                          onValueChange={(val) => updateForm(form.id, 'vehiclePlate', val === 'yok' ? '' : val)}
                        >
                          <SelectTrigger className="h-9 border-indigo-100 bg-indigo-50/20">
                            <SelectValue placeholder="Plaka seçiniz..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yok">Araçsız / Diğer</SelectItem>
                            {activeCompany?.vehicles?.map((v: any) => (
                              <SelectItem key={v.id} value={v.plate}>{v.plate} ({v.type === 'passenger' ? 'Binek' : 'Ticari'})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Luca Muhasebe Kodu Seçimi */}
                    <div className="space-y-2 mb-4">
                      <Label className="text-xs font-semibold text-indigo-700 block">🔍 Luca Muhasebe Kodu</Label>
                      <LucaAccountSelect 
                        value={form.data.muhasebeKodu || ''} 
                        onChange={(val) => updateForm(form.id, 'muhasebeKodu', val)}
                        placeholder="Ana hesap kodu seçin (örn: 153.01.001)..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Tutar Değeri <span className="text-red-500">*</span></Label>
                        <Input data-field="toplamTutar" type="number" min="0" step="0.01" value={form.data.toplamTutar} onChange={(e) => updateForm(form.id, 'toplamTutar', e.target.value)} className={form.errors.toplamTutar ? 'border-red-500 ring-2 ring-red-200 h-9' : 'h-9'} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Girdiğiniz Tutar Neyin Tutarı?</Label>
                        <div className="flex bg-slate-100 p-1 rounded-md">
                          <button type="button" onClick={() => updateForm(form.id, 'tutarTuru', 'dahil')} className={cn("flex-1 text-xs font-medium py-1.5 rounded transition-all", form.tutarTuru === 'dahil' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>Net Ödenecek (KDV Dahil)</button>
                          <button type="button" onClick={() => updateForm(form.id, 'tutarTuru', 'haric')} className={cn("flex-1 text-xs font-medium py-1.5 rounded transition-all", form.tutarTuru === 'haric' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>Brüt Matrah (KDV Hariç)</button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="space-y-2 border-r pr-2">
                        <Label className="text-xs font-medium text-slate-500">KDV Oranı</Label>
                        <div className="flex flex-wrap gap-1">
                          {KDV_ORANLARI.map((oran) => (
                            <button key={oran} type="button" onClick={() => updateForm(form.id, 'kdvOrani', oran)} className={cn("px-2 py-1 rounded text-xs transition-all border", form.data.kdvOrani === oran ? "bg-primary border-primary text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300")}>
                              %{oran}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2 border-r px-2">
                        <Label className="text-xs font-medium text-slate-500">KDV Tevkifatı (Kesinti)</Label>
                        <div className="flex flex-wrap gap-1">
                          {TEVKIFAT_ORANLARI.map((oran) => (
                            <button key={oran} type="button" onClick={() => updateForm(form.id, 'tevkifatOrani', oran)} className={cn("px-1.5 py-1 rounded text-[10px] transition-all border", form.data.tevkifatOrani === oran ? "bg-amber-500 border-amber-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300")}>
                              {oran === '0' ? 'Yok' : oran}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2 pl-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs font-medium text-slate-500">Stopaj Oranı</Label>
                            <div className="flex items-center gap-1 mt-1">
                              <Input type="number" min="0" max="100" value={form.data.stopajOrani} onChange={(e) => updateForm(form.id, 'stopajOrani', e.target.value)} className="h-8 w-14 text-xs" />
                              <span className="text-xs text-slate-400">%</span>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-purple-700" title="Özel İletişim Vergisi / Konaklama Vergisi (KKEG 689.01)">ÖİV / Özel Vergi (TL)</Label>
                            <div className="flex items-center gap-1 mt-1">
                              <Input type="number" min="0" step="0.01" value={form.data.oivTutari || '0'} onChange={(e) => updateForm(form.id, 'oivTutari', e.target.value)} className="h-8 w-full text-xs border-purple-200 bg-purple-50/30" placeholder="0.00" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {(hes.matrah > 0 || hes.kdvTutari > 0 || hes.oivTutari > 0) && (
                      <div className="bg-slate-50 rounded p-3 text-xs flex flex-wrap gap-4 border items-center">
                        <div className="text-slate-500">Brüt Matrah: <strong className="text-slate-900">{formatCurrency(hes.matrah)}</strong></div>
                        <div className="text-slate-500">Top. KDV: <strong className="text-slate-900">{formatCurrency(hes.kdvTutari)}</strong></div>
                        {hes.oivTutari > 0 && <div className="text-purple-700">ÖİV / Özel Vergi (KKEG): <strong>{formatCurrency(hes.oivTutari)}</strong></div>}
                        {hes.tevkifatTutari > 0 && <div className="text-amber-600">Devreden Tevkifat: <strong>-{formatCurrency(hes.tevkifatTutari)}</strong></div>}
                        {hes.stopajTutari > 0 && <div className="text-red-500">Stopaj Kesintisi: <strong>-{formatCurrency(hes.stopajTutari)}</strong></div>}

                        <div className="ml-auto text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded">
                          Net Ödenen: {formatCurrency(hes.toplamNet)}
                        </div>
                      </div>
                    )}
                  </div>
  );
}
