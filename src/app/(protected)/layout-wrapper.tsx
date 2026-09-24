"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/common/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/common/site-header";
import { PageTransition } from "@/components/common/page-transition";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isUpgradePage = pathname === "/upgrade";

  if (isUpgradePage) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <main className="flex-1 overflow-auto">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="overflow-x-hidden">
        <SiteHeader />
        <PageTransition className="overflow-x-hidden">
          {children}
        </PageTransition>
      </SidebarInset>
    </SidebarProvider>
  );
}
