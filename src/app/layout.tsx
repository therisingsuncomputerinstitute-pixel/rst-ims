import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "@/app/global.css";
import { ViewTransitions } from "next-view-transitions";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstrumentationClient } from "@/instrumentation-client";
import { INSTITUTE_NAME } from "@/lib/institute";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: `%s - ${INSTITUTE_NAME}`,
    default: INSTITUTE_NAME,
  },
  description: `${INSTITUTE_NAME} Institute Management System — courses, quizzes, assignments, and grades for students and faculty.`,
  openGraph: {
    title: INSTITUTE_NAME,
    description: `Institute Management System for ${INSTITUTE_NAME}.`,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: INSTITUTE_NAME,
    description: `Institute Management System for ${INSTITUTE_NAME}.`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <InstrumentationClient />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <ViewTransitions>
            <TooltipProvider>{children}</TooltipProvider>
          </ViewTransitions>
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
