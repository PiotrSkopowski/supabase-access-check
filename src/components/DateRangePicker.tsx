import { useState, useCallback, useRef, useEffect } from "react";
import { isValid } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEBOUNCE_MS = 600;

// Parsuj datę jako lokalną (bez przesunięcia strefy czasowej)
function parseLocalDate(str: string): Date | null {
  if (!DATE_REGEX.test(str)) return null;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return isValid(date) ? date : null;
}

// Formatuj datę do stringa bez przesunięcia strefy
function formatLocalDate(d: Date | undefined | null): string {
  if (!d || !isValid(d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DateRange | undefined>(value);
  const [fromText, setFromText] = useState(formatLocalDate(value?.from));
  const [toText, setToText] = useState(formatLocalDate(value?.to));
  const [fromError, setFromError] = useState(false);
  const [toError, setToError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync gdy zewnętrzna wartość się zmienia
  useEffect(() => {
    setFromText(formatLocalDate(value?.from));
    setToText(formatLocalDate(value?.to));
    setPending(value);
    setFromError(false);
    setToError(false);
  }, [value]);

  const handleOpenChange = useCallback((o: boolean) => {
    if (o) setPending(value);
    setOpen(o);
  }, [value]);

  // Kalendarz — zastosuj tylko gdy oba datą wybrane
  const handleCalendarSelect = useCallback((range: DateRange | undefined) => {
    setPending(range);
    if (!range) {
      onChange(undefined);
      setFromText("");
      setToText("");
      setOpen(false);
      return;
    }
    if (range.from && range.to) {
      onChange(range);
      setFromText(formatLocalDate(range.from));
      setToText(formatLocalDate(range.to));
      setOpen(false);
    }
  }, [onChange]);

  // Ostatnie 30 dni
  const handleLast30 = useCallback(() => {
    const to = new Date();
    to.setHours(0, 0, 0, 0);
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    const range = { from, to };
    setPending(range);
    onChange(range);
    setFromText(formatLocalDate(from));
    setToText(formatLocalDate(to));
    setOpen(false);
  }, [onChange]);

  // Pomocnik: wywołaj onChange z debounce
  const debouncedOnChange = useCallback((range: DateRange | undefined) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(range);
    }, DEBOUNCE_MS);
  }, [onChange]);

  // Natychmiastowe zastosowanie (onBlur lub Enter)
  const applyNow = useCallback((from: string, to: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const fromDate = parseLocalDate(from);
    const toDate = parseLocalDate(to);
    if (fromDate && toDate) {
      onChange({ from: fromDate, to: toDate });
    } else if (fromDate && !to) {
      onChange({ from: fromDate, to: undefined });
    } else if (!from && !to) {
      onChange(undefined);
    }
  }, [onChange]);

  // Pole Od
  const handleFromChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFromText(val);
    if (val === "") {
      setFromError(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onChange(undefined);
      return;
    }
    const d = parseLocalDate(val);
    if (d) {
      setFromError(false);
      const toDate = parseLocalDate(toText);
      if (toDate) {
        debouncedOnChange({ from: d, to: toDate });
      }
    } else if (val.length === 10) {
      setFromError(true);
    } else {
      setFromError(false);
    }
  }, [onChange, toText, debouncedOnChange]);

  const handleFromBlur = useCallback(() => {
    applyNow(fromText, toText);
    if (fromText.length > 0 && !parseLocalDate(fromText)) {
      setFromError(true);
    }
  }, [fromText, toText, applyNow]);

  const handleFromKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") applyNow(fromText, toText);
  }, [fromText, toText, applyNow]);

  // Pole Do
  const handleToChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setToText(val);
    if (val === "") {
      setToError(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const fromDate = parseLocalDate(fromText);
      if (fromDate) onChange({ from: fromDate, to: undefined });
      return;
    }
    const d = parseLocalDate(val);
    if (d) {
      setToError(false);
      const fromDate = parseLocalDate(fromText);
      if (fromDate) {
        debouncedOnChange({ from: fromDate, to: d });
      }
    } else if (val.length === 10) {
      setToError(true);
    } else {
      setToError(false);
    }
  }, [onChange, fromText, debouncedOnChange]);

  const handleToBlur = useCallback(() => {
    applyNow(fromText, toText);
    if (toText.length > 0 && !parseLocalDate(toText)) {
      setToError(true);
    }
  }, [fromText, toText, applyNow]);

  const handleToKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") applyNow(fromText, toText);
  }, [fromText, toText, applyNow]);

  // Wyczyść
  const handleClear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onChange(undefined);
    setFromText("");
    setToText("");
    setFromError(false);
    setToError(false);
    setPending(undefined);
  }, [onChange]);

  const hasValue = value?.from || value?.to;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* Pole Od */}
      <div className="relative">
        <Input
          value={fromText}
          onChange={handleFromChange}
          onBlur={handleFromBlur}
          onKeyDown={handleFromKeyDown}
          placeholder="RRRR-MM-DD"
          className={cn(
            "h-10 w-[130px] text-sm font-mono pr-2",
            fromError && "border-destructive focus-visible:ring-destructive"
          )}
          maxLength={10}
        />
        {fromError && (
          <span className="absolute top-full left-0 text-xs text-destructive whitespace-nowrap mt-0.5 z-10">
            Format: RRRR-MM-DD
          </span>
        )}
      </div>

      <span className="text-muted-foreground text-sm select-none">—</span>

      {/* Pole Do */}
      <div className="relative">
        <Input
          value={toText}
          onChange={handleToChange}
          onBlur={handleToBlur}
          onKeyDown={handleToKeyDown}
          placeholder="RRRR-MM-DD"
          className={cn(
            "h-10 w-[130px] text-sm font-mono pr-2",
            toError && "border-destructive focus-visible:ring-destructive"
          )}
          maxLength={10}
        />
        {toError && (
          <span className="absolute top-full left-0 text-xs text-destructive whitespace-nowrap mt-0.5 z-10">
            Format: RRRR-MM-DD
          </span>
        )}
      </div>

      {/* Kalendarz */}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            title="Wybierz zakres z kalendarza"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="border-b px-3 py-2 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleLast30}
            >
              Ostatnie 30 dni
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              {pending?.from && !pending?.to
                ? "Wybierz datę końcową..."
                : "Wybierz zakres"}
            </span>
          </div>
          <Calendar
            mode="range"
            selected={pending}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            locale={pl}
            className="p-3"
          />
        </PopoverContent>
      </Popover>

      {/* Wyczyść */}
      {hasValue && (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0"
          onClick={handleClear}
          title="Wyczyść zakres dat"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export default DateRangePicker;
