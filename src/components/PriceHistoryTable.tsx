import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface HistoryRow {
  id: string;
  source: string;
  price: number;
  quantity: number;
  order_date: string;
  created_at: string;
}

interface PriceHistoryTableProps {
  rows: HistoryRow[];
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formatCurrency = (val: number) =>
  val.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });

export function PriceHistoryTable({ rows }: PriceHistoryTableProps) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-4">Brak historii wycen dla tego produktu.</p>;
  }

  return (
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
  );
}
