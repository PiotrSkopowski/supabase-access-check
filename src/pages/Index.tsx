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

  useEffect(() => {
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
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="mb-6 text-3xl font-bold text-foreground">Order History</h1>

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
