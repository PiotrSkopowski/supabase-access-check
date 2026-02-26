import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, AlertTriangle, ChevronLeft, ChevronRight, Paperclip, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { OrderFilters, EMPTY_FILTERS, type FilterState } from "@/components/OrderFilters";
import { toast } from "sonner";

const PAGE_SIZE = 20;

interface OrderRow {
  id?: string;
  product_name: string;
  client_name: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  quantity: number | null;
  order_date: string | null;
  group_name?: string | null;
  product_id?: string | null;
}

interface ResultRow extends OrderRow {
  catalog_price: number | null;
  product_matched: boolean;
  sciezka_z: string | null;
}

type SortKey = "product_name" | "group_name" | "client_name" | "order_date" | "quantity" | "price" | "catalog_price" | "diff" | "prodio" | "plik";
type SortDir = "asc" | "desc";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

const formatPrice = (val: number, currency?: string | null) =>
  `${val.toFixed(2)} ${currency || "PLN"}`;

const getDiff = (row: ResultRow): number | null => {
  if (row.price == null || row.catalog_price == null || row.catalog_price === 0) return null;
  return ((row.price - row.catalog_price) / row.catalog_price) * 100;
};

const Index = () => {
  const [allRows, setAllRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const [ordersRes, productsRes, groupsRes] = await Promise.all([
        supabase.from("order_history").select("*").order("order_date", { ascending: false }),
        supabase.from("products").select("name, current_price, group_id, sciezka_z"),
        supabase.from("product_groups").select("id, name"),
      ]);

      if (ordersRes.error) {
        setError(`Błąd order_history: ${ordersRes.error.message}`);
        setAllRows([]);
        setLoading(false);
        return;
      }

      if (!ordersRes.data || ordersRes.data.length === 0) {
        setError("BŁĄD: Tabela order_history jest pusta lub zablokowana przez RLS");
        setAllRows([]);
        setLoading(false);
        return;
      }

      const groupMap = new Map<string, string>();
      if (groupsRes.data) {
        for (const g of groupsRes.data) {
          if (g.id && g.name) groupMap.set(g.id, g.name);
        }
      }

      const productMap = new Map<string, { current_price: number | null; group_name: string | null; sciezka_z: string | null }>();
      if (productsRes.data) {
        for (const p of productsRes.data) {
          if (p.name) {
            productMap.set(p.name.trim().toLowerCase(), {
              current_price: p.current_price,
              group_name: p.group_id ? (groupMap.get(p.group_id) ?? null) : null,
              sciezka_z: p.sciezka_z ?? null,
            });
          }
        }
      }

      const joined: ResultRow[] = ordersRes.data.map((o: any) => {
        const key = o.product_name?.trim().toLowerCase() || "";
        const catalog = productMap.get(key);
        return {
          ...o,
          catalog_price: catalog?.current_price ?? null,
          group_name: catalog?.group_name ?? null,
          product_matched: !!catalog,
          sciezka_z: catalog?.sciezka_z ?? null,
        };
      });

      setAllRows(joined);
      setLoading(false);
    };

    load();
  }, []);

  // Cross-filtering: each filter's options are derived from rows matching the OTHER filters + global search
  const filterOptions = useMemo(() => {
    const s = filters.search.toLowerCase();

    const matchesSearch = (r: ResultRow) => {
      if (!s) return true;
      const haystack = [r.product_name, r.client_name, r.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(s);
    };

    // For clients: apply product, group, and search filters (but NOT client filter)
    const clientSet = new Set<string>();
    for (const r of allRows) {
      if (!r.client_name) continue;
      if (filters.productName && r.product_name !== filters.productName) continue;
      if (filters.groupName && r.group_name !== filters.groupName) continue;
      if (!matchesSearch(r)) continue;
      clientSet.add(r.client_name);
    }

    // For products: apply client, group, and search filters (but NOT product filter)
    const productSet = new Set<string>();
    for (const r of allRows) {
      if (!r.product_name) continue;
      if (filters.clientName && r.client_name !== filters.clientName) continue;
      if (filters.groupName && r.group_name !== filters.groupName) continue;
      if (!matchesSearch(r)) continue;
      productSet.add(r.product_name);
    }

    // For groups: apply client, product, and search filters (but NOT group filter)
    const groupSet = new Set<string>();
    for (const r of allRows) {
      if (!r.group_name) continue;
      if (filters.clientName && r.client_name !== filters.clientName) continue;
      if (filters.productName && r.product_name !== filters.productName) continue;
      if (!matchesSearch(r)) continue;
      groupSet.add(r.group_name);
    }

    return {
      clients: Array.from(clientSet).sort(),
      products: Array.from(productSet).sort(),
      groups: Array.from(groupSet).sort(),
    };
  }, [allRows, filters]);

  const filteredRows = useMemo(() => {
    const s = filters.search.toLowerCase();
    return allRows.filter((r) => {
      if (filters.clientName && r.client_name !== filters.clientName) return false;
      if (filters.productName && r.product_name !== filters.productName) return false;
      if (filters.groupName && r.group_name !== filters.groupName) return false;
      if (s) {
        const haystack = [r.product_name, r.client_name, r.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(s)) return false;
      }
      return true;
    });
  }, [allRows, filters]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;

    const sorted = [...filteredRows].sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortKey) {
        case "product_name":
          valA = a.product_name?.toLowerCase() ?? "";
          valB = b.product_name?.toLowerCase() ?? "";
          break;
        case "group_name":
          valA = a.group_name?.toLowerCase() ?? "";
          valB = b.group_name?.toLowerCase() ?? "";
          break;
        case "client_name":
          valA = a.client_name?.toLowerCase() ?? "";
          valB = b.client_name?.toLowerCase() ?? "";
          break;
        case "order_date":
          valA = a.order_date ?? "";
          valB = b.order_date ?? "";
          break;
        case "quantity":
          valA = a.quantity ?? 0;
          valB = b.quantity ?? 0;
          break;
        case "price":
          valA = a.price ?? 0;
          valB = b.price ?? 0;
          break;
        case "catalog_price":
          valA = a.catalog_price ?? 0;
          valB = b.catalog_price ?? 0;
          break;
        case "diff":
          valA = getDiff(a) ?? -Infinity;
          valB = getDiff(b) ?? -Infinity;
          break;
        case "prodio":
          valA = a.product_id ? 1 : 0;
          valB = b.product_id ? 1 : 0;
          break;
        case "plik":
          valA = a.sciezka_z ? 1 : 0;
          valB = b.sciezka_z ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredRows, sortKey, sortDir]);

  useEffect(() => { setPage(0); }, [filters, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE);
  const pageRows = useMemo(
    () => sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sortedRows, page],
  );

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const handleCopyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      toast.success("Ścieżka została skopiowana do schowka");
    } catch {
      toast.error("Nie udało się skopiować ścieżki");
    }
  };

  const renderDiff = (row: ResultRow) => {
    const diff = getDiff(row);
    if (diff == null) return "—";

    if (diff > 0) {
      return (
        <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/20">
          +{diff.toFixed(1)}%
        </Badge>
      );
    }
    if (diff < 0) {
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          Rabat {Math.abs(diff).toFixed(1)}%
        </Badge>
      );
    }
    return <Badge variant="secondary" className="text-muted-foreground">0%</Badge>;
  };

  const hasProdioLink = (row: ResultRow) => !!row.product_id;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Historia Zleceń</h1>
        <p className="text-muted-foreground mt-1">
          {allRows.length > 0
            ? `${filteredRows.length} z ${allRows.length} zleceń · Strona ${page + 1} z ${Math.max(totalPages, 1)}`
            : "Ładowanie danych…"}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border-2 border-destructive rounded-lg p-6 text-center">
          <p className="text-destructive text-xl font-bold">{error}</p>
        </div>
      )}

      <OrderFilters
        filters={filters}
        onChange={setFilters}
        clients={filterOptions.clients}
        products={filterOptions.products}
        groups={filterOptions.groups}
      />

      <Card className="shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold w-10">#</TableHead>
                <TableHead className="font-semibold min-w-[200px] cursor-pointer select-none" onClick={() => handleSort("product_name")}>
                  <span className="inline-flex items-center">Produkt <SortIcon column="product_name" /></span>
                </TableHead>
                <TableHead className="font-semibold min-w-[140px] cursor-pointer select-none" onClick={() => handleSort("group_name")}>
                  <span className="inline-flex items-center">Grupa Produktowa <SortIcon column="group_name" /></span>
                </TableHead>
                <TableHead className="font-semibold min-w-[140px] cursor-pointer select-none" onClick={() => handleSort("client_name")}>
                  <span className="inline-flex items-center">Klient <SortIcon column="client_name" /></span>
                </TableHead>
                <TableHead className="font-semibold cursor-pointer select-none" onClick={() => handleSort("order_date")}>
                  <span className="inline-flex items-center">Data <SortIcon column="order_date" /></span>
                </TableHead>
                <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("quantity")}>
                  <span className="inline-flex items-center justify-end">Ilość <SortIcon column="quantity" /></span>
                </TableHead>
                <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("price")}>
                  <span className="inline-flex items-center justify-end">Cena Zlecenia <SortIcon column="price" /></span>
                </TableHead>
                <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("catalog_price")}>
                  <span className="inline-flex items-center justify-end">Cena Katalogowa <SortIcon column="catalog_price" /></span>
                </TableHead>
                <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("diff")}>
                  <span className="inline-flex items-center justify-end">Różnica <SortIcon column="diff" /></span>
                </TableHead>
                <TableHead className="font-semibold w-20 text-center cursor-pointer select-none" onClick={() => handleSort("prodio")}>
                  <span className="inline-flex items-center justify-center">PRODIO <SortIcon column="prodio" /></span>
                </TableHead>
                <TableHead className="font-semibold w-20 text-center cursor-pointer select-none" onClick={() => handleSort("plik")}>
                  <span className="inline-flex items-center justify-center">PLIK <SortIcon column="plik" /></span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                    Brak danych do wyświetlenia
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row, i) => (
                  <TableRow key={row.id || i} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="text-muted-foreground text-xs">
                      {page * PAGE_SIZE + i + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{row.product_name || "—"}</span>
                        {!row.product_matched && row.product_name && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                            </TooltipTrigger>
                            <TooltipContent>Brak dopasowania w katalogu produktów</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      {row.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {row.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.group_name || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {row.client_name || "—"}
                    </TableCell>
                    <TableCell>
                      {row.order_date ? formatDate(row.order_date) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{row.quantity ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {row.price != null ? formatPrice(row.price, row.currency) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.catalog_price != null
                        ? formatPrice(row.catalog_price, row.currency)
                        : <span className="text-muted-foreground text-xs">Brak w katalogu</span>}
                    </TableCell>
                    <TableCell className="text-right">{renderDiff(row)}</TableCell>
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {hasProdioLink(row) ? (
                            <a
                              href={`https://toptech.getprodio.com/product/${row.product_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-primary hover:bg-accent transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                          ) : (
                            <span className="inline-flex items-center justify-center h-8 w-8 text-muted-foreground/40 cursor-default">
                              <Eye className="h-4 w-4" />
                            </span>
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          {hasProdioLink(row) ? "Otwórz kartę produktu w Prodio" : "Brak powiązania z Prodio"}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {row.sciezka_z ? (
                            <button
                              onClick={() => handleCopyPath(row.sciezka_z!)}
                              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-primary hover:bg-accent transition-colors"
                            >
                              <Paperclip className="h-4 w-4" />
                            </button>
                          ) : (
                            <span className="inline-flex items-center justify-center h-8 w-8 text-muted-foreground/40 cursor-default">
                              <Paperclip className="h-4 w-4" />
                            </span>
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          {row.sciezka_z ? "Kopiuj ścieżkę do schowka" : "Brak ścieżki pliku"}
                        </TooltipContent>
                      </Tooltip>
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
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sortedRows.length)} z {sortedRows.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Poprzednia
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Następna <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Index;
