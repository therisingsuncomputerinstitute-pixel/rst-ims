import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Home, Lock } from "lucide-react";

export default function Forbidden() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-center">
      <div className="relative group mb-8">
        <div className="absolute -inset-4 bg-destructive/10 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
        <div className="relative flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-surface-container-high border-4 border-destructive/20 shadow-2xl overflow-hidden">
          <Lock className="h-16 w-16 text-destructive animate-bounce" />
          <div className="absolute inset-0 bg-destructive/5 animate-pulse"></div>
        </div>
      </div>

      <div className="max-w-xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-5xl font-black uppercase tracking-tighter text-on-surface">
            Forbidden Area
          </h1>
          <p className="text-on-surface-variant text-lg font-medium">
            Your current security clearance level is insufficient to access this
            cognitive scope.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-10">
          <Link href="/">
            <Button className="bg-primary text-primary-foreground font-black px-10 py-7 rounded-2xl shadow-xl shadow-primary/20 flex items-center gap-3 hover:scale-[1.05] active:scale-95 transition-all text-sm uppercase tracking-widest">
              <Home className="w-5 h-5" />
              Return Home
            </Button>
          </Link>

          <Link href="/settings">
            <Button
              variant="outline"
              className="border-outline-variant text-on-surface-variant font-black px-10 py-7 rounded-2xl flex items-center gap-3 hover:bg-surface-container-high transition-all text-sm uppercase tracking-widest"
            >
              <ShieldAlert className="w-5 h-5" />
              Check Clearance
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
