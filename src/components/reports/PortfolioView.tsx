import { useState, useMemo, useEffect, useCallback } from "react";
import { format, subMonths, differenceInDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { pl } from "date-fns/locale";
import {
  Download, FileText, FileSpreadsheet, Users,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, BarChart3, GitCompare, Filter, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ComboboxFilter } from "@/components/ComboboxFilter";
import type { DateRange } from "react-day-picker";
import * as XLSX from "xlsx";

/* ── Types ── */
export interface ClientPortfolioRow {
  client_name: string;
  total_revenue: number;
  order_count: number;
  unique_products: number;
  last_order_date: string | null;
  avg_order_value: number;
  rotation_index: number; // avg days between orders
  segment: "A" | "B" | "C";
}

type SortKey = "client_name" | "total_revenue" | "order_count" | "rotation_index" | "segment";
type SortDir = "asc" | "desc";
type SegmentFilter = "all" | "A" | "B" | "C";

const formatCurrency = (v: number) =>
  v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

function getSegment(revenue: number, orderCount: number): "A" | "B" | "C" {
  if (revenue >= 10000 || orderCount >= 5) return "A";
  if ((revenue >= 2000 && revenue < 10000) || (orderCount >= 2 && orderCount <= 4)) return "B";
  return "C";
}

const SEGMENT_DESCRIPTIONS: Record<"A" | "B" | "C", string> = {
  A: "Segment A: Kluczowi klienci (Wysoki obrót lub bardzo częste zamówienia).",
  B: "Segment B: Klienci stabilni (Średni obrót, regularne zamówienia).",
  C: "Segment C: Klienci jednorazowi lub z niskim obrotem.",
};

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
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>("all");
  /* ── Filter by date ── */
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (dateRange?.from && dateRange?.to && o.order_date) {
        const d = new Date(o.order_date);
        if (!isWithinInterval(d, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) return false;
      }
      return true;
    });
  }, [orders, dateRange]);

  /* ── Unique client names for search ── */
  const clientNames = useMemo(() => {
    const set = new Set<string>();
    for (const o of filteredOrders) {
      const n = (o.client_name ?? "").trim();
      if (n) set.add(n);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pl"));
  }, [filteredOrders]);

  /* ── Aggregate clients ── */
  const clients = useMemo<ClientPortfolioRow[]>(() => {
    const map = new Map<string, { revenue: number; count: number; products: Set<string>; dates: string[]; lastDate: string | null }>();

    for (const o of filteredOrders) {
      const name = (o.client_name ?? "").trim();
      if (!name) continue;
      const price = Number(o.price) || 0;
      const qty = Number(o.quantity) || 0;
      const value = price * qty;
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

    // Calculate rotation index per client
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
        segment: getSegment(d.revenue, d.count),
      };
    });
  }, [filteredOrders]);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const totalRev = clients.reduce((s, c) => s + c.total_revenue, 0);
    const segA = clients.filter((c) => c.segment === "A").length;
    const segB = clients.filter((c) => c.segment === "B").length;
    const segC = clients.filter((c) => c.segment === "C").length;
    return { totalClients: clients.length, totalRev, segA, segB, segC };
  }, [clients]);

  /* ── Filter + Sort ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = q ? clients.filter((c) => c.client_name.toLowerCase().includes(q)) : clients;

    if (segmentFilter !== "all") {
      list = list.filter((c) => c.segment === segmentFilter);
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
  }, [clients, search, sortKey, sortDir, segmentFilter]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  useEffect(() => { setPage(0); }, [search, sortKey, sortDir, pageSize, segmentFilter]);

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
    : "Cały okres";

  return (
    <div className="space-y-6">
      {/* Print header */}
      <div className="hidden print:block print:mb-6">
        <h1 className="text-2xl font-bold">Toptech Polska — Portfel Klientów</h1>
        <p className="text-sm text-muted-foreground mt-1">Okres: {dateRangeLabel}</p>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center print:hidden flex-wrap">
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted-foreground">Data od</label>
            <Input
              type="date"
              className="w-[180px]"
              value={dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""}
              onChange={(e) => {
                const val = e.target.value;
                onDateRangeChange(val ? { from: new Date(val), to: dateRange?.to } : { from: undefined, to: dateRange?.to });
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted-foreground">Data do</label>
            <Input
              type="date"
              className="w-[180px]"
              value={dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : ""}
              onChange={(e) => {
                const val = e.target.value;
                onDateRangeChange(val ? { from: dateRange?.from, to: new Date(val) } : { from: dateRange?.from, to: undefined });
              }}
            />
          </div>
        </div>

        <ComboboxFilter
          value={search}
          onChange={setSearch}
          options={clientNames}
          placeholder="Szukaj klienta…"
          emptyText="Nie znaleziono"
          className="w-full sm:w-[280px]"
        />

        <Select value={segmentFilter} onValueChange={(v) => setSegmentFilter(v as SegmentFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <SelectValue placeholder="Segment" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie segmenty</SelectItem>
            <SelectItem value="A">Segment A</SelectItem>
            <SelectItem value="B">Segment B</SelectItem>
            <SelectItem value="C">Segment C</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} klientów</span>

        {selected.size >= 2 && (
          <Button variant="default" size="sm" className="gap-1.5" onClick={() => onCompare(Array.from(selected))}>
            <GitCompare className="h-4 w-4" />
            Porównaj ({selected.size})
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
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
      {segmentFilter !== "all" && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground print:hidden">
          <Info className="h-4 w-4 shrink-0 text-primary" />
          {SEGMENT_DESCRIPTIONS[segmentFilter]}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Klienci</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">{kpis.totalClients}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Obrót</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.totalRev)} PLN</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Segment A</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">{kpis.segA}</p><p className="text-xs text-muted-foreground">kluczowi klienci</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Segment B</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">{kpis.segB}</p><p className="text-xs text-muted-foreground">średni potencjał</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Segment C</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">{kpis.segC}</p><p className="text-xs text-muted-foreground">okazjonalni</p></CardContent>
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
