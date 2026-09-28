"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Clock, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ums/page-header";
import { checkInWithCode, listMyAttendance } from "@/server/ums";

type Row = Awaited<ReturnType<typeof listMyAttendance>>[number];

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};

export default function AttendancePage() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    listMyAttendance()
      .then(setRows)
      .catch(() => toast.error("Could not load your attendance"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const result = await checkInWithCode(code);
      toast.success(
        result.alreadyCheckedIn
          ? "You already checked in for this class"
          : `Checked in · ${result.title}`,
      );
      setCode("");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Attendance"
        subtitle="Type the 6-digit code your teacher puts on the board to mark yourself present."
        icon={<CalendarCheck className="size-7 text-primary" />}
      />

      <div className="max-w-3xl grid gap-6">
        <Card className="rounded-3xl border-outline-variant/60">
          <CardHeader>
            <CardTitle>Check in</CardTitle>
            <CardDescription>
              The code opens 15 minutes before the class and expires 15 minutes
              after it ends.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <Label htmlFor="code">Class code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 482913"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1.5 font-mono text-lg tracking-[0.35em]"
                />
              </div>
              <Button type="submit" className="rounded-full sm:w-40" disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin mr-1" />
                ) : (
                  <LogIn className="size-4 mr-1" />
                )}
                Check in
              </Button>
            </form>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-on-surface-variant mb-3">
            Your classes
          </h2>
          {loading ? (
            <div className="grid gap-2">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/50 p-8 text-center">
              <p className="text-sm text-on-surface-variant">
                No classes yet. Your teacher needs to create one first.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {rows.map((r) => (
                <div
                  key={r.sessionId}
                  className="rounded-2xl border border-outline-variant/60 bg-surface-container p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-on-surface truncate">
                      {r.title}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {r.courseCode} ·{" "}
                      {format(new Date(r.startsAt), "EEE d MMM, HH:mm")} ·{" "}
                      {r.durationMinutes} min
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.isOpenNow && (
                      <Badge className="rounded-full bg-emerald-500/15 text-emerald-500">
                        <span className="size-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                        Code live
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className="rounded-full"
                    >
                      {r.status ? (
                        <>
                          <Clock className="size-3 mr-1" />
                          {STATUS_LABEL[r.status] ?? r.status}
                        </>
                      ) : (
                        "Not marked"
                      )}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
