"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MoveLeft, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-center">
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-primary/30 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <h1 className="relative text-[10rem] lg:text-[15rem] font-black tracking-tighter uppercase text-primary leading-none select-none">
          404
        </h1>
      </div>

      <div className="max-w-xl mx-auto space-y-6 mt-8">
        <div className="space-y-2">
          <h2 className="text-3xl lg:text-4xl font-black uppercase tracking-tight text-on-surface">
            Lost in the Wordings
          </h2>
          <p className="text-on-surface-variant text-lg font-medium">
            The page you're looking for has been moved, deleted, or never
            existed in this organization.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-10">
          <Link href="/">
            <Button className="bg-primary text-primary-foreground font-black px-8 py-7 rounded-2xl shadow-xl shadow-primary/20 flex items-center gap-3 hover:scale-[1.05] active:scale-95 transition-all text-sm uppercase tracking-widest">
              <Home className="w-5 h-5" />
              Return Home
            </Button>
          </Link>

          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="border-outline-variant text-on-surface-variant font-black px-8 py-7 rounded-2xl flex items-center gap-3 hover:bg-surface-container-high transition-all text-sm uppercase tracking-widest"
          >
            <MoveLeft className="w-5 h-5" />
            Go Back
          </Button>
        </div>
      </div>

      {/* Background Decorative Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-20 dark:opacity-10">
        <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-primary rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-primary rounded-full blur-[160px]"></div>
      </div>
    </main>
  );
}
