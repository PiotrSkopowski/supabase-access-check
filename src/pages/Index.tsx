import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Package, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OrderRow {
  id: string;
  product_id: string;
  source: string;
  price: number;
  quantity: number;
  order_date: string;
  created_at: string;
}

interface ProductSummary {
  product_id: string;
  latestPrice: number;
  totalOrders: number;
  latestDate: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formatCurrency = (val: number) =>
  val.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });

const Index = () => {
  const [allRows, setAllRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Form state
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [inserting, setInserting] = useState(false);
  const [insertMsg, setInsertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("order_history")
      .select("*")
      .order("order_date", { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setAllRows((data as OrderRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Derive unique products from order_history
  const products = useMemo<ProductSummary[]>(() => {
    const map = new Map<string, OrderRow[]>();
    allRows.forEach((row) => {
      const existing = map.get(row.product_id) ?? [];
      existing.push(row);
      map.set(row.product_id, existing);
    });
    return Array.from(map.entries()).map(([product_id, rows]) => {
      const sorted = [...rows].sort(
        (a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
      );
      return {
        product_id,
        latestPrice: sorted[0].price,
        totalOrders: rows.length,
        latestDate: sorted[0].order_date,
      };
    });
  }, [allRows]);

  const filteredProducts = useMemo(
    () =>
      products.filter((p) =>
        p.product_id.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [products, searchQuery]
  );

  const selectedProduct = products.find((p) => p.product_id === selectedProductId);
  const productHistory = useMemo(
    () =>
      allRows
        .filter((r) => r.product_id === selectedProductId)
        .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()),
    [allRows, selectedProductId]
  );

  const handleSave = async () => {
    if (!selectedProductId) return;
    const parsedPrice = parseFloat(price);
    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setInsertMsg({ type: "error", text: "Podaj prawidłową cenę." });
      return;
    }
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setInsertMsg({ type: "error", text: "Podaj prawidłową ilość." });
      return;
    }

    setInserting(true);
    setInsertMsg(null);
    const { error } = await supabase.from("order_history").insert({
      product_id: selectedProductId,
      price: parsedPrice,
      quantity: parsedQty,
      source: "PRODIO",
      order_date: new Date().toISOString().split("T")[0],
    });
    if (error) {
      setInsertMsg({ type: "error", text: error.message });
    } else {
      setInsertMsg({ type: "success", text: "Wycena zapisana pomyślnie!" });
      setPrice("");
      setQuantity("");
      await fetchData();
    }
    setInserting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-lg">Ładowanie danych…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive p-6">
        <p className="text-destructive font-medium">Błąd: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* ── SEARCH ── */}
      <section>
        <h2 className="text-2xl font-bold text-foreground mb-4">Wyszukaj produkt</h2>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po ID produktu…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Search results */}
        {searchQuery.length > 0 && (
          <div className="mt-3 rounded-lg border border-border bg-card divide-y divide-border max-w-md max-h-60 overflow-auto shadow-sm">
            {filteredProducts.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Brak wyników.</p>
            ) : (
              filteredProducts.map((p) => (
                <button
                  key={p.product_id}
                  onClick={() => {
                    setSelectedProductId(p.product_id);
                    setSearchQuery("");
                    setInsertMsg(null);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center justify-between gap-4"
                >
                  <span className="text-sm font-medium text-foreground truncate">
                    {p.product_id}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {p.totalOrders} wycen
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Quick-select if no search */}
        {searchQuery.length === 0 && !selectedProductId && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Card
                key={p.product_id}
                className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                onClick={() => setSelectedProductId(p.product_id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-secondary p-2">
                      <Package className="h-5 w-5 text-secondary-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground truncate">{p.product_id}</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">{formatCurrency(p.latestPrice)}</p>
                      <p className="text-xs text-muted-foreground">{p.totalOrders} wycen · ost. {formatDate(p.latestDate)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── SELECTED PRODUCT ── */}
      {selectedProduct && (
        <>
          {/* Product details */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-foreground">Szczegóły produktu</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedProductId(null);
                  setInsertMsg(null);
                }}
              >
                ← Wróć do listy
              </Button>
            </div>
            <Card>
              <CardContent className="p-6 grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">ID produktu</p>
                  <p className="text-sm font-mono font-medium text-foreground mt-1 break-all">{selectedProduct.product_id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Ostatnia cena</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(selectedProduct.latestPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Liczba wycen</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{selectedProduct.totalOrders}</p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Add price form */}
          <section>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Plus className="h-5 w-5" />
                  Dodaj nową wycenę
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="price">Cena (PLN)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Ilość</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      placeholder="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={handleSave} disabled={inserting}>
                  {inserting ? "Zapisywanie…" : "Zapisz wycenę"}
                </Button>
                {insertMsg && (
                  <p className={`mt-3 text-sm font-medium ${insertMsg.type === "success" ? "text-green-600" : "text-destructive"}`}>
                    {insertMsg.text}
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Price history */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4">Historia wycen</h2>
            {productHistory.length === 0 ? (
              <p className="text-muted-foreground">Brak historii dla tego produktu.</p>
            ) : (
              <div className="rounded-xl border border-border overflow-auto shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Data zamówienia</TableHead>
                      <TableHead className="font-semibold">Źródło</TableHead>
                      <TableHead className="font-semibold text-right">Cena</TableHead>
                      <TableHead className="font-semibold text-right">Ilość</TableHead>
                      <TableHead className="font-semibold">Dodano</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productHistory.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDate(row.order_date)}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                            {row.source}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(row.price)}</TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(row.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default Index;
