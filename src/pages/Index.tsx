import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, ChevronLeft, ChevronRight, Eye } from "lucide-react";
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
  group_id: string | number;
  product_name: string;
  product_description: string;
  product_id: string;
  prodio_id: string | null;
  quantity: number;
  price: number;
  current_price: number | null;
  currency: string;
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

const formatPrice = (val: number, currency: string) =>
  `${val.toFixed(2)} ${currency}`;

const calcDiscount = (catalogPrice: number | null, orderPrice: number): number | null => {
  if (catalogPrice == null || catalogPrice === 0) return null;
  return ((catalogPrice - orderPrice) / catalogPrice) * 100;
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
  const [page, setPage] = useState(0);

  // Fetch results from Supabase (filtered only by dropdowns)
  const fetchResults = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("order_history")
      .select(
        "id, order_date, price, quantity, currency, product_id, customer_id, products!inner(name, description, group_id, prodio_id, current_price, product_groups(name)), customers!inner(name)"
      );

    if (selectedProductId) {
      query = query.eq("product_id", selectedProductId);
    }
    if (selectedCustomerId) {
      query = query.eq("customer_id", selectedCustomerId);
    }
    if (selectedGroupId) {
      query = query.eq("products.group_id", selectedGroupId);
    }

    query = query.order("order_date", { ascending: false }).limit(50000);

    const { data, error } = await query;

    if (error) {
      console.error("Fetch error:", error);
      setAllRows([]);
      setLoading(false);
      return;
    }

    const mapped: ResultRow[] = (data ?? []).map((row: any) => ({
      id: row.id,
      order_date: row.order_date ?? "",
      customer_name: row.customers?.name ?? "—",
      customer_id: row.customer_id,
      group_name: row.products?.product_groups?.name ?? "—",
      group_id: row.products?.group_id,
      product_name: row.products?.name ?? "—",
      product_description: row.products?.description ?? "",
      product_id: row.product_id,
      prodio_id: row.products?.prodio_id ?? null,
      quantity: row.quantity,
      price: row.price,
      current_price: row.products?.current_price ?? null,
      currency: row.currency || "PLN",
    }));

    setAllRows(mapped);
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
                <TableHead className="font-semibold min-w-[130px]">Symbol</TableHead>
                <TableHead className="font-semibold min-w-[200px]">Opis</TableHead>
                <TableHead className="font-semibold text-right min-w-[80px]">Ilość</TableHead>
                <TableHead className="font-semibold text-right min-w-[120px]">Cena Zlecenie</TableHead>
                <TableHead className="font-semibold text-right min-w-[120px]">Cena Katalog</TableHead>
                <TableHead className="font-semibold text-right min-w-[90px]">Różnica</TableHead>
                <TableHead className="font-semibold text-center min-w-[70px]">Prodio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    Brak wyników. Zmień kryteria wyszukiwania.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(row.order_date)}</TableCell>
                    <TableCell>{row.customer_name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                        {row.group_name}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{row.product_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                      {row.product_description}
                    </TableCell>
                    <TableCell className="text-right">{row.quantity}</TableCell>
                    <TableCell className="text-right font-medium">{formatPrice(row.price, row.currency)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {row.current_price != null ? formatPrice(row.current_price, row.currency) : <span className="text-muted-foreground">BRAK</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {(() => {
                        const diff = calcDiscount(row.current_price, row.price);
                        if (diff == null) return <span className="text-muted-foreground">—</span>;
                        return <span className={diff > 0 ? "text-green-600" : ""}>{diff.toFixed(1)}%</span>;
                      })()}
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
                ))
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
