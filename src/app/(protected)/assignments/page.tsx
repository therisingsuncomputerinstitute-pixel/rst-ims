"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Timer,
  Upload,
  CheckCircle2,
  Lock,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { authClient } from "@/lib/auth-client";
import { listMyAssignments, MyAssignmentItem } from "@/server/ums";
import { PageHeader } from "@/components/ums/page-header";

const statusMeta: Record<
  MyAssignmentItem["status"],
  { label: string; cls: string }
> = {
  not_submitted: { label: "Not submitted", cls: "text-on-surface-variant" },
  submitted: { label: "Awaiting grade", cls: "text-amber-500" },
  graded: { label: "Graded", cls: "text-emerald-500" },
};

export default function AssignmentsPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";
  const [items, setItems] = useState<MyAssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMyAssignments()
      .then(setItems)
      .catch(() => toast.error("Failed to load assignments"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Assignments"
        subtitle={
          isAdmin
            ? "Review submissions and grades across courses."
            : "Submit files for your assignments."
        }
        icon={<FileText className="size-7 text-primary" />}
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
            <FileText className="size-12 text-on-surface-variant/40 mx-auto mb-4" />
            <p className="text-base font-black text-on-surface">No assignments</p>
            <p className="text-sm text-on-surface-variant mt-1">
              {isAdmin
                ? "Create assignments from a course page to get started."
                : "Assignments will appear here once your instructors publish them."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((a) => (
            <Card
              key={a.id}
              className="rounded-3xl border-outline-variant/60 hover:border-primary/40 transition-colors"
            >
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <Link
                  href={`/assignments/${a.id}`}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                    <FileText className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-on-surface truncate">{a.title}</p>
                      {!a.isPublished && isAdmin && (
                        <Badge variant="outline" className="rounded-full">
                          <Lock className="size-3 mr-1" /> Draft
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant truncate">
                      {a.courseCode} · {a.courseName} · {a.maxScore} points
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-3 shrink-0">
                  {a.status !== "not_submitted" && (
                    <div className="hidden sm:flex items-center gap-2">
                      {a.status === "graded" && (
                        <div className="text-right">
                          <p className="text-sm font-black text-on-surface">
                            {a.grade} <span className="text-xs text-on-surface-variant">/{a.maxScore}</span>
                          </p>
                          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                            Score
                          </p>
                        </div>
                      )}
                      <Badge
                        variant="secondary"
                        className={cn("rounded-full", statusMeta[a.status].cls)}
                      >
                        {a.status === "graded" ? (
                          <>
                            <CheckCircle2 className="size-3 mr-1" /> Graded
                          </>
                        ) : (
                          <>
                            <Upload className="size-3 mr-1" /> Submitted
                          </>
                        )}
                      </Badge>
                    </div>
                  )}
                  <div
                    className={cn(
                      "text-[10px] font-black uppercase tracking-widest hidden md:block",
                      statusMeta[a.status].cls,
                    )}
                  >
                    {statusMeta[a.status].label}
                  </div>
                  {a.dueAt && (
                    <div className="text-right hidden lg:block">
                      <Timer className="size-3.5 inline text-on-surface-variant mr-1" />
                      <span className="text-[11px] font-bold text-on-surface-variant">
                        {format(new Date(a.dueAt), "MMM d")}
                      </span>
                    </div>
                  )}
                  {isAdmin && a.status !== "not_submitted" && (
                    <Link href={`/assignments/${a.id}`}>
                      <Badge variant="secondary" className="rounded-full">
                        Review <ArrowRight className="size-3 ml-1" />
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