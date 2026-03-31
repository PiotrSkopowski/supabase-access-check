import { useState, useCallback, useEffect } from "react";
import { format, parse, isValid, subDays } from "date-fns";
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

const DATE_FORMAT = "yyyy-MM-dd";
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(str: string): Date | null {
  if (!DATE_REGEX.test(str)) return null;
  const d = parse(str, DATE_FORMAT, new Date());
  return isValid(d) ? d : null;
}

function formatDate(d: Date | undefined | null): string {
  if (!d || !isValid(d)) return "";
  return format(d, DATE_FORMAT);
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DateRange | undefined>(value);
  const [fromText, setFromText] = useState(formatDate(value?.from));
  const [toText, setToText] = useState(formatDate(value?.to));
  const [fromError, setFromError] = useState(false);
  const [toError, setToError] = useState(false);

  useEffect(() => {
    setFromText(formatDate(value?.from));
    setToText(formatDate(value?.to));
    setPending(value);
    setFromError(false);
    setToError(false);
  }, [value]);

  const handleOpenChange = useCallback((o: boolean) => {
    if (o) setPending(value);
    setOpen(o);
  }, [value]);

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
      setFromText(formatDate(range.from));
      setToText(formatDate(range.to));
      setOpen(false);
    }
  }, [onChange]);

  const handleLast30 = useCallback(() => {
    const to = new Date();
    const from = subDays(to, 30);
    const range = { from, to };
    setPending(range);
    onChange(range);
    setFromText(formatDate(from));
    setToText(formatDate(to));
    setOpen(false);
  }, [onChange]);

  const handleFromChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFromText(val);
    if (val === "") {
      setFromError(false);
      onChange(undefined);
      return;
    }
    const d = parseDate(val);
    if (d) {
      setFromError(false);
      const newRange = { from: d, to: value?.to };
      if (newRange.from && newRange.to) onChange(newRange);
    } else {
      setFromError(true);
    }
  }, [onChange, value?.to]);

  const handleToChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setToText(val);
    if (val === "") {
      setToError(false);
      if (value?.from) onChange({ from: value.from, to: undefined });
      return;
    }
    const d = parseDate(val);
    if (d) {
      setToError(false);
      const newRange = { from: value?.from, to: d };
      if (newRange.from && newRange.to) onChange(newRange);
    } else {
      setToError(true);
    }
  }, [onChange, value?.from]);

  const handleClear = useCallback(() => {
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

      {/* Przycisk kalendarza */}
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

      {/* Przycisk X — wyczyść */}
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
