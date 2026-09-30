"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Clock, Info } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ums/page-header";
import { listMyAttendance } from "@/server/ums";

type Row = Awaited<ReturnType<typeof listMyAttendance>>[number];

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};

export default function AttendancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    listMyAttendance()
      .then(setRows)
      .catch(() => toast.error("Could not load your attendance"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  // Excused absences do not count against the student, and an unmarked class is
  // simply not counted yet — both are excluded from the denominator.
  const counted = rows.filter((r) => r.status && r.status !== "excused");
  const attended = counted.filter((r) => r.status === "present" || r.status === "late");
  const percent = counted.length
    ? Math.round((attended.length / counted.length) * 100)
    : null;

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Attendance"
        subtitle="Your attendance record. Only your teacher can mark you present."
        icon={<CalendarCheck className="size-7 text-primary" />}
      />

      <div className="max-w-3xl grid gap-6">
        <Card className="rounded-3xl border-outline-variant/60">
          <CardHeader>
            <CardTitle>Your attendance</CardTitle>
            <CardDescription>
              Attendance is marked by your teacher during class. Contact them if
              something looks wrong.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-black text-on-surface">
                  {percent === null ? "—" : `${percent}%`}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-1">
                  Attended
                </p>
              </div>
              <div>
                <p className="text-3xl font-black text-emerald-500">
                  {attended.length}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-1">
                  Classes attended
                </p>
              </div>
              <div>
                <p className="text-3xl font-black text-on-surface">
                  {rows.length}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-1">
                  Total classes
                </p>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant mt-4 flex items-start gap-2">
              <Info className="size-3.5 mt-0.5 shrink-0" />
              Excused absences are not counted against you. Classes your teacher
              has not marked yet are left out of the percentage until they are.
            </p>
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
                  <Badge variant="secondary" className="rounded-full shrink-0">
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
