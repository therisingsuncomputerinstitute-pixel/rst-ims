"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background text-center">
      <div className="relative mb-8">
        <div className="absolute -inset-4 bg-destructive/10 rounded-full blur-3xl opacity-50"></div>
        <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-destructive/10 border-4 border-destructive/20 shadow-2xl">
          <AlertCircle className="h-12 w-12 text-destructive animate-pulse" />
        </div>
      </div>

      <div className="max-w-md space-y-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-black uppercase tracking-tighter text-on-surface">
            System Failure
          </h2>
          <p className="text-on-surface-variant text-lg font-medium">
            The cognitive engine encountered an unexpected error.
            <br />
            <span className="text-xs font-mono opacity-50 mt-4 block">
              {error.digest || "Internal Logic Exception"}
            </span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
          <Button
            onClick={() => reset()}
            className="w-full sm:w-auto bg-primary text-primary-foreground font-black px-10 py-7 rounded-2xl shadow-xl shadow-primary/20 flex items-center gap-3 hover:scale-[1.05] active:scale-95 transition-all text-sm uppercase tracking-widest"
          >
            <RotateCcw className="w-5 h-5" />
            Recalibrate
          </Button>

          <Link href="/" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full border-outline-variant text-on-surface-variant font-black px-10 py-7 rounded-2xl flex items-center gap-3 hover:bg-surface-container-high transition-all text-sm uppercase tracking-widest"
            >
              <Home className="w-5 h-5" />
              Return Base
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
