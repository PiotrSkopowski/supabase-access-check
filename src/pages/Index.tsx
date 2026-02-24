import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const Index = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from("order_history")
        .select("*")
        .order("order_date", { ascending: false })
        .limit(20);

      if (err) {
        setError(`Supabase error: ${err.message} (code: ${err.code})`);
        setRows([]);
        setColumns([]);
      } else if (!data || data.length === 0) {
        setError("BŁĄD: Połączenie z Supabase działa, ale tabela jest pusta lub zablokowana przez RLS");
        setRows([]);
        setColumns([]);
      } else {
        setColumns(Object.keys(data[0]));
        setRows(data);
        console.log("✅ order_history columns:", Object.keys(data[0]));
        console.log("✅ First row:", data[0]);
      }

      setLoading(false);
    };

    fetch();
  }, []);

  // Display columns we care about (if they exist)
  const displayCols = ["product_name", "price", "currency", "quantity", "order_date", "description"];
  const activeCols = columns.length > 0 ? displayCols.filter((c) => columns.includes(c)) : displayCols;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Pulpit zleceń — TRYB DIAGNOSTYCZNY
        </h1>
        <p className="text-muted-foreground mt-1">
          Surowe dane z tabeli <code>order_history</code> (LIMIT 20, bez joinów)
        </p>
        {columns.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Kolumny w tabeli: <code>{columns.join(", ")}</code>
          </p>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 border-2 border-destructive rounded-lg p-6 text-center">
          <p className="text-destructive text-xl font-bold">{error}</p>
        </div>
      )}

      <Card className="shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold w-10">#</TableHead>
                {activeCols.map((col) => (
                  <TableHead key={col} className="font-semibold">{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                    {activeCols.map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeCols.length + 1} className="text-center py-12 text-muted-foreground">
                    Brak danych do wyświetlenia
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    {activeCols.map((col) => (
                      <TableCell key={col}>
                        {col === "order_date" && row[col]
                          ? formatDate(row[col])
                          : col === "price" && row[col] != null
                          ? Number(row[col]).toFixed(2)
                          : row[col] != null
                          ? String(row[col])
                          : <span className="text-muted-foreground italic">null</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default Index;
