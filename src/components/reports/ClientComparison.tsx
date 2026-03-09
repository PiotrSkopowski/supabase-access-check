import { useMemo } from "react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { pl } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { DateRange } from "react-day-picker";

const formatCurrency = (v: number) =>
  v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCompact = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
};

const COLORS = ["hsl(217, 91%, 50%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)"];

interface ClientComparisonProps {
  clientNames: string[];
  orders: any[];
  dateRange: DateRange | undefined;
  onBack: () => void;
}

const ClientComparison = ({ clientNames, orders: rawOrders, dateRange, onBack }: ClientComparisonProps) => {
  const orders = rawOrders ?? [];

  const clientData = useMemo(() => {
    return clientNames.map((clientName) => {
      const clientOrders = orders.filter((o) => {
        if ((o.client_name ?? "").trim() !== clientName) return false;
        if (dateRange?.from && dateRange?.to && o.order_date) {
          const d = new Date(o.order_date);
          if (!isWithinInterval(d, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) return false;
        }
        return true;
      });

      let revenue = 0, volume = 0;
      const productMap = new Map<string, number>();
      const groupMap = new Map<string, number>();

      for (const o of clientOrders) {
        const p = Number(o.price) || 0;
        const q = Number(o.quantity) || 0;
        revenue += p * q;
        volume += q;
        const name = (o.product_name ?? "").trim();
        if (name) productMap.set(name, (productMap.get(name) || 0) + p * q);
      }

      const topProducts = Array.from(productMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 17) + "…" : name, value, fullName: name }));

      return {
        name: clientName,
        revenue,
        volume,
        orderCount: clientOrders.length,
        aov: clientOrders.length > 0 ? revenue / clientOrders.length : 0,
        uniqueProducts: productMap.size,
        topProducts,
      };
    });
  }, [clientNames, orders, dateRange]);

  /* ── Comparison bar chart data ── */
  const comparisonMetrics = useMemo(() => {
    return [
      { metric: "Obrót (tys. PLN)", ...Object.fromEntries(clientData.map((c) => [c.name, Math.round(c.revenue / 1000)])) },
      { metric: "Wolumen (szt.)", ...Object.fromEntries(clientData.map((c) => [c.name, c.volume])) },
      { metric: "Zlecenia", ...Object.fromEntries(clientData.map((c) => [c.name, c.orderCount])) },
      { metric: "AOV (PLN)", ...Object.fromEntries(clientData.map((c) => [c.name, Math.round(c.aov)])) },
    ];
  }, [clientData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Powrót
        </Button>
        <h2 className="text-xl font-bold text-foreground">Porównanie Klientów</h2>
        <div className="flex gap-2 ml-auto">
          {clientNames.map((name, i) => (
            <Badge key={name} className="text-xs" style={{ backgroundColor: COLORS[i], color: "white" }}>
              {name}
            </Badge>
          ))}
        </div>
      </div>

      {/* ── Side-by-side KPIs ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clientData.map((c, i) => (
          <Card key={c.name} className="border-l-4" style={{ borderLeftColor: COLORS[i] }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base truncate">{c.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Obrót</span>
                <span className="font-mono font-medium text-foreground">{formatCurrency(c.revenue)} PLN</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Wolumen</span>
                <span className="font-mono text-foreground">{c.volume.toLocaleString("pl-PL")} szt.</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Zlecenia</span>
                <span className="font-mono text-foreground">{c.orderCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">AOV</span>
                <span className="font-mono text-foreground">{formatCurrency(c.aov)} PLN</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Produkty</span>
                <span className="font-mono text-foreground">{c.uniqueProducts}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Comparison Chart ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">📊 Porównanie Wskaźników</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comparisonMetrics} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="metric" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tickFormatter={formatCompact} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {clientData.map((c, i) => (
                <Bar key={c.name} dataKey={c.name} fill={COLORS[i]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Top Products per Client ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clientData.map((c, i) => (
          <Card key={c.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top 5 produktów — {c.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {c.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Brak danych</p>
              ) : (
                <div className="space-y-2">
                  {c.topProducts.map((p, j) => (
                    <div key={p.fullName} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground text-xs w-4">{j + 1}.</span>
                        <span className="truncate text-foreground">{p.fullName}</span>
                      </span>
                      <span className="text-muted-foreground tabular-nums ml-2 shrink-0">{formatCurrency(p.value)} PLN</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ClientComparison;
