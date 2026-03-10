import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchRecentOrders(apiToken: string, limit: number = 10): Promise<any[]> {
  const url = `https://toptech.getprodio.com/api/orders?api_token=${apiToken}&page=1&per_page=${limit}`;
  console.log(`[PRODIO] Łączę z API Prodio... URL: ${url.replace(apiToken, '***')}`);

  const res = await fetch(url);
  console.log(`[PRODIO] Odpowiedź API: status ${res.status}`);

  if (!res.ok) {
    const text = await res.text();
    console.error(`[PRODIO] Błąd API: ${text}`);
    throw new Error(`Błąd API Prodio: ${res.status} – ${text}`);
  }

  const orders = await res.json();
  console.log(`[PRODIO] Otrzymano dane: ${Array.isArray(orders) ? orders.length : 'nie-tablica'} rekordów`);

  if (!Array.isArray(orders)) {
    throw new Error(`Nieoczekiwany format odpowiedzi API Prodio`);
  }

  return orders;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[PRODIO] Start synchronizacji...");

    const PRODIO_API_TOKEN = Deno.env.get("PRODIO_API_TOKEN");
    if (!PRODIO_API_TOKEN) {
      console.error("[PRODIO] Brak klucza PRODIO_API_TOKEN!");
      return new Response(
        JSON.stringify({ error: "Brak klucza PRODIO_API_TOKEN w konfiguracji." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prodioOrders = await fetchRecentOrders(PRODIO_API_TOKEN, 10);

    console.log("[PRODIO] Tworzę klienta Supabase...");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Lookup: pobierz dane katalogowe produktów jednym zapytaniem (unikamy N+1)
    const productIds = [...new Set(
      prodioOrders
        .map((o: any) => o.product_id)
        .filter((id: any) => id != null)
    )];

    const productLookup = new Map<number, { product_group: number | null; product_group_name: string | null; current_price: number | null }>();

    if (productIds.length > 0) {
      console.log(`[PRODIO] Lookup: pobieram dane katalogowe dla ${productIds.length} produktów...`);
      const { data: catalogProducts, error: lookupError } = await supabase
        .from("products")
        .select("prodio_id, group_id, current_price")
        .in("prodio_id", productIds);

      if (lookupError) {
        console.warn(`[PRODIO] Lookup warning: ${lookupError.message}`);
      } else if (catalogProducts) {
        // Pobierz nazwy grup produktowych
        const groupIds = [...new Set(catalogProducts.map((p: any) => p.group_id).filter(Boolean))];
        const groupLookup = new Map<number, string>();

        if (groupIds.length > 0) {
          const { data: groups } = await supabase
            .from("product_groups")
            .select("id, name")
            .in("id", groupIds);
          if (groups) {
            for (const g of groups) {
              groupLookup.set(g.id, g.name);
            }
          }
        }

        for (const p of catalogProducts) {
          productLookup.set(p.prodio_id, {
            product_group: p.group_id ?? null,
            product_group_name: p.group_id ? (groupLookup.get(p.group_id) ?? null) : null,
            current_price: p.current_price ?? null,
          });
        }
        console.log(`[PRODIO] Lookup: znaleziono ${productLookup.size} produktów w katalogu.`);
      }
    }

    const mappedOrders = prodioOrders.map((o: any) => {
      const catalog = o.product_id ? productLookup.get(o.product_id) : undefined;
      const prodioPrice = o.price != null ? Number(o.price) : null;

      return {
        prodio_order_id: String(o.id),
        client_id: o.client_id ?? null,
        client_name: o.client_name ?? null,
        product_id: o.product_id ?? null,
        product_name: o.product_name ?? null,
        product_group: catalog?.product_group ?? o.product_group ?? null,
        product_group_name: catalog?.product_group_name ?? o.product_group_name ?? null,
        price: (prodioPrice != null && prodioPrice > 0) ? prodioPrice : (catalog?.current_price ?? prodioPrice),
        currency: o.currency ?? null,
        order_date: o.create_date ?? null,
        quantity: o.total != null ? Number(o.total) : null,
        description: o.weight ?? null,
        source: "PRODIO",
      };
    });

    console.log(`[PRODIO] Zapisuję ${mappedOrders.length} rekordów do bazy...`);
    const { data, error } = await supabase
      .from("order_history")
      .upsert(mappedOrders, { onConflict: "prodio_order_id" })
      .select("id");

    if (error) {
      console.error(`[PRODIO] Błąd zapisu: ${error.message}`);
      return new Response(
        JSON.stringify({ error: `Błąd zapisu do bazy: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalUpserted = data?.length ?? 0;
    console.log(`[PRODIO] Sukces! Zapisano ${totalUpserted} rekordów.`);

    return new Response(
      JSON.stringify({
        success: true,
        fetched: prodioOrders.length,
        upserted: totalUpserted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Nieoczekiwany błąd: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
