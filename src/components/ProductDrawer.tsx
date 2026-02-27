import { useState, useMemo } from "react";
import { X, Search, TrendingUp, TrendingDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { levenshtein } from "@/lib/levenshtein";

export interface ProductDrawerData {
  product_name: string;
  description: string | null;
  client_name: string | null;
}

interface PricePoint {
  date: string;
  price: number;
  source: "Prodio" | "Sales";
}

interface SimilarProduct {
  product_name: string;
  date: string;
  unit_price: number;
  distance: number;
}

interface ProductDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductDrawerData | null;
  /** All order history rows for building price chart & smart match */
  allOrders: {
    product_name: string;
    description: string | null;
    client_name: string | null;
    price: number | null;
    order_date: string | null;
  }[];
  /** All sales opportunities */
  allOpportunities: {
    client_name: string;
    opportunity_date: string;
    product_name: string;
    unit_price: number;
    quantity: number;
  }[];
  loading?: boolean;
}

const chartConfig: ChartConfig = {
  prodio: { label: "Zlecenie (Prodio)", color: "hsl(var(--primary))" },
  sales: { label: "Wycena (Sales)", color: "hsl(var(--success))" },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export function ProductDrawer({
  open,
  onOpenChange,
  product,
  allOrders,
  allOpportunities,
  loading,
}: ProductDrawerProps) {
  const [sensitivity, setSensitivity] = useState(3);
  const [showSimilar, setShowSimilar] = useState(false);

  // Price history chart data
  const priceHistory = useMemo<PricePoint[]>(() => {
    if (!product) return [];
    const norm = (s: string) => (s ?? "").trim().toLowerCase();
    const pName = norm(product.product_name);
    const points: PricePoint[] = [];

    // From orders (Prodio)
    for (const o of allOrders) {
      if (norm(o.product_name) === pName && o.price != null && o.order_date) {
        points.push({ date: o.order_date.slice(0, 10), price: o.price, source: "Prodio" });
      }
    }

    // From sales opportunities
    for (const s of allOpportunities) {
      if (
        norm(s.product_name).includes(pName) ||
        pName.includes(norm(s.product_name))
      ) {
        if (s.unit_price > 0 && s.opportunity_date) {
          points.push({
            date: s.opportunity_date.slice(0, 10),
            price: s.unit_price,
            source: "Sales",
          });
        }
      }
    }

    points.sort((a, b) => a.date.localeCompare(b.date));
    return points;
  }, [product, allOrders, allOpportunities]);

  // Chart data - merge by date
  const chartData = useMemo(() => {
    const map = new Map<string, { date: string; prodio?: number; sales?: number }>();
    for (const p of priceHistory) {
      const entry = map.get(p.date) ?? { date: p.date };
      if (p.source === "Prodio") entry.prodio = p.price;
      else entry.sales = p.price;
      map.set(p.date, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [priceHistory]);

  // Price trend
  const trend = useMemo(() => {
    if (priceHistory.length < 2) return null;
    const first = priceHistory[0].price;
    const last = priceHistory[priceHistory.length - 1].price;
    return last >= first ? "up" : "down";
  }, [priceHistory]);

  // Smart Match - similar products for same client
  const similarProducts = useMemo<SimilarProduct[]>(() => {
    if (!product || !showSimilar) return [];
    const clientNorm = (product.client_name ?? "").trim().toLowerCase();
    if (!clientNorm) return [];
    const pNameNorm = product.product_name.trim().toLowerCase();

    const seen = new Map<string, SimilarProduct>();

    for (const o of allOrders) {
      const oClient = (o.client_name ?? "").trim().toLowerCase();
      if (!oClient.includes(clientNorm) && !clientNorm.includes(oClient)) continue;

      const oName = (o.product_name ?? "").trim().toLowerCase();
      if (oName === pNameNorm) continue;

      const dist = levenshtein(pNameNorm, oName);
      if (dist > sensitivity) continue;

      const key = oName;
      const existing = seen.get(key);
      if (!existing || (o.order_date && o.order_date > (existing.date ?? ""))) {
        seen.set(key, {
          product_name: o.product_name,
          date: o.order_date?.slice(0, 10) ?? "—",
          unit_price: o.price ?? 0,
          distance: dist,
        });
      }
    }

    return Array.from(seen.values()).sort((a, b) => a.distance - b.distance);
  }, [product, allOrders, sensitivity, showSimilar]);

  if (!product) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[60vw] sm:max-w-[900px] overflow-y-auto p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="text-xl font-bold text-foreground leading-tight">
            {product.product_name}
          </SheetTitle>
          {product.description && (
            <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
          )}
          {product.client_name && (
            <Badge variant="secondary" className="mt-2 w-fit">
              {product.client_name}
            </Badge>
          )}
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Price History Chart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Trend cenowy</CardTitle>
                {trend && (
                  <div className="flex items-center gap-1">
                    {trend === "up" ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        trend === "up" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {trend === "up" ? "Wzrostowy" : "Spadkowy"}
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Brak danych cenowych dla tego produktu
                </p>
              ) : (
                <ChartContainer config={chartConfig} className="h-[220px] w-full">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
                      }}
                      fontSize={11}
                    />
                    <YAxis fontSize={11} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(v) => formatDate(String(v))}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="prodio"
                      stroke="var(--color-prodio)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="var(--color-sales)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Smart Match */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Podobne wyceny u tego samego klienta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">
                    Czułość (max. różnica znaków):
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={sensitivity}
                    onChange={(e) => setSensitivity(Number(e.target.value) || 3)}
                    className="w-20 h-9"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowSimilar(true)}
                  className="gap-1.5"
                >
                  <Search className="h-3.5 w-3.5" />
                  Szukaj podobnych
                </Button>
              </div>

              {showSimilar && (
                <div className="mt-3">
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : similarProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nie znaleziono podobnych produktów (próg: {sensitivity} znaków)
                    </p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Nazwa
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Data
                            </th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                              Cena
                            </th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                              Δ
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {similarProducts.map((sp, i) => (
                            <tr
                              key={i}
                              className="border-t border-border hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-3 py-2 font-medium text-foreground">
                                {sp.product_name}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {sp.date}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-foreground">
                                {sp.unit_price.toFixed(2)} PLN
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Badge variant="outline" className="text-xs">
                                  {sp.distance}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
