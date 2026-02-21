import { useState, useEffect, useRef } from "react";
import { Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

interface Customer {
  id: string;
  name: string;
}

interface CustomerSearchProps {
  onSelect: (customer: Customer) => void;
}

export function CustomerSearch({ onSelect }: CustomerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      // Fuzzy: split query into chars with % between for typo tolerance
      const fuzzyPattern = `%${query.trim().split("").join("%")}%`;
      const { data } = await supabase
        .from("customers")
        .select("id, name")
        .ilike("name", fuzzyPattern)
        .limit(10);
      setResults((data as Customer[]) ?? []);
      setOpen(true);
      setLoading(false);
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xl">
      <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Wyszukaj klienta po nazwie…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-10 h-12 text-base border-border bg-card shadow-sm"
      />

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-64 overflow-auto">
          {loading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Szukam…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Brak wyników dla „{query}"</p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSelect(c);
                  setQuery("");
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b border-border last:border-0"
              >
                <div className="rounded-md bg-secondary p-1.5">
                  <Users className="h-3.5 w-3.5 text-secondary-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">{c.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
