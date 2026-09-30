"use client";

import { useCallback, useEffect, useState } from "react";
import { GraduationCap, Loader2, Save, Info } from "lucide-react";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";
import { listCourseGradebook, saveGradebookEntry } from "@/server/ums";

type Data = Awaited<ReturnType<typeof listCourseGradebook>>;
type GradeRow = Data["rows"][number];

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

const letterColor = (letter: string | null) => {
  if (letter === "A") return "text-emerald-400";
  if (letter === "B") return "text-orange-400";
  if (letter === "C") return "text-amber-400";
  if (letter === "D") return "text-orange-600";
  return "text-rose-400";
};

export function GradebookTab({ courseId }: { courseId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, GradeRow>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Fetches without touching `loading`, so the effect below can drive that state
  // from an async callback instead of synchronously during the effect body.
  const fetchGradebook = useCallback(async () => {
    try {
      const d = await listCourseGradebook(courseId);
      setData(d);
      setDrafts(Object.fromEntries(d.rows.map((r) => [r.studentId, r])));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchGradebook();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchGradebook]);

  const reload = useCallback(() => {
    setLoading(true);
    void fetchGradebook().finally(() => setLoading(false));
  }, [fetchGradebook]);

  const edit = (studentId: string, patch: Partial<GradeRow>) => {
    setDrafts((prev) => {
      const base = prev[studentId];
      if (!base) return prev;
      // Recompute the live total so the teacher sees the effect as they type.
      const merged = { ...base, ...patch };
      return {
        ...prev,
        [studentId]: {
          ...merged,
          result: recompute(merged),
        },
      };
    });
  };

  const save = async (row: GradeRow) => {
    setSaving(row.studentId);
    try {
      await saveGradebookEntry({
        courseId,
        studentId: row.studentId,
        finalExam: row.finalExam,
        midTerm: row.midTerm,
        conduct: row.conduct,
        participation: row.participation,
        remarks: row.remarks,
      });
      toast.success(`Saved ${row.name}`);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  if (!data) return null;

  const rows = Object.values(drafts);

  return (
    <div className="grid gap-4">
      <Card className="rounded-3xl border-outline-variant/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-4 text-primary" /> Gradebook
            <Badge variant="secondary" className="rounded-full">
              out of 100
            </Badge>
          </CardTitle>
          <CardDescription className="mt-1">
            Final exam 50 · Mid term 20 · Quizzes 10 · Assignments 10 ·
            Participation 10 (3 attendance + 2 phone-free &amp; focused + 5 class
            participation). Quizzes, assignments and attendance are worked out
            automatically — you only enter the two exams, the 2 and the 5.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-on-surface-variant flex items-start gap-2">
            <Info className="size-3.5 mt-0.5 shrink-0" />
            A grade stays out of 100 even while parts are missing, so a
            half-entered grade never looks better than it is. Marks still to
            enter are flagged on each row.
          </p>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-16 text-center">
            <p className="text-sm text-on-surface-variant">
              No students enrolled yet. Enrol someone on the Students tab first.
            </p>
          </CardContent>
        </Card>
      ) : (
        rows.map((row) => {
          const r = row.result;
          return (
            <Card
              key={row.studentId}
              className="rounded-3xl border-outline-variant/60"
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{row.name}</CardTitle>
                  <CardDescription className="truncate">{row.email}</CardDescription>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.missing.length > 0 ? (
                    <Badge
                      variant="secondary"
                      className="rounded-full text-amber-500"
                    >
                      {r.missing.length} to enter
                    </Badge>
                  ) : (
                    <Badge className="rounded-full bg-emerald-500/15 text-emerald-500">
                      Complete
                    </Badge>
                  )}
                  <div className="text-right">
                    <p className="text-2xl font-black text-on-surface">
                      {r.earned ?? "—"}
                      <span className="text-sm text-on-surface-variant">
                        /{r.outOf}
                      </span>
                    </p>
                    <p
                      className={cn(
                        "text-xs font-black",
                        letterColor(r.letter),
                      )}
                    >
                      {r.percent === null
                        ? "—"
                        : `${r.percent}% · ${r.letter}`}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MarkField
                    id={`final-${row.studentId}`}
                    label="Final exam"
                    max={50}
                    value={row.finalExam}
                    onChange={(v) =>
                      edit(row.studentId, {
                        finalExam: v,
                        result: undefined as never,
                      })
                    }
                  />
                  <MarkField
                    id={`mid-${row.studentId}`}
                    label="Mid term"
                    max={20}
                    value={row.midTerm}
                    onChange={(v) =>
                      edit(row.studentId, { midTerm: v, result: undefined as never })
                    }
                  />
                  <MarkField
                    id={`conduct-${row.studentId}`}
                    label="Phone-free & focused"
                    max={2}
                    step={0.5}
                    required
                    value={row.conduct}
                    onChange={(v) =>
                      edit(row.studentId, {
                        conduct: v ?? 0,
                        result: undefined as never,
                      })
                    }
                  />
                  <MarkField
                    id={`part-${row.studentId}`}
                    label="Class participation"
                    max={5}
                    step={0.5}
                    required
                    value={row.participation}
                    onChange={(v) =>
                      edit(row.studentId, {
                        participation: v ?? 0,
                        result: undefined as never,
                      })
                    }
                  />
                </div>

                <div className="rounded-2xl border border-outline-variant/60 bg-surface-container p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">
                    Worked out automatically
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Derived
                      label="Quizzes"
                      weight={10}
                      value={row.quizPercent}
                    />
                    <Derived
                      label="Assignments"
                      weight={10}
                      value={row.assignmentPercent}
                    />
                    <Derived
                      label="Attendance"
                      weight={3}
                      value={row.attendancePercent}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex-1">
                    <Label
                      htmlFor={`remarks-${row.studentId}`}
                      className="text-xs"
                    >
                      Note for the student (optional)
                    </Label>
                    <Input
                      id={`remarks-${row.studentId}`}
                      value={row.remarks ?? ""}
                      onChange={(e) =>
                        edit(row.studentId, {
                          remarks: e.target.value,
                          result: undefined as never,
                        })
                      }
                      placeholder="Visible to the student on their grade page"
                      className="mt-1.5"
                    />
                  </div>
                  <Button
                    className="rounded-full shrink-0"
                    disabled={saving === row.studentId}
                    onClick={() => save(row)}
                  >
                    {saving === row.studentId ? (
                      <Loader2 className="size-4 animate-spin mr-1" />
                    ) : (
                      <Save className="size-4 mr-1" />
                    )}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function MarkField({
  id,
  label,
  max,
  step = 1,
  required = false,
  value,
  onChange,
}: {
  id: string;
  label: string;
  max: number;
  step?: number;
  required?: boolean;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {label} <span className="text-on-surface-variant">/ {max}</span>
        {!required && <span className="text-on-surface-variant"> (optional)</span>}
      </Label>
      <Input
        id={id}
        type="number"
        min={0}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? null : Number(raw));
        }}
        className="mt-1.5"
      />
    </div>
  );
}

function Derived({
  label,
  weight,
  value,
}: {
  label: string;
  weight: number;
  value: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-on-surface-variant">{label}</span>
      <span className="text-xs font-bold text-on-surface">
        {value === null ? (
          <span className="text-on-surface-variant/60">not marked yet</span>
        ) : (
          <>
            {(Math.round((value / 100) * weight * 100) / 100).toFixed(2).replace(/\.00$/, "")}{" "}
            <span className="text-on-surface-variant">
              / {weight} · {Math.round(value)}%
            </span>
          </>
        )}
      </span>
    </div>
  );
}

/** Mirror of the server maths so typing feels live. */
function recompute(row: GradeRow) {
  const clamp = (n: number, a: number, b: number) =>
    Math.min(b, Math.max(a, n));
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const slice = (p: number | null, w: number) =>
    p === null ? null : r2((clamp(p, 0, 100) / 100) * w);
  const components = [
    { key: "finalExam", earned: row.finalExam },
    { key: "midTerm", earned: row.midTerm },
    { key: "quizzes", earned: slice(row.quizPercent, 10) },
    { key: "assignments", earned: slice(row.assignmentPercent, 10) },
    { key: "attendance", earned: slice(row.attendancePercent, 3) },
    { key: "conduct", earned: r2(clamp(row.conduct, 0, 2)) },
    { key: "participation", earned: r2(clamp(row.participation, 0, 5)) },
  ] as const;
  const missing = components.filter((c) => c.earned === null).map((c) => c.key);
  const earned = r2(
    components.reduce((s, c) => s + (c.earned ?? 0), 0),
  );
  const percent = r2(earned);
  return {
    ...row.result,
    components: [],
    earned,
    outOf: 100,
    percent,
    letter:
      percent >= 90
        ? "A"
        : percent >= 80
          ? "B"
          : percent >= 70
            ? "C"
            : percent >= 60
              ? "D"
              : "F",
    missing,
  } as GradeRow["result"];
}
