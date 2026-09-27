import Image from "next/image";
import { Loader2 } from "lucide-react";
import { INSTITUTE_NAME } from "@/lib/institute";

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Image
          src="/logo.png"
          alt={`${INSTITUTE_NAME} logo`}
          width={72}
          height={72}
          priority
          className="size-16 object-contain sm:size-18"
        />
        <div className="relative">
          <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
          <Loader2 className="h-10 w-10 animate-spin text-primary relative" />
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
