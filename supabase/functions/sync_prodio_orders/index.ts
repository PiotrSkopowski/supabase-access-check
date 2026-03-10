import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchRecentOrders(apiToken: string, limit: number = 10): Promise<any[]> {
  const url = `https://toptech.getprodio.com/api/orders?api_token=${apiToken}&page=1&per_page=${limit}`;
  console.log(`[PRODIO] Fetching orders...`);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Prodio API error: ${res.status} – ${text}`);
  }
  const orders = await res.json();
  if (!Array.isArray(orders)) throw new Error("Unexpected Prodio API response format");
  console.log(`[PRODIO] Fetched ${orders.length} orders`);
  return orders;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PRODIO_API_TOKEN = Deno.env.get("PRODIO_API_TOKEN");
    if (!PRODIO_API_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Missing PRODIO_API_TOKEN" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prodioOrders = await fetchRecentOrders(PRODIO_API_TOKEN, 10);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Pre-load ALL groups in one query
    const { data: existingGroups } = await supabase
      .from("product_groups")
      .select("id, name");
    const groupByName = new Map<string, number>();
    if (existingGroups) {
      for (const g of existingGroups) {
        if (g.name) groupByName.set(g.name, g.id);
      }
    }

    // 2. Collect unique group names that need creating
    const newGroupNames = new Set<string>();
    for (const o of prodioOrders) {
      const gn = o.product_group_name ?? o.group_name ?? null;
      if (gn && !groupByName.has(gn)) newGroupNames.add(gn);
    }

    // 3. Batch-insert missing groups (single query)
    if (newGroupNames.size > 0) {
      const toInsert = Array.from(newGroupNames).map(name => ({ name }));
      const { data: inserted, error: gErr } = await supabase
        .from("product_groups")
        .upsert(toInsert, { onConflict: "name", ignoreDuplicates: true })
        .select("id, name");
      if (inserted) {
        for (const g of inserted) groupByName.set(g.name, g.id);
      }
      // If upsert didn't return (ignoreDuplicates), re-fetch
      if (gErr || !inserted) {
        const { data: allGroups } = await supabase.from("product_groups").select("id, name");
        if (allGroups) {
          for (const g of allGroups) {
            if (g.name) groupByName.set(g.name, g.id);
          }
        }
      }
    }
    console.log(`[PRODIO] Groups resolved: ${groupByName.size}`);

    // 4. Pre-load existing products by prodio_id (single query)
    const prodioProductIds = [...new Set(prodioOrders.filter(o => o.product_id).map(o => o.product_id))];
    const productByProdioId = new Map<number, any>();
    if (prodioProductIds.length > 0) {
      const { data: existingProducts } = await supabase
        .from("products")
        .select("id, prodio_id, group_id, current_price, name")
        .in("prodio_id", prodioProductIds);
      if (existingProducts) {
        for (const p of existingProducts) productByProdioId.set(p.prodio_id, p);
      }
    }

    // 5. Batch prepare product inserts and updates
    const productsToInsert: any[] = [];
    const productsToUpdate: { id: number; updates: Record<string, any> }[] = [];

    for (const o of prodioOrders) {
      if (!o.product_id) continue;
      const gn = o.product_group_name ?? o.group_name ?? null;
      const localGroupId = gn ? (groupByName.get(gn) ?? null) : null;
      const price = o.price != null ? Number(o.price) : null;
      const existing = productByProdioId.get(o.product_id);

      if (existing) {
        const upd: Record<string, any> = {};
        if (!existing.group_id && localGroupId) upd.group_id = localGroupId;
        if (!existing.current_price && price && price > 0) upd.current_price = price;
        if (!existing.name && o.product_name) upd.name = o.product_name;
        if (Object.keys(upd).length > 0) {
          productsToUpdate.push({ id: existing.id, updates: upd });
          // Update local cache
          Object.assign(existing, upd);
        }
      } else {
        const newProd: Record<string, any> = { prodio_id: o.product_id, name: o.product_name ?? null };
        if (localGroupId) newProd.group_id = localGroupId;
        if (price && price > 0) newProd.current_price = price;
        productsToInsert.push(newProd);
        // Cache to avoid duplicate inserts
        productByProdioId.set(o.product_id, { ...newProd, id: -1 });
      }
    }

    // 6. Execute batch product operations (2 queries max)
    if (productsToInsert.length > 0) {
      const { error: insErr } = await supabase.from("products").upsert(productsToInsert, { onConflict: "prodio_id", ignoreDuplicates: true });
      if (insErr) console.error(`[PRODIO] Product insert error: ${insErr.message}`);
      else console.log(`[PRODIO] Inserted ${productsToInsert.length} products`);
    }
    // Updates must be individual (different WHERE clauses), but are few
    for (const { id, updates } of productsToUpdate) {
      await supabase.from("products").update(updates).eq("id", id);
    }

    // 7. Build mapped orders for order_history
    const mappedOrders = prodioOrders.map(o => {
      const gn = o.product_group_name ?? o.group_name ?? null;
      const localGroupId = gn ? (groupByName.get(gn) ?? null) : null;
      const prodioPrice = o.price != null ? Number(o.price) : null;
      const cached = o.product_id ? productByProdioId.get(o.product_id) : null;

      return {
        prodio_order_id: String(o.id),
        client_id: o.client_id ?? null,
        client_name: o.client_name ?? null,
        product_id: o.product_id ?? null,
        product_name: o.product_name ?? null,
        product_group: localGroupId ?? null,
        product_group_name: gn ?? null,
        price: (prodioPrice && prodioPrice > 0) ? prodioPrice : (cached?.current_price ?? prodioPrice),
        currency: o.currency ?? null,
        order_date: o.create_date ?? null,
        quantity: o.total != null ? Number(o.total) : null,
        description: o.weight ?? null,
        source: "PRODIO",
      };
    });

    // 8. Single upsert for all orders
    const { data, error } = await supabase
      .from("order_history")
      .upsert(mappedOrders, { onConflict: "prodio_order_id" })
      .select("id");

    if (error) {
      console.error(`[PRODIO] order_history error: ${error.message}`);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = { success: true, fetched: prodioOrders.length, upserted: data?.length ?? 0, groups: groupByName.size };
    console.log(`[PRODIO] Done:`, result);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[PRODIO] Error: ${(err as Error).message}`);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
