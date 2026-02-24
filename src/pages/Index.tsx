import { useState, useEffect, useMemo } from "react";
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
import { Eye, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { OrderFilters, EMPTY_FILTERS, type FilterState } from "@/components/OrderFilters";

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

interface ProductCatalog {
  name: string;
  current_price: number | null;
}

interface ResultRow extends OrderRow {
  catalog_price: number | null;
  product_matched: boolean;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

const formatPrice = (val: number, currency?: string | null) =>
  `${val.toFixed(2)} ${currency || "PLN"}`;

const Index = () => {
  const [allRows, setAllRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const [ordersRes, productsRes] = await Promise.all([
        supabase.from("order_history").select("*").order("order_date", { ascending: false }),
        supabase.from("products").select("name, current_price"),
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

      const productMap = new Map<string, ProductCatalog>();
      if (productsRes.data) {
        for (const p of productsRes.data) {
          if (p.name) productMap.set(p.name.trim().toLowerCase(), p);
        }
      }

      const joined: ResultRow[] = ordersRes.data.map((o: any) => {
        const key = o.product_name?.trim().toLowerCase() || "";
        const catalog = productMap.get(key);
        return {
          ...o,
          catalog_price: catalog?.current_price ?? null,
          product_matched: !!catalog,
        };
      });

      setAllRows(joined);
      setLoading(false);
    };

    load();
  }, []);

  const filterOptions = useMemo(() => {
    const clientSet = new Set<string>();
    const productSet = new Set<string>();
    const groupSet = new Set<string>();
    for (const r of allRows) {
      if (r.client_name) clientSet.add(r.client_name);
      if (r.product_name) productSet.add(r.product_name);
      if (r.group_name) groupSet.add(r.group_name);
    }
    return {
      clients: Array.from(clientSet).sort(),
      products: Array.from(productSet).sort(),
      groups: Array.from(groupSet).sort(),
    };
  }, [allRows]);

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

  useEffect(() => { setPage(0); }, [filters]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pageRows = useMemo(
    () => filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredRows, page],
  );

  const renderDiff = (row: ResultRow) => {
    if (row.price == null || row.catalog_price == null || row.catalog_price === 0) return "—";

    const diff = ((row.price - row.catalog_price) / row.catalog_price) * 100;

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
                <TableHead className="font-semibold min-w-[200px]">Produkt</TableHead>
                <TableHead className="font-semibold min-w-[140px]">Klient</TableHead>
                <TableHead className="font-semibold">Data</TableHead>
                <TableHead className="font-semibold text-right">Ilość</TableHead>
                <TableHead className="font-semibold text-right">Cena Zlecenia</TableHead>
                <TableHead className="font-semibold text-right">Cena Katalogowa</TableHead>
                <TableHead className="font-semibold text-right">Różnica</TableHead>
                <TableHead className="font-semibold w-20 text-center">PRODIO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    Brak danych do wyświetlenia
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row, i) => (
                  <TableRow key={row.id || i}>
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
                        ? formatPrice(row.catalog_price)
                        : <span className="text-muted-foreground text-xs">Brak w katalogu</span>}
                    </TableCell>
                    <TableCell className="text-right">{renderDiff(row)}</TableCell>
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {hasProdioLink(row) ? (
                            <a
                              href={`https://app.prodio.pl/products/view/${row.product_id}`}
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} z {filteredRows.length}
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
