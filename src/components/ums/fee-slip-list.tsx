"use client";

import { Eye, Receipt, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDelete } from "@/components/ums/confirm-delete";
import type { FeeSlipRow } from "@/server/ums";

/**
 * Lists fee slips. "View" opens the generated PDF in a new tab (inline, so it
 * renders in the browser); "Download" saves the same PDF to disk.
 */
export function FeeSlipList({
  slips,
  onDelete,
  emptyMessage = "No fee slips yet.",
}: {
  slips: FeeSlipRow[];
  onDelete?: (id: string) => void;
  emptyMessage?: string;
}) {
  if (!slips.length) {
    return (
      <Card className="rounded-3xl border-outline-variant/60">
        <CardContent className="py-10 text-center text-sm text-on-surface-variant">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  const open = (id: string, download: boolean) => {
    const url = `/api/fees/slip/${id}${download ? "?download=1" : ""}`;
    // Let the browser render the PDF inline in a new tab; the download variant
    // goes through a temporary anchor so it saves instead of navigating.
    if (download) {
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="grid gap-3">
      {slips.map((s) => {
        const partial = s.balanceDue > 0;
        const overpaid = s.overpaid > 0;

        return (
          <Card key={s.id} className="rounded-3xl border-outline-variant/60">
            <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-on-surface">
                    {s.studentName}
                  </span>
                  <Badge variant="outline">{s.courseCode}</Badge>
                  <Badge variant="secondary">{s.period}</Badge>
                  {partial && (
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                      {s.adjustmentReason ?? "Part paid"}
                    </Badge>
                  )}
                  {overpaid && (
                    <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400">
                      Advance
                    </Badge>
                  )}
                </div>

                <p className="mt-1 text-xs text-on-surface-variant">
                  Receipt {s.slipReference}
                  {s.rollNumber ? ` · Roll ${s.rollNumber}` : ""} ·{" "}
                  {s.method.replace(/_/g, " ")}
                  {s.reference ? ` · Ref ${s.reference}` : ""} · Paid{" "}
                  {format(new Date(s.paidAt), "d MMM yyyy")}
                </p>

                <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                  <span className="font-semibold text-on-surface">
                    {s.currency}{" "}
                    {s.amountPaid.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    Original {s.currency}{" "}
                    {s.originalFee.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                    {partial
                      ? ` · ${s.currency} ${s.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })} remaining`
                      : ""}
                  {s.adjustmentReason ? ` · ${s.adjustmentReason}` : ""}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => open(s.id, false)}
                >
                  <Eye className="size-4" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => open(s.id, true)}
                >
                  <Receipt className="size-4" />
                  Download
                </Button>
                {onDelete && (
                  <ConfirmDelete
                    what="fee slip"
                    itemName={`${s.slipReference} · ${s.studentName}`}
                    icon={<Trash2 className="size-4" />}
                    className="text-error hover:bg-error/10"
                    consequences={
                      <>
                        <li className="flex items-center gap-2">
                          <Receipt className="size-3.5 shrink-0" />
                          {s.currency} {s.amountPaid.toLocaleString()} recorded as
                          received for {s.period}
                        </li>
                        <li className="flex items-center gap-2">
                          <Trash2 className="size-3.5 shrink-0" />
                          The student loses the ability to open or download this slip
                        </li>
                      </>
                    }
                    onConfirm={() => onDelete(s.id)}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}