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

/**
 * Resolves a Prodio group name to a local product_groups.id.
 * Creates the group if it doesn't exist yet.
 */
async function resolveGroupId(
  supabase: any,
  prodioGroupName: string | null,
  groupCache: Map<string, number>
): Promise<number | null> {
  if (!prodioGroupName) return null;

  // Check cache first
  if (groupCache.has(prodioGroupName)) {
    return groupCache.get(prodioGroupName)!;
  }

  // Try to find existing group by name
  const { data: existing, error: findErr } = await supabase
    .from("product_groups")
    .select("id")
    .eq("name", prodioGroupName)
    .maybeSingle();

  if (findErr) {
    console.warn(`[PRODIO] resolveGroupId find error for "${prodioGroupName}": ${findErr.message}`);
    return null;
  }

  if (existing) {
    groupCache.set(prodioGroupName, existing.id);
    console.log(`[PRODIO] Grupa "${prodioGroupName}" już istnieje, lokalne id=${existing.id}`);
    return existing.id;
  }

  // Create new group
  const { data: newGroup, error: insertErr } = await supabase
    .from("product_groups")
    .insert({ name: prodioGroupName })
    .select("id")
    .single();

  if (insertErr) {
    console.error(`[PRODIO] Błąd tworzenia grupy "${prodioGroupName}": ${insertErr.message}`);
    return null;
  }

  console.log(`[PRODIO] Utworzono nową grupę "${prodioGroupName}", lokalne id=${newGroup.id}`);
  groupCache.set(prodioGroupName, newGroup.id);
  return newGroup.id;
}

/**
 * Ensures a product exists in the local `products` table with correct group_id and price.
 * Anti-Poisoned Cache: updates existing products if they have missing price or group.
 */
async function ensureProduct(
  supabase: any,
  prodioProductId: number,
  productName: string | null,
  localGroupId: number | null,
  prodioPrice: number | null
): Promise<{ group_id: number | null; current_price: number | null }> {
  // Check if product already exists
  const { data: existing, error: findErr } = await supabase
    .from("products")
    .select("id, prodio_id, group_id, current_price, name")
    .eq("prodio_id", prodioProductId)
    .maybeSingle();

  if (findErr) {
    console.warn(`[PRODIO] ensureProduct find error for prodio_id=${prodioProductId}: ${findErr.message}`);
    return { group_id: localGroupId, current_price: prodioPrice };
  }

  if (existing) {
    // Anti-Poisoned Cache: update if missing group or price
    const needsUpdate: Record<string, any> = {};
    if (!existing.group_id && localGroupId) {
      needsUpdate.group_id = localGroupId;
    }
    if (!existing.current_price && prodioPrice && prodioPrice > 0) {
      needsUpdate.current_price = prodioPrice;
    }
    if (!existing.name && productName) {
      needsUpdate.name = productName;
    }

    if (Object.keys(needsUpdate).length > 0) {
      console.log(`[PRODIO] Anti-Poisoned Cache: aktualizuję produkt prodio_id=${prodioProductId}, pola: ${Object.keys(needsUpdate).join(', ')}`);
      const { error: updateErr } = await supabase
        .from("products")
        .update(needsUpdate)
        .eq("id", existing.id);
      if (updateErr) {
        console.warn(`[PRODIO] Błąd aktualizacji produktu prodio_id=${prodioProductId}: ${updateErr.message}`);
      }
    }

    return {
      group_id: needsUpdate.group_id ?? existing.group_id,
      current_price: needsUpdate.current_price ?? existing.current_price,
    };
  }

  // Product doesn't exist – insert it
  const newProduct: Record<string, any> = {
    prodio_id: prodioProductId,
    name: productName,
  };
  if (localGroupId) newProduct.group_id = localGroupId;
  if (prodioPrice && prodioPrice > 0) newProduct.current_price = prodioPrice;

  const { data: inserted, error: insertErr } = await supabase
    .from("products")
    .insert(newProduct)
    .select("id, group_id, current_price")
    .single();

  if (insertErr) {
    console.error(`[PRODIO] Błąd wstawiania produktu prodio_id=${prodioProductId}: ${insertErr.message}`);
    return { group_id: localGroupId, current_price: prodioPrice };
  }

  console.log(`[PRODIO] Dodano nowy produkt prodio_id=${prodioProductId}, lokalny id=${inserted.id}`);
  return { group_id: inserted.group_id, current_price: inserted.current_price };
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

    // Cache for group name -> local id resolution
    const groupCache = new Map<string, number>();

    // Pre-load existing groups into cache
    const { data: existingGroups } = await supabase
      .from("product_groups")
      .select("id, name");
    if (existingGroups) {
      for (const g of existingGroups) {
        if (g.name) groupCache.set(g.name, g.id);
      }
      console.log(`[PRODIO] Pre-loaded ${groupCache.size} grup do cache.`);
    }

    // Process each order: resolve group -> ensure product -> build mapped order
    const mappedOrders = [];
    for (const o of prodioOrders) {
      const prodioPrice = o.price != null ? Number(o.price) : null;
      const prodioGroupName: string | null = o.product_group_name ?? o.group_name ?? null;

      let localGroupId: number | null = null;
      let currentPrice: number | null = null;
      let groupName: string | null = prodioGroupName;

      if (o.product_id) {
        // 1. Resolve group by NAME (not by Prodio ID)
        localGroupId = await resolveGroupId(supabase, prodioGroupName, groupCache);

        // 2. Ensure product exists with correct local group_id
        const productInfo = await ensureProduct(
          supabase,
          o.product_id,
          o.product_name ?? null,
          localGroupId,
          prodioPrice
        );

        localGroupId = productInfo.group_id;
        currentPrice = productInfo.current_price;

        // Resolve group name from cache if we have localGroupId
        if (localGroupId && !groupName) {
          for (const [name, id] of groupCache.entries()) {
            if (id === localGroupId) { groupName = name; break; }
          }
        }
      }

      mappedOrders.push({
        prodio_order_id: String(o.id),
        client_id: o.client_id ?? null,
        client_name: o.client_name ?? null,
        product_id: o.product_id ?? null,
        product_name: o.product_name ?? null,
        product_group: localGroupId ?? null,
        product_group_name: groupName ?? null,
        price: (prodioPrice != null && prodioPrice > 0) ? prodioPrice : (currentPrice ?? prodioPrice),
        currency: o.currency ?? null,
        order_date: o.create_date ?? null,
        quantity: o.total != null ? Number(o.total) : null,
        description: o.weight ?? null,
        source: "PRODIO",
      });
    }

    console.log(`[PRODIO] Zapisuję ${mappedOrders.length} rekordów do bazy...`);
    const { data, error } = await supabase
      .from("order_history")
      .upsert(mappedOrders, { onConflict: "prodio_order_id" })
      .select("id");

    if (error) {
      console.error(`[PRODIO] Błąd zapisu order_history: ${error.message}`);
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
        groups_in_cache: groupCache.size,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[PRODIO] Nieoczekiwany błąd: ${(err as Error).message}`);
    return new Response(
      JSON.stringify({ error: `Nieoczekiwany błąd: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
