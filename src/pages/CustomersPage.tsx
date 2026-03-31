import { useState } from "react";
import { useCustomers } from "@/hooks/useOrdersData";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, Building2, Phone, Mail, MapPin } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const PAGE_SIZE = 25;

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const formatCurrency = (val: number) =>
  val > 0 ? new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(val) : "—";

const getSegmentBadge = (segment: string | null) => {
  if (!segment) return null;
  if (segment.startsWith("A")) return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400">{segment}</Badge>;
  if (segment.startsWith("B")) return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400">{segment}</Badge>;
  return <Badge variant="secondary">{segment}</Badge>;
};

const CustomersPage = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<any | null>(null);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(0);
    clearTimeout((window as any).__searchTimer);
    (window as any).__searchTimer = setTimeout(() => setDebouncedSearch(val), 350);
  };

  const { data: customers = [], isLoading } = useCustomers(debouncedSearch);

  const totalPages = Math.ceil(customers.length / PAGE_SIZE);
  const pageRows = customers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Klienci</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "Ładowanie…" : `${customers.length} klientów · dane z Subiektu`}
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj po nazwie, symbolu, NIP, mieście…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10 h-11 text-sm"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>NIP</TableHead>
                <TableHead>Miasto</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead className="text-right">Zleceń</TableHead>
                <TableHead className="text-right">Obrót</TableHead>
                <TableHead>Ostatnie zlecenie</TableHead>
                <TableHead>Segment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    Brak klientów spełniających kryteria
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((c, i) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(c)}
                  >
                    <TableCell className="text-muted-foreground text-xs">{page * PAGE_SIZE + i + 1}</TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">{c.name}</p>
                      {c.symbol && c.symbol !== c.name && (
                        <p className="text-xs text-muted-foreground">{c.symbol}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{c.nip || "—"}</TableCell>
                    <TableCell className="text-sm">{c.city || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {c.contact_person || c.phone || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{c.total_orders || 0}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(c.total_revenue)}</TableCell>
                    <TableCell className="text-sm">{formatDate(c.last_order_date)}</TableCell>
                    <TableCell>{getSegmentBadge(c.segment_abc)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, customers.length)} z {customers.length}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Poprzednia
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Następna <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Panel szczegółów klienta */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                {selected.symbol && selected.symbol !== selected.name && (
                  <p className="text-sm text-muted-foreground">{selected.symbol}</p>
                )}
                <div className="flex gap-2 mt-2">
                  {getSegmentBadge(selected.segment_abc)}
                  <Badge variant="outline">{selected.status}</Badge>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* KPI */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Zleceń</p>
                    <p className="text-lg font-bold text-foreground">{selected.total_orders || 0}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Obrót łączny</p>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(selected.total_revenue)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Ostatnie zlecenie</p>
                    <p className="text-lg font-bold text-foreground">{formatDate(selected.last_order_date)}</p>
                  </div>
                </div>

                {/* Dane firmy */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" /> Dane firmy
                  </h4>
                  <div className="space-y-2 text-sm">
                    {selected.nip && <p className="flex justify-between"><span className="text-muted-foreground">NIP</span><span className="text-foreground">{selected.nip}</span></p>}
                    {selected.city && <p className="flex justify-between"><span className="text-muted-foreground">Miasto</span><span className="text-foreground">{selected.city}</span></p>}
                  </div>
                </div>

                {/* Kontakt */}
                {(selected.contact_person || selected.contact_phone || selected.contact_email || selected.phone || selected.email) && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" /> Kontakt
                    </h4>
                    <div className="space-y-2 text-sm">
                      {selected.contact_person && <p className="flex justify-between"><span className="text-muted-foreground">Osoba</span><span className="text-foreground">{selected.contact_person}</span></p>}
                      {(selected.contact_phone || selected.phone) && <p className="flex justify-between"><span className="text-muted-foreground">Telefon</span><span className="text-foreground">{selected.contact_phone || selected.phone}</span></p>}
                      {(selected.contact_email || selected.email) && <p className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="text-foreground">{selected.contact_email || selected.email}</span></p>}
                    </div>
                  </div>
                )}

                {/* Warunki handlowe */}
                {(selected.credit_limit || selected.payment_days || selected.discount) && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Warunki handlowe</h4>
                    <div className="space-y-2 text-sm">
                      {selected.credit_limit && <p className="flex justify-between"><span className="text-muted-foreground">Limit kredytowy</span><span className="text-foreground">{formatCurrency(selected.credit_limit)}</span></p>}
                      {selected.payment_days && <p className="flex justify-between"><span className="text-muted-foreground">Dni płatności</span><span className="text-foreground">{selected.payment_days} dni</span></p>}
                      {selected.discount && <p className="flex justify-between"><span className="text-muted-foreground">Rabat</span><span className="text-foreground">{selected.discount}%</span></p>}
                    </div>
                  </div>
                )}

                {selected.notes && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Notatki</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CustomersPage;
