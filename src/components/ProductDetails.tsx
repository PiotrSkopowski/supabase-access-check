import { Package, TrendingUp, Hash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ProductDetailsProps {
  name: string;
  latestPrice: number | null;
  totalOrders: number;
}

const formatCurrency = (val: number) =>
  val.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });

export function ProductDetails({ name, latestPrice, totalOrders }: ProductDetailsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary p-2.5">
          <Package className="h-6 w-6 text-primary-foreground" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{name}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-lg bg-secondary p-2">
              <TrendingUp className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Ostatnia cena</p>
              <p className="text-2xl font-bold text-foreground">
                {latestPrice !== null ? formatCurrency(latestPrice) : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-lg bg-secondary p-2">
              <Hash className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Liczba wycen</p>
              <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
