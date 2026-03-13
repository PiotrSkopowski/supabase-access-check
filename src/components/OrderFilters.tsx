import { Search, X, SlidersHorizontal, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ComboboxFilter } from "@/components/ComboboxFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export interface FilterState {
  search: string;
  clientName: string;
  productName: string;
  groupName: string;
}

export type ToggleableColumn = "group_name" | "client_name" | "order_date" | "quantity" | "price";

export const TOGGLEABLE_COLUMNS: { key: ToggleableColumn; label: string }[] = [
  { key: "group_name", label: "Grupa Produktowa" },
  { key: "client_name", label: "Klient" },
  { key: "order_date", label: "Data" },
  { key: "quantity", label: "Ilość" },
  { key: "price", label: "Wycena (Zlec. / Kat.)" },
];

interface OrderFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  clients: string[];
  products: string[];
  groups: string[];
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions: readonly number[];
  hiddenColumns: Set<ToggleableColumn>;
  onToggleColumn: (col: ToggleableColumn) => void;
}

export const EMPTY_FILTERS: FilterState = {
  search: "",
  clientName: "",
  productName: "",
  groupName: "",
};

export function OrderFilters({ filters, onChange, clients, products, groups, pageSize, onPageSizeChange, pageSizeOptions, hiddenColumns, onToggleColumn }: OrderFiltersProps) {
  const hasAny = filters.search || filters.clientName || filters.productName || filters.groupName;

  return (
    <div className="space-y-3">
      {/* Row 1: Global search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj po nazwie produktu, kliencie lub opisie…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-10 h-11 text-sm border-border bg-card shadow-sm"
        />
        {hasAny && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Row 2: Combobox filters + column toggle + page size */}
      <div className="flex flex-wrap gap-3 items-center">
        <ComboboxFilter
          value={filters.clientName}
          onChange={(v) => onChange({ ...filters, clientName: v })}
          options={clients}
          placeholder="Wszyscy klienci"
          className="w-[220px]"
        />
        <ComboboxFilter
          value={filters.productName}
          onChange={(v) => onChange({ ...filters, productName: v })}
          options={products}
          placeholder="Wszystkie produkty"
          className="w-[220px]"
        />
        <ComboboxFilter
          value={filters.groupName}
          onChange={(v) => onChange({ ...filters, groupName: v })}
          options={groups}
          placeholder="Wszystkie grupy"
          className="w-[220px]"
        />
        <div className="flex items-center gap-1.5 ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Kolumny</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Widoczność kolumn</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {TOGGLEABLE_COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={!hiddenColumns.has(col.key)}
                  onCheckedChange={() => onToggleColumn(col.key)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-sm text-muted-foreground whitespace-nowrap">Wierszy:</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="w-[70px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
