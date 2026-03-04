import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PRODIO_API_TOKEN = Deno.env.get("PRODIO_API_TOKEN");
    if (!PRODIO_API_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Brak klucza PRODIO_API_TOKEN w konfiguracji." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch orders from Prodio API
    const prodioRes = await fetch(
      `https://toptech.getprodio.com/api/orders?api_token=${PRODIO_API_TOKEN}`
    );

    if (!prodioRes.ok) {
      const text = await prodioRes.text();
      return new Response(
        JSON.stringify({ error: `Błąd API Prodio: ${prodioRes.status} – ${text}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prodioOrders = await prodioRes.json();

    if (!Array.isArray(prodioOrders)) {
      return new Response(
        JSON.stringify({ error: "Odpowiedź z Prodio nie jest tablicą." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map Prodio fields to order_history schema
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

    // Upsert to Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("order_history")
      .upsert(mappedOrders, { onConflict: "prodio_order_id" })
      .select("id");

    if (error) {
      return new Response(
        JSON.stringify({ error: `Błąd zapisu do bazy: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        fetched: prodioOrders.length,
        upserted: data?.length ?? 0,
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
