import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Package } from "lucide-react";
import RFMAnalysis from "@/components/reports/RFMAnalysis";
import AssortmentAnalysis from "@/components/reports/AssortmentAnalysis";

const ReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [ordersRes, oppsRes] = await Promise.all([
        supabase
          .from("order_history")
          .select("client_name, price, quantity, order_date, product_name, description"),
        supabase
          .from("sales_opportunities")
          .select("client_name, opportunity_date, product_name, unit_price, quantity")
          .gt("unit_price", 0)
          .not("unit_price", "is", null),
      ]);
      setOrders(ordersRes.data ?? []);
      setOpportunities(oppsRes.data ?? []);
      setLoading(false);
    })();
  }, []);

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
