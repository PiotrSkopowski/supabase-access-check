import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, ChevronLeft, ChevronRight, Eye, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ResultRow includes IDs for cascading filters

interface ResultRow {
  id: string;
  order_date: string;
  customer_name: string;
  customer_id: string | number;
  group_name: string;
  group_id: string | number | null;
  product_name: string;
  product_description: string;
  product_id: string;
  prodio_id: string | null;
  quantity: number;
  price: number;
  currency: string;
  current_price: number | null;
  product_currency: string;
  product_matched: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string;
}

const PAGE_SIZE = 50;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formatPrice = (val: number, currency: string = "PLN") =>
  `${val.toFixed(2)} ${currency}`;

const calcDiscount = (catalogPrice: number | null, orderPrice: number): number | null => {
  if (catalogPrice == null || catalogPrice === 0) return null;
  return ((orderPrice - catalogPrice) / catalogPrice) * 100;
};

const Index = () => {
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // All fetched rows (before text filter)
  const [allRows, setAllRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Fetch results: separate queries, client-side join
  const fetchResults = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      // 1) Fetch order_history (flat, no joins)
      let orderQuery = supabase
        .from("order_history")
        .select("id, order_date, price, quantity, currency, product_id, customer_id, product_name")
        .order("order_date", { ascending: false })
        .limit(50000);

      if (selectedProductId) {
        orderQuery = orderQuery.eq("product_id", selectedProductId);
      }
      if (selectedCustomerId) {
        orderQuery = orderQuery.eq("customer_id", selectedCustomerId);
      }

      const [ordersRes, productsRes, customersRes] = await Promise.all([
        orderQuery,
        supabase.from("products").select("id, name, description, group_id, prodio_id, current_price, currency, product_groups(name)"),
        supabase.from("customers").select("id, name"),
      ]);

      if (ordersRes.error) {
        setFetchError(`order_history: ${ordersRes.error.message}`);
        setAllRows([]);
        setLoading(false);
        return;
      }

      // Build lookup maps - keyed by trimmed lowercase name for matching
      const productByName = new Map<string, any>();
      (productsRes.data ?? []).forEach((p: any) => {
        const key = (p.name ?? "").trim().toLowerCase();
        if (key) productByName.set(key, p);
      });

      const customerMap = new Map<string, string>();
      (customersRes.data ?? []).forEach((c: any) => customerMap.set(c.id, c.name));

      const mapped: ResultRow[] = (ordersRes.data ?? []).map((row: any) => {
        const orderProductName = (row.product_name ?? "").trim();
        const matchKey = orderProductName.toLowerCase();
        const product = matchKey ? productByName.get(matchKey) : null;
        const matched = product != null;

        return {
          id: row.id,
          order_date: row.order_date ?? "",
          customer_name: row.customer_id ? (customerMap.get(row.customer_id) ?? "—") : "—",
          customer_id: row.customer_id,
          group_name: product?.product_groups?.name ?? "—",
          group_id: product?.group_id ?? null,
          product_name: orderProductName || "—",
          product_description: product?.description ?? "",
          product_id: row.product_id,
          prodio_id: product?.prodio_id ?? null,
          quantity: row.quantity,
          price: row.price,
          currency: row.currency ?? "PLN",
          current_price: product?.current_price ?? null,
          product_currency: product?.currency ?? "PLN",
          product_matched: matched,
        };
      });

      // Client-side group filter
      const finalRows = selectedGroupId
        ? mapped.filter((r) => r.group_id != null && String(r.group_id) === String(selectedGroupId))
        : mapped;

      setAllRows(finalRows);
      setFetchError(ordersRes.data?.length === 0 ? `Zapytanie zwróciło 0 rekordów z order_history.` : null);
    } catch (err: any) {
      setFetchError(`Unexpected: ${err.message}`);
      setAllRows([]);
    }

    setLoading(false);
  }, [selectedProductId, selectedCustomerId, selectedGroupId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Reset page when any filter changes
  useEffect(() => {
    setPage(0);
  }, [searchQuery, selectedProductId, selectedCustomerId, selectedGroupId]);

  // Frontend text filtering
  const filteredRows = searchQuery.trim()
    ? allRows.filter((r) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          r.product_name.toLowerCase().includes(q) ||
          (r.product_description ?? "").toLowerCase().includes(q) ||
          r.customer_name.toLowerCase().includes(q)
        );
      })
    : allRows;

  // Cascading dropdown options from filtered results
  const availableProducts = Array.from(
    new Map(filteredRows.map((r) => [r.product_id, { id: r.product_id, name: r.product_name, description: r.product_description }])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const availableCustomers = Array.from(
    new Map(filteredRows.map((r) => [r.customer_id, { id: r.customer_id, name: r.customer_name }])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const availableGroups = Array.from(
    new Map(filteredRows.filter((r) => r.group_id).map((r) => [r.group_id, { id: r.group_id, name: r.group_name }])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Paginate filtered results
  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Pulpit zleceń
        </h1>
        <p className="text-muted-foreground mt-1">
          Przeszukuj historię zleceń po produkcie, kliencie lub grupie produktowej
        </p>
      </div>

      {/* ===== FILTER CARD ===== */}
      <Card className="shadow-sm">
        <CardContent className="pt-6 space-y-4">
          {/* Row 1: Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj po symbolu produktu, opisie lub nazwie klienta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 text-base"
            />
          </div>

          {/* Row 2: Three cascading dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              value={selectedProductId ?? "ALL"}
              onValueChange={(v) => setSelectedProductId(v === "ALL" ? null : v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Produkt" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover max-h-72">
                <SelectItem value="ALL">Wszystkie produkty</SelectItem>
                {availableProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.description ? ` - ${p.description}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedCustomerId != null ? String(selectedCustomerId) : "ALL"}
              onValueChange={(v) => setSelectedCustomerId(v === "ALL" ? null : v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Klient" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover max-h-72">
                <SelectItem value="ALL">Wszyscy klienci</SelectItem>
                {availableCustomers.map((c) => (
                  <SelectItem key={String(c.id)} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedGroupId != null ? String(selectedGroupId) : "ALL"}
              onValueChange={(v) => setSelectedGroupId(v === "ALL" ? null : v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Grupa produktów" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover max-h-72">
                <SelectItem value="ALL">Wszystkie grupy</SelectItem>
                {availableGroups.map((g) => (
                  <SelectItem key={String(g.id)} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ===== RESULTS TABLE ===== */}
      <Card className="shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold min-w-[110px]">Data</TableHead>
                <TableHead className="font-semibold min-w-[150px]">Klient</TableHead>
                <TableHead className="font-semibold min-w-[130px]">Grupa</TableHead>
                <TableHead className="font-semibold min-w-[220px]">Produkt</TableHead>
                <TableHead className="font-semibold text-right min-w-[80px]">Ilość</TableHead>
                <TableHead className="font-semibold text-right min-w-[130px]">Cena Zlecenie</TableHead>
                <TableHead className="font-semibold text-right min-w-[130px]">Cena Katalog</TableHead>
                <TableHead className="font-semibold text-right min-w-[100px]">Różnica</TableHead>
                <TableHead className="font-semibold text-center min-w-[70px]">Prodio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    {fetchError ? (
                      <div>
                        <p className="font-medium text-destructive">Błąd pobierania danych</p>
                        <p className="text-sm mt-1">{fetchError}</p>
                      </div>
                    ) : (
                      "Brak wyników. Zmień kryteria wyszukiwania."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const currencyMismatch = row.currency !== row.product_currency;
                  const diff = calcDiscount(row.current_price, row.price);

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(row.order_date)}</TableCell>
                      <TableCell>{row.customer_name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                          {row.group_name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium flex items-center gap-1.5">
                          {row.product_name}
                          {!row.product_matched && (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-3.5 w-3.5 text-destructive inline-block shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>Brak dopasowania w katalogu produktów</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {row.product_description && (
                          <div className="text-xs text-muted-foreground mt-0.5 max-w-[300px] truncate">
                            {row.product_description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{row.quantity}</TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(row.price, row.currency)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {row.current_price != null ? formatPrice(row.current_price, row.product_currency) : <span className="text-muted-foreground">Brak w cenniku</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {currencyMismatch ? (
                          <span className="text-yellow-500 font-medium">Waluta!</span>
                        ) : diff == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : diff > 0 ? (
                          <span className="text-green-600">+{diff.toFixed(1)}%</span>
                        ) : (
                          <span className="text-muted-foreground">Rabat {Math.abs(diff).toFixed(1)}%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {row.prodio_id ? (
                                <a
                                  href={`https://toptech.getprodio.com/product/${row.prodio_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center"
                                >
                                  <Eye className="h-4 w-4 text-primary" />
                                </a>
                              ) : (
                                <span className="inline-flex items-center justify-center cursor-default">
                                  <Eye className="h-4 w-4 text-muted-foreground/40" />
                                </span>
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              {row.prodio_id ? "Otwórz kartę produktu w Prodio" : "Brak powiązania z Prodio"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!loading && totalCount > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Wyniki {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} z {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Poprzednia
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Następna
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Index;
