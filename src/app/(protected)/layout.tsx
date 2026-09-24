import { AppSidebar } from "@/components/common/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/common/site-header";
import { PageTransition } from "@/components/common/page-transition";
import { LayoutWrapper } from "./layout-wrapper";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-black">
      <LayoutWrapper>{children}</LayoutWrapper>
    </div>
  );
}
