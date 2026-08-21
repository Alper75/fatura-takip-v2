import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Save, BrainCircuit, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';

interface IntegrationImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: any[];
  importApiUrl: string;
  onSuccess: (importedCount: number) => void;
}

const CellDropdown = ({ value, options, onChange, placeholder }: { value: string; options: {value: string, label: string}[]; onChange: (v: string) => void, placeholder: string }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState('');
  
  if (!isEditing) {
    const displayValue = options.find(o => o.value === value)?.label || value;
    return (
      <div 
        className={`text-sm p-2 border border-slate-200 hover:border-indigo-400 rounded-md cursor-pointer min-h-[36px] flex items-center bg-white ${!displayValue ? 'text-rose-500 font-medium bg-rose-50' : 'text-slate-700 line-clamp-1'}`}
        onClick={() => { setIsEditing(true); setSearch(value || ''); }}
        title={displayValue || placeholder}
      >
        {displayValue || placeholder}
      </div>
    );
  }

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()) || o.value.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative">
      <input 
        autoFocus
        className="flex h-9 w-full items-center justify-between rounded-md border border-indigo-500 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={search}
        placeholder="Ara veya Kod Yaz..."
        onChange={e => setSearch(e.target.value)}
        onKeyDown={e => {
           if (e.key === 'Enter') {
             onChange(search);
             setIsEditing(false);
           }
        }}
        onBlur={() => setTimeout(() => {
           if (search !== value) onChange(search);
           setIsEditing(false);
        }, 150)}
      />
      <div className="absolute top-full left-0 w-full min-w-[250px] max-h-48 overflow-auto bg-white border border-slate-200 shadow-xl rounded-md z-50 mt-1 p-1">
        <div 
          className="text-sm p-2 hover:bg-slate-100 cursor-pointer text-slate-500 rounded"
          onClick={() => { onChange(''); setIsEditing(false); }}
        >
          {placeholder} (Temizle)
        </div>
        {filtered.length === 0 && search && (
           <div 
             className="text-sm p-2 hover:bg-indigo-50 cursor-pointer text-indigo-700 font-medium rounded truncate"
             onClick={() => { onChange(search); setIsEditing(false); }}
           >
             "{search}" olarak kullan (Yeni Kural)
           </div>
        )}
        {filtered.map(o => (
          <div 
            key={o.value} 
            className="text-sm p-2 hover:bg-indigo-50 cursor-pointer text-slate-700 rounded truncate"
            onClick={() => { onChange(o.value); setIsEditing(false); }}
            title={o.label}
          >
            {o.label}
          </div>
        ))}
      </div>
    </div>
  );
};

