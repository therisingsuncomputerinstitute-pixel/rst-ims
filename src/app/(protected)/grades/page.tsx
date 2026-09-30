"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, ListChecks, FileText, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getMyGrades, getMyCourseGradebook, GradeRow } from "@/server/ums";
import { PageHeader } from "@/components/ums/page-header";

function letterColor(letter: string | null) {
  if (letter === "A") return "text-emerald-400";
  if (letter === "B") return "text-orange-400";
  if (letter === "C") return "text-amber-400";
  if (letter === "D") return "text-orange-600";
  return "text-rose-400";
}

export default function GradesPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyGrades>> | null>(null);
  const [books, setBooks] = useState<
    NonNullable<Awaited<ReturnType<typeof getMyCourseGradebook>>>[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyGrades()
      .then((d) => {
        setData(d);
        // Only the Agentic AI Architect quarters have a weighted gradebook, so
        // ask per enrolled course and keep the ones that have one.
        return Promise.all(
          d.courseIds.map((id) => getMyCourseGradebook(id).catch(() => null)),
        );
      })
      .then((list) => setBooks(list.filter((b) => b !== null)))
      .catch(() => toast.error("Failed to load grades"))
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) {
    return (
      <div className="p-4 md:p-8 space-y-4">
        <Skeleton className="h-36 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  const rows = data?.rows ?? [];

  const byCourse = new Map<string, GradeRow[]>();
  for (const r of rows) {
    const key = `${r.courseName} (${r.courseCode})`;
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key)!.push(r);
  }

  const pending = rows.filter((r) => r.status !== "graded").length;
  const graded = rows.length - pending;

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Performance"
        subtitle="Your grades across quizzes and assignments."
        icon={<GraduationCap className="size-7 text-primary" />}
      />

      {/* Summary */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="rounded-3xl border-outline-variant/60">
          <CardContent className="p-6 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">
              Overall grade
            </p>
            <p
              className={cn(
                "text-5xl font-black",
                letterColor(data?.overallLetter ?? null),
              )}
            >
              {data?.overallLetter ?? "—"}
            </p>
            {data?.overallPercent != null && (
              <p className="text-sm font-bold text-on-surface-variant mt-1">
                {data.overallPercent}%
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-outline-variant/60">
          <CardContent className="p-6 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">
              Graded items
            </p>
            <p className="text-5xl font-black text-on-surface">{graded}</p>
            <p className="text-sm font-bold text-on-surface-variant mt-1">
              of {rows.length} total
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-outline-variant/60">
          <CardContent className="p-6 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">
              Awaiting grade
            </p>
            <p className="text-5xl font-black text-amber-500">{pending}</p>
            <p className="text-sm font-bold text-on-surface-variant mt-1">
              pending
            </p>
          </CardContent>
        </Card>
      </div>

      {books.length > 0 && (
        <div className="space-y-4 mb-6">
          <Card className="rounded-3xl border-outline-variant/60 bg-surface-container">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest text-on-surface-variant">
                How your grade is built
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                {[
                  ["Final exam", 50],
                  ["Mid term", 20],
                  ["Quizzes", 10],
                  ["Assignments", 10],
                  ["Participation", 10],
                ].map(([label, weight]) => (
                  <span key={String(label)} className="text-on-surface-variant">
                    <span className="font-black text-on-surface">{weight}</span>{" "}
                    {label}
                  </span>
                ))}
              </div>
              <p className="text-xs text-on-surface-variant mt-3">
                Participation is 10 marks: 3 for attendance, 2 for keeping your
                phone away and staying focused, and 5 for class participation.
              </p>
            </CardContent>
          </Card>
          {books.map((b) => (
            <Card
              key={b.course.id}
              className="rounded-3xl border-outline-variant/60"
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">
                    {b.course.name}
                  </CardTitle>
                  <CardDescription>
                    {b.course.code} · weighted grade, out of {b.result.outOf}
                  </CardDescription>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-3xl font-black text-on-surface">
                    {b.result.earned ?? "—"}
                    <span className="text-base text-on-surface-variant">
                      /{b.result.outOf}
                    </span>
                  </p>
                  <p
                    className={cn(
                      "text-sm font-black",
                      letterColor(b.result.letter),
                    )}
                  >
                    {b.result.percent === null
                      ? "Not graded yet"
                      : `${b.result.percent}% · ${b.result.letter}`}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {b.result.components.map((c) => {
                    const lost =
                      c.earned === null
                        ? null
                        : Math.round((c.weight - c.earned) * 100) / 100;
                    const pctOfWeight =
                      c.earned === null
                        ? 0
                        : Math.min(100, Math.max(0, (c.earned / c.weight) * 100));
                    const full = lost === 0;
                    return (
                      <div key={c.key} className="grid gap-1">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <span className="font-bold text-on-surface">
                              {c.label}
                            </span>
                            <span className="text-on-surface-variant text-xs">
                              {" "}
                              · {c.weight} marks · {c.note}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2 shrink-0">
                            {c.earned === null ? (
                              <span className="text-on-surface-variant/60 text-xs font-bold">
                                not entered
                              </span>
                            ) : (
                              <>
                                <span
                                  className={cn(
                                    "text-xs font-bold",
                                    full
                                      ? "text-emerald-500"
                                      : "text-rose-400",
                                  )}
                                >
                                  {full
                                    ? "full marks"
                                    : `lost ${lost}`}
                                </span>
                                <span className="font-black text-on-surface">
                                  {c.earned} / {c.weight}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div
                          className="h-2 w-full rounded-full bg-surface-container-highest overflow-hidden"
                          role="img"
                          aria-label={`${c.label}: ${c.earned ?? 0} of ${c.weight} marks`}
                        >
                          <div
                            className={cn(
                              "h-full rounded-full",
                              c.earned === null
                                ? "bg-outline-variant"
                                : full
                                  ? "bg-emerald-500"
                                  : "bg-primary",
                            )}
                            style={{ width: `${c.earned === null ? 100 : pctOfWeight}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-container px-4 py-3 text-sm">
                  <span className="font-black uppercase tracking-widest text-[10px] text-on-surface-variant">
                    Total
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "text-xs font-bold",
                        b.result.earned === b.result.outOf
                          ? "text-emerald-500"
                          : "text-rose-400",
                      )}
                    >
                      {b.result.earned === b.result.outOf
                        ? "nothing lost"
                        : `${Math.round((b.result.outOf - (b.result.earned ?? 0)) * 100) / 100} marks lost in total`}
                    </span>
                    <span className="font-black text-on-surface">
                      {b.result.earned ?? 0} / {b.result.outOf}
                    </span>
                  </span>
                </div>
                {b.remarks && (
                  <p className="text-xs text-on-surface-variant mt-3 flex items-start gap-2">
                    <Info className="size-3.5 mt-0.5 shrink-0" />
                    {b.remarks}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-16 text-center">
            <GraduationCap className="size-12 text-on-surface-variant/40 mx-auto mb-4" />
            <p className="text-base font-black text-on-surface">
              No grades yet
            </p>
            <p className="text-sm text-on-surface-variant mt-1 max-w-sm mx-auto">
              Attempt quizzes and submit assignments to build your academic record.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {[...byCourse.entries()].map(([course, items]) => (
            <Card key={course} className="rounded-3xl border-outline-variant/60">
              <CardHeader>
                <CardTitle className="text-base">{course}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col divide-y divide-outline-variant/40">
                  {items.map((g) => (
                    <Link
                      key={g.id}
                      href={g.kind === "quiz" ? `/quizzes/${g.id}` : `/assignments/${g.id}`}
                      className="flex items-center justify-between py-3 gap-3 hover:bg-surface-container-highest/50 transition-colors rounded-lg px-1"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                          {g.kind === "quiz" ? (
                            <ListChecks className="size-4 text-primary" />
                          ) : (
                            <FileText className="size-4 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-on-surface truncate">
                            {g.title}
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            {g.kind === "quiz" ? "Quiz" : "Assignment"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {g.status === "graded" ? (
                          <>
                            <div className="text-right">
                              <p className="text-sm font-black text-on-surface">
                                {g.earned}/{g.max}
                              </p>
                              <p className="text-[10px] text-on-surface-variant">
                                {g.percent}%
                              </p>
                            </div>
                            <span
                              className={cn(
                                "size-9 rounded-xl flex items-center justify-center font-black text-sm",
                                letterColor(g.letter),
                              )}
                              style={{ backgroundColor: "var(--surface-container-highest)" }}
                            >
                              {g.letter}
                            </span>
                          </>
                        ) : (
                          <Badge variant="secondary" className="rounded-full text-amber-500">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";