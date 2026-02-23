import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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

interface Customer {
  id: string;
  name: string;
}

interface ProductGroup {
  id: string;
  name: string;
}

interface ResultRow {
  id: string;
  order_date: string;
  customer_name: string;
  group_name: string;
  product_name: string;
  product_description: string;
  quantity: number;
  price: number;
}

const PAGE_SIZE = 50;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formatCurrency = (val: number) =>
  val.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });

const Index = () => {
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Dropdown data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);

  // Results
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Fetch dropdown options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      const [custRes, groupRes] = await Promise.all([
        supabase.from("customers").select("id, name").order("name"),
        supabase.from("product_groups").select("id, name").order("name"),
      ]);
      setCustomers((custRes.data as Customer[]) ?? []);
      setProductGroups((groupRes.data as ProductGroup[]) ?? []);
    };
    fetchOptions();
  }, []);

  // Fetch results
  const fetchResults = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("order_history")
      .select(
        "id, order_date, price, quantity, product_id, customer_id, products!inner(name, description, group_id, product_groups(name)), customers!inner(name)",
        { count: "exact" }
      );

    if (selectedCustomerId) {
      query = query.eq("customer_id", selectedCustomerId);
    }

    if (selectedGroupId) {
      query = query.eq("products.group_id", selectedGroupId);
    }

    if (searchQuery.trim()) {
      const q = `%${searchQuery.trim()}%`;
      query = query.or(
        `products.name.ilike.${q},products.description.ilike.${q},customers.name.ilike.${q}`
      );
    }

    query = query
      .order("order_date", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("Fetch error:", error);
      setRows([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    const mapped: ResultRow[] = (data ?? []).map((row: any) => ({
      id: row.id,
      order_date: row.order_date ?? row.created_at ?? "",
      customer_name: row.customers?.name ?? "—",
      group_name: row.products?.product_groups?.name ?? "—",
      product_name: row.products?.name ?? "—",
      product_description: row.products?.description ?? "",
      quantity: row.quantity,
      price: row.price,
    }));

    setRows(mapped);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [searchQuery, selectedCustomerId, selectedGroupId, page]);

  // Re-fetch when filters or page change
  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, selectedCustomerId, selectedGroupId]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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

          {/* Row 2: Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              value={selectedCustomerId ?? "ALL"}
              onValueChange={(v) => setSelectedCustomerId(v === "ALL" ? null : v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Wybierz klienta" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="ALL">Wszyscy klienci</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedGroupId ?? "ALL"}
              onValueChange={(v) => setSelectedGroupId(v === "ALL" ? null : v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Grupa produktowa" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="ALL">Wszystkie grupy</SelectItem>
                {productGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
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
                <TableHead className="font-semibold text-right min-w-[110px]">Cena</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
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
                    <TableCell className="text-right font-medium">{formatCurrency(row.price)}</TableCell>
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
