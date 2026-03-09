import { useState, useMemo } from "react";
import { format, subMonths, differenceInDays, addDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarIcon, TrendingUp, TrendingDown, AlertTriangle, Package, DollarSign, BarChart3, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import type { DateRange } from "react-day-picker";

const formatCurrency = (v: number) =>
  v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCompact = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
};

interface ClientAnalyticsDashboardProps {
  orders: any[];
}

const REGULAR_MIN_ORDERS = 3;
const REGULAR_LOOKBACK_DAYS = 180;

const ClientAnalyticsDashboard = ({ orders: rawOrders }: ClientAnalyticsDashboardProps) => {
  const orders = rawOrders ?? [];

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 6),
    to: new Date(),
  });
  const [selectedClient, setSelectedClient] = useState<string>("__all__");

  // ── Unique clients ──
  const clients = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      const name = (o.client_name ?? "").trim();
      if (name) set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pl"));
  }, [orders]);

  // ── Filtered orders ──
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedClient !== "__all__" && (o.client_name ?? "").trim() !== selectedClient) return false;
      if (dateRange?.from && dateRange?.to && o.order_date) {
        const d = new Date(o.order_date);
        if (!isWithinInterval(d, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) return false;
      }
      return true;
    });
  }, [orders, selectedClient, dateRange]);

  // ── Previous period orders (for trend) ──
  const prevPeriodOrders = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    const rangeDays = differenceInDays(dateRange.to, dateRange.from);
    const prevFrom = subMonths(dateRange.from, rangeDays > 90 ? 12 : 1);
    const prevTo = dateRange.from;

    return orders.filter((o) => {
      if (selectedClient !== "__all__" && (o.client_name ?? "").trim() !== selectedClient) return false;
      if (o.order_date) {
        const d = new Date(o.order_date);
        if (!isWithinInterval(d, { start: startOfDay(prevFrom), end: endOfDay(prevTo) })) return false;
      }
      return true;
    });
  }, [orders, selectedClient, dateRange]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const calcKpis = (list: any[]) => {
      let revenue = 0;
      let volume = 0;
      let orderCount = 0;
      for (const o of list) {
        const price = Number(o.price) || 0;
        const qty = Number(o.quantity) || 0;
        revenue += price * qty;
        volume += qty;
        orderCount += 1;
      }
      const aov = orderCount > 0 ? revenue / orderCount : 0;
      return { revenue, volume, aov, orderCount };
    };

    const current = calcKpis(filteredOrders);
    const prev = calcKpis(prevPeriodOrders);

    const revenueTrend = prev.revenue > 0 ? ((current.revenue - prev.revenue) / prev.revenue) * 100 : 0;
    const aovTrend = prev.aov > 0 ? ((current.aov - prev.aov) / prev.aov) * 100 : 0;
    const volumeTrend = prev.volume > 0 ? ((current.volume - prev.volume) / prev.volume) * 100 : 0;

    return { ...current, revenueTrend, aovTrend, volumeTrend };
  }, [filteredOrders, prevPeriodOrders]);

  // ── TOP 10 ──
  const top10Data = useMemo(() => {
    const valueMap = new Map<string, number>();
    const volumeMap = new Map<string, number>();

    for (const o of filteredOrders) {
      const name = (o.product_name ?? "").trim();
      if (!name) continue;
      const price = Number(o.price) || 0;
      const qty = Number(o.quantity) || 0;
      valueMap.set(name, (valueMap.get(name) || 0) + price * qty);
      volumeMap.set(name, (volumeMap.get(name) || 0) + qty);
    }

    const topValue = Array.from(valueMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name: name.length > 25 ? name.slice(0, 22) + "…" : name, value, fullName: name }));

    const topVolume = Array.from(volumeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, volume]) => ({ name: name.length > 25 ? name.slice(0, 22) + "…" : name, volume, fullName: name }));

    return { topValue, topVolume };
  }, [filteredOrders]);

  // ── Regularity analysis ──
  const regularityData = useMemo(() => {
    // Group orders by product, sorted by date
    const productOrders = new Map<string, string[]>();
    for (const o of filteredOrders) {
      const name = (o.product_name ?? "").trim();
      if (!name || !o.order_date) continue;
      const existing = productOrders.get(name) || [];
      existing.push(o.order_date);
      productOrders.set(name, existing);
    }

    // Calculate intervals for products with 3+ orders
    const intervals: { name: string; avgInterval: number; intervals: number[]; lastOrder: Date; expectedNext: Date; isOverdue: boolean }[] = [];

    const today = new Date();

    for (const [name, dates] of productOrders) {
      if (dates.length < REGULAR_MIN_ORDERS) continue;
      const sorted = dates.sort();
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        gaps.push(differenceInDays(new Date(sorted[i]), new Date(sorted[i - 1])));
      }
      const avgInterval = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const lastOrder = new Date(sorted[sorted.length - 1]);
      const expectedNext = addDays(lastOrder, Math.round(avgInterval));
      const isOverdue = expectedNext < today;

      intervals.push({
        name,
        avgInterval: Math.round(avgInterval),
        intervals: gaps,
        lastOrder,
        expectedNext,
        isOverdue,
      });
    }

    // Top 8 most frequent for the line chart
    const topFrequent = [...intervals]
      .sort((a, b) => a.avgInterval - b.avgInterval)
      .slice(0, 8);

    // Overdue / missing orders
    const overdueProducts = intervals
      .filter((p) => p.isOverdue)
      .sort((a, b) => differenceInDays(a.expectedNext, today) - differenceInDays(b.expectedNext, today));

    // Line chart data: show intervals per order index for top products
    const maxOrders = Math.max(...topFrequent.map((p) => p.intervals.length), 0);
    const lineChartData: any[] = [];
    for (let i = 0; i < maxOrders; i++) {
      const point: any = { index: `#${i + 2}` };
      for (const p of topFrequent) {
        const shortName = p.name.length > 20 ? p.name.slice(0, 17) + "…" : p.name;
        point[shortName] = p.intervals[i] ?? null;
      }
      lineChartData.push(point);
    }

    return { topFrequent, overdueProducts, lineChartData };
  }, [filteredOrders]);

  const lineColors = [
    "hsl(217, 91%, 50%)", "hsl(142, 71%, 45%)", "hsl(0, 84%, 60%)",
    "hsl(38, 92%, 50%)", "hsl(280, 65%, 60%)", "hsl(190, 80%, 45%)",
    "hsl(340, 75%, 55%)", "hsl(160, 60%, 40%)",
  ];

  const TrendIndicator = ({ value, alert }: { value: number; alert?: boolean }) => {
    const isNegative = value < 0;
    const isAlert = alert || (isNegative && Math.abs(value) > 20);
    return (
      <div className={cn("flex items-center gap-1 text-sm font-medium", isAlert ? "text-destructive" : isNegative ? "text-muted-foreground" : "text-[hsl(var(--success))]")}>
        {isAlert && <AlertTriangle className="h-3.5 w-3.5" />}
        {isNegative ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
        {Math.abs(value).toFixed(1)}%
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd MMM yyyy", { locale: pl })} – {format(dateRange.to, "dd MMM yyyy", { locale: pl })}
                  </>
                ) : (
                  format(dateRange.from, "dd MMM yyyy", { locale: pl })
                )
              ) : (
                "Wybierz zakres dat"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              className="p-3 pointer-events-auto"
              locale={pl}
            />
          </PopoverContent>
        </Popover>

        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="Wszyscy klienci" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Wszyscy klienci</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground ml-auto">
          {filteredOrders.length} zleceń w zakresie
        </span>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Sumaryczny Obrót
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.revenue)} PLN</p>
            <TrendIndicator value={kpis.revenueTrend} alert={kpis.revenueTrend < -20} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Łączny Wolumen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{kpis.volume.toLocaleString("pl-PL")} szt.</p>
            <TrendIndicator value={kpis.volumeTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Średnia Wartość Zamówienia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.aov)} PLN</p>
            <TrendIndicator value={kpis.aovTrend} alert={kpis.aovTrend < -20} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Liczba Zamówień
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{kpis.orderCount}</p>
            <p className="text-sm text-muted-foreground">w wybranym okresie</p>
          </CardContent>
        </Card>
      </div>

      {/* ── TOP 10 Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🏆 TOP 10 — Wartość (PLN)</CardTitle>
            <CardDescription>Produkty generujące największy przychód</CardDescription>
          </CardHeader>
          <CardContent>
            {top10Data.topValue.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Brak danych</p>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={top10Data.topValue} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={formatCompact} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: number) => [`${formatCurrency(val)} PLN`, "Wartość"]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">📦 TOP 10 — Wolumen (szt.)</CardTitle>
            <CardDescription>Produkty z największą sumaryczną ilością</CardDescription>
          </CardHeader>
          <CardContent>
            {top10Data.topVolume.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Brak danych</p>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={top10Data.topVolume} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: number) => [`${val.toLocaleString("pl-PL")} szt.`, "Ilość"]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                  />
                  <Bar dataKey="volume" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Regularity Analysis ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Rytm Klienta — Analiza Regularności
          </CardTitle>
          <CardDescription>
            Odstępy (w dniach) między kolejnymi zamówieniami dla najczęściej zamawianych produktów
          </CardDescription>
        </CardHeader>
        <CardContent>
          {regularityData.lineChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Za mało danych — potrzeba min. {REGULAR_MIN_ORDERS} zamówienia na produkt
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={regularityData.lineChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="index" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis label={{ value: "Dni", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {regularityData.topFrequent.map((p, i) => {
                  const shortName = p.name.length > 20 ? p.name.slice(0, 17) + "…" : p.name;
                  return (
                    <Line
                      key={p.name}
                      type="monotone"
                      dataKey={shortName}
                      stroke={lineColors[i % lineColors.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Missing Orders ── */}
      {regularityData.overdueProducts.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Brakujące Zamówienia — Skontaktuj się z klientem
            </CardTitle>
            <CardDescription>
              Produkty regularne (min. {REGULAR_MIN_ORDERS}× w {REGULAR_LOOKBACK_DAYS / 30} mies.), których przewidywana data zamówienia już minęła
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {regularityData.overdueProducts.map((p) => {
                const daysOverdue = differenceInDays(new Date(), p.expectedNext);
                return (
                  <div
                    key={p.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Ostatnie: {format(p.lastOrder, "dd.MM.yyyy")} · Śr. interwał: {p.avgInterval} dni
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant="destructive" className="whitespace-nowrap">
                        {daysOverdue} dni opóźnienia
                      </Badge>
                      <Badge variant="outline" className="text-destructive border-destructive/50 whitespace-nowrap">
                        Krytyczne
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClientAnalyticsDashboard;
