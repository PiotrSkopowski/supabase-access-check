import { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface ComboboxFilterProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  emptyText?: string;
  className?: string;
}

export function ComboboxFilter({
  value,
  onChange,
  options,
  placeholder,
  emptyText = "Brak wyników",
  className,
}: ComboboxFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return options.slice(0, 50);
    const q = search.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 50);
  }, [options, search]);

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-card font-normal text-sm h-10"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {value && (
                <span
                  role="button"
                  className="rounded-sm hover:bg-accent p-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("");
                    setSearch("");
                  }}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              )}
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Szukaj…`}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {filtered.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      onChange(option === value ? "" : option);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === option ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
