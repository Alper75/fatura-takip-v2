import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  Info,
  ExternalLink,
  Plus,
  UserPlus,
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function LucaAyarlari() {
  const { 
    lucaAccounts, 
    syncLucaAccounts, 
    cariler, 
    addCari, 
    updateCari 
  } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [openSelectors, setOpenSelectors] = useState<Record<string, boolean>>({});

  const filteredAccounts = lucaAccounts.filter(acc => 
    acc.kod.includes(searchTerm) || 
    acc.ad.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSync = () => {
    syncLucaAccounts();
    toast.info("Eklenti tarama isteği gönderildi. Luca sekmesinde eklenti ikonuna basıp 'Hesap Planını Çek' butonuna tıklayın.", {
      duration: 5000,
    });
  };

  const handleManualFetch = () => {
    window.dispatchEvent(new CustomEvent('FATURA_APP_LUCA_GET_ACCOUNTS'));
    toast.info("Eklenti hafızasındaki veriler kontrol ediliyor...");
  };

  const handleCreateCari = (acc: any) => {
    addCari({
      tip: 'musteri',
      unvan: acc.ad,
      vknTckn: '11111111111', // Placeholder as Luca account doesn't have VKN
      muhasebeKodu: acc.kod,
      adres: '',
      telefon: '',
      eposta: '',
      vergiDairesi: ''
    });
    toast.success(`${acc.ad} için cari kart oluşturuldu.`);
  };

  const handleMatchCari = (accKod: string, cariId: string) => {
    updateCari(cariId, { muhasebeKodu: accKod });
    setOpenSelectors(prev => ({ ...prev, [accKod]: false }));
    toast.success(`Cari hesap kodu ${accKod} olarak güncellendi.`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Luca Entegrasyonu</h1>
          <p className="text-slate-500">Hesap planı senkronizasyonu ve veri aktarım ayarları</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => window.open('https://www.luca.com.tr', '_blank')}
            variant="outline"
            className="gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Luca'ya Git
          </Button>
          <Button 
            onClick={handleManualFetch}
            variant="secondary"
            className="gap-2 border-dashed border-indigo-200"
          >
            <RefreshCw className="w-4 h-4" />
            Eklentiden Veriyi Çek
          </Button>
          <Button 
            onClick={handleSync}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            <Search className="w-4 h-4" />
            Senkronizasyonu Başlat
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Durum Kartı */}
        <Card className="lg:col-span-1 border-indigo-100 bg-indigo-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="w-5 h-5 text-indigo-600" />
              Nasıl Çalışır?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold">1</div>
              <p>Luca tarayıcı eklentisinin (v2.0+) kurulu olduğundan emin olun.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold">2</div>
              <p>Luca portalına giriş yapın ve <b>Hesap Planı Listesi</b> sayfasını açıp <b>Sorgula</b> deyin.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold">3</div>
              <p>Tarayıcınızın sağ üstündeki <b>Eklenti İkonuna</b> tıklayın ve <b>"Hesap Planını Çek"</b> butonuna basın.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold">4</div>
              <p>Eğer liste otomatik güncellenmezse yukarıdaki <b>"Eklentiden Veriyi Çek"</b> butonunu kullanın.</p>
            </div>
鼓            
            <div className="mt-6 p-4 bg-white rounded-lg border border-indigo-100">
              <h4 className="font-semibold text-indigo-900 mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Senkronizasyon Durumu
              </h4>
              <p className="text-xs">
                {lucaAccounts.length > 0 
                  ? `${lucaAccounts.length} hesap kodu başarıyla senkronize edildi.` 
                  : "Henüz hesap planı çekilmedi."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Hesap Listesi */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>Luca Hesap Planı</CardTitle>
                <CardDescription>Aktarım sırasında kullanılacak muhasebe kodları</CardDescription>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Kod veya ad ara..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <div className="overflow-x-auto max-h-[500px]">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-32">Hesap Kodu</TableHead>
                      <TableHead>Hesap Adı</TableHead>
                      <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-32 text-center text-slate-400">
                          {searchTerm ? "Sonuç bulunamadı." : "Henüz hesap planı yüklenmedi."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAccounts.map((acc, idx) => {
                      const matchedCari = cariler.find(c => c.muhasebeKodu === acc.kod);
                      
                      return (
                        <TableRow key={idx} className="hover:bg-slate-50/50">
                          <TableCell className="font-mono font-medium text-indigo-600 bg-indigo-50/10">
                            {acc.kod}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            <div className="flex flex-col">
                              <span>{acc.ad}</span>
                              {matchedCari && (
                                <Badge variant="secondary" className="w-fit mt-1 text-[10px] bg-green-50 text-green-700 border-green-100">
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  {matchedCari.unvan}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {!matchedCari && (
                                <Button 
                                  onClick={() => handleCreateCari(acc)}
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 text-[11px] gap-1 text-slate-500 hover:text-indigo-600"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  Cari Oluştur
                                </Button>
                              )}
                              
                              <Popover 
                                open={openSelectors[acc.kod]} 
                                onOpenChange={(open) => setOpenSelectors(prev => ({ ...prev, [acc.kod]: open }))}
                              >
                                <PopoverTrigger asChild>
                                  <Button 
                                    variant={matchedCari ? "ghost" : "outline"} 
                                    size="sm" 
                                    className={cn(
                                      "h-8 text-[11px] gap-1",
                                      matchedCari ? "text-slate-400" : "text-indigo-600 border-indigo-100"
                                    )}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    {matchedCari ? "Değiştir" : "Eşleştir"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[240px]" align="end">
                                  <Command>
                                    <CommandInput placeholder="Cari ara..." />
                                    <CommandList>
                                      <CommandEmpty>Cari bulunamadı.</CommandEmpty>
                                      <CommandGroup heading="Cariler">
                                        {cariler.map((cari) => (
                                          <CommandItem
                                            key={cari.id}
                                            value={cari.unvan}
                                            onSelect={() => handleMatchCari(acc.kod, cari.id)}
                                            className="text-xs"
                                          >
                                            <div className="flex flex-col">
                                              <span>{cari.unvan}</span>
                                              <span className="text-[10px] text-slate-400">{cari.vknTckn}</span>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
