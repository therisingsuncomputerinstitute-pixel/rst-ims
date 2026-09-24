import type { ReactNode } from "react";
import "@/app/global.css";
import { PageTransition } from "@/components/common/page-transition";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main>
      <PageTransition>{children}</PageTransition>
    </main>
  );
}
