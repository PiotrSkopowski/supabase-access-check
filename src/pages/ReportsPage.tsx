import { useState } from "react";
import { subMonths } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Package, Briefcase, RefreshCw } from "lucide-react";
import RFMAnalysis from "@/components/reports/RFMAnalysis";
import AssortmentAnalysis from "@/components/reports/AssortmentAnalysis";
import PortfolioView from "@/components/reports/PortfolioView";
import ClientDrilldown from "@/components/reports/ClientDrilldown";
import ClientComparison from "@/components/reports/ClientComparison";
import { useOrderHistory, useSalesOpportunities, type OrderFiltersParams } from "@/hooks/useOrdersData";
import type { DateRange } from "react-day-picker";

type View = { type: "portfolio" } | { type: "drilldown"; client: string } | { type: "compare"; clients: string[] };

const ReportsPage = () => {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 6),
    to: new Date(),
  });

  const reportFilters: OrderFiltersParams = {
    dateFrom: dateRange?.from ? dateRange.from.toISOString().split("T")[0] : undefined,
    dateTo: dateRange?.to
      ? dateRange.to.toISOString().split("T")[0]
      : dateRange?.from
      ? dateRange.from.toISOString().split("T")[0]
      : undefined,
  };

  const { data: orders = [], isLoading: loadingOrders, isFetching: fetchingOrders } = useOrderHistory(reportFilters);
  const { data: opportunities = [], isLoading: loadingOpps } = useSalesOpportunities();

  const loading = loadingOrders || loadingOpps;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["order_history"] });
    queryClient.invalidateQueries({ queryKey: ["sales_opportunities"] });
    queryClient.refetchQueries({ queryKey: ["order_history", reportFilters] });
  };

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 6),
    to: new Date(),
  });
  const [view, setView] = useState<View>({ type: "portfolio" });

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Raporty Analityczne</h1>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={fetchingOrders}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${fetchingOrders ? "animate-spin" : ""}`} />
          Odśwież dane
        </Button>
      </div>

      <Tabs defaultValue="portfolio" className="w-full">
        <TabsList>
          <TabsTrigger value="portfolio" className="gap-1.5" onClick={() => setView({ type: "portfolio" })}>
            <Briefcase className="h-4 w-4" />
            Portfel Klientów
          </TabsTrigger>
          <TabsTrigger value="rfm" className="gap-1.5">
            <Users className="h-4 w-4" />
            Ranking RFM
          </TabsTrigger>
          <TabsTrigger value="assortment" className="gap-1.5">
            <Package className="h-4 w-4" />
            Analiza Asortymentu
          </TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio">
          {view.type === "portfolio" && (
            <PortfolioView
              orders={orders}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              onClientClick={(client) => setView({ type: "drilldown", client })}
              onCompare={(clients) => setView({ type: "compare", clients })}
            />
          )}
          {view.type === "drilldown" && (
            <ClientDrilldown
              clientName={view.client}
              orders={orders}
              dateRange={dateRange}
              onBack={() => setView({ type: "portfolio" })}
            />
          )}
          {view.type === "compare" && (
            <ClientComparison
              clientNames={view.clients}
              orders={orders}
              dateRange={dateRange}
              onBack={() => setView({ type: "portfolio" })}
            />
          )}
        </TabsContent>

        <TabsContent value="rfm">
          <RFMAnalysis orders={orders} />
        </TabsContent>

        <TabsContent value="assortment">
          <AssortmentAnalysis orders={orders} opportunities={opportunities} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
