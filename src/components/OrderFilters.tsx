import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ComboboxFilter } from "@/components/ComboboxFilter";

export interface FilterState {
  search: string;
  clientName: string;
  productName: string;
  groupName: string;
}

interface OrderFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  clients: string[];
  products: string[];
  groups: string[];
}

export const EMPTY_FILTERS: FilterState = {
  search: "",
  clientName: "",
  productName: "",
  groupName: "",
};

export function OrderFilters({ filters, onChange, clients, products, groups }: OrderFiltersProps) {
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

      {/* Row 2: Combobox filters */}
      <div className="flex flex-wrap gap-3">
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
      </div>
    </div>
  );
}
