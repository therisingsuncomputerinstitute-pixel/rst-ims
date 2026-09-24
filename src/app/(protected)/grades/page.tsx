"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, ListChecks, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getMyGrades, GradeRow } from "@/server/ums";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyGrades()
      .then(setData)
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