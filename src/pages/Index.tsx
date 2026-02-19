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

const Index = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insertMsg, setInsertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [inserting, setInserting] = useState(false);

  const fetchData = async () => {
    const { data, error } = await supabase.from("order_history").select("*");
    if (error) {
      setError(error.message);
    } else if (data && data.length > 0) {
      setColumns(Object.keys(data[0]));
      setRows(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTestSave = async () => {
    setInserting(true);
    setInsertMsg(null);
    const { error } = await supabase.from("order_history").insert({
      product_id: "9fdbb9bf-d45e-4f6b-9823-75e6bbd6715e",
      price: 99.99,
      quantity: 1,
      source: "PRODIO",
      order_date: new Date().toISOString().split("T")[0],
    });
    if (error) {
      setInsertMsg({ type: "error", text: error.message });
    } else {
      setInsertMsg({ type: "success", text: "Row inserted successfully!" });
      await fetchData();
    }
    setInserting(false);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mb-6 flex items-center gap-4">
        <h1 className="text-3xl font-bold text-foreground">Order History</h1>
        <button
          onClick={handleTestSave}
          disabled={inserting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {inserting ? "Saving…" : "Test Save"}
        </button>
      </div>
      {insertMsg && (
        <div className={`mb-4 rounded-lg border p-3 text-sm font-medium ${insertMsg.type === "success" ? "border-green-500 text-green-700 bg-green-50" : "border-destructive text-destructive"}`}>
          {insertMsg.text}
        </div>
      )}

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {error && (
        <div className="rounded-lg border border-destructive p-4">
          <p className="text-destructive font-medium">Error: {error}</p>
          <p className="text-muted-foreground text-sm mt-2">
            Since these are publishable keys, you can share your Supabase URL and anon key directly in chat, and I'll add them to the code.
          </p>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-muted-foreground">No rows found in order_history.</p>
      )}

      {rows.length > 0 && (
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col}>
                      {row[col] == null ? "—" : String(row[col])}
                    </TableCell>
                  ))}
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
