import { useState, useCallback } from "react";
import { Package, Users, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductSearch } from "@/components/ProductSearch";
import { CustomerSearch } from "@/components/CustomerSearch";
import { ProductDetails } from "@/components/ProductDetails";
import { AddPriceForm } from "@/components/AddPriceForm";
import { PriceHistoryTable } from "@/components/PriceHistoryTable";
import { CustomerOrdersTable } from "@/components/CustomerOrdersTable";
import { Button } from "@/components/ui/button";

interface SelectedProduct { id: string; name: string; }
interface SelectedCustomer { id: string; name: string; }
interface OrderRow { id: string; product_id: string; price: number; quantity: number; created_at: string; source: string; order_date: string; }
interface CustomerOrder { id: string; product_name: string; price: number; quantity: number; created_at: string; }

const Index = () => {
  // Product mode
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);
  const [productHistory, setProductHistory] = useState<OrderRow[]>([]);
  const [productLoading, setProductLoading] = useState(false);

  // Customer mode
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);

  const fetchProductHistory = useCallback(async (productId: string) => {
    setProductLoading(true);
    const { data } = await supabase
      .from("order_history")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    setProductHistory((data as OrderRow[]) ?? []);
    setProductLoading(false);
  }, []);

  const fetchCustomerOrders = useCallback(async (customerId: string) => {
    setCustomerLoading(true);
    const { data: orders } = await supabase
      .from("order_history")
      .select("id, product_id, price, quantity, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (!orders || orders.length === 0) {
      setCustomerOrders([]);
      setCustomerLoading(false);
      return;
    }

    // Fetch product names for all product_ids
    const productIds = [...new Set(orders.map((o: any) => o.product_id))];
    const { data: products } = await supabase
      .from("products")
      .select("id, name")
      .in("id", productIds);

    const productMap = new Map((products ?? []).map((p: any) => [p.id, p.name]));

    setCustomerOrders(
      orders.map((o: any) => ({
        id: o.id,
        product_name: productMap.get(o.product_id) ?? o.product_id,
        price: o.price,
        quantity: o.quantity,
        created_at: o.created_at,
      }))
    );
    setCustomerLoading(false);
  }, []);

  const handleSelectProduct = (product: SelectedProduct) => {
    setSelectedProduct(product);
    fetchProductHistory(product.id);
  };

  const handleSelectCustomer = (customer: SelectedCustomer) => {
    setSelectedCustomer(customer);
    fetchCustomerOrders(customer.id);
  };

  const latestPrice = productHistory.length > 0 ? productHistory[0].price : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Pulpit wycen</h1>
        <p className="text-muted-foreground mt-1">Wyszukuj produkty i klientów, zarządzaj wycenami</p>
      </div>

      <Tabs defaultValue="product" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="product" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Wg produktu
          </TabsTrigger>
          <TabsTrigger value="customer" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Wg klienta
          </TabsTrigger>
        </TabsList>

        {/* ====== PRODUCT TAB ====== */}
        <TabsContent value="product" className="space-y-6 mt-6">
          {!selectedProduct ? (
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Wyszukaj produkt</h2>
              <ProductSearch onSelect={handleSelectProduct} />
            </section>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedProduct(null); setProductHistory([]); }}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Wróć do wyszukiwania
              </Button>

              <ProductDetails
                name={selectedProduct.name}
                latestPrice={latestPrice}
                totalOrders={productHistory.length}
              />

              <AddPriceForm
                productId={selectedProduct.id}
                productName={selectedProduct.name}
                onSaved={() => fetchProductHistory(selectedProduct.id)}
              />

              <section>
                <h3 className="text-xl font-semibold text-foreground mb-4">Historia wycen</h3>
                {productLoading ? (
                  <p className="text-muted-foreground">Ładowanie…</p>
                ) : (
                  <PriceHistoryTable rows={productHistory} />
                )}
              </section>
            </>
          )}
        </TabsContent>

        {/* ====== CUSTOMER TAB ====== */}
        <TabsContent value="customer" className="space-y-6 mt-6">
          {!selectedCustomer ? (
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Wyszukaj klienta</h2>
              <CustomerSearch onSelect={handleSelectCustomer} />
            </section>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedCustomer(null); setCustomerOrders([]); }}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Wróć do wyszukiwania
              </Button>

              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary p-2.5">
                  <Users className="h-6 w-6 text-primary-foreground" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">
                  {selectedCustomer.name}
                </h2>
              </div>

              <section>
                <h3 className="text-xl font-semibold text-foreground mb-4">
                  Zamówienia klienta ({customerOrders.length})
                </h3>
                {customerLoading ? (
                  <p className="text-muted-foreground">Ładowanie…</p>
                ) : (
                  <CustomerOrdersTable rows={customerOrders} />
                )}
              </section>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
