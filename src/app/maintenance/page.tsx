"use client";

import { useEffect, useState } from "react";
import { Wrench, ShieldAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { getMaintenanceState, setMaintenanceMode } from "@/server/ums";

export default function MaintenancePage() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";

  useEffect(() => {
    let cancelled = false;
    getMaintenanceState()
      .then((state) => {
        if (cancelled) return;
        setEnabled(state.enabled);
        setMessage(state.message);
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resume = async () => {
    const state = await setMaintenanceMode({ enabled: false });
    setEnabled(state.enabled);
    setMessage(state.message);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <div className="w-full max-w-xl rounded-3xl border border-outline-variant/60 bg-card p-8 shadow-xl">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-amber-500/10">
          {enabled ? (
            <ShieldAlert className="size-8 text-amber-500" />
          ) : (
            <Wrench className="size-8 text-amber-500" />
          )}
        </div>
        <h1 className="text-3xl font-black tracking-tight text-on-surface">
          {enabled ? "Maintenance in progress" : "All systems operational"}
        </h1>
        <p className="mt-3 text-sm font-medium text-on-surface-variant">
          {enabled
            ? message || "The portal is temporarily offline for maintenance. Please try again shortly."
            : "The portal is up and running."}
        </p>
        <p className="mt-6 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Rising Sun Tech Institute
        </p>
        {isAdmin && enabled ? (
          <Button
            onClick={resume}
            className="mt-8 rounded-full bg-primary px-8 font-black text-primary-foreground hover:scale-[1.02] active:scale-95 transition-all"
          >
            <RotateCcw className="mr-2 size-4" />
            Resume portal
          </Button>
        ) : null}
      </div>
    </div>
  );
}
