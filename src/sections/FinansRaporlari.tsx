import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3 } from 'lucide-react';
import { CariYaslandirmaTab } from './finans/CariYaslandirmaTab';
import { GelirGiderTablosuTab } from './finans/GelirGiderTablosuTab';

export function FinansRaporlari() {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Finansal Raporlar (Cari Yaşlandırma &amp; Gelir-Gider)
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Vade gecikmesi bazlı alacak/borç yaşlandırma analizi ve yıllık özet kâr-zarar tablosu
          </p>
        </CardHeader>
      </Card>

      <Tabs defaultValue="aging" className="space-y-6">
        <TabsList className="bg-white border shadow-sm p-1 h-auto">
          <TabsTrigger value="aging" className="px-4 py-2 text-sm">
            Cari Yaşlandırma (30 / 60 / 90 Gün)
          </TabsTrigger>
          <TabsTrigger value="gelir-gider" className="px-4 py-2 text-sm">
            Özet Gelir-Gider Tablosu
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aging" className="mt-0">
          <CariYaslandirmaTab />
        </TabsContent>

        <TabsContent value="gelir-gider" className="mt-0">
          <GelirGiderTablosuTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
