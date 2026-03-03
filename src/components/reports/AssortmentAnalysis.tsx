import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown, Package, TrendingUp, AlertTriangle,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";

// ── Threshold for "high offers, zero conversion" warning ──
const HIGH_OFFERS_THRESHOLD = 5;

interface ProductAgg {
  product_name: string;
  order_count: number;
  offer_count: number;
  conversion: number;
  total_value: number;
}

type SortKey = "product_name" | "order_count" | "offer_count" | "conversion" | "total_value";
type SortDir = "asc" | "desc";

const formatCurrency = (v: number) =>
  v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface AssortmentAnalysisProps {
  orders: any[];
  opportunities: any[];
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const STORAGE_KEY = "toptech-assortment-pagesize";

const getStoredPageSize = (): number => {
  try { const v = localStorage.getItem(STORAGE_KEY); return v && PAGE_SIZE_OPTIONS.includes(Number(v) as any) ? Number(v) : 20; } catch { return 20; }
};

const AssortmentAnalysis = ({ orders, opportunities }: AssortmentAnalysisProps) => {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [clientFilter, setClientFilter] = useState<string>("__all__");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(getStoredPageSize);
  // ── Unique clients for dropdown ──
  const clients = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      const name = (o.client_name ?? "").trim();
      if (name) set.add(name);
    }
    for (const o of opportunities) {
      const name = (o.client_name ?? "").trim();
      if (name) set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pl"));
  }, [orders, opportunities]);

  // ── Product aggregation ──
  const products = useMemo<ProductAgg[]>(() => {
    const filteredOrders = clientFilter === "__all__"
      ? orders
      : orders.filter((o) => (o.client_name ?? "").trim() === clientFilter);

    const filteredOpps = clientFilter === "__all__"
      ? opportunities
      : opportunities.filter((o) => (o.client_name ?? "").trim() === clientFilter);

    const map = new Map<string, { orderCount: number; offerCount: number; totalValue: number }>();

    for (const o of filteredOrders) {
      const name = (o.product_name ?? "").trim();
      if (!name) continue;
      const price = Number(o.price) || 0;
      const qty = Number(o.quantity) || 0;
      const value = price * qty;

      const existing = map.get(name);
      if (existing) {
        existing.orderCount += 1;
        existing.totalValue += value;
      } else {
        map.set(name, { orderCount: 1, offerCount: 0, totalValue: value });
      }
    }

    for (const o of filteredOpps) {
      const name = (o.product_name ?? "").trim();
      if (!name || name.length < 2) continue;
      const existing = map.get(name);
      if (existing) {
        existing.offerCount += 1;
      } else {
        map.set(name, { orderCount: 0, offerCount: 1, totalValue: 0 });
      }
    }

    return Array.from(map.entries()).map(([name, d]) => {
      const total = d.orderCount + d.offerCount;
      return {
        product_name: name,
        order_count: d.orderCount,
        offer_count: d.offerCount,
        conversion: total > 0 ? (d.orderCount / total) * 100 : 0,
        total_value: d.totalValue,
      };
    });
  }, [orders, opportunities, clientFilter]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    if (!products.length) return null;
    const topRevenue = products.reduce((a, b) => (a.total_value > b.total_value ? a : b));
    const mostQuoted = products.reduce((a, b) => (a.offer_count > b.offer_count ? a : b));
    const zeroConversion = products.filter(
      (p) => p.offer_count >= HIGH_OFFERS_THRESHOLD && p.order_count === 0
    ).length;
    return { topRevenue, mostQuoted, zeroConversion };
  }, [products]);

  // ── Filter + sort ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = q ? products.filter((p) => p.product_name.toLowerCase().includes(q)) : products;

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "product_name":
          cmp = a.product_name.localeCompare(b.product_name, "pl"); break;
        case "order_count":
          cmp = a.order_count - b.order_count; break;
        case "offer_count":
          cmp = a.offer_count - b.offer_count; break;
        case "conversion":
          cmp = a.conversion - b.conversion; break;
        case "total_value":
          cmp = a.total_value - b.total_value; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [products, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  useEffect(() => { setPage(0); }, [search, sortKey, sortDir, pageSize, clientFilter]);

  const handlePageSizeChange = useCallback((val: string) => {
    const n = Number(val);
    setPageSize(n);
    try { localStorage.setItem(STORAGE_KEY, String(n)); } catch { }
  }, []);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageRows = useMemo(
    () => filtered.slice(page * pageSize, (page + 1) * pageSize),
    [filtered, page, pageSize],
  );

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1 text-primary" />;
  };

  const isWarningRow = (p: ProductAgg) =>
    p.offer_count >= HIGH_OFFERS_THRESHOLD && p.conversion === 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Analiza konwersji ofert do zleceń — {products.length} produktów
        </p>
      </div>

      {/* ── KPI Cards ── */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Top Produkt (Wartość)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-foreground truncate">{kpis.topRevenue.product_name}</p>
              <p className="text-sm text-muted-foreground">{formatCurrency(kpis.topRevenue.total_value)} PLN</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4 text-accent-foreground" />
                Najczęściej Wyceniany
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-foreground truncate">{kpis.mostQuoted.product_name}</p>
              <p className="text-sm text-muted-foreground">{kpis.mostQuoted.offer_count} ofert</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Zerowa Konwersja (&ge;{HIGH_OFFERS_THRESHOLD} ofert)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.zeroConversion}</p>
              <p className="text-sm text-muted-foreground">produktów bez realizacji</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj produktu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 text-sm border-border bg-card shadow-sm"
          />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-full sm:w-[260px] h-10 text-sm border-border bg-card shadow-sm">
            <SelectValue placeholder="Wszyscy klienci" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Wszyscy klienci</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ── */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("product_name")}>
                <span className="flex items-center">Produkt <SortIcon col="product_name" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort("order_count")}>
                <span className="flex items-center justify-center">Zlecenia <SortIcon col="order_count" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort("offer_count")}>
                <span className="flex items-center justify-center">Oferty <SortIcon col="offer_count" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort("conversion")}>
                <span className="flex items-center justify-center">Konwersja <SortIcon col="conversion" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("total_value")}>
                <span className="flex items-center justify-end">Wartość (PLN) <SortIcon col="total_value" /></span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  Brak danych produktów
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((p) => (
                <TableRow
                  key={p.product_name}
                  className={isWarningRow(p) ? "bg-destructive/10 hover:bg-destructive/15" : ""}
                >
                  <TableCell className="font-medium text-foreground max-w-[300px] truncate">
                    {p.product_name}
                    {isWarningRow(p) && (
                      <AlertTriangle className="inline-block h-3.5 w-3.5 ml-1.5 text-destructive" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">{p.order_count}</TableCell>
                  <TableCell className="text-center">{p.offer_count}</TableCell>
                  <TableCell className="text-center font-mono text-sm">
                    {p.conversion.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(p.total_value)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} z {filtered.length}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Wierszy:</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-[70px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(0)}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {page + 1} / {totalPages || 1}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AssortmentAnalysis;
