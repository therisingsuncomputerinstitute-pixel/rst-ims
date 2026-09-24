"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Timer,
  Lock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { authClient } from "@/lib/auth-client";
import { listMyQuizzes, MyQuizItem } from "@/server/ums";
import { PageHeader } from "@/components/ums/page-header";

const statusMeta: Record<
  MyQuizItem["status"],
  { label: string; cls: string }
> = {
  not_attempted: { label: "Not attempted", cls: "text-on-surface-variant" },
  in_progress: { label: "In progress", cls: "text-amber-500" },
  submitted: { label: "Attempted", cls: "text-emerald-500" },
};

export default function QuizzesPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";
  const [items, setItems] = useState<MyQuizItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMyQuizzes()
      .then(setItems)
      .catch(() => toast.error("Failed to load quizzes"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Quizzes"
        subtitle={
          isAdmin
            ? "All quizzes across your courses."
            : "Online quizzes available for your enrolled courses."
        }
        icon={<ClipboardList className="size-7 text-primary" />}
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-16 text-center">
            <ClipboardList className="size-12 text-on-surface-variant/40 mx-auto mb-4" />
            <p className="text-base font-black text-on-surface">No quizzes</p>
            <p className="text-sm text-on-surface-variant mt-1">
              {isAdmin
                ? "Create quizzes from a course page to get started."
                : "Quizzes will appear here once your instructors publish them."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((q) => (
            <Card
              key={q.id}
              className="rounded-3xl border-outline-variant/60 hover:border-primary/40 transition-colors"
            >
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <Link
                  href={`/quizzes/${q.id}`}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                    <ClipboardList className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-on-surface truncate">{q.title}</p>
                      {!q.isPublished && isAdmin && (
                        <Badge variant="outline" className="rounded-full">
                          <Lock className="size-3 mr-1" /> Draft
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant truncate">
                      {q.courseCode} · {q.courseName} · {q.totalQuestions} questions ·{" "}
                      {q.durationMinutes} min
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-3 shrink-0">
                  {q.status === "submitted" && (
                    <>
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-black text-on-surface">
                          {q.scoreEarned}/{q.scoreTotal}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                          Score
                        </p>
                      </div>
                      <CheckCircle2 className="size-5 text-emerald-400" />
                    </>
                  )}
                  <div
                    className={cn(
                      "text-[10px] font-black uppercase tracking-widest hidden md:block",
                      statusMeta[q.status].cls,
                    )}
                  >
                    {statusMeta[q.status].label}
                  </div>
                  {q.dueAt && (
                    <div className="text-right hidden lg:block">
                      <Timer className="size-3.5 inline text-on-surface-variant mr-1" />
                      <span className="text-[11px] font-bold text-on-surface-variant">
                        {format(new Date(q.dueAt), "MMM d")}
                      </span>
                    </div>
                  )}
                  {isAdmin && (
                    <Link href={`/quizzes/${q.id}`}>
                      <Badge variant="secondary" className="rounded-full">
                        Manage <ArrowRight className="size-3 ml-1" />
                      </Badge>
                    </Link>
                  )}
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