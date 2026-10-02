"use client";

import { useState, type ReactNode } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Delete confirmation for the whole app. Nothing is removed on click — the
 * action only runs after the dialog is opened and "Yes, delete …" is pressed,
 * so a stray click can never destroy data.
 */
export function ConfirmDelete({
  itemName,
  what = "this",
  consequences,
  confirmWord,
  onConfirm,
  trigger,
  variant = "ghost",
  size = "sm",
  icon,
  className,
}: {
  /** Human name of the thing being deleted, e.g. "Quiz 3". */
  itemName: string;
  /** Noun shown in the title, e.g. "quiz". */
  what?: string;
  /** Bullet list of what is destroyed along with it. */
  consequences?: ReactNode;
  /** When set, the admin must type this exact word to enable the action. */
  confirmWord?: string;
  onConfirm: () => Promise<void> | void;
  trigger?: ReactNode;
  variant?: "ghost" | "outline" | "destructive";
  size?: "sm" | "icon" | "default";
  icon?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const blocked = Boolean(confirmWord) && typed.trim() !== confirmWord;

  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
      setTyped("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant={variant}
            size={size}
            className={
              className ??
              "rounded-full text-on-surface-variant hover:text-error hover:bg-error/10"
            }
            aria-label={`Delete ${itemName}`}
          >
            {trigger ?? (icon ?? "Delete")}
          </Button>
        }
      >
        {trigger ?? (icon ?? "Delete")}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-error/10 text-error">
            <TriangleAlert className="size-7" />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete {what} “{itemName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone. The {what} is removed immediately and will not
            be recoverable.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {consequences ? (
          <ul className="space-y-1.5 text-xs font-medium text-muted-foreground">
            {consequences}
          </ul>
        ) : null}

        {confirmWord ? (
          <div className="space-y-2">
            <label
              htmlFor={`confirm-word-${itemName}`}
              className="text-xs font-bold text-foreground"
            >
              Type <span className="text-error">{confirmWord}</span> to confirm
            </label>
            <input
              id={`confirm-word-${itemName}`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder={confirmWord}
            />
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || blocked}
            onClick={(e) => {
              e.preventDefault();
              void run();
            }}
            className="bg-error text-white hover:bg-error/90"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deleting…
              </>
            ) : (
              `Yes, delete ${what}`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}