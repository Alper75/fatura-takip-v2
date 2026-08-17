import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Download, RefreshCcw, FileText } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

export default function GelenEFaturalar() {
  const [loading, setLoading] = useState(false);
  const [faturalar, setFaturalar] = useState<any[]>([]);

  useEffect(() => {
    fetchFaturalar();
  }, []);

  const fetchFaturalar = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/elogo/gelen-faturalar', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setFaturalar(data.veriler || []);
      }
    } catch (error) {
      console.error('Gelen faturalar alınamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('tr-TR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Gelen E-Faturalar (eLogo)</h2>
          <p className="text-muted-foreground mt-1">Son 30 güne ait eLogo portalınıza gelen e-Faturalar.</p>
        </div>
        <Button onClick={fetchFaturalar} disabled={loading} variant="outline" className="gap-2">
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Yenile
        </Button>
      </div>

      <Card className="border-none shadow-md bg-white">
        <CardHeader className="border-b bg-gray-50/50 pb-4">
          <CardTitle className="text-lg text-gray-800">Fatura Listesi</CardTitle>
          <CardDescription>
            GİB üzerinden tarafınıza kesilen faturalar.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Gönderen / VKN</TableHead>
                  <TableHead className="font-semibold text-slate-600">Fatura No</TableHead>
                  <TableHead className="font-semibold text-slate-600">Tarih</TableHead>
                  <TableHead className="font-semibold text-slate-600 text-right">Tutar</TableHead>
                  <TableHead className="font-semibold text-slate-600 text-center">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                      Faturalar yükleniyor...
                    </TableCell>
                  </TableRow>
                ) : faturalar.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                      Gelen fatura bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  faturalar.map((f, i) => (
                    <TableRow key={i} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="font-medium text-slate-900">{f?.senderName || 'Bilinmiyor'}</div>
                        <div className="text-xs text-slate-500">{f?.senderVkn || '-'}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{f?.invoiceNumber || '-'}</TableCell>
                      <TableCell>{formatDate(f?.issueDate)}</TableCell>
                      <TableCell className="text-right font-medium">{f?.payableAmount || '-'} {f?.currencyCode}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                          <Download className="w-4 h-4 mr-2" /> PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
