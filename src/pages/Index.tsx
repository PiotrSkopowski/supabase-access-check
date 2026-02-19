import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface OrderRow {
  id: string;
  product_id: string;
  source: string;
  price: number;
  quantity: number;
  order_date: string;
  created_at: string;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatCurrency = (val: number) =>
  val.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });

const Index = () => {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insertMsg, setInsertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [inserting, setInserting] = useState(false);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("order_history")
      .select("*")
      .order("order_date", { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setRows((data as OrderRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    const parsedPrice = parseFloat(price);
    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setInsertMsg({ type: "error", text: "Podaj prawidłową cenę." });
      return;
    }
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setInsertMsg({ type: "error", text: "Podaj prawidłową ilość." });
      return;
    }

    setInserting(true);
    setInsertMsg(null);
    const { error } = await supabase.from("order_history").insert({
      product_id: "9fdbb9bf-d45e-4f6b-9823-75e6bbd6715e",
      price: parsedPrice,
      quantity: parsedQty,
      source: "PRODIO",
      order_date: new Date().toISOString().split("T")[0],
    });
    if (error) {
      setInsertMsg({ type: "error", text: error.message });
    } else {
      setInsertMsg({ type: "success", text: "Wycena zapisana pomyślnie!" });
      setPrice("");
      setQuantity("");
      await fetchData();
    }
    setInserting(false);
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <h1 className="text-3xl font-bold text-foreground mb-8">Historia zamówień</h1>

      {/* Form */}
      <div className="mb-8 rounded-xl border border-border bg-card p-6 shadow-sm max-w-lg">
        <h2 className="text-lg font-semibold text-card-foreground mb-4">Nowa wycena</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
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
        <Button onClick={handleSave} disabled={inserting} className="w-full">
          {inserting ? "Zapisywanie…" : "Zapisz wycenę"}
        </Button>
        {insertMsg && (
          <p className={`mt-3 text-sm font-medium ${insertMsg.type === "success" ? "text-green-600" : "text-destructive"}`}>
            {insertMsg.text}
          </p>
        )}
      </div>

      {/* Table */}
      {loading && <p className="text-muted-foreground">Ładowanie…</p>}
      {error && (
        <div className="rounded-lg border border-destructive p-4">
          <p className="text-destructive font-medium">Błąd: {error}</p>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-muted-foreground">Brak danych w historii zamówień.</p>
      )}

      {rows.length > 0 && (
        <div className="rounded-xl border border-border overflow-auto shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Data zamówienia</TableHead>
                <TableHead className="font-semibold">Źródło</TableHead>
                <TableHead className="font-semibold text-right">Cena</TableHead>
                <TableHead className="font-semibold text-right">Ilość</TableHead>
                <TableHead className="font-semibold">Dodano</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(row.order_date)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                      {row.source}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(row.price)}</TableCell>
                  <TableCell className="text-right">{row.quantity}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(row.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Index;
