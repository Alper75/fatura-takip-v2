import * as React from "react"
import { Check, ChevronsUpDown, Search, Plus, Edit3, X, ListFilter, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useApp } from "@/context/AppContext"

interface LucaAccountSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const QUICK_FILTERS = [
  { id: 'ALL', label: 'Tümü' },
  { id: '102', label: '102 Bankalar' },
  { id: '100', label: '100 Kasa' },
  { id: '120', label: '120 Alıcılar' },
  { id: '320', label: '320 Satıcılar' },
  { id: '770', label: '770 Giderler' },
  { id: '760', label: '760 Pazarlama' },
];

export function LucaAccountSelect({ value, onChange, placeholder = "Hesap seçin...", className }: LucaAccountSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState('ALL');
  const [manualCode, setManualCode] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'list' | 'manual'>('list');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const { lucaAccounts = [] } = useApp();

  // Modal her açıldığında search ve manuel kodu sıfırla/hazırla
  React.useEffect(() => {
    if (open) {
      setSearchTerm('');
      setManualCode(value || '');
      setActiveTab('list');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open, value]);

  // Türkçe karakter duyarlı arama normalizasyonu
  const normalizeTr = (text: string) => {
    if (!text) return '';
    return text
      .toLocaleLowerCase('tr-TR')
      .replace(/i̇/g, 'i')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .trim();
  };

  // Filtrelenmiş hesaplar (Hızlı ve donmayan 50 sonuçluk pencere)
  const filteredAccounts = React.useMemo(() => {
    let list = lucaAccounts || [];

    // Hızlı filtre (102, 100, vs.)
    if (activeFilter !== 'ALL') {
      list = list.filter(acc => acc.kod?.startsWith(activeFilter));
    }

    if (!searchTerm.trim()) {
      return list.slice(0, 60);
    }

    const normSearch = normalizeTr(searchTerm);
    const searchClean = searchTerm.trim().replace(/\s+/g, '');

    const filtered = list.filter(acc => {
      const kodClean = (acc.kod || '').replace(/\s+/g, '');
      const adNorm = normalizeTr(acc.ad || '');
      return kodClean.includes(searchClean) || adNorm.includes(normSearch);
    });

    return filtered.slice(0, 60);
  }, [lucaAccounts, searchTerm, activeFilter]);

  // Seçili hesabın bilgisi
  const selectedAccount = React.useMemo(() => {
    if (!value) return null;
    return (lucaAccounts || []).find((a) => a.kod === value);
  }, [lucaAccounts, value]);

  const displayLabel = React.useMemo(() => {
    if (!value) return placeholder;
    if (selectedAccount) {
      return `${selectedAccount.kod} - ${selectedAccount.ad}`;
    }
    return `${value} (Özel/Manuel Kod)`;
  }, [value, selectedAccount, placeholder]);

  const handleSelectCode = (kod: string) => {
    onChange(kod);
    setOpen(false);
  };

  const handleApplyManual = () => {
    const clean = manualCode.trim();
    onChange(clean);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-9 font-mono text-xs text-left bg-white border-slate-200 hover:border-indigo-400 group relative pr-7",
            !value && "text-slate-400",
            value && !selectedAccount && "text-indigo-700 font-semibold bg-indigo-50/40",
            className
          )}
          title={displayLabel}
        >
          <span className="truncate mr-2 block flex-1">
            {displayLabel}
          </span>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {value && (
              <span
                onClick={handleClear}
                className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                title="Seçimi Temizle"
              >
                <X className="w-3 h-3" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[420px] p-0 shadow-xl border border-slate-200 rounded-xl overflow-hidden bg-white z-[9999]" align="start">
        {/* Başlık ve Sekmeler */}
        <div className="bg-slate-50 border-b p-2 flex items-center justify-between gap-2">
          <div className="flex rounded-lg bg-slate-200/70 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5",
                activeTab === 'list' ? "bg-white text-indigo-700 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ListFilter className="w-3 h-3" />
              Hesap Planı ({lucaAccounts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5",
                activeTab === 'manual' ? "bg-white text-indigo-700 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Edit3 className="w-3 h-3" />
              Kendin Kod Yaz
            </button>
          </div>

          {value && (
            <button
              type="button"
              onClick={() => handleSelectCode('')}
              className="text-[11px] text-red-600 hover:underline px-2"
            >
              Kaldır
            </button>
          )}
        </div>

        {activeTab === 'manual' ? (
          /* MANUEL KOD GİRİŞ ALANI */
          <div className="p-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Hesap Kodu Girin:
              </label>
              <p className="text-[11px] text-slate-400 mb-2">
                Hesap planında bulamadığınız veya yeni açtığınız hesap kodunu doğrudan yazabilirsiniz.
              </p>
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Örn: 102.01.001 veya 770.01.005"
                className="font-mono text-sm h-9"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyManual();
                  }
                }}
              />
            </div>

            {/* Hızlı Şablon Butonları */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hızlı Başlangıç</span>
              <div className="flex flex-wrap gap-1.5">
                {['102.01.', '102.02.', '100.01.', '120.01.', '320.01.', '770.01.'].map(prefix => (
                  <button
                    key={prefix}
                    type="button"
                    onClick={() => setManualCode(prefix)}
                    className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded border text-slate-600 transition-colors"
                  >
                    {prefix}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button 
                type="button" 
                size="sm" 
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleApplyManual}
                disabled={!manualCode.trim()}
              >
                Bu Kodu Uygula
              </Button>
            </div>
          </div>
        ) : (
          /* LİSTEDEN ARAMA ALANI */
          <div>
            {/* Arama Kutusu */}
            <div className="p-2 border-b relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                ref={searchInputRef}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Kod (102.01...) veya hesap adı ara..."
                className="pl-8 h-9 text-xs border-slate-200 focus:border-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredAccounts.length > 0) {
                      handleSelectCode(filteredAccounts[0].kod);
                    } else if (searchTerm.trim()) {
                      handleSelectCode(searchTerm.trim());
                    }
                  }
                }}
              />
            </div>

            {/* Hızlı Filtre Butonları */}
            <div className="p-1.5 bg-slate-50 border-b flex items-center gap-1 overflow-x-auto text-[11px]">
              {QUICK_FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-colors",
                    activeFilter === f.id 
                      ? "bg-indigo-600 text-white shadow-xs" 
                      : "bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Kullanıcı özel kod aradıysa "Bu kodu seç" uyarısı */}
            {searchTerm.trim() && !lucaAccounts.some(a => a.kod === searchTerm.trim()) && (
              <div className="p-2 bg-indigo-50/70 border-b flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-700 truncate">
                  Yazdığınız Kod: <span className="font-mono font-bold text-indigo-700">{searchTerm.trim()}</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-6 text-[10px] px-2 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 gap-1"
                  onClick={() => handleSelectCode(searchTerm.trim())}
                >
                  <Plus className="w-3 h-3" />
                  Bu Kodu Ata
                </Button>
              </div>
            )}

            {/* Hesap Listesi */}
            <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-100 p-1">
              {filteredAccounts.length === 0 ? (
                <div className="p-6 text-center text-slate-400 space-y-3">
                  <p className="text-xs">
                    {searchTerm ? `"${searchTerm}" aramasına uygun hesap bulunamadı.` : 'Bu filtrede hesap bulunamadı.'}
                  </p>
                  {searchTerm.trim() ? (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1 mx-auto"
                      onClick={() => handleSelectCode(searchTerm.trim())}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      "{searchTerm.trim()}" Kodunu Manuel Ata
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1 mx-auto text-indigo-600 border-indigo-200"
                      onClick={() => {
                        setManualCode('');
                        setActiveTab('manual');
                      }}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Kendin Kod Yaz
                    </Button>
                  )}
                </div>
              ) : (
                filteredAccounts.map((account) => {
                  const isSelected = value === account.kod;
                  return (
                    <div
                      key={account.kod}
                      onClick={() => handleSelectCode(account.kod)}
                      className={cn(
                        "p-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-xs group",
                        isSelected 
                          ? "bg-indigo-50 text-indigo-900 font-semibold" 
                          : "hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Check className={cn("w-3.5 h-3.5 shrink-0 text-indigo-600", isSelected ? "opacity-100" : "opacity-0")} />
                        <span className="font-mono font-bold text-indigo-600 shrink-0 text-[11px] bg-slate-100 group-hover:bg-indigo-100/70 px-1.5 py-0.5 rounded">
                          {account.kod}
                        </span>
                        <span className="truncate text-slate-700 group-hover:text-slate-900">{account.ad}</span>
                      </div>
                      {account.tur && (
                        <span className="text-[9px] uppercase px-1 py-0.5 bg-slate-100 text-slate-500 rounded shrink-0">
                          {account.tur}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Alt Bilgi */}
            <div className="p-2 bg-slate-50 border-t flex items-center justify-between text-[10px] text-slate-400">
              <span>{filteredAccounts.length} / {lucaAccounts.length} hesap listelendi</span>
              <button
                type="button"
                onClick={() => {
                  setManualCode(searchTerm.trim() || value || '');
                  setActiveTab('manual');
                }}
                className="text-indigo-600 hover:underline font-medium flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                Kod Yok mu? Elle Yaz
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
