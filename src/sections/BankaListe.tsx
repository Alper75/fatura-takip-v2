import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApp } from '@/context/AppContext';
import { Landmark, Plus, Trash2, Edit, CreditCard, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { BankaEkstreUpload } from './BankaEkstreUpload';

export function BankaListe() {
  const { bankaHesaplari, deleteBankaHesabi, openBankaDrawer } = useApp();
  const [bankToDelete, setBankToDelete] = useState<string | null>(null);
  const [selectedBankaForUpload, setSelectedBankaForUpload] = useState<string | null>(null);

  const formatCurrency = (val: number) => {
    const safeVal = isNaN(val) || val === null || val === undefined ? 0 : val;
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(safeVal);
  };

  const handleDelete = (id: string) => {
    deleteBankaHesabi(id);
    setBankToDelete(null);
    toast.success('Banka hesabı silindi.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" />
            Banka Hesapları
          </h2>
          <p className="text-slate-500 mt-1">Nakit akışınızı ve banka bakiyelerinizi yönetin</p>
        </div>
        <Button onClick={() => openBankaDrawer()} className="gap-2">
          <Plus className="w-4 h-4" />
          Yeni Hesap
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bankaHesaplari.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white border border-dashed rounded-2xl text-slate-400">
            <Landmark className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">Henüz banka hesabı eklenmemiş</p>
            <Button variant="link" onClick={() => openBankaDrawer()} className="mt-2 text-primary">
              İlk hesabınızı hemen ekleyin
            </Button>
          </div>
        ) : (
          bankaHesaplari.map((banka) => (
            <Card key={banka.id} className="border-0 shadow-md hover:shadow-lg transition-shadow overflow-hidden group">
              <div className="h-2 bg-indigo-600" />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openBankaDrawer(banka.id)} className="w-8 h-8 text-slate-400 hover:text-blue-600">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <AlertDialog open={bankToDelete === banka.id} onOpenChange={(o) => !o && setBankToDelete(null)}>
                      <AlertDialogTrigger asChild>
                         <Button variant="ghost" size="icon" onClick={() => setBankToDelete(banka.id)} className="w-8 h-8 text-slate-400 hover:text-red-600">
                           <Trash2 className="w-4 h-4" />
                         </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hesabı Sil</AlertDialogTitle>
                          <AlertDialogDescription>
                            {banka.hesapAdi} hesabını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(banka.id)} className="bg-red-600 hover:bg-red-700">Sil</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <CardTitle className="mt-4 text-xl">{banka.hesapAdi}</CardTitle>
                <p className="text-sm text-slate-500">{banka.bankaAdi}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-4 gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  onClick={() => setSelectedBankaForUpload(banka.id)}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Ekstre Yükle
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="bg-slate-50 rounded-lg p-3 mb-4">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">IBAN</p>
                  <p className="text-xs font-mono text-slate-700 truncate select-all">{banka.iban}</p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Güncel Bakiye</p>
                    <p className="text-2xl font-black text-slate-900">{formatCurrency(banka.guncelBakiye)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold px-2 py-1 bg-slate-200 text-slate-700 rounded uppercase">
                      {banka.dovizTuru}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selectedBankaForUpload && (
        <BankaEkstreUpload 
          bankaId={selectedBankaForUpload} 
          isOpen={!!selectedBankaForUpload} 
          onClose={() => setSelectedBankaForUpload(null)} 
        />
      )}
    </div>
  );
}
