import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, 
  ChevronRight, 
  Lock, 
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const STATUS_LABELS: Record<string, { label: string; color: string; icon?: any }> = {
  'Work': { label: 'Çalıştı', color: 'bg-green-100 text-green-700 border-green-200' },
  'Weekend': { label: 'Hafta Sonu', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  'Holiday': { label: 'Resmi Tatil', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  'Annual Leave': { label: 'Yıllık İzin', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'Unpaid Leave': { label: 'Ücretsiz İzin', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  'Sickness': { label: 'Raporlu', color: 'bg-red-100 text-red-700 border-red-200' },
};

export default function KisiselPuantaj() {
  const { currentPersonnel, pointages, fetchPointages, submitPointage } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchPointages();
  }, [fetchPointages]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const monthName = new Intl.DateTimeFormat('tr-TR', { month: 'long' }).format(currentDate);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getDayPointage = (day: number) => {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return pointages.find(p => p.personnel_id === currentPersonnel?.id && p.date === dStr);
  };

  const handleStatusChange = async (day: number, nextStatus: string, isLocked: boolean | undefined) => {
    if (isLocked) {
      toast.error('Bu gün yönetici tarafından onaylandığı için değiştirilemez.');
      return;
    }

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const result = await submitPointage({
      date: dateStr,
      status: nextStatus,
      overtime_hours: 0
    });

    if (result.success) {
      toast.success(`${day} ${monthName} durumu güncellendi: ${STATUS_LABELS[nextStatus].label}`);
    } else {
      toast.error(result.message);
    }
  };

  if (!currentPersonnel) return <div className="p-8 text-center">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Puantaj Cetvelim</h2>
          <p className="text-muted-foreground mt-1">Çalışma günlerinizi takip edin ve düzenleyin.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-1 rounded-lg border border-slate-200">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-bold min-w-[100px] text-center">
            {monthName} {year}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sol Panel: Bilgi ve Özet */}
        <div className="md:col-span-1 space-y-4">
          <Card className="border-indigo-100 bg-indigo-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Özet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 uppercase">Çalışılan Gün</span>
                <span className="font-bold text-green-700">
                  {pointages.filter(p => p.personnel_id === currentPersonnel.id && p.status === 'Work' && p.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)).length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 uppercase">Onaylı (Kilitli)</span>
                <span className="font-bold text-indigo-700">
                  {pointages.filter(p => p.personnel_id === currentPersonnel.id && p.is_locked && p.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)).length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-400 uppercase tracking-wider">Durum Renkleri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(STATUS_LABELS).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <div className={cn("w-3 h-3 rounded-full border", value.color.split(' ')[0])}></div>
                  <span>{value.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
            <p className="text-xs text-yellow-800 leading-relaxed">
              <strong>Not:</strong> Takvim üzerindeki günlere tıklayarak durumunuzu değiştirebilirsiniz. Yönetici tarafından onaylanan (kilitli) günler değiştirilemez.
            </p>
          </div>
        </div>

        {/* Sağ Panel: Takvim Görünümü */}
        <Card className="md:col-span-3">
          <CardContent className="p-6">
            <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
              {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(day => (
                <div key={day} className="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500">
                  {day}
                </div>
              ))}
              
              {/* Boş Günler */}
              {Array.from({ length: (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1) }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-white min-h-[100px] p-2 opacity-50"></div>
              ))}

              {/* Ayın Günleri */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const p = getDayPointage(day);
                const isWeekend = new Date(year, month, day).getDay() === 0 || new Date(year, month, day).getDay() === 6;
                const status = p?.status || (isWeekend ? 'Weekend' : null);
                const config = status ? STATUS_LABELS[status] : null;
                const isLocked = p?.is_locked;

                 return (
                  <Popover key={day}>
                    <PopoverTrigger asChild>
                      <div 
                        className={cn(
                          "bg-white min-h-[100px] p-2 border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer relative group",
                          isLocked && "cursor-not-allowed bg-slate-50",
                          isWeekend && !p && "bg-slate-50/50"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <span className={cn(
                            "text-sm font-medium",
                            (new Date(year, month, day).getDay() === 0 || new Date(year, month, day).getDay() === 6) ? "text-red-500" : "text-slate-900"
                          )}>
                            {day}
                          </span>
                          {isLocked && <Lock className="w-3 h-3 text-indigo-400" />}
                        </div>

                        {status ? (
                          <div className={cn(
                            "mt-2 p-1.5 rounded text-[10px] font-bold border flex flex-col gap-1",
                            config?.color
                          )}>
                            <span>{config?.label}</span>
                            {p && p.overtime_hours > 0 && (
                              <span className="bg-white/50 px-1 rounded inline-block w-fit">+{p.overtime_hours}s Fazla Mesai</span>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 text-[10px] text-slate-300 italic group-hover:text-slate-400">
                            Henüz girilmedi
                          </div>
                        )}
                      </div>
                    </PopoverTrigger>
                    {!isLocked && (
                      <PopoverContent className="w-48 p-2 z-[100]" side="bottom">
                        <div className="grid grid-cols-1 gap-1">
                          {Object.entries(STATUS_LABELS).map(([statusKey, value]) => (
                            <Button 
                              key={statusKey} 
                              variant="ghost" 
                              size="sm" 
                              className="justify-start h-8 text-xs"
                              onClick={() => handleStatusChange(day, statusKey, isLocked)}
                            >
                              <div className={cn("w-3 h-3 rounded-full mr-2 border", value.color.split(' ')[0])}></div>
                              {value.label}
                            </Button>
                          ))}
                        </div>
                      </PopoverContent>
                    )}
                  </Popover>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
