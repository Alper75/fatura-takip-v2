import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, BrainCircuit, UploadCloud, Trash2, Check, X, FileSpreadsheet, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import * as XLSX from 'xlsx';

type KuralTipi = 'fatura' | 'banka';

interface GeneratedRule {
  _uid: string;
  kural_adi?: string;
  anahtar_kelime: string;
  muhasebe_kodu: string;
}

interface SavedRule {
  id: string;
  kural_tipi: KuralTipi;
  kural_adi: string;
  anahtar_kelime: string;
  muhasebe_kodu: string;
  olusturma_tarihi?: string;
}

interface ParsedExcelResult {
  rows: string[];
  totalRows: number;
  usedRows: number;
  sheetCount: number;
  firstSheetName: string;
}

const EXCEL_ROW_LIMIT = 2000;

const isExcelFile = (file: File) => /\.xlsx?$/i.test(file.name);
const isXmlFile = (file: File) => /\.xml$/i.test(file.name);

const createUid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const jsonToBase64DataUrl = (payload: unknown): string => {
  const jsonString = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(jsonString);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:application/json;base64,${btoa(binary)}`;
};

const getElementsByLocalName = (root: Document | Element, localName: string): Element[] => {
  const byNs = Array.from(root.getElementsByTagNameNS('*', localName));
  if (byNs.length > 0) return byNs;
  return Array.from(root.getElementsByTagName(localName));
};

const extractUblPartyName = (xmlDoc: Document, containerTag: 'AccountingSupplierParty' | 'AccountingCustomerParty'): string => {
  const container = getElementsByLocalName(xmlDoc, containerTag)[0];
  if (!container) return '';

  const partyNameNode = getElementsByLocalName(container, 'PartyName')[0];
  if (partyNameNode) {
    const name = getElementsByLocalName(partyNameNode, 'Name')[0]?.textContent?.trim();
    if (name) return name;
  }

  // Şahıs firmalarında PartyName yerine Person (FirstName + FamilyName) bulunabilir
  const personNode = getElementsByLocalName(container, 'Person')[0];
  if (personNode) {
    const first = getElementsByLocalName(personNode, 'FirstName')[0]?.textContent?.trim() || '';
    const family = getElementsByLocalName(personNode, 'FamilyName')[0]?.textContent?.trim() || '';
    const fullName = `${first} ${family}`.trim();
    if (fullName) return fullName;
  }

  return '';
};

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.message || `İstek başarısız oldu (${res.status})`);
  }
  return data as T;
}

export default function AkilliOgrenme() {
  const [muavinFile, setMuavinFile] = useState<File | null>(null);
  const [digerFiles, setDigerFiles] = useState<File[]>([]);
  const [kuralTipi, setKuralTipi] = useState<KuralTipi>('fatura');

  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [truncationNotices, setTruncationNotices] = useState<string[]>([]);
  const [generatedRules, setGeneratedRules] = useState<GeneratedRule[]>([]);
  const [savedRules, setSavedRules] = useState<SavedRule[]>([]);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const data = await apiFetch<{ success: boolean; kurallar?: SavedRule[]; message?: string }>(
        '/api/yapay-zeka-kurallari'
      );
      if (data.success && Array.isArray(data.kurallar)) {
        setSavedRules(data.kurallar);
      } else {
        toast.error(data.message || 'Kayıtlı kurallar alınamadı.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Kayıtlı kurallar yüklenirken hata oluştu.');
    }
  };

  const parseExcelRows = async (file: File): Promise<ParsedExcelResult> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error(`${file.name} içinde okunabilir çalışma sayfası bulunamadı.`);
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
    const limitedRows = rows.slice(0, EXCEL_ROW_LIMIT);

    // Sütun hizasını (ör. Borç | Alacak) korumak için boş hücreleri atmak yerine boş string olarak tutuyoruz
    const compactRows = limitedRows
      .map((row) => {
        if (!Array.isArray(row)) return '';
        const cells = row.map((cell) => (cell == null ? '' : String(cell).trim()));
        if (!cells.some((c) => c.length > 0)) return '';
        return cells.join(' | ');
      })
      .filter((r) => r.length > 0);

    return {
      rows: compactRows,
      totalRows: rows.length,
      usedRows: limitedRows.length,
      sheetCount: workbook.SheetNames.length,
      firstSheetName,
    };
  };

  const parseMultipleExcelsForAI = async (files: File[]) => {
    const notices: string[] = [];
    const parsedResults = await Promise.all(files.map((file) => parseExcelRows(file)));

    const combinedRows: string[] = [];
    parsedResults.forEach((result, idx) => {
      const file = files[idx];
      if (result.totalRows > EXCEL_ROW_LIMIT || result.sheetCount > 1) {
        const parts: string[] = [];
        if (result.totalRows > EXCEL_ROW_LIMIT) {
          parts.push(`${result.totalRows} satırdan ilk ${EXCEL_ROW_LIMIT} satır`);
        }
        if (result.sheetCount > 1) {
          parts.push(`${result.sheetCount} sayfadan yalnızca "${result.firstSheetName}" sayfası`);
        }
        notices.push(`${file.name}: ${parts.join(' ve ')} kullanıldı.`);
      }

      if (files.length > 1) {
        combinedRows.push(`--- DOSYA: ${file.name} ---`);
      }
      combinedRows.push(...result.rows);
    });

    return {
      base64: jsonToBase64DataUrl(combinedRows),
      notices,
    };
  };

  const parseMultipleXMLsForAI = async (files: File[]) => {
    const parser = new DOMParser();
    const texts = await Promise.all(files.map((file) => file.text()));

    let corruptCount = 0;
    const combinedData: { tedarikci: string; musteri: string; urunler: string[] }[] = [];

    texts.forEach((text) => {
      const xmlDoc = parser.parseFromString(text, 'text/xml');
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        corruptCount++;
        return;
      }

      const tedarikci = extractUblPartyName(xmlDoc, 'AccountingSupplierParty');
      const musteri = extractUblPartyName(xmlDoc, 'AccountingCustomerParty');

      const items: string[] = [];
      const invoiceLines = getElementsByLocalName(xmlDoc, 'InvoiceLine');
      for (const line of invoiceLines) {
        const itemNode = getElementsByLocalName(line, 'Item')[0];
        if (itemNode) {
          const itemName = getElementsByLocalName(itemNode, 'Name')[0]?.textContent?.trim();
          if (itemName) items.push(itemName);
        }
      }

      if (tedarikci || musteri || items.length > 0) {
        combinedData.push({ tedarikci, musteri, urunler: items });
      }
    });

    if (corruptCount > 0) {
      toast.warning(`${corruptCount} adet bozuk/geçersiz XML dosyası atlandı.`);
    }

    if (combinedData.length === 0) {
      throw new Error('Seçilen XML dosyalarından geçerli fatura verisi okunamadı.');
    }

    // Aynı tedarikçi-müşteri çiftini tekilleştirerek payload boyutunu küçült
    const uniqueMap = new Map<string, { tedarikci: string; musteri: string; urunler: Set<string> }>();
    for (const entry of combinedData) {
      const groupKey = `${entry.tedarikci}||${entry.musteri}`;
      let existing = uniqueMap.get(groupKey);
      if (!existing) {
        existing = { tedarikci: entry.tedarikci, musteri: entry.musteri, urunler: new Set() };
        uniqueMap.set(groupKey, existing);
      }
      entry.urunler.forEach((u) => existing!.urunler.add(u));
    }

    const finalData = Array.from(uniqueMap.values()).map((g) => ({
      tedarikci: g.tedarikci,
      musteri: g.musteri,
      urunler: Array.from(g.urunler),
    }));

    return jsonToBase64DataUrl(finalData);
  };

  const handleLearn = async () => {
    if (!muavinFile || digerFiles.length === 0) {
      toast.error('Lütfen hem Muavin Defter hem de Dış Veri (Fatura/Banka) dosyalarını yükleyin.');
      return;
    }

    if (!isExcelFile(muavinFile)) {
      toast.error('Muavin defteri için lütfen geçerli bir Excel (.xlsx / .xls) dosyası seçin.');
      return;
    }

    const allXml = digerFiles.every(isXmlFile);
    const allExcel = digerFiles.every(isExcelFile);

    if (kuralTipi === 'fatura' && !allXml && !allExcel) {
      toast.error('Lütfen aynı anda yalnızca XML veya yalnızca Excel dosyaları seçin (karışık seçim desteklenmez).');
      return;
    }

    if (kuralTipi === 'banka' && !allExcel) {
      toast.error('Banka ekstreleri için lütfen yalnızca Excel (.xlsx / .xls) dosyaları seçin.');
      return;
    }

    setLoading(true);
    setGeneratedRules([]);
    setTruncationNotices([]);

    try {
      toast.info(`${muavinFile.name} optimize ediliyor...`);
      const muavinParsed = await parseMultipleExcelsForAI([muavinFile]);
      const notices = [...muavinParsed.notices];

      let faturalarBase64 = '';
      let faturalarFileName = '';

      if (kuralTipi === 'fatura' && allXml) {
        toast.info(`${digerFiles.length} adet XML optimize ediliyor...`);
        faturalarBase64 = await parseMultipleXMLsForAI(digerFiles);
        faturalarFileName = 'toplu_faturalar_ozeti.json';
      } else {
        toast.info(`${digerFiles.length} adet Excel dosyası optimize ediliyor...`);
        const digerParsed = await parseMultipleExcelsForAI(digerFiles);
        faturalarBase64 = digerParsed.base64;
        faturalarFileName = 'optimize_edilmis_ekstre.json';
        notices.push(...digerParsed.notices);
      }

      if (notices.length > 0) {
        setTruncationNotices(notices);
      }

      const data = await apiFetch<{ success: boolean; rules?: Omit<GeneratedRule, '_uid'>[]; message?: string }>(
        '/api/ai/learn',
        {
          method: 'POST',
          body: JSON.stringify({
            kuralTipi,
            muavinFileName: muavinFile.name,
            muavinBase64: muavinParsed.base64,
            faturalarFileName,
            faturalarBase64,
          }),
        }
      );

      if (data.success) {
        const rulesWithUid: GeneratedRule[] = (data.rules || []).map((r) => ({
          ...r,
          _uid: createUid(),
        }));
        setGeneratedRules(rulesWithUid);
        if (rulesWithUid.length > 0) {
          toast.success(`${rulesWithUid.length} kural çıkarıldı!`);
        } else {
          toast('Öğrenilecek kural bulunamadı veya veriler eşleşmedi.', { icon: 'ℹ️' });
        }
      } else {
        toast.error(data.message || 'Yapay zeka analiz hatası.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const validateRule = (rule: GeneratedRule): string | null => {
    const keyword = (rule.anahtar_kelime || '').trim();
    const code = (rule.muhasebe_kodu || '').trim();
    if (!keyword) return 'Anahtar kelime boş olamaz.';
    if (!code) return `"${keyword}" için muhasebe kodu boş olamaz.`;
    if (!/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(code)) {
      return `"${code}" geçerli bir muhasebe kodu formatında değil.`;
    }
    return null;
  };

  const saveRuleRequest = async (rule: GeneratedRule) => {
    const validationError = validateRule(rule);
    if (validationError) {
      throw new Error(validationError);
    }

    const data = await apiFetch<{ success: boolean; message?: string; skipped?: boolean }>(
      '/api/yapay-zeka-kurallari',
      {
        method: 'POST',
        body: JSON.stringify({
          kural_tipi: kuralTipi,
          kural_adi: rule.kural_adi || `${kuralTipi.toUpperCase()} Kuralı`,
          anahtar_kelime: rule.anahtar_kelime.trim(),
          muhasebe_kodu: rule.muhasebe_kodu.trim(),
        }),
      }
    );

    if (!data.success) {
      throw new Error(data.message || 'Kural kaydedilemedi.');
    }
    return data;
  };

  const handleSaveRule = async (rule: GeneratedRule) => {
    try {
      const data = await saveRuleRequest(rule);
      toast.success(data.skipped ? data.message || 'Kural zaten mevcut.' : 'Kural kaydedildi');
      setGeneratedRules((prev) => prev.filter((r) => r._uid !== rule._uid));
      await fetchRules();
    } catch (err: any) {
      toast.error(err?.message || 'Kural kaydedilirken hata oluştu.');
    }
  };

  const handleSaveAllRules = async () => {
    if (generatedRules.length === 0 || savingAll) return;

    setSavingAll(true);
    const snapshot = [...generatedRules];
    const savedUids = new Set<string>();
    let failCount = 0;
    let lastError = '';

    try {
      for (const rule of snapshot) {
        try {
          await saveRuleRequest(rule);
          savedUids.add(rule._uid);
        } catch (err: any) {
          failCount++;
          lastError = err?.message || 'Hata oluştu';
        }
      }

      if (savedUids.size > 0) {
        setGeneratedRules((prev) => prev.filter((r) => !savedUids.has(r._uid)));
        await fetchRules();
      }

      if (failCount === 0) {
        toast.success(`${savedUids.size} kural başarıyla kaydedildi.`);
      } else if (savedUids.size > 0) {
        toast.warning(`${savedUids.size} kural kaydedildi, ${failCount} kural kaydedilemedi (${lastError}).`);
      } else {
        toast.error(`Kurallar kaydedilemedi: ${lastError}`);
      }
    } finally {
      setSavingAll(false);
    }
  };

  const handleDeleteRule = async (rule: SavedRule) => {
    if (!window.confirm(`"${rule.anahtar_kelime}" -> ${rule.muhasebe_kodu} kuralını silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      await apiFetch<{ success: boolean; message?: string }>(`/api/yapay-zeka-kurallari/${rule.id}`, {
        method: 'DELETE',
      });
      toast.success('Kural silindi');
      await fetchRules();
    } catch (err: any) {
      toast.error(err?.message || 'Kural silinirken hata oluştu.');
    }
  };

  const isBusy = loading || savingAll;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Yapay Zeka & Akıllı Öğrenme
          </h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Geçmiş verilerinizi yükleyerek yapay zekanın muhasebe kurallarını öğrenmesini sağlayın.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-indigo-100 shadow-md">
            <CardHeader className="bg-indigo-50/50 pb-4 border-b border-indigo-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-indigo-600" />
                Öğrenme Modeli
              </CardTitle>
              <CardDescription>
                Hangi alan için kural çıkarmak istediğinizi seçin ve referans dosyaları yükleyin.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Öğrenme Hedefi (Kural Tipi)</Label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    disabled={isBusy}
                    className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${kuralTipi === 'fatura' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => { setKuralTipi('fatura'); setDigerFiles([]); }}
                  >
                    Faturalar (Alış/Satış)
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${kuralTipi === 'banka' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => { setKuralTipi('banka'); setDigerFiles([]); }}
                  >
                    Banka Ekstreleri
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 transition-colors bg-slate-50 relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    disabled={isBusy}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    onChange={e => setMuavinFile(e.target.files?.[0] || null)}
                  />
                  <div className="flex flex-col items-center justify-center text-center gap-2">
                    <FileSpreadsheet className="h-8 w-8 text-slate-400" />
                    <div>
                      <p className="font-medium text-sm text-slate-700">Geçmiş Muavin Defteri</p>
                      <p className="text-xs text-slate-500">{muavinFile ? muavinFile.name : 'Excel dosyası yükle (.xlsx)'}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 transition-colors bg-slate-50 relative">
                  <input
                    type="file"
                    multiple
                    disabled={isBusy}
                    accept={kuralTipi === 'fatura' ? '.xml,.xlsx,.xls' : '.xlsx,.xls'}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    onChange={e => setDigerFiles(Array.from(e.target.files || []))}
                  />
                  <div className="flex flex-col items-center justify-center text-center gap-2">
                    <UploadCloud className="h-8 w-8 text-slate-400" />
                    <div>
                      <p className="font-medium text-sm text-slate-700">
                        {kuralTipi === 'fatura' ? 'Geçmiş Faturalar (Çoklu XML veya Excel)' : 'Banka Ekstreleri (Çoklu Excel)'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {digerFiles.length > 0
                          ? (digerFiles.length === 1 ? digerFiles[0].name : `${digerFiles.length} adet dosya seçildi`)
                          : (kuralTipi === 'fatura' ? 'Toplu XML veya Excel yükle' : 'Excel dosyası yükle (.xlsx)')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {truncationNotices.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                  {truncationNotices.map((notice, i) => (
                    <p key={i}>{notice}</p>
                  ))}
                </div>
              )}

              <Button
                onClick={handleLearn}
                disabled={isBusy || !muavinFile || digerFiles.length === 0}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md transition-all group"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />}
                {loading ? 'Yapay Zeka Analiz Ediyor...' : 'Verilerden Öğren'}
              </Button>

              <p className="text-[11px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Yüklenen dosya özetleri (Excel&apos;lerde ilk sayfa ve en fazla 2.000 satır) kural çıkarımı için yapay zeka servisine gönderilir.</span>
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">

          {generatedRules.length > 0 && (
            <Card className="border-emerald-100 shadow-md bg-emerald-50/20">
              <CardHeader className="pb-3 border-b border-emerald-100/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-emerald-800">Öğrenilen Yeni Kurallar</CardTitle>
                  <CardDescription>Yapay zeka verilerinizi analiz etti ve aşağıdaki örüntüleri (kuralları) çıkardı. Onayladıklarınız kaydedilir.</CardDescription>
                </div>
                <Button size="sm" disabled={savingAll} onClick={handleSaveAllRules} className="bg-emerald-600 hover:bg-emerald-700">
                  {savingAll ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  {savingAll ? 'Kaydediliyor...' : 'Tümünü Onayla'}
                </Button>
              </CardHeader>
              <CardContent className="pt-4 p-0">
                <div className="divide-y divide-emerald-100">
                  {generatedRules.map((rule) => (
                    <div key={rule._uid} className="p-4 flex items-center justify-between hover:bg-white transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-slate-800">{rule.anahtar_kelime}</span>
                          <span className="text-slate-400 text-sm">içeriyorsa ➔</span>
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                            {rule.muhasebe_kodu}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">{rule.kural_adi}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingAll}
                          className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                          onClick={() => handleSaveRule(rule)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingAll}
                          className="text-red-500 border-red-200 hover:bg-red-50"
                          onClick={() => setGeneratedRules(prev => prev.filter((r) => r._uid !== rule._uid))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="text-lg">Hafızadaki Kurallar</CardTitle>
              <CardDescription>Sistemin daha önceden öğrenip kaydettiği otomatik atama kuralları.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {savedRules.length === 0 ? (
                <div className="p-10 text-center text-slate-500">
                  <BrainCircuit className="h-10 w-10 mx-auto text-slate-200 mb-3" />
                  <p>Henüz hafızada kural yok.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {savedRules.map((rule) => (
                    <div key={rule.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-700">{rule.anahtar_kelime}</span>
                          <span className="text-slate-400 text-sm">➔</span>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                            {rule.muhasebe_kodu}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] ml-2 text-slate-400">
                            {rule.kural_tipi === 'fatura' ? 'Fatura' : 'Banka'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">{rule.kural_adi}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteRule(rule)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
