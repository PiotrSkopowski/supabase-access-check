import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Package, BarChart3 } from "lucide-react";
import RFMAnalysis from "@/components/reports/RFMAnalysis";
import AssortmentAnalysis from "@/components/reports/AssortmentAnalysis";
import ClientAnalyticsDashboard from "@/components/reports/ClientAnalyticsDashboard";
import { useOrderHistory, useSalesOpportunities } from "@/hooks/useOrdersData";

const ReportsPage = () => {
  const { data: orders = [], isLoading: loadingOrders } = useOrderHistory();
  const { data: opportunities = [], isLoading: loadingOpps } = useSalesOpportunities();

  const loading = loadingOrders || loadingOpps;

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
      <h1 className="text-2xl font-bold text-foreground">Raporty Analityczne</h1>

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Panel Klienta
          </TabsTrigger>
          <TabsTrigger value="rfm" className="gap-1.5">
            <Users className="h-4 w-4" />
            Ranking Klientów (RFM)
          </TabsTrigger>
          <TabsTrigger value="assortment" className="gap-1.5">
            <Package className="h-4 w-4" />
            Analiza Asortymentu
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <ClientAnalyticsDashboard orders={orders} />
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
