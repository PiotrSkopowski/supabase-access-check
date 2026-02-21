import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface CustomerOrder {
  id: string;
  product_name: string;
  price: number;
  quantity: number;
  created_at: string;
}

interface CustomerOrdersTableProps {
  rows: CustomerOrder[];
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

const formatCurrency = (val: number) =>
  val.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });

export function CustomerOrdersTable({ rows }: CustomerOrdersTableProps) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-4">Brak zamówień dla tego klienta.</p>;
  }

  return (
    <div className="rounded-xl border border-border overflow-auto shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Produkt</TableHead>
            <TableHead className="font-semibold">Data</TableHead>
            <TableHead className="font-semibold text-right">Ilość</TableHead>
            <TableHead className="font-semibold text-right">Cena</TableHead>
            <TableHead className="font-semibold text-right">Wartość</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.product_name}</TableCell>
              <TableCell>{formatDate(row.created_at)}</TableCell>
              <TableCell className="text-right">{row.quantity}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.price)}</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(row.price * row.quantity)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
