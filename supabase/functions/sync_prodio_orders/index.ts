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

    const mappedOrders = prodioOrders.map((o: any) => ({
      prodio_order_id: String(o.id),
      client_id: o.client_id ?? null,
      client_name: o.client_name ?? null,
      product_id: o.product_id ?? null,
      product_name: o.product_name ?? null,
      product_group: o.product_group ?? null,
      product_group_name: o.product_group_name ?? null,
      price: o.price != null ? Number(o.price) : null,
      currency: o.currency ?? null,
      order_date: o.create_date ?? null,
      quantity: o.total != null ? Number(o.total) : null,
      description: o.weight ?? null,
      source: "PRODIO",
    }));

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
