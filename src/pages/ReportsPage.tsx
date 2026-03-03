import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Package } from "lucide-react";
import RFMAnalysis from "@/components/reports/RFMAnalysis";
import AssortmentAnalysis from "@/components/reports/AssortmentAnalysis";
import { useOrderHistory, useSalesOpportunities } from "@/hooks/useOrdersData";

const ReportsPage = () => {
  const { data: orders = [], isLoading: loadingOrders } = useOrderHistory();
  const { data: opportunities = [], isLoading: loadingOpps } = useSalesOpportunities();

  const loading = loadingOrders || loadingOpps;

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Raporty Analityczne</h1>

      <Tabs defaultValue="rfm" className="w-full">
        <TabsList>
          <TabsTrigger value="rfm" className="gap-1.5">
            <Users className="h-4 w-4" />
            Ranking Klientów (RFM)
          </TabsTrigger>
          <TabsTrigger value="assortment" className="gap-1.5">
            <Package className="h-4 w-4" />
            Analiza Asortymentu
          </TabsTrigger>
        </TabsList>

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
