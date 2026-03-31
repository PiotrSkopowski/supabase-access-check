import { useState, useCallback, useEffect } from "react";
import { format, parse, isValid, subDays } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

const DATE_FORMAT = "yyyy-MM-dd";
const PLACEHOLDER = "RRRR-MM-DD";
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
    <div className={cn("flex items-end gap-2", className)}>
      {/* Pole "Od" */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Od</Label>
        <Input
          value={fromText}
          onChange={handleFromChange}
          placeholder={PLACEHOLDER}
          className={cn("h-9 w-[120px] text-sm", fromError && "border-destructive")}
        />
        {fromError && (
          <p className="text-[10px] text-destructive">Format: RRRR-MM-DD</p>
        )}
      </div>

      <span className="text-muted-foreground pb-2">—</span>

      {/* Pole "Do" */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Do</Label>
        <Input
          value={toText}
          onChange={handleToChange}
          placeholder={PLACEHOLDER}
          className={cn("h-9 w-[120px] text-sm", toError && "border-destructive")}
        />
        {toError && (
          <p className="text-[10px] text-destructive">Format: RRRR-MM-DD</p>
        )}
      </div>

      {/* Przycisk kalendarza */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground invisible">_</Label>
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            {/* Skrót — Ostatnie 30 dni */}
            <div className="flex items-center justify-between border-b px-3 py-2">
              <Button variant="ghost" size="sm" className="text-xs" onClick={handleLast30}>
                Ostatnie 30 dni
              </Button>
              <span className="text-xs text-muted-foreground">
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
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Przycisk czyszczenia */}
      {hasValue && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground invisible">_</Label>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default DateRangePicker;
