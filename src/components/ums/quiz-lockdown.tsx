"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, PauseCircle, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Quiz lockdown for online exams.
 *
 * While active it keeps the attempt in full screen, reports any switch to
 * another tab or window, blocks keyboard input, and blocks right-click.
 * Questions are multiple-choice, so nothing needs typing.
 */

export type ProctorViolation = {
  kind: "tab_switch" | "window_blur" | "fullscreen_exit" | "keyboard" | "right_click";
  at: number;
  label: string;
};

const VIOLATION_LABEL: Record<ProctorViolation["kind"], string> = {
  tab_switch: "Switched tab or window",
  window_blur: "Left the quiz window",
  fullscreen_exit: "Exited full screen",
  keyboard: "Tried to use the keyboard",
  right_click: "Tried to right-click",
};

export function useQuizProctor(
  active: boolean,
  onViolation?: (v: ProctorViolation) => void,
) {
  const [violations, setViolations] = useState<ProctorViolation[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [warning, setWarning] = useState<ProctorViolation | null>(null);

  const onViolationRef = useRef(onViolation);
  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  const lastAt = useRef(0);

  const record = useCallback((kind: ProctorViolation["kind"]) => {
    const now = Date.now();
    if (now - lastAt.current < 700) return;
    lastAt.current = now;
    const v: ProctorViolation = { kind, at: now, label: VIOLATION_LABEL[kind] };
    setViolations((prev) => [...prev, v]);
    setWarning(v);
    onViolationRef.current?.(v);
  }, []);

  const requestFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      }
    } catch {
      // Some browsers refuse without a gesture.
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch { /* nothing */ }
  }, []);

  const enteredRef = useRef(false);
  useEffect(() => {
    if (!active) return;
    const sync = () => {
      const fs = Boolean(document.fullscreenElement);
      if (fs) enteredRef.current = true;
      setIsFullscreen(fs);
      if (!fs && active && enteredRef.current) record("fullscreen_exit");
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [active, record]);

  useEffect(() => {
    if (!active) return;
    const onVisibility = () => { if (document.hidden) record("tab_switch"); };
    const onBlur = () => { if (!document.hidden) record("window_blur"); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [active, record]);

  // Block keyboard AND right-click
  useEffect(() => {
    if (!active) return;
    const blockKey = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      record("keyboard");
    };
    const blockCtx = (e: MouseEvent) => {
      e.preventDefault();
      record("right_click");
    };
    window.addEventListener("keydown", blockKey, { capture: true });
    window.addEventListener("keyup", blockKey, { capture: true });
    window.addEventListener("keypress", blockKey, { capture: true });
    document.addEventListener("copy", blockKey, { capture: true });
    document.addEventListener("paste", blockKey, { capture: true });
    document.addEventListener("cut", blockKey, { capture: true });
    document.addEventListener("contextmenu", blockCtx, { capture: true });
    return () => {
      window.removeEventListener("keydown", blockKey, { capture: true });
      window.removeEventListener("keyup", blockKey, { capture: true });
      window.removeEventListener("keypress", blockKey, { capture: true });
      document.removeEventListener("copy", blockKey, { capture: true });
      document.removeEventListener("paste", blockKey, { capture: true });
      document.removeEventListener("cut", blockKey, { capture: true });
      document.removeEventListener("contextmenu", blockCtx, { capture: true });
    };
  }, [active, record]);

  useEffect(() => {
    if (!active) return;
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [active]);

  return {
    violations,
    violationCount: violations.length,
    warning,
    dismissWarning: () => setWarning(null),
    isFullscreen,
    requestFullscreen,
    exitFullscreen,
  };
}

export function ProctorBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-error/15 px-3 py-1.5 text-xs font-bold text-error">
      <ShieldAlert className="size-3.5" />
      {count} warning{count === 1 ? "" : "s"}
    </span>
  );
}

export function FullscreenGuard({ onResume }: { onResume: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Maximize2 className="size-7" />
        </div>
        <h2 className="text-lg font-bold text-on-surface">Full screen is required</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          The quiz is paused until you return to full screen. Click below to continue.
        </p>
        <Button className="mt-5 rounded-full" onClick={onResume}>
          <Maximize2 className="size-4 mr-2" /> Resume full screen
        </Button>
      </div>
    </div>
  );
}

/** Shown when an admin pauses the student's attempt. */
export function PausedOverlay() {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur p-6">
      <div className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-background p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
          <PauseCircle className="size-8" />
        </div>
        <h2 className="text-xl font-bold text-on-surface">Quiz Paused</h2>
        <p className="mt-3 text-sm text-on-surface-variant leading-relaxed">
          Your instructor has paused your quiz session. Please contact them to resume.
          The timer is still running. Do not close this window.
        </p>
        <p className="mt-4 text-xs font-bold text-amber-500 uppercase tracking-widest">
          Waiting for instructor to resume…
        </p>
      </div>
    </div>
  );
}

export function ProctorWarning({
  violation,
  count,
  warningLimit,
  onDismiss,
}: {
  violation: ProctorViolation;
  count: number;
  warningLimit: number;
  onDismiss: () => void;
}) {
  const message: Record<ProctorViolation["kind"], string> = {
    tab_switch: "Switching to another tab or window was detected. This is recorded on your attempt.",
    window_blur: "You left the quiz window. This is recorded on your attempt.",
    fullscreen_exit: "You left full screen. Use the Resume button to continue the quiz.",
    keyboard: "Keyboard use is not allowed during this quiz. Only the mouse can be used.",
    right_click: "Right-clicking is not allowed during this quiz.",
  };

  const remaining = Math.max(0, warningLimit - count);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-md rounded-3xl border border-error/30 bg-background p-6 text-center shadow-xl">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-error/10 text-error">
          <TriangleAlert className="size-6" />
        </div>
        <h2 className="text-base font-bold text-on-surface">Warning — {violation.label}</h2>
        <p className="mt-2 text-sm text-on-surface-variant">{message[violation.kind]}</p>
        <p className="mt-3 text-xs font-bold text-error">
          {count} warning{count === 1 ? "" : "s"} on this attempt
        </p>
        {remaining > 0 ? (
          <p className="mt-1 text-xs text-amber-500 font-semibold">
            {remaining} more violation{remaining === 1 ? "" : "s"} will pause your quiz session.
          </p>
        ) : (
          <p className="mt-1 text-xs text-rose-500 font-bold">
            Further violations will terminate your quiz.
          </p>
        )}
        <Button className="mt-5 w-full rounded-full" onClick={onDismiss}>
          I understand, continue
        </Button>
      </div>
    </div>
  );
}