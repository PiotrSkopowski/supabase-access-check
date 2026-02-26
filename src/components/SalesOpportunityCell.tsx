import { Clock } from "lucide-react";
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

const formatOpp = (o: SalesOpportunity) => {
  const date = o.opportunity_date?.slice(0, 10) ?? "—";
  const curr = o.currency || "PLN";
  return `${date} • ${o.quantity} szt. • ${o.unit_price.toFixed(2)} ${curr}`;
};

export function SalesOpportunityCell({ opportunities }: Props) {
  if (opportunities.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const latest = opportunities[0];
  const rest = opportunities.slice(1);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-foreground whitespace-nowrap">{formatOpp(latest)}</span>
      {rest.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-0.5 text-xs text-primary hover:bg-accent rounded px-1 py-0.5 transition-colors">
              <Clock className="h-3 w-3" />
              <span>+{rest.length}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto max-w-sm p-3" align="start">
            <p className="text-xs font-semibold text-foreground mb-2">Poprzednie wyceny</p>
            <div className="space-y-1">
              {rest.map((o, i) => (
                <p key={i} className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatOpp(o)}
                </p>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
