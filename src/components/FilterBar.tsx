import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search,
  X,
  ChevronDown,
  Calendar as CalendarIcon,
  Filter
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface FilterValues {
  search: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  status: string;
}

interface FilterBarProps {
  onFilterChange: (filters: FilterValues) => void;
  searchPlaceholder?: string;
  showStatus?: boolean;
  statusOptions?: { label: string; value: string }[];
}

export function FilterBar({ 
  onFilterChange, 
  searchPlaceholder = "Ara...", 
  showStatus = true,
  statusOptions = [
    { label: 'Hepsi', value: 'all' },
    { label: 'Ödenmiş', value: 'odendi' },
    { label: 'Ödenmemiş', value: 'odenmedi' },
    { label: 'Bekliyor', value: 'bekliyor' },
  ]
}: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({
    search: '',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    status: 'all',
  });

  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    let count = 0;
    if (filters.startDate) count++;
    if (filters.endDate) count++;
    if (filters.minAmount) count++;
    if (filters.maxAmount) count++;
    if (filters.status !== 'all') count++;
    setActiveCount(count);
    
    onFilterChange(filters);
  }, [filters]);

  const clearFilters = () => {
    setFilters({
      search: '',
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
      status: 'all',
    });
  };

  const hasActiveFilters = activeCount > 0 || filters.search !== '';

  return (
    <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder={searchPlaceholder}
            className="pl-10 h-11 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-200 transition-all rounded-xl"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>

        <div className="flex gap-2">
          {/* Status Dropdown */}
          {showStatus && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 border-slate-200 rounded-xl gap-2 font-medium">
                  Durum: {statusOptions.find(o => o.value === filters.status)?.label}
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl p-2">
                <DropdownMenuLabel>İşlem Durumu</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {statusOptions.map((opt) => (
                  <DropdownMenuItem 
                    key={opt.value}
                    className={cn("rounded-lg cursor-pointer", filters.status === opt.value && "bg-indigo-50 text-indigo-700 font-semibold")}
                    onClick={() => setFilters(prev => ({ ...prev, status: opt.value }))}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Expand Filters Toggle */}
          <Button 
            variant={isExpanded ? "secondary" : "outline"}
            className={cn("h-11 rounded-xl gap-2 font-medium transition-all", activeCount > 0 && "border-indigo-200 bg-indigo-50 text-indigo-700")}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Filter className={cn("w-4 h-4", activeCount > 0 && "fill-current")} />
            Filtreler
            {activeCount > 0 && (
              <Badge className="ml-1 bg-indigo-600 hover:bg-indigo-600 h-5 min-w-5 flex items-center justify-center p-0">
                {activeCount}
              </Badge>
            )}
          </Button>

          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              className="h-11 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50" 
              onClick={clearFilters}
            >
              <X className="w-4 h-4 mr-2" />
              Temizle
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-50 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Date Range */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 px-1 uppercase tracking-wider">Tarih Aralığı</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input 
                  type="date"
                  className="pl-8 h-10 text-sm bg-slate-50 border-transparent rounded-lg focus:bg-white"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <span className="text-slate-300">-</span>
              <div className="relative flex-1">
                <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input 
                  type="date"
                  className="pl-8 h-10 text-sm bg-slate-50 border-transparent rounded-lg focus:bg-white"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Amount Range */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 px-1 uppercase tracking-wider">Tutar Aralığı</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₺</span>
                <Input 
                  placeholder="Min"
                  type="number"
                  className="pl-7 h-10 text-sm bg-slate-50 border-transparent rounded-lg focus:bg-white"
                  value={filters.minAmount}
                  onChange={(e) => setFilters(prev => ({ ...prev, minAmount: e.target.value }))}
                />
              </div>
              <span className="text-slate-300">-</span>
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₺</span>
                <Input 
                  placeholder="Max"
                  type="number"
                  className="pl-7 h-10 text-sm bg-slate-50 border-transparent rounded-lg focus:bg-white"
                  value={filters.maxAmount}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
                />
              </div>
            </div>
          </div>
          
          <div className="hidden lg:block"></div>
          
          <div className="flex items-end pb-0.5">
             <p className="text-[10px] text-slate-400 italic">
               * Kriterleri girdikçe liste anlık güncellenir.
             </p>
          </div>
        </div>
      )}
    </div>
  );
}
