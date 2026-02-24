import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ProductDetails } from "@/components/ProductDetails";
import { PriceHistoryTable } from "@/components/PriceHistoryTable";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ProductPage = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(name || "");

  const [loading, setLoading] = useState(true);
  const [catalogPrice, setCatalogPrice] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!decodedName) return;

    const load = async () => {
      setLoading(true);

      const [productRes, historyRes] = await Promise.all([
        supabase.from("products").select("current_price").ilike("name", decodedName.trim()),
        supabase
          .from("order_history")
          .select("id, price, quantity, order_date, created_at, description")
          .ilike("product_name", decodedName.trim())
          .order("order_date", { ascending: false }),
      ]);

      setCatalogPrice(productRes.data?.[0]?.current_price ?? null);

      setHistory(
        (historyRes.data || []).map((r: any) => ({
          ...r,
          source: "Zlecenie",
        })),
      );

      setLoading(false);
    };

    load();
  }, [decodedName]);

  if (loading) {
    return (
      <div className="max-w-[1000px] mx-auto space-y-6 py-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Wróć
      </Button>

      <ProductDetails
        name={decodedName}
        latestPrice={catalogPrice}
        totalOrders={history.length}
      />

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">Historia wycen</h3>
        <PriceHistoryTable rows={history} />
      </div>
    </div>
  );
};

export default ProductPage;
