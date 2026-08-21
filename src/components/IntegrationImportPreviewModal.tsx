import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Save, BrainCircuit, FileCheck } from 'lucide-react';
import { toast } from 'sonner';

interface IntegrationImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: any[];
  importApiUrl: string;
  onSuccess: (importedCount: number) => void;
}

export function IntegrationImportPreviewModal({ isOpen, onClose, invoices, importApiUrl, onSuccess }: IntegrationImportPreviewModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [kurallar, setKurallar] = useState<any[]>([]);
  const [rulesApplied, setRulesApplied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setItems([...invoices]);
      setRulesApplied(false);
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
  }, [isOpen, invoices]);

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

  const handleSaveAll = async () => {
    setSaving(true);
    let successCount = 0;
    try {
      const token = localStorage.getItem('token');
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
      <DialogContent className="max-w-5xl">
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
                <TableHead className="text-center">Muhasebe Kodu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-xs">{item.faturaNo || item.belgeNumarasi}</TableCell>
                  <TableCell>{item.issueDate?.split('T')[0] || item.tarih}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={item.senderName || item.aliciUnvan}>
                    {item.senderName || item.aliciUnvan}
                  </TableCell>
                  <TableCell className="text-right font-medium text-emerald-600">
                    {formatCurrency(item.payableAmount || item.toplamTutar)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Input 
                      placeholder="Hesap Kodu..." 
                      value={item.muhasebeKodu || ''}
                      onChange={(e) => handleUpdateCode(idx, e.target.value)}
                      className="w-32 mx-auto text-center font-mono text-sm border-indigo-200 focus-visible:ring-indigo-500"
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
