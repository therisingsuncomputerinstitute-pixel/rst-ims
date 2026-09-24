import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserX, LogIn, Home } from "lucide-react";

export default function Unauthorized() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-center">
      <div className="relative group mb-8">
        <div className="absolute -inset-4 bg-primary/10 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
        <div className="relative flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-surface-container-high border-4 border-primary/20 shadow-2xl overflow-hidden">
          <UserX className="h-16 w-16 text-primary animate-pulse" />
        </div>
      </div>

      <div className="max-w-xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-5xl font-black uppercase tracking-tighter text-on-surface">
            Identity Required
          </h1>
          <p className="text-on-surface-variant text-lg font-medium">
            You must be authenticated to access the Wordings AI cognitive
            engine.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-10">
          <Link href="/login">
            <Button className="bg-primary text-primary-foreground font-black px-10 py-7 rounded-2xl shadow-xl shadow-primary/20 flex items-center gap-3 hover:scale-[1.05] active:scale-95 transition-all text-sm uppercase tracking-widest">
              <LogIn className="w-5 h-5" />
              Sign In
            </Button>
          </Link>

          <Link href="/">
            <Button
              variant="outline"
              className="border-outline-variant text-on-surface-variant font-black px-10 py-7 rounded-2xl flex items-center gap-3 hover:bg-surface-container-high transition-all text-sm uppercase tracking-widest"
            >
              <Home className="w-5 h-5" />
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
