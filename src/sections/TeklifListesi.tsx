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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from '@/context/AppContext';
import { 
  FileSignature, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Share2, 
  FileText, 
  FileSpreadsheet, 
  ExternalLink,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  MessageCircle,
  Mail
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { TeklifDrawer } from './TeklifDrawer';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TeklifMailDialog } from './TeklifMailDialog';

export function TeklifListesi() {
  const { teklifler, deleteTeklif, user } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTeklif, setEditingTeklif] = useState<any>(null);
  const [mailDialogTeklif, setMailDialogTeklif] = useState<any>(null);

  const filteredTeklifler = teklifler.filter(t => 
    t.teklif_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.musteri_adi || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Bekliyor':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100"><Clock className="w-3 h-3 mr-1" /> Bekliyor</Badge>;
      case 'Onaylandı (Siparişe Dönüştü)':
      case 'Onaylandı':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" /> Onaylandı</Badge>;
      case 'Reddedildi':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><XCircle className="w-3 h-3 mr-1" /> Reddedildi</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleExportExcel = (teklif: any) => {
    try {
      if (!teklif.kalemler || teklif.kalemler.length === 0) {
        return toast.error("Dışa aktarılacak kalem bulunamadı.");
      }

      const excelData = teklif.kalemler.map((k: any) => ({
        'Ürün Adı': k.urun_adi,
        'Miktar': k.miktar,
        'Birim': k.birim,
        'Birim Fiyat': k.birim_fiyat,
        'İskonto (%)': k.iskonto_orani || 0,
        'KDV (%)': k.kdv_orani,
        'Toplam': k.toplam_tutar
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Sütun genişliklerini ayarla
      ws['!cols'] = [
        { wch: 40 }, // Ürün Adı
        { wch: 10 }, // Miktar
        { wch: 10 }, // Birim
        { wch: 15 }, // Birim Fiyat
        { wch: 12 }, // İskonto (%)
        { wch: 10 }, // KDV (%)
        { wch: 20 }, // Toplam
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Teklif Detayı");
      XLSX.writeFile(wb, `${teklif.teklif_no}_detay.xlsx`);
      toast.success("Excel oluşturuldu.");
    } catch (error) {
      toast.error("Excel oluşturulurken bir hata oluştu.");
    }
  };

  const handleExportPDF = (teklif: any) => {
    try {
      const doc = new jsPDF() as any;
      
      // Header - Premium look
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 45, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.text("TEKLIF FORMU", 105, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Teklif No: ${teklif.teklif_no}`, 15, 30);
      doc.text(`Tarih: ${new Date(teklif.tarih).toLocaleDateString('tr-TR')}`, 15, 36);
      
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text("Alici Müşteri:", 15, 55);
      doc.setFont("helvetica", "normal");
      doc.text(teklif.musteri_adi || "-", 15, 62);
      doc.text(`VKN/TCKN: ${teklif.musteri_vkn || "-"}`, 15, 68);
      
      doc.text(teklif.musteri_adres || "", 15, 74, { maxWidth: 80 });

      // Table
      const tableData = (teklif.kalemler || []).map((k: any) => [
        k.urun_adi,
        `${k.miktar} ${k.birim}`,
        formatCurrency(k.birim_fiyat),
        `%${k.iskonto_orani || 0}`,
        `%${k.kdv_orani}`,
        formatCurrency(k.toplam_tutar)
      ]);

      autoTable(doc, {
        startY: 85,
        head: [['Urun Aciklamasi', 'Miktar', 'Birim Fiyat', 'Iskonto', 'KDV', 'Toplam']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255,255,255], fontStyle: 'bold' },
        styles: { fontSize: 9, halign: 'center' },
        columnStyles: { 0: { halign: 'left' }, 5: { fontStyle: 'bold' } }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 15;
      
      // Summary Rectangle
      doc.setFillColor(248, 250, 252);
      doc.rect(130, finalY - 5, 65, 25, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`GENEL TOPLAM: ${formatCurrency(teklif.toplam_tutar)}`, 190, finalY + 5, { align: "right" });

      doc.save(`${teklif.teklif_no}_Teklif.pdf`);
      toast.success("PDF dosyası indirildi.");
    } catch (e) {
      toast.error("PDF oluşturulurken hata yaşandı.");
    }
  };

  const getPublicLink = (token: string) => {
    const origin = window.location.origin;
    return `${origin}/?teklif=${token}`;
  };

  const handleShareWhatsApp = (teklif: any) => {
    const link = getPublicLink(teklif.onay_token);
    const text = `Sayın ${teklif.musteri_adi},\n\nSizin için hazırladığımız teklife aşağıdaki linkten ulaşabilirsiniz:\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareMail = (teklif: any) => {
    setMailDialogTeklif(teklif);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-primary" />
            Teklif Yönetimi
          </h1>
          <p className="text-slate-500 text-sm mt-1">Müşterilerinize hızlı ve profesyonel teklifler oluşturun.</p>
        </div>
        <Button onClick={() => { setEditingTeklif(null); setIsDrawerOpen(true); }} className="gap-2 shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" /> Yeni Teklif Oluştur
        </Button>
      </div>

      <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-md">
        <CardHeader className="pb-3 border-b border-slate-50">
          <div className="flex items-center gap-2 relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 text-slate-400" />
            <Input 
              placeholder="Teklif no veya müşteri ara..." 
              className="pl-9 bg-slate-50/50 border-slate-100 focus:bg-white transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-semibold">Teklif No</TableHead>
                <TableHead className="font-semibold">Tarih</TableHead>
                <TableHead className="font-semibold">Müşteri</TableHead>
                <TableHead className="font-semibold text-right">Toplam Tutar</TableHead>
                <TableHead className="font-semibold text-center">Durum</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeklifler.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-slate-400">
                    Henüz teklif kaydı bulunamadı.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTeklifler.map((teklif) => (
                  <TableRow key={teklif.id} className="group hover:bg-slate-50/80 transition-colors">
                    <TableCell className="font-mono font-medium text-primary">{teklif.teklif_no}</TableCell>
                    <TableCell className="text-slate-600">{teklif.tarih}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">{teklif.musteri_adi || (teklif as any).unvan || '-'}</span>
                        <span className="text-xs text-slate-400">{teklif.musteri_vkn || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-900">
                      {formatCurrency(teklif.toplam_tutar)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(teklif.durum)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Share2 className="w-4 h-4 text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Paylaş</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleShareWhatsApp(teklif)} className="gap-2 text-green-600">
                              <MessageCircle className="w-4 h-4" /> WhatsApp ile Gönder
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleShareMail(teklif)} className="gap-2 text-blue-600">
                              <Mail className="w-4 h-4" /> E-posta ile Gönder
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleExportPDF(teklif)} className="gap-2">
                              <FileText className="w-4 h-4" /> PDF Olarak İndir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportExcel(teklif)} className="gap-2">
                              <FileSpreadsheet className="w-4 h-4" /> Excel Olarak İndir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if(confirm('Bu teklifi silmek istediğinize emin misiniz?')) deleteTeklif(teklif.id);
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

      <TeklifDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        initialData={editingTeklif}
      />
      
      <TeklifMailDialog 
        open={!!mailDialogTeklif}
        onOpenChange={(open) => !open && setMailDialogTeklif(null)}
        teklif={mailDialogTeklif}
      />
    </div>
  );
}
