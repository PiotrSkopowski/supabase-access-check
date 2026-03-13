import { ListFilter, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const STATUS_DISPLAY: Record<string, { label: string; className: string }> = {
  invoiced: { label: "Zafakturowane", className: "bg-green-100 text-green-800 border-green-200" },
  closed: { label: "Zamknięte", className: "bg-blue-100 text-blue-800 border-blue-200" },
  canceled: { label: "Anulowane", className: "text-red-500 border-red-200 bg-red-50" },
};

export function getStatusDisplay(status: string | null | undefined) {
  const key = (status ?? "").toLowerCase();
  return STATUS_DISPLAY[key] ?? { label: status || "Brak", className: "text-muted-foreground" };
}

interface StatusFilterProps {
  availableStatuses: string[];
  selectedStatuses: string[];
  onChange: (statuses: string[]) => void;
}

export function StatusFilter({ availableStatuses, selectedStatuses, onChange }: StatusFilterProps) {
  const allSelected = availableStatuses.length === selectedStatuses.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : [...availableStatuses]);
  };

  const toggle = (status: string) => {
    onChange(
      selectedStatuses.includes(status)
        ? selectedStatuses.filter((s) => s !== status)
        : [...selectedStatuses, status]
    );
  };

  const activeCount = selectedStatuses.length;
  const hasFilter = activeCount < availableStatuses.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <ListFilter className="h-4 w-4" />
          <span className="hidden sm:inline">Status</span>
          {hasFilter && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs rounded-full">
              {activeCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Filtruj po statusie</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={allSelected} onCheckedChange={toggleAll}>
          <span className="font-medium">Zaznacz wszystkie</span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {availableStatuses.map((status) => {
          const display = getStatusDisplay(status);
          return (
            <DropdownMenuCheckboxItem
              key={status}
              checked={selectedStatuses.includes(status)}
              onCheckedChange={() => toggle(status)}
            >
              <Badge variant="outline" className={`${display.className} text-xs mr-2`}>
                {display.label}
              </Badge>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
