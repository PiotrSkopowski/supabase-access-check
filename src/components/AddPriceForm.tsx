import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

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

    setInserting(true);
    setMsg(null);

    const { error } = await supabase.from("order_history").insert({
      product_id: productId,
      price: parsedPrice,
      quantity: parsedQty,
      source: "PRODIO",
      order_date: new Date().toISOString().split("T")[0],
    });

    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setMsg({ type: "success", text: "Wycena zapisana pomyślnie!" });
      setPrice("");
      setQuantity("");
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
        <div className="grid grid-cols-2 gap-4 mb-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="price">Cena (PLN)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Ilość</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              placeholder="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
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
