import { useState, useEffect, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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

      {/* Row 2: Dropdown filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={filters.clientName}
          onValueChange={(v) => onChange({ ...filters, clientName: v === "__all__" ? "" : v })}
        >
          <SelectTrigger className="w-[220px] bg-card">
            <SelectValue placeholder="Wszyscy klienci" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Wszyscy klienci</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.productName}
          onValueChange={(v) => onChange({ ...filters, productName: v === "__all__" ? "" : v })}
        >
          <SelectTrigger className="w-[220px] bg-card">
            <SelectValue placeholder="Wszystkie produkty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Wszystkie produkty</SelectItem>
            {products.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.groupName}
          onValueChange={(v) => onChange({ ...filters, groupName: v === "__all__" ? "" : v })}
        >
          <SelectTrigger className="w-[220px] bg-card">
            <SelectValue placeholder="Wszystkie grupy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Wszystkie grupy</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
