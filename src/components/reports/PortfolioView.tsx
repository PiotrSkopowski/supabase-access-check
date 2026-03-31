import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { format, differenceInDays, isWithinInterval, startOfDay, endOfDay, subDays } from "date-fns";
import { pl } from "date-fns/locale";
import {
  Download, FileText, FileSpreadsheet, Users,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, BarChart3, GitCompare, Info,
  CalendarIcon, Search, Settings, Check,
} from "lucide-react";
import { StatusFilter } from "@/components/StatusFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import * as XLSX from "xlsx";

/* ── Forbidden names ── */
const FORBIDDEN_NAMES = ["fly4u", "sky rocket", "test", "toptech"];

/* ── Types ── */
export interface ClientPortfolioRow {
  client_name: string;
  total_revenue: number;
  order_count: number;
  unique_products: number;
  last_order_date: string | null;
  avg_order_value: number;
  rotation_index: number;
  segment: "A" | "B" | "C";
}

type SortKey = "client_name" | "total_revenue" | "order_count" | "rotation_index" | "segment";
type SortDir = "asc" | "desc";
type SegmentFilter = "all" | "A" | "B" | "C";

interface SegmentThresholds {
  aMinRevenue: number;
  aMinOrders: number;
  bMinRevenue: number;
  bMinOrders: number;
}

const LS_KEYS = {
  aRevenue: "toptech-segment-a-revenue",
  aOrders: "toptech-segment-a-orders",
  bRevenue: "toptech-segment-b-revenue",
  bOrders: "toptech-segment-b-orders",
};

const loadThresholds = (): SegmentThresholds => ({
  aMinRevenue: Number(localStorage.getItem(LS_KEYS.aRevenue)) || 10000,
  aMinOrders: Number(localStorage.getItem(LS_KEYS.aOrders)) || 5,
  bMinRevenue: Number(localStorage.getItem(LS_KEYS.bRevenue)) || 2000,
  bMinOrders: Number(localStorage.getItem(LS_KEYS.bOrders)) || 2,
});

const DEFAULT_THRESHOLDS: SegmentThresholds = loadThresholds();

const formatCurrency = (v: number) =>
  v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Format number with space as thousands separator for display */
