import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useOrderHistory() {
  return useQuery({
    queryKey: ["order_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_history")
        .select("product_id, client_id, client_name, product_name, product_group, product_group_name, currency, price, quantity, prodio_order_id, order_date, description, status")
        .order("order_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_TIME,
  });
}

export function useProducts(fields = "name, current_price, group_id") {
  return useQuery<any[]>({
    queryKey: ["products", fields],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(fields);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    staleTime: STALE_TIME,
  });
}

export function useProductGroups() {
  return useQuery({
    queryKey: ["product_groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_groups")
        .select("id, name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_TIME,
  });
}

export function useSalesOpportunities() {
  return useQuery({
    queryKey: ["sales_opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_opportunities")
        .select("client_name, opportunity_date, product_name, unit_price, quantity")
        .not("product_name", "is", null)
        .neq("product_name", "")
        .not("unit_price", "is", null)
        .gt("unit_price", 0)
        .not("quantity", "is", null)
        .gt("quantity", 0)
        .order("opportunity_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_TIME,
  });
}
