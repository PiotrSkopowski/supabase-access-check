import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search, TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import { ProductDrawer, type ProductDrawerData } from "@/components/ProductDrawer";

interface AggregatedProduct {
  key: string;
  product_name: string;
  description: string | null;
  client_name: string | null;
  order_count: number;
  sales_count: number;
  avg_diff_pct: number | null;
  trend: "up" | "down" | "flat" | null;
  last_activity: string | null;
  prices: number[];
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

type SortKey = "product_name" | "client_name" | "order_count" | "sales_count" | "avg_diff" | "last_activity";
type SortDir = "asc" | "desc";

const ProductsPage = () => {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductDrawerData | null>(null);

  const pageSize = 20;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [ordersRes, productsRes, oppsRes] = await Promise.all([
        supabase.from("order_history").select("*").order("order_date", { ascending: false }),
        supabase.from("products").select("name, current_price, group_id"),
        supabase.from("sales_opportunities").select("client_name, opportunity_date, product_name, unit_price, quantity").not("product_name", "is", null).neq("product_name", "").not("unit_price", "is", null).gt("unit_price", 0).not("quantity", "is", null).gt("quantity", 0),
      ]);

      setOrders(ordersRes.data ?? []);
      setProducts(productsRes.data ?? []);
      setOpportunities(oppsRes.data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  // Build aggregated product list
  const aggregated = useMemo<AggregatedProduct[]>(() => {
    const map = new Map<string, AggregatedProduct>();

    // From orders
    for (const o of orders) {
      const pn = (o.product_name ?? "").trim();
      const desc = (o.description ?? "").trim();
      const key = `${pn.toLowerCase()}|||${desc.toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          product_name: pn,
          description: desc || null,
          client_name: o.client_name ?? null,
          order_count: 0,
          sales_count: 0,
          avg_diff_pct: null,
          trend: null,
          last_activity: null,
          prices: [],
        });
      }

      const entry = map.get(key)!;
      entry.order_count++;
      if (o.price != null) entry.prices.push(o.price);
      if (o.order_date && (!entry.last_activity || o.order_date > entry.last_activity)) {
        entry.last_activity = o.order_date;
      }
    }

    // Count sales opportunities per product
    const norm = (s: string) => (s ?? "").trim().toLowerCase();
    for (const s of opportunities) {
      const sName = norm(s.product_name);
      if (sName.length < 2) continue;

      for (const [, entry] of map) {
        const eName = norm(entry.product_name);
        if (eName.includes(sName) || sName.includes(eName)) {
          entry.sales_count++;
          if (s.opportunity_date && (!entry.last_activity || s.opportunity_date > entry.last_activity)) {
            entry.last_activity = s.opportunity_date;
          }
        }
      }
    }

    // Compute avg diff and trend from catalog
    const catalogMap = new Map<string, number>();
    for (const p of products) {
      if (p.name && p.current_price != null) {
        catalogMap.set(p.name.trim().toLowerCase(), p.current_price);
      }
    }

    for (const [, entry] of map) {
      const catPrice = catalogMap.get(entry.product_name.trim().toLowerCase());
      if (catPrice && catPrice > 0 && entry.prices.length > 0) {
        const diffs = entry.prices.map((p) => ((p - catPrice) / catPrice) * 100);
        entry.avg_diff_pct = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      }

      if (entry.prices.length >= 2) {
        const last = entry.prices[0]; // newest
        const prev = entry.prices[1]; // penultimate
        if (last > prev) entry.trend = "up";
        else if (last < prev) entry.trend = "down";
        else entry.trend = "flat";
      }
    }

    return Array.from(map.values());
  }, [orders, products, opportunities]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return aggregated;
    return aggregated.filter(
      (p) =>
        p.product_name.toLowerCase().includes(s) ||
        (p.description ?? "").toLowerCase().includes(s) ||
        (p.client_name ?? "").toLowerCase().includes(s)
    );
  }, [aggregated, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      let va: any, vb: any;
      switch (sortKey) {
        case "product_name": va = a.product_name.toLowerCase(); vb = b.product_name.toLowerCase(); break;
        case "client_name": va = (a.client_name ?? "").toLowerCase(); vb = (b.client_name ?? "").toLowerCase(); break;
        case "order_count": va = a.order_count; vb = b.order_count; break;
        case "sales_count": va = a.sales_count; vb = b.sales_count; break;
        case "avg_diff": va = a.avg_diff_pct ?? -Infinity; vb = b.avg_diff_pct ?? -Infinity; break;
        case "last_activity": va = a.last_activity ?? ""; vb = b.last_activity ?? ""; break;
        default: return 0;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  useEffect(() => { setPage(0); }, [search, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const pageRows = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }, [sortKey]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const openDrawer = (p: AggregatedProduct) => {
    setSelectedProduct({
      product_name: p.product_name,
      description: p.description,
      client_name: p.client_name,
    });
    setDrawerOpen(true);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Baza Wiedzy o Produktach</h1>
        <p className="text-muted-foreground mt-1">
          {loading ? "Ładowanie…" : `${filtered.length} unikalnych produktów`}
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj produktu, opisu lub klienta…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 text-sm border-border bg-card shadow-sm"
        />
      </div>

      <Card className="shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold w-10">#</TableHead>
                <TableHead className="font-semibold min-w-[200px] cursor-pointer select-none" onClick={() => handleSort("product_name")}>
                  <span className="inline-flex items-center">Produkt <SortIcon column="product_name" /></span>
                </TableHead>
                <TableHead className="font-semibold min-w-[140px] cursor-pointer select-none" onClick={() => handleSort("client_name")}>
                  <span className="inline-flex items-center">Klient <SortIcon column="client_name" /></span>
                </TableHead>
                <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("order_count")}>
                  <span className="inline-flex items-center justify-end">Ilość Zleceń <SortIcon column="order_count" /></span>
                </TableHead>
                <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("sales_count")}>
                  <span className="inline-flex items-center justify-end">Ilość Wycen <SortIcon column="sales_count" /></span>
                </TableHead>
                <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("avg_diff")}>
                  <span className="inline-flex items-center justify-end">Śr. Różnica % <SortIcon column="avg_diff" /></span>
                </TableHead>
                <TableHead className="font-semibold text-center">Trend</TableHead>
                <TableHead className="font-semibold cursor-pointer select-none" onClick={() => handleSort("last_activity")}>
                  <span className="inline-flex items-center">Ost. Aktywność <SortIcon column="last_activity" /></span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Brak produktów do wyświetlenia
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row, i) => (
                  <TableRow key={row.key} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="text-muted-foreground text-xs">{page * pageSize + i + 1}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => openDrawer(row)}
                        className="text-left hover:text-primary transition-colors"
                      >
                        <span className="font-medium text-foreground hover:text-primary">{row.product_name}</span>
                        {row.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{row.description}</p>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{row.client_name || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{row.order_count}</TableCell>
                    <TableCell className="text-right font-medium">{row.sales_count}</TableCell>
                    <TableCell className="text-right">
                      {row.avg_diff_pct != null ? (
                        <Badge
                          className={
                            row.avg_diff_pct > 0
                              ? "bg-success/15 text-success border-success/30"
                              : "text-muted-foreground"
                          }
                          variant={row.avg_diff_pct > 0 ? "default" : "secondary"}
                        >
                          {row.avg_diff_pct > 0 ? "+" : ""}
                          {row.avg_diff_pct.toFixed(1)}%
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.trend === "up" && <TrendingUp className="h-4 w-4 text-success mx-auto" />}
                      {row.trend === "down" && <TrendingDown className="h-4 w-4 text-destructive mx-auto" />}
                      {row.trend === "flat" && <Minus className="h-4 w-4 text-muted-foreground mx-auto" />}
                      {!row.trend && <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.last_activity ? formatDate(row.last_activity) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} z {sorted.length}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Poprzednia
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                Następna <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ProductDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        product={selectedProduct}
        allOrders={orders}
        allOpportunities={opportunities}
        loading={loading}
      />
    </div>
  );
};

export default ProductsPage;
