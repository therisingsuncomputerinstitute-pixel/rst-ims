"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Quiz lockdown for online exams.
 *
 * While active it keeps the attempt in full screen, reports any switch to
 * another tab or window, and blocks keyboard input so only the mouse works.
 * Questions are multiple-choice, so nothing needs typing. No microphone or
 * camera access is ever requested.
 */

export type ProctorViolation = {
  kind: "tab_switch" | "window_blur" | "fullscreen_exit" | "keyboard";
  at: number;
  label: string;
};

const VIOLATION_LABEL: Record<ProctorViolation["kind"], string> = {
  tab_switch: "Switched tab or window",
  window_blur: "Left the quiz window",
  fullscreen_exit: "Exited full screen",
  keyboard: "Tried to use the keyboard",
};

export function useQuizProctor(
  active: boolean,
  onViolation?: (v: ProctorViolation) => void,
) {
  const [violations, setViolations] = useState<ProctorViolation[]>([]);
  // Assume full screen while we check for real (effect runs right after mount)
  // so the guard does not flash for a frame at the start.
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [warning, setWarning] = useState<ProctorViolation | null>(null);

  // Keep the latest callback without re-registering every listener.
  const onViolationRef = useRef(onViolation);
  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  // A single physical action can fire several events (blur + visibilitychange),
  // so ignore repeats inside this window instead of counting them separately.
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
      // Some browsers refuse without a gesture; the resume button covers that.
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* nothing to do */
    }
  }, []);

  // Track full-screen state and flag leaving it. A violation is only counted
  // once full screen has actually been entered, so the brief moment before the
  // browser reports it does not raise a false alarm.
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

  // Detect leaving the tab or the window.
  useEffect(() => {
    if (!active) return;
    const onVisibility = () => {
      if (document.hidden) record("tab_switch");
    };
    const onBlur = () => {
      if (!document.hidden) record("window_blur");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [active, record]);

  // Only the mouse is allowed: swallow keyboard input entirely.
  useEffect(() => {
    if (!active) return;
    const block = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      record("keyboard");
    };
    window.addEventListener("keydown", block, { capture: true });
    window.addEventListener("keyup", block, { capture: true });
    window.addEventListener("keypress", block, { capture: true });
    document.addEventListener("copy", block, { capture: true });
    document.addEventListener("paste", block, { capture: true });
    document.addEventListener("cut", block, { capture: true });
    return () => {
      window.removeEventListener("keydown", block, { capture: true });
      window.removeEventListener("keyup", block, { capture: true });
      window.removeEventListener("keypress", block, { capture: true });
      document.removeEventListener("copy", block, { capture: true });
      document.removeEventListener("paste", block, { capture: true });
      document.removeEventListener("cut", block, { capture: true });
    };
  }, [active, record]);

  // Leaving the attempt always releases full screen.
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

/** Small badge showing how many times the rules were broken. */
export function ProctorBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-error/15 px-3 py-1.5 text-xs font-bold text-error">
      <ShieldAlert className="size-3.5" />
      {count} warning{count === 1 ? "" : "s"}
    </span>
  );
}

/**
 * Shown when full screen was left, so the student can resume with a mouse click
 * (the only gesture the browser accepts for re-entering full screen).
 */
export function FullscreenGuard({ onResume }: { onResume: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Maximize2 className="size-7" />
        </div>
        <h2 className="text-lg font-bold text-on-surface">
          Full screen is required
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          The quiz is paused until you return to full screen. Click below to
          continue.
        </p>
        <Button className="mt-5 rounded-full" onClick={onResume}>
          <Maximize2 className="size-4 mr-2" /> Resume full screen
        </Button>
      </div>
    </div>
  );
}

/** Soft warning shown after a rule is broken; dismissed with a mouse click. */
export function ProctorWarning({
  violation,
  count,
  onDismiss,
}: {
  violation: ProctorViolation;
  count: number;
  onDismiss: () => void;
}) {
  const message: Record<ProctorViolation["kind"], string> = {
    tab_switch:
      "Switching to another tab or window was detected. This is recorded on your attempt.",
    window_blur:
      "You left the quiz window. This is recorded on your attempt.",
    fullscreen_exit:
      "You left full screen. Use the Resume button to continue the quiz.",
    keyboard:
      "Keyboard use is not allowed during this quiz. Only the mouse can be used.",
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-md rounded-3xl border border-error/30 bg-background p-6 text-center shadow-xl">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-error/10 text-error">
          <TriangleAlert className="size-6" />
        </div>
        <h2 className="text-base font-bold text-on-surface">
          Warning — {violation.label}
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant">{message[violation.kind]}</p>
        <p className="mt-3 text-xs font-bold text-error">
          {count} warning{count === 1 ? "" : "s"} on this attempt
        </p>
        <Button className="mt-5 w-full rounded-full" onClick={onDismiss}>
          I understand, continue
        </Button>
      </div>
    </div>
  );
}