const formatWithSpaces = (v: number): string => {
  if (!v && v !== 0) return "";
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

/** Parse space-formatted string back to number */
const parseSpaced = (s: string): number => {
  const cleaned = s.replace(/\s/g, "");
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

function getSegment(revenue: number, orderCount: number, t: SegmentThresholds): "A" | "B" | "C" {
  if (revenue >= t.aMinRevenue || orderCount >= t.aMinOrders) return "A";
  if (revenue >= t.bMinRevenue || orderCount >= t.bMinOrders) return "B";
  return "C";
}

const segmentColors: Record<string, string> = {
  A: "bg-primary text-primary-foreground",
  B: "bg-accent text-accent-foreground",
  C: "bg-muted text-muted-foreground",
};

interface PortfolioViewProps {
  orders: any[];
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onClientClick: (clientName: string) => void;
  onCompare: (clients: string[]) => void;
}

const PortfolioView = ({
  orders: rawOrders,
  dateRange,
  onDateRangeChange,
  onClientClick,
  onCompare,
}: PortfolioViewProps) => {
  const orders = rawOrders ?? [];
  const [sortKey, setSortKey] = useState<SortKey>("total_revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>("all");
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [clientSearch, setClientSearch] = useState("");
  const [thresholds, setThresholds] = useState<SegmentThresholds>(DEFAULT_THRESHOLDS);
  const [draftThresholds, setDraftThresholds] = useState<SegmentThresholds>(DEFAULT_THRESHOLDS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>(dateRange);

  // Formatted display values for threshold inputs (draft)
  const [displayARevenue, setDisplayARevenue] = useState(formatWithSpaces(DEFAULT_THRESHOLDS.aMinRevenue));
  const [displayBRevenue, setDisplayBRevenue] = useState(formatWithSpaces(DEFAULT_THRESHOLDS.bMinRevenue));

  // Sync draft when popover opens
  const handleSettingsOpen = useCallback((open: boolean) => {
    if (open) {
      setDraftThresholds(thresholds);
      setDisplayARevenue(formatWithSpaces(thresholds.aMinRevenue));
      setDisplayBRevenue(formatWithSpaces(thresholds.bMinRevenue));
    }
    setSettingsOpen(open);
  }, [thresholds]);

  const handleSaveThresholds = useCallback(() => {
    setThresholds(draftThresholds);
    localStorage.setItem(LS_KEYS.aRevenue, String(draftThresholds.aMinRevenue));
    localStorage.setItem(LS_KEYS.aOrders, String(draftThresholds.aMinOrders));
    localStorage.setItem(LS_KEYS.bRevenue, String(draftThresholds.bMinRevenue));
    localStorage.setItem(LS_KEYS.bOrders, String(draftThresholds.bMinOrders));
    setSettingsOpen(false);
    toast.success("Ustawienia segmentacji zostały zapisane");
  }, [draftThresholds]);

  const handleCalendarSelect = useCallback((range: DateRange | undefined) => {
    setCalendarRange(range);
    if (!range || (range.from && range.to)) {
      onDateRangeChange(range);
    }
  }, [onDateRangeChange]);

  useEffect(() => {
    setCalendarRange(dateRange);
  }, [dateRange]);

  /* ── Clean orders: exclude forbidden names ── */
  const cleanOrders = useMemo(() => {
    return orders.filter((o) => {
      const name = (o.client_name ?? "").trim().toLowerCase();
      return !FORBIDDEN_NAMES.some((f) => name === f);
    });
  }, [orders]);

  /* ── Available statuses from clean orders ── */
  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const o of cleanOrders) {
      set.add(o.status || "");
    }
    return Array.from(set).sort();
  }, [cleanOrders]);

  /* ── Initialize selectedStatuses when availableStatuses change ── */
  useEffect(() => {
    if (availableStatuses.length > 0 && selectedStatuses.length === 0) {
      setSelectedStatuses([...availableStatuses]);
    }
  }, [availableStatuses]);

  /* ── LTM cutoff for segmentation (last 365 days) ── */
  const ltmCutoff = useMemo(() => startOfDay(subDays(new Date(), 365)), []);

  /* ── Orders filtered by LTM for segmentation ── */
  const ltmOrders = useMemo(() => {
    return cleanOrders.filter((o) => {
      if (!o.order_date) return false;
      return new Date(o.order_date) >= ltmCutoff;
    });
  }, [cleanOrders, ltmCutoff]);

  /* ── Build LTM-based segment map ── */
  const ltmSegmentMap = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>();
    for (const o of ltmOrders) {
      const name = (o.client_name ?? "").trim();
      if (!name) continue;
      const value = (Number(o.price) || 0) * (Number(o.quantity) || 0);
      const existing = map.get(name);
      if (existing) {
        existing.revenue += value;
        existing.count += 1;
      } else {
        map.set(name, { revenue: value, count: 1 });
      }
    }
    const result = new Map<string, "A" | "B" | "C">();
    for (const [name, d] of map) {
      result.set(name, getSegment(d.revenue, d.count, thresholds));
    }
    return result;
  }, [ltmOrders, thresholds]);

  /* ── Filter by user-selected date range AND status (for display) ── */
  const filteredOrders = useMemo(() => {
    const statusSet = new Set(selectedStatuses);
    return cleanOrders.filter((o) => {
      // Status filter — filter BEFORE aggregation
      if (statusSet.size > 0 && !statusSet.has(o.status || "")) return false;
      // Date range filter
      if (!dateRange?.from && !dateRange?.to) return true;
      if (!o.order_date) return true;
      if (dateRange.from && dateRange.to) {
        const d = new Date(o.order_date);
        return isWithinInterval(d, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) });
      }
      return true;
    });
  }, [cleanOrders, dateRange, selectedStatuses]);

  /* ── Aggregate clients from filtered orders, segment from LTM ── */
  const clients = useMemo<ClientPortfolioRow[]>(() => {
    const map = new Map<string, { revenue: number; count: number; products: Set<string>; dates: string[]; lastDate: string | null }>();

    for (const o of filteredOrders) {
      const name = (o.client_name ?? "").trim();
      if (!name) continue;
      const value = (Number(o.price) || 0) * (Number(o.quantity) || 0);
      const date = o.order_date ?? null;
      const productName = (o.product_name ?? "").trim();

      const existing = map.get(name);
      if (existing) {
        existing.revenue += value;
        existing.count += 1;
        if (productName) existing.products.add(productName);
        if (date) existing.dates.push(date);
        if (date && (!existing.lastDate || date > existing.lastDate)) existing.lastDate = date;
      } else {
        const products = new Set<string>();
        if (productName) products.add(productName);
        map.set(name, { revenue: value, count: 1, products, dates: date ? [date] : [], lastDate: date });
      }
    }

    return Array.from(map.entries()).map(([name, d]) => {
      const sortedDates = d.dates.sort();
      let avgInterval = 0;
      if (sortedDates.length > 1) {
        let totalGap = 0;
        for (let i = 1; i < sortedDates.length; i++) {
          totalGap += differenceInDays(new Date(sortedDates[i]), new Date(sortedDates[i - 1]));
        }
        avgInterval = Math.round(totalGap / (sortedDates.length - 1));
      }

      return {
        client_name: name,
        total_revenue: d.revenue,
        order_count: d.count,
        unique_products: d.products.size,
        last_order_date: d.lastDate,
        avg_order_value: d.count > 0 ? d.revenue / d.count : 0,
        rotation_index: avgInterval,
        segment: ltmSegmentMap.get(name) ?? "C",
      };
    });
  }, [filteredOrders, ltmSegmentMap]);

  /* ── Clients filtered by segment (for client filter list) ── */
  const clientsForFilter = useMemo(() => {
    if (segmentFilter === "all") return clients;
    return clients.filter((c) => c.segment === segmentFilter);
  }, [clients, segmentFilter]);

  const clientNamesForFilter = useMemo(() =>
    clientsForFilter.map((c) => c.client_name).sort((a, b) => a.localeCompare(b, "pl")),
    [clientsForFilter]
  );

  const visibleClientNames = useMemo(() => {
    const q = clientSearch.toLowerCase().trim();
    if (!q) return clientNamesForFilter;
    return clientNamesForFilter.filter((n) => n.toLowerCase().includes(q));
  }, [clientNamesForFilter, clientSearch]);

  /* ── Filter + Sort ── */
  const filtered = useMemo(() => {
    let list = clients;
    if (segmentFilter !== "all") {
      list = list.filter((c) => c.segment === segmentFilter);
    }
    if (selectedClients.size > 0) {
      list = list.filter((c) => selectedClients.has(c.client_name));
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "client_name": cmp = a.client_name.localeCompare(b.client_name, "pl"); break;
        case "total_revenue": cmp = a.total_revenue - b.total_revenue; break;
        case "order_count": cmp = a.order_count - b.order_count; break;
        case "rotation_index": cmp = a.rotation_index - b.rotation_index; break;
        case "segment": cmp = a.segment.localeCompare(b.segment); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [clients, sortKey, sortDir, segmentFilter, selectedClients]);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const totalRev = filtered.reduce((s, c) => s + c.total_revenue, 0);
    const segA = filtered.filter((c) => c.segment === "A");
    const segB = filtered.filter((c) => c.segment === "B");
    const segC = filtered.filter((c) => c.segment === "C");
    return {
      totalClients: filtered.length,
      totalRev,
      segA: { count: segA.length, revenue: segA.reduce((s, c) => s + c.total_revenue, 0) },
      segB: { count: segB.length, revenue: segB.reduce((s, c) => s + c.total_revenue, 0) },
      segC: { count: segC.length, revenue: segC.reduce((s, c) => s + c.total_revenue, 0) },
    };
  }, [filtered]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  useEffect(() => { setPage(0); }, [sortKey, sortDir, pageSize, segmentFilter, selectedClients, dateRange]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageRows = useMemo(
    () => filtered.slice(page * pageSize, (page + 1) * pageSize),
    [filtered, page, pageSize],
  );

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else if (next.size < 3) next.add(name);
      return next;
    });
  };

  const toggleClientFilter = (name: string) => {
    setSelectedClients((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  /* ── Export ── */
  const handleExportExcel = () => {
    const rows = filtered.map((c) => ({
      "Klient": c.client_name,
      "Segment": c.segment,
      "Obrót (PLN)": c.total_revenue,
      "Zlecenia": c.order_count,
      "Unikalne Produkty": c.unique_products,
      "Śr. Wartość Zamówienia": c.avg_order_value,
      "Wskaźnik Rotacji (dni)": c.rotation_index,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Portfel");
    XLSX.writeFile(wb, `Toptech_Portfel_Klientow.xlsx`);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1 text-primary" />;
  };

  const dateRangeLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, "dd MMM yyyy", { locale: pl })} – ${format(dateRange.to, "dd MMM yyyy", { locale: pl })}`
    : dateRange?.from
      ? `Od ${format(dateRange.from, "dd MMM yyyy", { locale: pl })}`
      : "Cały okres";

  const segmentDescription = segmentFilter === "all" ? null
    : segmentFilter === "A" ? `Segment A: Obrót ≥ ${formatWithSpaces(thresholds.aMinRevenue)} PLN lub min. ${thresholds.aMinOrders} zamówień (LTM).`
    : segmentFilter === "B" ? `Segment B: Obrót ≥ ${formatWithSpaces(thresholds.bMinRevenue)} PLN lub min. ${thresholds.bMinOrders} zamówień (LTM).`
    : "Segment C: Pozostali klienci poniżej progów Segmentu B (LTM).";

  return (
    <div className="space-y-4">
      {/* Print header */}
      <div className="hidden print:block print:mb-6">
        <h1 className="text-2xl font-bold">Toptech Polska — Portfel Klientów</h1>
        <p className="text-sm text-muted-foreground mt-1">Okres: {dateRangeLabel}</p>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-10 rounded-md text-sm justify-start min-w-[240px]", !dateRange?.from && "text-muted-foreground")}>
              <CalendarIcon className="h-4 w-4 mr-2" />
              {dateRangeLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={calendarRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              locale={pl}
              className="p-3 pointer-events-auto"
            />
            {dateRange?.from && (
              <div className="border-t px-3 py-2">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => onDateRangeChange(undefined)}>
                  Wyczyść daty
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Client Multi-Select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-10 rounded-md text-sm gap-2">
              <Search className="h-4 w-4" />
              Klient
              {selectedClients.size > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{selectedClients.size}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Szukaj klienta…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-1 px-2 py-1.5 border-b">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setSelectedClients((prev) => {
                    const next = new Set(prev);
                    visibleClientNames.forEach((n) => next.add(n));
                    return next;
                  });
                }}
              >
                Zaznacz widoczne
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setSelectedClients((prev) => {
                    const next = new Set(prev);
                    visibleClientNames.forEach((n) => next.delete(n));
                    return next;
                  });
                }}
              >
                Odznacz widoczne
              </Button>
            </div>
            <ScrollArea className="max-h-64">
              {visibleClientNames.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Brak wyników</p>
              ) : (
                visibleClientNames.map((name) => (
                  <button
                    key={name}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                    onClick={() => toggleClientFilter(name)}
                  >
                    <Checkbox checked={selectedClients.has(name)} className="pointer-events-none" />
                    <span className="truncate">{name}</span>
                  </button>
                ))
              )}
            </ScrollArea>
            {selectedClients.size > 0 && (
              <div className="border-t px-2 py-1.5">
                <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={() => setSelectedClients(new Set())}>
                  Wyczyść wszystkie ({selectedClients.size})
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Segment Filter */}
        <Select value={segmentFilter} onValueChange={(v) => setSegmentFilter(v as SegmentFilter)}>
          <SelectTrigger className="h-10 rounded-md text-sm w-[170px]">
            <SelectValue placeholder="Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy</SelectItem>
            <SelectItem value="A">Segment A</SelectItem>
            <SelectItem value="B">Segment B</SelectItem>
            <SelectItem value="C">Segment C</SelectItem>
          </SelectContent>
        </Select>

        {/* Segmentation Settings (Popover) */}
        <Popover open={settingsOpen} onOpenChange={handleSettingsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-md"
              title="Ustawienia Segmentacji"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-foreground">⚙️ Segmentacja (LTM)</p>
                <p className="text-xs text-muted-foreground mt-1">Progi liczone na bazie ostatnich 365 dni.</p>
              </div>

              <div className="space-y-2 rounded-md border border-border p-3 bg-muted/30">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Segment A — Kluczowi</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Min. obrót (PLN)</Label>
                    <Input
                      value={displayARevenue}
                      className="h-9 text-sm"
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d]/g, "");
                        const num = Number(raw) || 0;
                        setDisplayARevenue(raw ? formatWithSpaces(num) : "");
                        setDraftThresholds((p) => ({ ...p, aMinRevenue: num }));
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Min. zamówień</Label>
                    <Input
                      type="number"
                      value={draftThresholds.aMinOrders}
                      className="h-9 text-sm"
                      onChange={(e) => setDraftThresholds((p) => ({ ...p, aMinOrders: Number(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-border p-3 bg-muted/30">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Segment B — Stabilni</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Min. obrót (PLN)</Label>
                    <Input
                      value={displayBRevenue}
                      className="h-9 text-sm"
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d]/g, "");
                        const num = Number(raw) || 0;
                        setDisplayBRevenue(raw ? formatWithSpaces(num) : "");
                        setDraftThresholds((p) => ({ ...p, bMinRevenue: num }));
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Min. zamówień</Label>
                    <Input
                      type="number"
                      value={draftThresholds.bMinOrders}
                      className="h-9 text-sm"
                      onChange={(e) => setDraftThresholds((p) => ({ ...p, bMinOrders: Number(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">Segment C: Poniżej progów B.</p>

              <Button className="w-full h-9 text-sm" onClick={handleSaveThresholds}>
                Zapisz ustawienia
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Status Filter */}
        <StatusFilter
          availableStatuses={availableStatuses}
          selectedStatuses={selectedStatuses}
          onChange={setSelectedStatuses}
        />

        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} klientów</span>

        {selected.size >= 2 && (
          <Button variant="default" size="sm" className="gap-1.5 h-10" onClick={() => onCompare(Array.from(selected))}>
            <GitCompare className="h-4 w-4" />
            Porównaj ({selected.size})
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-10">
              <Download className="h-4 w-4" />
              Eksportuj
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => window.print()} className="gap-2 cursor-pointer">
              <FileText className="h-4 w-4" /> Drukuj / PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4" /> Eksport Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Segment Info Bar ── */}
      {segmentDescription && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground print:hidden">
          <Info className="h-4 w-4 shrink-0 text-primary" />
          {segmentDescription}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Klienci
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{kpis.totalClients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Obrót
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.totalRev)} PLN</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Segment A</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{kpis.segA.count}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(kpis.segA.revenue)} PLN</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Segment B</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{kpis.segB.count}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(kpis.segB.revenue)} PLN</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Segment C</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{kpis.segC.count}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(kpis.segC.revenue)} PLN</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Table ── */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 print:hidden" />
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("client_name")}>
                <span className="flex items-center">Klient <SortIcon col="client_name" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort("segment")}>
                <span className="flex items-center justify-center">Segment <SortIcon col="segment" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("total_revenue")}>
                <span className="flex items-center justify-end">Obrót (PLN) <SortIcon col="total_revenue" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort("order_count")}>
                <span className="flex items-center justify-center">Zlecenia <SortIcon col="order_count" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort("rotation_index")}>
                <span className="flex items-center justify-center">Rotacja (dni) <SortIcon col="rotation_index" /></span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Brak danych</TableCell></TableRow>
            ) : (
              pageRows.map((c) => (
                <TableRow key={c.client_name} className={selected.has(c.client_name) ? "bg-accent/30" : ""}>
                  <TableCell className="print:hidden">
                    <Checkbox
                      checked={selected.has(c.client_name)}
                      onCheckedChange={() => toggleSelect(c.client_name)}
                      disabled={!selected.has(c.client_name) && selected.size >= 3}
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      className="text-left font-medium text-primary hover:underline cursor-pointer"
                      onClick={() => onClientClick(c.client_name)}
                    >
                      {c.client_name}
                    </button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("text-xs", segmentColors[c.segment])}>{c.segment}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatCurrency(c.total_revenue)}</TableCell>
                  <TableCell className="text-center">{c.order_count}</TableCell>
                  <TableCell className="text-center text-sm">{c.rotation_index > 0 ? `${c.rotation_index} dni` : "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} z {filtered.length}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Wierszy:</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-[70px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(0)}><ChevronsLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm text-muted-foreground px-2">{page + 1} / {totalPages || 1}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}><ChevronsRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PortfolioView;
