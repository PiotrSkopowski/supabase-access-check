import { useState, useEffect } from "react";
import { Plus, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

interface Customer {
  id: string;
  name: string;
}

interface AddPriceFormProps {
  productId: string;
  productName: string;
  onSaved: () => void;
}

export function AddPriceForm({ productId, productName, onSaved }: AddPriceFormProps) {
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [inserting, setInserting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Customer search
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);

  useEffect(() => {
    if (customerQuery.trim().length === 0) {
      setCustomerResults([]);
      setCustomerOpen(false);
      return;
    }
    const timeout = setTimeout(async () => {
      const fuzzy = `%${customerQuery.trim().split("").join("%")}%`;
      const { data } = await supabase.from("customers").select("id, name").ilike("name", fuzzy).limit(8);
      setCustomerResults((data as Customer[]) ?? []);
      setCustomerOpen(true);
    }, 250);
    return () => clearTimeout(timeout);
  }, [customerQuery]);

  const handleSave = async () => {
    const parsedPrice = parseFloat(price);
    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setMsg({ type: "error", text: "Podaj prawidłową cenę." });
      return;
    }
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setMsg({ type: "error", text: "Podaj prawidłową ilość." });
      return;
    }
    if (!selectedCustomer) {
      setMsg({ type: "error", text: "Wybierz klienta." });
      return;
    }

    setInserting(true);
    setMsg(null);

    const { error } = await supabase.from("order_history").insert({
      product_id: productId,
      customer_id: selectedCustomer.id,
      price: parsedPrice,
      quantity: parsedQty,
    });

    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setMsg({ type: "success", text: "Wycena zapisana pomyślnie!" });
      setPrice("");
      setQuantity("");
      setSelectedCustomer(null);
      setCustomerQuery("");
      onSaved();
    }
    setInserting(false);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plus className="h-5 w-5" />
          Nowa wycena — {productName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Customer selector */}
          <div className="space-y-2 relative">
            <Label>Klient</Label>
            {selectedCustomer ? (
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-card">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium flex-1">{selectedCustomer.name}</span>
                <button
                  onClick={() => { setSelectedCustomer(null); setCustomerQuery(""); }}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >✕</button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Szukaj klienta…"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                />
                {customerOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-auto">
                    {customerResults.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Brak wyników</p>
                    ) : (
                      customerResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedCustomer(c); setCustomerOpen(false); setCustomerQuery(""); }}
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-0"
                        >
                          {c.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Cena (PLN)</Label>
            <Input id="price" type="number" step="0.01" min="0" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Ilość</Label>
            <Input id="quantity" type="number" min="1" placeholder="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        </div>
        <Button onClick={handleSave} disabled={inserting}>
          {inserting ? "Zapisywanie…" : "Zapisz wycenę"}
        </Button>
        {msg && (
          <p className={`mt-3 text-sm font-medium ${msg.type === "success" ? "text-green-600" : "text-destructive"}`}>
            {msg.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