export function IntegrationImportPreviewModal({ isOpen, onClose, invoices, importApiUrl, onSuccess }: IntegrationImportPreviewModalProps) {
  const { cariler, lucaAccounts } = useApp();
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [kurallar, setKurallar] = useState<any[]>([]);
  const [rulesApplied, setRulesApplied] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setInitialized(false);
      setRulesApplied(false);
      return;
    }
    
    if (isOpen && !initialized) {
      // Auto-match cariler by VKN or Unvan
      const mappedInvoices = invoices.map(item => {
        const vkn = String(item.senderVkn || item.aliciVkn || item.vknTckn || item.tcVkn || '').trim();
        const unvan = String(item.senderName || item.aliciUnvan || item.ad || '').toLowerCase().trim();
        let cariId = item.cariId || null;
        if (!cariId && cariler) {
          const matched = cariler.find(c => {
            if (vkn && c.vknTckn) {
               const cVkn = String(c.vknTckn).trim();
               if (cVkn === vkn) return true;
               if (cVkn.endsWith(vkn) || vkn.endsWith(cVkn)) {
                 if (cVkn.length >= 10 && vkn.length >= 10) return true;
               }
            }
            if (unvan && c.unvan) {
              const cariUnvan = String(c.unvan).toLowerCase().trim();
              if (cariUnvan === unvan) return true;
              if (cariUnvan.length > 5 && unvan.length > 5) {
                return cariUnvan.includes(unvan) || unvan.includes(cariUnvan);
              }
            }
            return false;
          });
          if (matched) cariId = matched.id;
        }
        return { ...item, cariId };
      });
      setItems(mappedInvoices);
      setRulesApplied(false);
      setInitialized(true);
      
      // Fetch AI rules when opened
      const token = localStorage.getItem('token');
      fetch('/api/yapay-zeka-kurallari', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setKurallar(data.kurallar.filter((k: any) => k.kural_tipi === 'fatura'));
          }
        })
        .catch(console.error);
    }
  }, [isOpen, invoices, cariler, initialized]);

  // Apply AI rules once rules are fetched and items exist
  useEffect(() => {
    if (kurallar.length > 0 && items.length > 0 && !rulesApplied) {
      let appliedCount = 0;
      setItems(prev => prev.map(item => {
        if (!item.muhasebeKodu) {
          const text = `${item.senderName || item.aliciUnvan || ''} ${item.faturaAciklama || ''}`.toLowerCase();
          for (const rule of kurallar) {
            if (text.includes(rule.anahtar_kelime.toLowerCase())) {
              appliedCount++;
              return { ...item, muhasebeKodu: rule.muhasebe_kodu };
            }
          }
        }
        return item;
      }));
      setRulesApplied(true);
      if (appliedCount > 0) {
        toast.success(`${appliedCount} faturaya yapay zeka kuralı uygulandı!`);
      }
    }
  }, [kurallar, items.length, rulesApplied]);

  const handleUpdateCode = (idx: number, val: string) => {
    const newItems = [...items];
    newItems[idx].muhasebeKodu = val;
    setItems(newItems);
  };

  const handleUpdateCari = (idx: number, val: string) => {
    const newItems = [...items];
    newItems[idx].cariId = val;
    setItems(newItems);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    let successCount = 0;
    try {
      const token = localStorage.getItem('token');
      
      // Auto-create rules for manually assigned codes
      for (const item of items) {
        if (item.muhasebeKodu) {
          const senderName = (item.senderName || item.aliciUnvan || item.ad || '').trim();
          if (senderName) {
            const exactRuleExists = kurallar.some(k => k.anahtar_kelime.toLowerCase() === senderName.toLowerCase());
            
            if (!exactRuleExists) {
               try {
                 const ruleRes = await fetch('/api/yapay-zeka-kurallari', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                   body: JSON.stringify({ kural_tipi: 'fatura', kural_adi: 'Otomatik Kural: ' + senderName, anahtar_kelime: senderName, muhasebe_kodu: item.muhasebeKodu })
                 });
                 if (ruleRes.ok) {
                    const ruleData = await ruleRes.json();
                    if (ruleData.success) {
                       setKurallar(prev => [...prev, { id: ruleData.id || Date.now().toString(), kural_tipi: 'fatura', anahtar_kelime: senderName, muhasebe_kodu: item.muhasebeKodu }]);
                    }
                 }
               } catch (e) { console.error('Kural ekleme hatası', e); }
            }
          }
        }
      }

      for (const item of items) {
        const payload = { ...item };
        const res = await fetch(importApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
        }
      }
      toast.success(`${successCount} fatura başarıyla aktarıldı.`);
      onSuccess(successCount);
      onClose();
    } catch (err: any) {
      toast.error('Toplu aktarım hatası: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val: any) => {
    if (!val) return '0,00 ₺';
    return Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] lg:max-w-7xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-indigo-600" />
            Toplu İçe Aktarma ve Yapay Zeka Önizlemesi
          </DialogTitle>
          <DialogDescription>
            Seçtiğiniz {items.length} faturayı aktarmadan önce muhasebe kodlarını inceleyebilir ve düzenleyebilirsiniz.
            <span className="flex items-center gap-1 mt-2 text-indigo-600 font-medium">
              <BrainCircuit className="w-4 h-4" /> Yapay zeka kurallarınız ({kurallar.length} kural) tespit edilip otomatik uygulandı.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4 max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numara</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Ünvan</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
                <TableHead className="min-w-[200px]">Cari Seçimi</TableHead>
                <TableHead className="min-w-[250px]">Muhasebe Kodu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-xs">{item.faturaNo || item.belgeNumarasi}</TableCell>
                  <TableCell>{item.issueDate?.split('T')[0] || item.tarih}</TableCell>
                  <TableCell className="max-w-[150px] truncate" title={item.senderName || item.aliciUnvan}>
                    {item.senderName || item.aliciUnvan}
                  </TableCell>
                  <TableCell className="text-right font-medium text-emerald-600">
                    {formatCurrency(item.payableAmount || item.toplamTutar)}
                  </TableCell>
                  <TableCell className="align-top">
                    <select 
                      className="w-full text-sm p-2 border rounded-md border-slate-200 bg-white"
                      value={item.cariId || ''}
                      onChange={(e) => handleUpdateCari(idx, e.target.value)}
                    >
                      <option value="">Seçiniz...</option>
                      {cariler.map(c => (
                        <option key={c.id} value={c.id}>{c.unvan}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell className="align-top">
                    <CellDropdown 
                      value={item.muhasebeKodu || ''}
                      placeholder="Hesap Seçin veya Kod Yazın..."
                      options={(lucaAccounts || []).map((a: any) => ({ value: a.kod, label: `${a.kod} - ${a.ad}` }))}
                      onChange={(val) => handleUpdateCode(idx, val)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>İptal</Button>
          <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Aktarılıyor...' : 'Tümünü Onayla ve Aktar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
