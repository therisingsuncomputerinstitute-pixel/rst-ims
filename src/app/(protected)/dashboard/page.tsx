"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  BookOpen,
  FileText,
  ClipboardList,
  CheckCircle2,
  Timer,
  ArrowRight,
  Users,
  FileCheck2,
  UserPlus,
  AlertTriangle,
  Layers,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  staggerContainer,
  staggerItem,
} from "@/components/common/page-transition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { authClient } from "@/lib/auth-client";
import { getStudentDashboardData } from "@/server/ums";

type DashboardData = Awaited<ReturnType<typeof getStudentDashboardData>>;

function letterColor(letter: string | null) {
  if (!letter) return "text-on-surface-variant";
  if (letter === "A") return "text-emerald-400";
  if (letter === "B") return "text-orange-400";
  if (letter === "C") return "text-amber-400";
  if (letter === "D") return "text-orange-600";
  return "text-rose-400";
}

function RoleGate() {
  const { data: session } = authClient.useSession();
  return (
    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-surface-container border border-outline-variant">
      {session?.user?.role === "admin" ? "Admin" : "Student"}
    </span>
  );
}

export default function DashboardPage() {
  const { data: session } = authClient.useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentDashboardData()
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <Skeleton className="h-24 w-full rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  const isAdmin = data?.isAdmin ?? false;

  return (
    <div className="p-4 md:p-8">
      <motion.div variants={staggerContainer} initial="hidden" animate="show">
        {/* Hero */}
        <motion.div
          variants={staggerItem}
          className="relative overflow-hidden rounded-3xl border border-outline-variant/60 bg-surface-container p-6 md:p-8 mb-6"
        >
          <div className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <GraduationCap className="size-5 text-primary" />
                <RoleGate />
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface">
                {isAdmin ? "Administration Portal" : "Welcome back"}
                {!isAdmin && session?.user?.name && (
                  <span className="text-primary">, {session.user.name.split(" ")[0]}</span>
                )}
              </h1>
              <p className="text-sm font-medium text-on-surface-variant mt-1">
                {isAdmin
                  ? "Manage courses, quizzes, assignments and student grades from one place."
                  : "Your courses, quizzes and assignments at a glance."}
              </p>
            </div>
            {!isAdmin && (
              <div className="flex items-center gap-4">
                <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-highest/60 px-6 py-4 text-center">
                  <p className="text-3xl font-black text-on-surface">
                    {data?.overallPercent != null ? (
                      <>{data.overallPercent}%</>
                    ) : (
                      "--"
                    )}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    Overall
                  </p>
                </div>
                <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-highest/60 px-6 py-4 text-center">
                  <p
                    className={cn(
                      "text-3xl font-black",
                      letterColor(data?.overallLetter ?? null),
                    )}
                  >
                    {data?.overallLetter ?? "--"}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    Grade
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {!isAdmin && (data?.dueSoon?.length ?? 0) > 0 && (
          <DueSoonAlert items={data?.dueSoon ?? []} />
        )}

        {isAdmin ? (
          data && <AdminDashboard data={data} />
        ) : (
          data && <StudentDashboard data={data} />
        )}
      </motion.div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  to?: string;
}) {
  const inner = (
    <motion.div
      variants={staggerItem}
      className="rounded-3xl border border-outline-variant/60 bg-surface-container p-5 h-full"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Icon className="size-5 text-primary" />
        </div>
        <ArrowRight className="size-4 text-on-surface-variant/50" />
      </div>
      <p className="text-3xl font-black text-on-surface">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">
        {label}
      </p>
    </motion.div>
  );
  return to ? (
    <Link href={to} className="h-full block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  accent = "text-primary",
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl bg-surface-container-highest/50 p-3">
      <div className={cn("flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1")}>
        <Icon className={cn("size-3.5", accent)} /> {label}
      </div>
      <p className="text-xl font-black text-on-surface">{value}</p>
    </div>
  );
}

function BarRow({
  label,
  value,
  caption,
}: {
  label: string;
  value: number | null;
  caption?: string;
}) {
  const width = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-on-surface truncate pr-2">{label}</span>
        <span className="text-xs font-black text-on-surface-variant shrink-0">
          {value == null ? "—" : `${value}%`}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-surface-container-highest/60 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-orange-400 transition-all duration-700"
          style={{ width: `${width}%` }}
        />
      </div>
      {caption && (
        <p className="text-[10px] text-on-surface-variant mt-0.5">{caption}</p>
      )}
    </div>
  );
}

function ActivityFeed({
  items,
  emptyText,
}: {
  items: DashboardData["activity"];
  emptyText: string;
}) {
  const iconFor = (type: string): { icon: LucideIcon; cls: string } => {
    if (type === "quiz") return { icon: ClipboardList, cls: "text-primary" };
    if (type === "assignment") return { icon: FileText, cls: "text-orange-400" };
    if (type === "grade") return { icon: CheckCircle2, cls: "text-emerald-400" };
    if (type === "enrollment") return { icon: UserPlus, cls: "text-violet-400" };
    return { icon: FileText, cls: "text-sky-400" };
  };

  if (!items?.length) {
    return (
      <p className="text-sm text-on-surface-variant text-center py-8">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-outline-variant/40">
      {items.map((item) => {
        const { icon: Icon, cls } = iconFor(item.type);
        const inner = (
          <div className="flex items-center gap-3 py-2.5 px-1 hover:bg-surface-container-highest/40 rounded-xl transition-colors">
            <div className={cn("p-2 rounded-xl bg-surface-container-highest/70 shrink-0")}>
              <Icon className={cn("size-4", cls)} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-on-surface truncate">
                {item.title}
              </p>
              <p className="text-xs text-on-surface-variant truncate">
                {item.subtitle}
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/70 shrink-0">
              {item.createdAt
                ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
                : ""}
            </span>
          </div>
        );
        return item.href ? (
          <Link key={item.id} href={item.href} className="block">
            {inner}
          </Link>
        ) : (
          <div key={item.id}>{inner}</div>
        );
      })}
    </div>
  );
}

function DueSoonAlert({ items }: { items: NonNullable<DashboardData["dueSoon"]> }) {
  return (
    <motion.div
      variants={staggerItem}
      className="mb-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 md:p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="size-4 text-amber-400" />
        <h2 className="text-sm font-black uppercase tracking-widest text-amber-400">
          Due soon
        </h2>
        <Badge className="ml-auto rounded-full" variant="secondary">
          {items.length} {items.length === 1 ? "item" : "items"}
        </Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-3 rounded-2xl bg-surface-container/70 p-3 hover:bg-surface-container transition-colors"
          >
            <div className="p-2 rounded-xl bg-amber-400/15 shrink-0">
              <Timer className="size-4 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-on-surface truncate">{item.title}</p>
              <p className="text-xs text-on-surface-variant truncate">{item.subtitle}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                Due {item.createdAt ? format(new Date(item.createdAt), "MMM d, h:mm a") : ""}
              </p>
              <p className="text-[10px] text-on-surface-variant">
                {item.createdAt
                  ? formatDistanceToNow(new Date(item.createdAt))
                  : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}

function AdminDashboard({ data }: { data: DashboardData }) {
  const counts = data.counts ?? { courses: 0, quizzes: 0, assignments: 0 };
  const quizStats = data.quizStats;
  const assignStats = data.assignmentStats;
  const perf = data.coursePerformance ?? [];
  const activity = data.activity ?? [];

  return (
    <>
      {quizStats && assignStats && (
        <motion.div
          variants={staggerItem}
          className="grid gap-4 md:grid-cols-2 mb-6"
        >
          <Card className="rounded-3xl border-outline-variant/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="size-5 text-primary" />
                Quiz performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <MiniStat icon={Layers} label="Attempts" value={quizStats.attempts} />
                <MiniStat icon={CheckCircle2} label="Completed" value={quizStats.submitted} accent="text-emerald-400" />
                <MiniStat icon={Timer} label="In progress" value={quizStats.inProgress} accent="text-amber-400" />
                <MiniStat icon={TrendingUp} label="Pass rate" value={quizStats.passRate != null ? `${quizStats.passRate}%` : "—"} accent="text-orange-400" />
              </div>
              <BarRow label="Pass rate (≥ 50%)" value={quizStats.passRate} caption={`${quizStats.submitted} submitted attempts across the institute`} />
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-outline-variant/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-5 text-orange-400" />
                Assignment performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <MiniStat icon={FileText} label="Submitted" value={assignStats.submitted} />
                <MiniStat icon={CheckCircle2} label="Graded" value={assignStats.graded} accent="text-emerald-400" />
                <MiniStat icon={Timer} label="Pending" value={assignStats.pending} accent="text-amber-400" />
                <MiniStat icon={TrendingUp} label="Avg grade" value={assignStats.avgPercent != null ? `${assignStats.avgPercent}%` : "—"} accent="text-orange-400" />
              </div>
              <BarRow label="Average grade" value={assignStats.avgPercent} caption={`${assignStats.graded} graded submissions`} />
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div
        variants={staggerItem}
        className="grid gap-4 md:grid-cols-2 mb-6"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <StatTile icon={Users} label="Students" value={data.studentCount} to="/users" />
          <StatTile icon={BookOpen} label="Courses" value={counts.courses} to="/courses" />
        </div>
        <Card className="rounded-3xl border-outline-variant/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-5 text-primary" />
              Course performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {perf.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-6">
                No graded work yet. Grades will appear here once you grade
                submissions.
              </p>
            ) : (
              perf.slice(0, 6).map((c) => (
                <BarRow
                  key={c.courseId}
                  label={`${c.courseCode} · ${c.courseName}`}
                  value={c.percent}
                />
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Card className="rounded-3xl border-outline-variant/60 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck2 className="size-5 text-amber-400" />
            Pending Grading
            {data.pendingGradingCount > 0 && (
              <Badge className="ml-auto" variant="destructive">
                {data.pendingGradingCount}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentSubmissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="size-10 text-emerald-400/70 mb-3" />
              <p className="text-sm font-semibold text-on-surface">
                All caught up
              </p>
              <p className="text-xs text-on-surface-variant">
                No submissions waiting to be graded.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-outline-variant/40">
              {data.recentSubmissions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-3 rounded-xl px-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">
                      {s.studentName}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate">
                      {s.assignmentTitle} · {s.fileName}
                    </p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                      {formatDistanceToNow(new Date(s.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest text-amber-500">
                      Awaiting grade
                    </span>
                    <Link href={`/assignments/${s.assignmentId || ""}`}>
                      <Button size="sm" className="rounded-xl">
                        Review &amp; grade <ArrowRight className="size-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          {data.pendingGradingCount > 0 && (
            <div className="pt-2">
              <Link href="/assignments">
                <Button variant="outline" className="w-full rounded-xl" size="sm">
                  Review all submissions <ArrowRight className="size-4 ml-2" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-outline-variant/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="size-5 text-primary" />
            Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <ActivityFeed items={activity} emptyText="No activity yet." />
        </CardContent>
      </Card>
    </>
  );
}

function StudentDashboard({ data }: { data: DashboardData }) {
  const progress = data.courseProgress ?? [];
  const trend = data.scoreTrend ?? [];
  const activity = data.activity ?? [];
  const hasProgressData = progress.some((p) => p.total > 0);

  return (
    <>
      {/* Courses */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">
            My Courses
          </h2>
          <Link href="/courses">
            <Button variant="ghost" size="sm" className="rounded-full">
              View all <ArrowRight className="size-4 ml-1" />
            </Button>
          </Link>
        </div>
        {data.courses.length === 0 ? (
          <Card className="rounded-3xl border-dashed">
            <CardContent className="py-12 text-center">
              <BookOpen className="size-10 text-on-surface-variant/40 mx-auto mb-3" />
              <p className="text-sm font-bold text-on-surface">
                No courses available yet
              </p>
              <p className="text-xs text-on-surface-variant">
                You will appear here once you are enrolled by the administration.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.courses.slice(0, 6).map((c) => {
              const prog = progress.find((p) => p.courseId === c.id);
              return (
                <motion.div key={c.id} variants={staggerItem}>
                  <Link href={`/courses/${c.id}`}>
                    <Card className="rounded-3xl border-outline-variant/60 h-full hover:border-primary/40 transition-colors">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-2.5 rounded-xl bg-primary/10">
                            <BookOpen className="size-5 text-primary" />
                          </div>
                          <Badge variant="secondary" className="rounded-full">
                            {c.code}
                          </Badge>
                        </div>
                        <p className="font-black text-on-surface">{c.name}</p>
                        <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                          {c.description || c.instructorName || "No description"}
                        </p>
                        <div className="flex items-center gap-3 mt-4 text-[11px] font-bold text-on-surface-variant">
                          <span className="flex items-center gap-1">
                            <ClipboardList className="size-3.5" /> {c.quizCount} quizzes
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="size-3.5" /> {c.assignmentCount} assignments
                          </span>
                        </div>
                        {prog && prog.total > 0 && (
                          <div className="mt-4">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                                Progress
                              </span>
                              <span className="text-[10px] font-bold text-on-surface-variant">
                                {prog.completed}/{prog.total}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-surface-container-highest/60 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-orange-400"
                                style={{ width: `${prog.percent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts */}
      <motion.div variants={staggerItem} className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card className="rounded-3xl border-outline-variant/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="size-5 text-primary" />
              Progress per course
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!hasProgressData ? (
              <p className="text-sm text-on-surface-variant text-center py-6">
                Progress appears here once your courses have published quizzes
                and assignments.
              </p>
            ) : (
              progress.map((p) => (
                <BarRow
                  key={p.courseId}
                  label={`${p.courseCode} · ${p.courseName}`}
                  value={p.percent}
                  caption={`${p.completed} of ${p.total} completed`}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-outline-variant/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-5 text-primary" />
              Score trend
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trend.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-6">
                Attempt quizzes and submit assignments to see your score trend.
              </p>
            ) : (
              trend.map((t, i) => (
                <BarRow key={`${t.title}-${i}`} label={t.title} value={t.percent} />
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Upcoming */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <UpcomingList
          title="Upcoming Quizzes"
          icon={Timer}
          items={data.upcomingQuizzes.map((q: { id: string; title: string; courseName?: string; dueAt?: Date | null }) => ({
            id: q.id,
            title: q.title,
            course: q.courseName || "",
            dueAt: q.dueAt ?? null,
            href: `/quizzes/${q.id}`,
          }))}
          emptyText="No upcoming quizzes"
        />
        <UpcomingList
          title="Upcoming Assignments"
          icon={FileText}
          items={data.upcomingAssignments.map((a: { id: string; title: string; courseName?: string; dueAt?: Date | null }) => ({
            id: a.id,
            title: a.title,
            course: a.courseName || "",
            dueAt: a.dueAt ?? null,
            href: `/assignments/${a.id}`,
          }))}
          emptyText="No upcoming assignments"
        />
      </div>

      {/* Recent activity + grades */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="rounded-3xl border-outline-variant/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="size-5 text-primary" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ActivityFeed items={activity} emptyText="No activity yet. Start with a quiz or assignment!" />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-outline-variant/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-400" />
              Recent Grades
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {data.recentGrades.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">
                No graded work yet. Attempt quizzes and submit assignments to see
                results here.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-outline-variant/40">
                {data.recentGrades.map((g) => (
                  <Link
                    key={g.id}
                    href={g.kind === "quiz" ? `/quizzes/${g.id}` : `/assignments/${g.id}`}
                    className="flex items-center justify-between py-3 px-4 hover:bg-surface-container-highest/40 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "size-9 rounded-xl flex items-center justify-center font-black text-sm",
                          letterColor(g.letter),
                        )}
                        style={{ backgroundColor: "var(--surface-container-highest)" }}
                      >
                        {g.letter ?? "--"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">{g.title}</p>
                        <p className="text-xs text-on-surface-variant">
                          {g.courseCode} · {g.kind === "quiz" ? "Quiz" : "Assignment"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-on-surface">
                        {g.earned != null && g.max != null ? (
                          <>
                            {g.earned}/{g.max}
                          </>
                        ) : (
                          "--"
                        )}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                        {g.percent != null ? `${g.percent}%` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function UpcomingList({
  title,
  icon: Icon,
  items,
  emptyText,
}: {
  title: string;
  icon: LucideIcon;
  items: { id: string; title: string; course: string; dueAt: Date | null; href: string }[];
  emptyText: string;
}) {
  return (
    <motion.div variants={staggerItem}>
      <Card className="rounded-3xl border-outline-variant/60 h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="size-5 text-primary" /> {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {items.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-8">
              {emptyText}
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-outline-variant/40">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between py-3 px-4 hover:bg-surface-container-highest/40 rounded-xl transition-colors"
                >
                  <div>
                    <p className="text-sm font-bold text-on-surface">{item.title}</p>
                    <p className="text-xs text-on-surface-variant">
                      {item.course}
                    </p>
                  </div>
                  {item.dueAt && (
                    <div className="text-right">
                      <p className="text-xs font-black text-amber-500 uppercase tracking-wide">
                        Due {format(item.dueAt, "MMM d")}
                      </p>
                      <p className="text-[10px] text-on-surface-variant">
                        {formatDistanceToNow(new Date(item.dueAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export const dynamic = "force-dynamic";