import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SalesOpportunity {
  client_name: string;
  opportunity_date: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  currency?: string | null;
}

interface Props {
  opportunities: SalesOpportunity[];
}

const formatPrice = (price: number, currency?: string | null) =>
  `${price.toFixed(2)} ${currency || "PLN"}`;

const formatDetail = (o: SalesOpportunity) => {
  const date = o.opportunity_date?.slice(0, 10) ?? "—";
  const curr = o.currency || "PLN";
  return { date, qty: o.quantity, price: `${o.unit_price.toFixed(2)} ${curr}` };
};

export function SalesOpportunityCell({ opportunities }: Props) {
  if (opportunities.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const latest = opportunities[0];
  const rest = opportunities.slice(1);
  const detail = formatDetail(latest);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary transition-colors group">
          <span>{formatPrice(latest.unit_price, latest.currency)}</span>
          <Info className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-xs p-3" align="start">
        <p className="text-xs font-semibold text-foreground mb-2">Najnowsza wycena</p>
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>Data: <span className="text-foreground">{detail.date}</span></p>
          <p>Ilość: <span className="text-foreground">{detail.qty} szt.</span></p>
          <p>Cena: <span className="text-foreground font-medium">{detail.price}</span></p>
        </div>
        {rest.length > 0 && (
          <>
            <hr className="my-2 border-border" />
            <p className="text-xs font-semibold text-foreground mb-1.5">
              Poprzednie wyceny ({rest.length})
            </p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {rest.map((o, i) => {
                const d = formatDetail(o);
                return (
                  <p key={i} className="text-xs text-muted-foreground whitespace-nowrap">
                    {d.date} • {d.qty} szt. • {d.price}
                  </p>
                );
              })}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
