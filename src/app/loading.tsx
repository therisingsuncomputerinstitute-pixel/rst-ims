import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
          <Loader2 className="h-12 w-12 animate-spin text-primary relative" />
        </div>
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-black uppercase tracking-widest text-on-surface">
            Initializing Engine
          </h2>
          <p className="text-sm font-medium text-on-surface-variant animate-pulse tracking-tight uppercase">
            Loading Cognitive Scope...
          </p>
        </div>
      </div>
    </div>
  );
}
