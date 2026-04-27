import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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

export function LucaAccountSelect({ value, onChange, placeholder = "Hesap seçin...", className }: LucaAccountSelectProps) {
  const [open, setOpen] = React.useState(false)
  const { lucaAccounts } = useApp()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-9 font-mono text-xs", className)}
        >
          {value
            ? lucaAccounts.find((account) => account.kod === value)?.kod + " - " + lucaAccounts.find((account) => account.kod === value)?.ad
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Hesap kodu veya adı ara..." />
          <CommandList>
            <CommandEmpty>Hesap bulunamadı.</CommandEmpty>
            <CommandGroup>
              {lucaAccounts.map((account) => (
                <CommandItem
                  key={account.kod}
                  value={account.kod + " " + account.ad}
                  onSelect={() => {
                    onChange(account.kod === value ? "" : account.kod)
                    setOpen(false)
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === account.kod ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="font-bold mr-2 text-indigo-600">{account.kod}</span>
                  <span className="text-slate-600">{account.ad}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
