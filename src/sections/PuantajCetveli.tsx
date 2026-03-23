import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Palmtree, 
  Coffee 
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { id: 'Work', label: 'Çalıştı', color: 'bg-emerald-500', icon: CheckCircle2 },
  { id: 'Weekend', label: 'Hafta Sonu', color: 'bg-slate-400', icon: Coffee },
  { id: 'Holiday', label: 'Resmi Tatil', color: 'bg-blue-400', icon: Palmtree },
  { id: 'Annual Leave', label: 'Yıllık İzin', color: 'bg-yellow-400', icon: Palmtree },
  { id: 'Unpaid Leave', label: 'Ücretsiz İzin', color: 'bg-red-400', icon: XCircle },
  { id: 'Sickness', label: 'Raporlu', color: 'bg-purple-400', icon: Clock },
];

export default function PuantajCetveli() {
  const { personnel, pointages, fetchPersonnel, fetchPointages, submitPointage } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchPersonnel();
    fetchPointages();
  }, [fetchPersonnel, fetchPointages]);

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return new Date(year, month + 1, 0).getDate();
  }, [currentDate]);

  const monthLabel = currentDate.toLocaleString('tr-TR', { month: 'long', year: 'numeric' });

  // Mevcut puantaj verisini haritala (personnel_id-date -> status)
  const pointageMap = useMemo(() => {
    const map: Record<string, any> = {};
    pointages.forEach(p => {
      map[`${p.personnel_id}-${p.date}`] = p;
    });
    return map;
  }, [pointages]);

  const handleCellClick = async (personId: number, day: number) => {
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    
    // Mevcut durumu bul ve bir sonrakine geç
    const current = pointageMap[`${personId}-${dateStr}`]?.status || 'Work';
    const currentIndex = STATUS_OPTIONS.findIndex(o => o.id === current);
    const nextIndex = (currentIndex + 1) % STATUS_OPTIONS.length;
    const nextStatus = STATUS_OPTIONS[nextIndex].id;

    const result = await submitPointage({
      personnel_id: personId,
      date: dateStr,
      status: nextStatus,
      overtime_hours: 0
    });

    if (!result.success) {
      toast.error('Puantaj kaydedilemedi.');
    }
  };

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Puantaj Cetveli</h2>
          <p className="text-muted-foreground">Personel günlük çalışma ve devam takibi.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-bold min-w-[120px] text-center">{monthLabel}</span>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 py-2">
        {STATUS_OPTIONS.map(opt => (
          <div key={opt.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-3 h-3 rounded-full ${opt.color}`}></div>
            <span>{opt.label}</span>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50">
        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="sticky left-0 bg-slate-50 z-20 w-48 border-r">Personel</TableHead>
                {Array.from({ length: daysInMonth }).map((_, i) => {
                   const day = i + 1;
                   const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                   const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                   return (
                     <TableHead key={day} className={`text-center p-1 text-[10px] min-w-[30px] border-r ${isWeekend ? 'bg-slate-100 text-slate-400' : ''}`}>
                       {day}
                     </TableHead>
                   );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {personnel.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="sticky left-0 bg-white z-10 font-bold text-xs border-r">
                    {p.first_name} {p.last_name}
                  </TableCell>
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                    const pt = pointageMap[`${p.id}-${dateStr}`];
                    const status = pt?.status || 'Work';
                    const config = STATUS_OPTIONS.find(o => o.id === status) || STATUS_OPTIONS[0];
                    
                    return (
                      <TableCell 
                        key={day} 
                        className={`p-0 text-center border-r hover:opacity-80 transition-opacity cursor-pointer h-10`}
                        onClick={() => handleCellClick(p.id, day)}
                      >
                        <div className={`w-full h-full flex items-center justify-center ${config.color} text-white`}>
                           {pt?.overtime_hours > 0 && <span className="text-[8px] font-bold">+{pt.overtime_hours}</span>}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="text-[10px] text-slate-400 italic">* Hücrelerin üzerine tıklayarak durumu değiştirebilirsiniz (Çalıştı &rarr; Hafta Sonu &rarr; İzinli vb.).</p>
    </div>
  );
}
