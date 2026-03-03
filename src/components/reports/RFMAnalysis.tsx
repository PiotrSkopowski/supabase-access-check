import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown, Crown, Heart, AlertTriangle,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { differenceInDays } from "date-fns";

const RECENCY_ACTIVE_DAYS = 60;
const RECENCY_DORMANT_DAYS = 120;

interface CustomerRFM {
  client_name: string;
  monetary: number;
  frequency: number;
  last_order_date: string | null;
  recency_days: number | null;
}

type SortKey = "client_name" | "monetary" | "frequency" | "last_order_date" | "recency_days";
type SortDir = "asc" | "desc";

const formatCurrency = (v: number) =>
  v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

function getStatus(days: number | null): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (days === null) return { label: "Brak danych", variant: "secondary" };
  if (days < RECENCY_ACTIVE_DAYS) return { label: "Aktywny", variant: "default" };
  if (days <= RECENCY_DORMANT_DAYS) return { label: "Uśpiony", variant: "secondary" };
  return { label: "Ryzyko utraty", variant: "destructive" };
}

interface RFMAnalysisProps {
  orders: any[];
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const STORAGE_KEY = "toptech-rfm-pagesize";

const getStoredPageSize = (): number => {
  try { const v = localStorage.getItem(STORAGE_KEY); return v && PAGE_SIZE_OPTIONS.includes(Number(v) as any) ? Number(v) : 20; } catch { return 20; }
};

const RFMAnalysis = ({ orders }: RFMAnalysisProps) => {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("monetary");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(getStoredPageSize);

  const customers = useMemo<CustomerRFM[]>(() => {
    const map = new Map<string, { monetary: number; frequency: number; lastDate: string | null }>();
    const today = new Date();

    for (const o of orders) {
      const name = (o.client_name ?? "").trim();
      if (!name) continue;
      const price = Number(o.price) || 0;
      const qty = Number(o.quantity) || 0;
      const value = price * qty;
      const date = o.order_date ?? null;

      const existing = map.get(name);
      if (existing) {
        existing.monetary += value;
        existing.frequency += 1;
        if (date && (!existing.lastDate || date > existing.lastDate)) existing.lastDate = date;
      } else {
        map.set(name, { monetary: value, frequency: 1, lastDate: date });
      }
    }

    return Array.from(map.entries()).map(([name, d]) => ({
      client_name: name,
      monetary: d.monetary,
      frequency: d.frequency,
      last_order_date: d.lastDate,
      recency_days: d.lastDate ? differenceInDays(today, new Date(d.lastDate)) : null,
    }));
  }, [orders]);

  const kpis = useMemo(() => {
    if (!customers.length) return null;
    const topValue = customers.reduce((a, b) => (a.monetary > b.monetary ? a : b));
    const topFreq = customers.reduce((a, b) => (a.frequency > b.frequency ? a : b));
    const atRisk = customers.filter(
      (c) => c.recency_days !== null && c.recency_days > RECENCY_DORMANT_DAYS
    ).length;
    return { topValue, topFreq, atRisk };
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = q ? customers.filter((c) => c.client_name.toLowerCase().includes(q)) : customers;

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "client_name":
          cmp = a.client_name.localeCompare(b.client_name, "pl"); break;
        case "monetary":
          cmp = a.monetary - b.monetary; break;
        case "frequency":
          cmp = a.frequency - b.frequency; break;
        case "last_order_date":
          cmp = (a.last_order_date ?? "").localeCompare(b.last_order_date ?? ""); break;
        case "recency_days":
          cmp = (a.recency_days ?? 9999) - (b.recency_days ?? 9999); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [customers, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  useEffect(() => { setPage(0); }, [search, sortKey, sortDir, pageSize]);

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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Agregacja historycznych zleceń z Prodio — {customers.length} klientów
        </p>
      </div>

      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" />
                Top Klient (Wartość)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-foreground truncate">{kpis.topValue.client_name}</p>
              <p className="text-sm text-muted-foreground">{formatCurrency(kpis.topValue.monetary)} PLN</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Heart className="h-4 w-4 text-accent-foreground" />
                Najbardziej Lojalny
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-foreground truncate">{kpis.topFreq.client_name}</p>
              <p className="text-sm text-muted-foreground">{kpis.topFreq.frequency} zleceń</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Zagrożeni Klienci (&gt;{RECENCY_DORMANT_DAYS} dni)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.atRisk}</p>
              <p className="text-sm text-muted-foreground">klientów bez zlecenia</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj klienta…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10 text-sm border-border bg-card shadow-sm"
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("client_name")}>
                <span className="flex items-center">Klient <SortIcon col="client_name" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("monetary")}>
                <span className="flex items-center justify-end">Wartość (PLN) <SortIcon col="monetary" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort("frequency")}>
                <span className="flex items-center justify-center">Zlecenia <SortIcon col="frequency" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("last_order_date")}>
                <span className="flex items-center">Ostatnie zlecenie <SortIcon col="last_order_date" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort("recency_days")}>
                <span className="flex items-center justify-center">Dni <SortIcon col="recency_days" /></span>
              </TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Brak danych klientów
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((c) => {
                const status = getStatus(c.recency_days);
                return (
                  <TableRow key={c.client_name}>
                    <TableCell className="font-medium text-foreground max-w-[250px] truncate">
                      {c.client_name}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(c.monetary)}
                    </TableCell>
                    <TableCell className="text-center">{c.frequency}</TableCell>
                    <TableCell className="text-sm">
                      {c.last_order_date ? formatDate(c.last_order_date) : "—"}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {c.recency_days !== null ? c.recency_days : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })
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

export default RFMAnalysis;
