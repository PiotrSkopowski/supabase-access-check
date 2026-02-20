import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { ProductSearch } from "@/components/ProductSearch";
import { ProductDetails } from "@/components/ProductDetails";
import { AddPriceForm } from "@/components/AddPriceForm";
import { PriceHistoryTable } from "@/components/PriceHistoryTable";
import { Button } from "@/components/ui/button";

interface SelectedProduct {
  id: string;
  name: string;
}

interface OrderRow {
  id: string;
  product_id: string;
  source: string;
  price: number;
  quantity: number;
  order_date: string;
  created_at: string;
}

const Index = () => {
  const [selected, setSelected] = useState<SelectedProduct | null>(null);
  const [history, setHistory] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async (productId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("order_history")
      .select("*")
      .eq("product_id", productId)
      .order("order_date", { ascending: false });
    setHistory((data as OrderRow[]) ?? []);
    setLoading(false);
  }, []);

  const handleSelect = (product: SelectedProduct) => {
    setSelected(product);
    fetchHistory(product.id);
  };

  const latestPrice = history.length > 0 ? history[0].price : null;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Search */}
      <section>
        <h2 className="text-2xl font-bold text-foreground mb-4">Wyszukaj produkt</h2>
        <ProductSearch onSelect={handleSelect} />
      </section>

      {/* Selected product */}
      {selected && (
        <>
          <div className="flex items-center justify-between">
            <div />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelected(null);
                setHistory([]);
              }}
            >
              ← Wróć do wyszukiwania
            </Button>
          </div>

          <ProductDetails
            name={selected.name}
            latestPrice={latestPrice}
            totalOrders={history.length}
          />

          <AddPriceForm
            productId={selected.id}
            productName={selected.name}
            onSaved={() => fetchHistory(selected.id)}
          />

          <section>
            <h3 className="text-xl font-bold text-foreground mb-4">Historia wycen</h3>
            {loading ? (
              <p className="text-muted-foreground">Ładowanie…</p>
            ) : (
              <PriceHistoryTable rows={history} />
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default Index;
