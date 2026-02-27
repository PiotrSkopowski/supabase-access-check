import { useState, useMemo } from "react";
import { Search, TrendingUp, TrendingDown, Minus, Eye, Paperclip } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { levenshtein } from "@/lib/levenshtein";
import { toast } from "sonner";

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
  product_id?: string | null;
  sciezka_z?: string | null;
}

interface ProductDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductDrawerData | null;
  allOrders: {
    product_name: string;
    description: string | null;
    client_name: string | null;
    price: number | null;
    order_date: string | null;
    product_id?: string | null;
    sciezka_z?: string | null;
  }[];
  allOpportunities: {
    client_name: string;
    opportunity_date: string;
    product_name: string;
    unit_price: number;
    quantity: number;
  }[];
  loading?: boolean;
}

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(25, 95%, 53%)",
  "hsl(280, 65%, 60%)",
  "hsl(190, 80%, 45%)",
  "hsl(340, 75%, 55%)",
  "hsl(55, 85%, 50%)",
  "hsl(160, 60%, 45%)",
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

function getPriceHistory(
  productName: string,
  allOrders: ProductDrawerProps["allOrders"],
  allOpportunities: ProductDrawerProps["allOpportunities"]
): PricePoint[] {
  const norm = (s: string) => (s ?? "").trim().toLowerCase();
  const pName = norm(productName);
  const points: PricePoint[] = [];

  for (const o of allOrders) {
    if (norm(o.product_name) === pName && o.price != null && o.order_date) {
      points.push({ date: o.order_date.slice(0, 10), price: o.price, source: "Prodio" });
    }
  }

  for (const s of allOpportunities) {
    if (
      norm(s.product_name).includes(pName) ||
      pName.includes(norm(s.product_name))
    ) {
      if (s.unit_price > 0 && s.opportunity_date) {
        points.push({ date: s.opportunity_date.slice(0, 10), price: s.unit_price, source: "Sales" });
      }
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

function computeTrend(prices: PricePoint[]): "up" | "down" | "flat" | null {
  if (prices.length < 2) return null;
  const last = prices[prices.length - 1].price;
  const prev = prices[prices.length - 2].price;
  if (last > prev) return "up";
  if (last < prev) return "down";
  return "flat";
}

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
  const [checkedProducts, setCheckedProducts] = useState<Set<string>>(new Set());

  // Price history for main product
  const mainHistory = useMemo<PricePoint[]>(
    () => (product ? getPriceHistory(product.product_name, allOrders, allOpportunities) : []),
    [product, allOrders, allOpportunities]
  );

  const trend = useMemo(() => computeTrend(mainHistory), [mainHistory]);

  // Similar products
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
          product_id: o.product_id ?? null,
          sciezka_z: o.sciezka_z ?? null,
        });
      }
    }

    return Array.from(seen.values()).sort((a, b) => a.distance - b.distance);
  }, [product, allOrders, sensitivity, showSimilar]);

  // Toggle checkbox
  const toggleProduct = (name: string) => {
    setCheckedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Build comparative chart data & config
  const { chartData, chartConfig, activeKeys } = useMemo(() => {
    if (!product) return { chartData: [], chartConfig: {} as ChartConfig, activeKeys: [] as string[] };

    // Always include main product
    const series: { key: string; label: string; history: PricePoint[] }[] = [
      { key: "main", label: product.product_name.slice(0, 30), history: mainHistory },
    ];

    // Add checked similar products
    for (const sp of similarProducts) {
      if (checkedProducts.has(sp.product_name)) {
        const hist = getPriceHistory(sp.product_name, allOrders, allOpportunities);
        series.push({
          key: `sim_${sp.product_name.slice(0, 20).replace(/\s+/g, "_")}`,
          label: sp.product_name.slice(0, 30),
          history: hist,
        });
      }
    }

    // Merge all into one timeline
    const dateMap = new Map<string, Record<string, any>>();
    for (const s of series) {
      for (const p of s.history) {
        const row = dateMap.get(p.date) ?? { date: p.date };
        row[s.key] = p.price;
        dateMap.set(p.date, row);
      }
    }

    const data = Array.from(dateMap.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );

    const config: ChartConfig = {};
    const keys: string[] = [];
    series.forEach((s, i) => {
      config[s.key] = { label: s.label, color: PALETTE[i % PALETTE.length] };
      keys.push(s.key);
    });

    return { chartData: data, chartConfig: config, activeKeys: keys };
  }, [product, mainHistory, similarProducts, checkedProducts, allOrders, allOpportunities]);

  // Aggregate stats for checked products + main
  const aggregateStats = useMemo(() => {
    if (!product) return null;
    if (checkedProducts.size === 0) return null;

    const allPrices: number[] = [];
    // Main product prices
    for (const p of mainHistory) allPrices.push(p.price);
    // Checked similar
    for (const sp of similarProducts) {
      if (!checkedProducts.has(sp.product_name)) continue;
      const hist = getPriceHistory(sp.product_name, allOrders, allOpportunities);
      for (const p of hist) allPrices.push(p.price);
    }

    if (allPrices.length === 0) return null;
    const avg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    return { avg, min, max, count: allPrices.length };
  }, [product, mainHistory, similarProducts, checkedProducts, allOrders, allOpportunities]);

  const handleCopyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      toast.success("Ścieżka skopiowana do schowka");
    } catch {
      toast.error("Nie udało się skopiować ścieżki");
    }
  };

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
          {/* Aggregate Stats Widget */}
          {aggregateStats && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Analiza Zbiorcza ({checkedProducts.size + 1} produktów)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Średnia cena</p>
                    <p className="text-lg font-bold text-foreground">{aggregateStats.avg.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Min</p>
                    <p className="text-lg font-bold text-success">{aggregateStats.min.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max</p>
                    <p className="text-lg font-bold text-destructive">{aggregateStats.max.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Price History Chart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {checkedProducts.size > 0 ? "Porównanie cenowe" : "Trend cenowy"}
                </CardTitle>
                {trend !== null ? (
                  <div className="flex items-center gap-1">
                    {trend === "up" && <TrendingUp className="h-4 w-4 text-success" />}
                    {trend === "down" && <TrendingDown className="h-4 w-4 text-destructive" />}
                    {trend === "flat" && <Minus className="h-4 w-4 text-muted-foreground" />}
                    <span
                      className={`text-xs font-medium ${
                        trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {trend === "up" ? "Wzrostowy" : trend === "down" ? "Spadkowy" : "Stabilny"}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Brak danych cenowych dla tego produktu
                </p>
              ) : (
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
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
                    {activeKeys.length > 1 && (
                      <ChartLegend content={<ChartLegendContent />} />
                    )}
                    {activeKeys.map((key, i) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={PALETTE[i % PALETTE.length]}
                        strokeWidth={key === "main" ? 2.5 : 1.5}
                        strokeDasharray={key === "main" ? undefined : "5 5"}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
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
                  onClick={() => {
                    setShowSimilar(true);
                    setCheckedProducts(new Set());
                  }}
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
                            <th className="w-8 px-2 py-2" />
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
                            <th className="w-8 px-1 py-2 text-center">
                              <Eye className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
                            </th>
                            <th className="w-8 px-1 py-2 text-center">
                              <Paperclip className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {similarProducts.map((sp, i) => (
                            <tr
                              key={i}
                              className="border-t border-border hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-2 py-2">
                                <Checkbox
                                  checked={checkedProducts.has(sp.product_name)}
                                  onCheckedChange={() => toggleProduct(sp.product_name)}
                                />
                              </td>
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
                              <td className="px-1 py-2 text-center">
                                {sp.product_id ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href={`https://toptech.getprodio.com/product/${sp.product_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center h-6 w-6 rounded text-primary hover:bg-accent transition-colors"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="z-50">
                                      Otwórz w Prodio
                                    </TooltipContent>
                                  </Tooltip>
                                ) : null}
                              </td>
                              <td className="px-1 py-2 text-center">
                                {sp.sciezka_z ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => handleCopyPath(sp.sciezka_z!)}
                                        className="inline-flex items-center justify-center h-6 w-6 rounded text-primary hover:bg-accent transition-colors"
                                      >
                                        <Paperclip className="h-3.5 w-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="z-50">
                                      Kopiuj ścieżkę pliku
                                    </TooltipContent>
                                  </Tooltip>
                                ) : null}
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
