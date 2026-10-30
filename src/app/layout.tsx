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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://rst-ims.vercel.app",
  ),
  title: {
    template: `%s - ${INSTITUTE_NAME}`,
    default: `${INSTITUTE_NAME} | Institute Management System`,
  },
  description: `${INSTITUTE_NAME} Institute Management System — comprehensive portal for courses, proctored quizzes, assignments, attendance, and weighted grades for students and faculty.`,
  keywords: [
    "Institute Management System",
    "LMS",
    "Course Management",
    "Online Exams",
    "Quizzes",
    "Assignments",
    "Grades",
    "Student Portal",
    INSTITUTE_NAME,
  ],
  authors: [{ name: INSTITUTE_NAME }],
  creator: INSTITUTE_NAME,
  publisher: INSTITUTE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: `${INSTITUTE_NAME} | Institute Management System`,
    description: `Comprehensive portal for courses, proctored quizzes, assignments, and grades for ${INSTITUTE_NAME}.`,
    locale: "en_US",
    type: "website",
    siteName: INSTITUTE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: `${INSTITUTE_NAME} | Institute Management System`,
    description: `Comprehensive portal for courses, proctored quizzes, assignments, and grades for ${INSTITUTE_NAME}.`,
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
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
