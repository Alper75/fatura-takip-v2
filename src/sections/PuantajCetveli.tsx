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
  Coffee,
  FileSpreadsheet,
  Lock,
  Unlock,
  CheckCheck
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { id: 'Work', label: 'Çalıştı', color: 'bg-emerald-500', icon: CheckCircle2 },
  { id: 'Weekend', label: 'Hafta Sonu', color: 'bg-slate-400', icon: Coffee },
  { id: 'Holiday', label: 'Resmi Tatil', color: 'bg-blue-400', icon: Palmtree },
  { id: 'Annual Leave', label: 'Yıllık İzin', color: 'bg-yellow-400', icon: Palmtree },
  { id: 'Unpaid Leave', label: 'Ücretsiz İzin', color: 'bg-red-400', icon: XCircle },
  { id: 'Sickness', label: 'Raporlu', color: 'bg-purple-400', icon: Clock },
];

export default function PuantajCetveli() {
  const { personnel, pointages, fetchPersonnel, fetchPointages, submitPointage, bulkLockPointage, bulkLockAllPersonnel, downloadPuantajTemplate, uploadPuantajExcel } = useApp();
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

  const pointageMap = useMemo(() => {
    const map: Record<string, any> = {};
    pointages.forEach(p => {
      map[`${p.personnel_id}-${p.date}`] = p;
    });
    return map;
  }, [pointages]);

  const handleCellClick = async (personId: number, day: number, status: string) => {
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    
    const result = await submitPointage({
      personnel_id: personId,
      date: dateStr,
      status: status,
      overtime_hours: 0
    });

    if (!result.success) {
      toast.error('Puantaj kaydedilemedi.');
    }
  };

  const handleLockToggle = async (personId: number, day: number, currentLocked: boolean) => {
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    const pt = pointageMap[`${personId}-${dateStr}`];

    const result = await submitPointage({
      personnel_id: personId,
      date: dateStr,
      status: pt?.status || 'Work',
      overtime_hours: pt?.overtime_hours || 0,
      is_locked: !currentLocked
    });

    if (result.success) {
      toast.success(currentLocked ? 'Kilit açıldı.' : 'Gün kilitlendi.');
    } else {
      toast.error('Kilit işlemi başarısız.');
    }
  };

  const handleBulkLock = async (personId: number, lockStatus: boolean) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const result = await bulkLockPointage(personId, year, month, lockStatus);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message || 'Toplu işlem başarısız.');
    }
  };

  const handleBulkLockAll = async (lockStatus: boolean) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const result = await bulkLockAllPersonnel(year, month, lockStatus);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message || 'Genel toplu işlem başarısız.');
    }
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const res = await uploadPuantajExcel(file);
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    }
  };

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Puantaj Cetveli</h2>
          <p className="text-muted-foreground">Personel günlük çalışma ve devam takibi.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadPuantajTemplate}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Şablon
          </Button>
          <div className="relative">
            <input type="file" className="hidden" id="puantaj-upload" accept=".xlsx, .xls" onChange={onFileUpload} />
            <Button variant="outline" size="sm" onClick={() => document.getElementById('puantaj-upload')?.click()}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel Yükle
            </Button>
          </div>
          <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm ml-2">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-bold min-w-[120px] text-center">{monthLabel}</span>
            <Button variant="ghost" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button 
            variant="default" 
            size="sm" 
            className="bg-emerald-600 hover:bg-emerald-700 ml-2"
            onClick={() => handleBulkLockAll(true)}
          >
            <CheckCheck className="h-4 w-4 mr-2" /> Tümünü Onayla
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-amber-600 border-amber-200 hover:bg-amber-50 ml-2"
            onClick={() => handleBulkLockAll(false)}
          >
            <Unlock className="h-4 w-4 mr-2" /> Tüm Kilidi Aç
          </Button>
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
                <TableHead className="sticky left-0 bg-slate-50 z-20 w-48 border-r text-xs">Personel</TableHead>
                {Array.from({ length: daysInMonth }).map((_, i) => {
                   const day = i + 1;
                   const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                   const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                   return (
                     <TableHead key={day} className={`text-center p-1 text-[10px] min-w-[30px] border-r ${isWeekend ? 'bg-slate-200 text-slate-600 font-bold' : ''}`}>
                       {day}
                     </TableHead>
                   );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {personnel.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="sticky left-0 bg-white z-10 font-bold text-[11px] border-r">
                    <div className="flex flex-col gap-1">
                      <span>{p.first_name} {p.last_name}</span>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-1 text-[9px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => handleBulkLock(p.id, true)}
                        >
                          Onayla
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-1 text-[9px] text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          onClick={() => handleBulkLock(p.id, false)}
                        >
                          Kilidi Aç
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                    const pt = pointageMap[`${p.id}-${dateStr}`];
                    
                    // Hafta sonu ise ve kayıt yoksa varsayılan renk slate-100, kayıt varsa o rengi kullan
                    const status = pt?.status || (isWeekend ? 'Weekend' : 'Work');
                    const config = STATUS_OPTIONS.find(o => o.id === status) || STATUS_OPTIONS[0];
                    
                    return (
                      <TableCell 
                        key={day} 
                        className={`p-0 text-center border-r hover:opacity-80 transition-opacity cursor-pointer h-10 ${isWeekend && !pt ? 'bg-slate-100' : ''}`}
                      >
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className={`w-full h-full flex items-center justify-center ${config.color} text-white relative`}>
                              {pt?.overtime_hours > 0 && <span className="text-[8px] font-bold">+{pt.overtime_hours}</span>}
                              {pt?.is_locked ? <Lock className="h-3 w-3 absolute" /> : null}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-2 z-[100]" side="bottom">
                            <div className="grid grid-cols-1 gap-1">
                              {STATUS_OPTIONS.map(opt => (
                                <Button 
                                  key={opt.id} 
                                  variant="ghost" 
                                  size="sm" 
                                  className="justify-start h-8 text-xs"
                                  onClick={() => handleCellClick(p.id, day, opt.id)}
                                >
                                  <div className={`w-3 h-3 rounded-full mr-2 ${opt.color}`}></div>
                                  {opt.label}
                                </Button>
                              ))}
                              <div className="border-t mt-1 pt-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className={cn(
                                    "justify-start h-8 text-xs w-full",
                                    pt?.is_locked ? "text-amber-600" : "text-emerald-600"
                                  )}
                                  onClick={() => handleLockToggle(p.id, day, !!pt?.is_locked)}
                                >
                                  {pt?.is_locked ? (
                                    <><Unlock className="h-3 w-3 mr-2" /> Kilidi Kaldır</>
                                  ) : (
                                    <><Lock className="h-3 w-3 mr-2" /> Onayla & Kilitle</>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="text-[10px] text-slate-400 italic font-medium px-1">* Hücrelerin üzerine tıklayarak durumu seçim listesinden hızlıca güncelleyebilirsiniz.</p>
    </div>
  );
}
