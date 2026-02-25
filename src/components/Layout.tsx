import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <span className="text-sm font-semibold text-foreground tracking-tight">
                Toptech Polska — System Wycen
              </span>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6 md:p-8 bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
