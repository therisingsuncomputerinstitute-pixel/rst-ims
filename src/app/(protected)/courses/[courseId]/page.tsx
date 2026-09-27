"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  FileText,
  Users,
  Plus,
  Loader2,
  Timer,
  CalendarDays,
  CheckCircle2,
  Circle,
  Trash2,
  Mail,
  UserPlus,
  GraduationCap,
  UsersRound,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { parseStudentList } from "@/lib/student-list";
import { authClient } from "@/lib/auth-client";
import {
  getCourse,
  listStudents,
  enrollStudents,
  enrollStudentsByList,
  removeEnrollment,
  toggleQuizPublish,
  toggleAssignmentPublish,
  deleteQuiz,
  deleteAssignment,
} from "@/server/ums";

type Detail = Awaited<ReturnType<typeof getCourse>>;

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";
  const courseId = params.courseId;

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "students">("overview");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getCourse(courseId)
      .then(setData)
      .catch(() => toast.error("Failed to load course"))
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="p-4 md:p-8 space-y-4">
        <Skeleton className="h-20 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-4 md:p-8">
        <p className="text-sm text-on-surface-variant">Course not found.</p>
      </div>
    );
  }

  const { course, quizzes, assignments, enrollments } = data;

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-outline-variant/60 bg-surface-container p-6 md:p-8 mb-6">
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="rounded-full font-mono">
                {course.code}
              </Badge>
              {course.term && (
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  {course.term}
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface">
              {course.name}
            </h1>
            {course.description && (
              <p className="text-sm font-medium text-on-surface-variant mt-2 max-w-2xl">
                {course.description}
              </p>
            )}
            {course.instructorName && (
              <p className="text-sm flex items-center gap-2 mt-3 text-on-surface-variant">
                <GraduationCap className="size-4 text-primary" />
                {course.instructorName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-highest/60 px-4 py-3 text-center">
              <p className="text-xl font-black text-on-surface">{(quizzes as any[]).length}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                Quizzes
              </p>
            </div>
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-highest/60 px-4 py-3 text-center">
              <p className="text-xl font-black text-on-surface">
                {(assignments as any[]).length}
              </p>
              <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                Assignments
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5">
        <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>
          <BookOpen className="size-4 mr-1.5" /> Overview
        </TabBtn>
        {isAdmin && (
          <TabBtn active={tab === "students"} onClick={() => setTab("students")}>
            <Users className="size-4 mr-1.5" /> Students
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {enrollments.length}
            </span>
          </TabBtn>
        )}
      </div>

      {tab === "overview" ? (
        <OverviewTab
          courseId={courseId}
          quizzes={quizzes as any[]}
          assignments={assignments as any[]}
          isAdmin={isAdmin}
          isClientEnrolled={data.isEnrolled}
          busy={busy}
          setBusy={setBusy}
          load={load}
        />
      ) : (
        <StudentsTab
          courseId={courseId}
          courseName={course.name}
          enrollments={enrollments}
          load={load}
        />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-4 py-2 text-sm font-bold transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-on-surface-variant hover:text-on-surface border border-outline-variant/50",
      )}
    >
      {children}
    </button>
  );
}

function OverviewTab({
  courseId,
  quizzes,
  assignments,
  isAdmin,
  isClientEnrolled,
  busy,
  setBusy,
  load,
}: {
  courseId: string;
  quizzes: any[];
  assignments: any[];
  isAdmin: boolean;
  isClientEnrolled: boolean;
  busy: string | null;
  setBusy: (v: string | null) => void;
  load: () => void;
}) {
  return (
    <div className="space-y-8">
      {/* Quizzes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
            <ClipboardList className="size-4" /> Quizzes
          </h2>
          {isAdmin && (
            <Link href={`/courses/${courseId}/quiz/new`}>
              <Button size="sm" className="rounded-full">
                <Plus className="size-4 mr-1" /> New Quiz
              </Button>
            </Link>
          )}
        </div>
        {quizzes.length === 0 ? (
          <EmptyRow text={isAdmin ? "No quizzes yet. Create one to get started." : "No quizzes published yet."} />
        ) : (
          <div className="flex flex-col gap-3">
            {quizzes.map((q) => (
              <ItemCard
                key={q.id}
                icon={ClipboardList}
                title={q.title}
                subtitle={`${q.totalQuestions} questions · ${q.durationMinutes} min · ${q.maxScore} points`}
                dueAt={q.dueAt ? format(new Date(q.dueAt), "MMM d, yyyy") : "No due date"}
                href={isAdmin ? `/quizzes/${q.id}` : `/quizzes/${q.id}`}
                published={q.isPublished}
                isAdmin={isAdmin}
                type="quiz"
                itemId={q.id}
                busy={busy}
                setBusy={setBusy}
                load={load}
              />
            ))}
          </div>
        )}
      </section>

      {/* Assignments */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
            <FileText className="size-4" /> Assignments
          </h2>
          {isAdmin && (
            <Link href={`/courses/${courseId}/assignment/new`}>
              <Button size="sm" className="rounded-full">
                <Plus className="size-4 mr-1" /> New Assignment
              </Button>
            </Link>
          )}
        </div>
        {assignments.length === 0 ? (
          <EmptyRow text={isAdmin ? "No assignments yet. Create one to get started." : "No assignments published yet."} />
        ) : (
          <div className="flex flex-col gap-3">
            {assignments.map((a) => (
              <ItemCard
                key={a.id}
                icon={FileText}
                title={a.title}
                subtitle={a.maxScore ? `${a.maxScore} points` : ""}
                dueAt={a.dueAt ? format(new Date(a.dueAt), "MMM d, yyyy") : "No due date"}
                href={`/assignments/${a.id}`}
                published={a.isPublished}
                isAdmin={isAdmin}
                type="assignment"
                itemId={a.id}
                busy={busy}
                setBusy={setBusy}
                load={load}
              />
            ))}
          </div>
        )}
      </section>
      {!isAdmin && (
        <p className="text-xs text-on-surface-variant">
          {isClientEnrolled ? "You are enrolled in this course." : ""}
        </p>
      )}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-outline-variant/50 p-8 text-center">
      <p className="text-sm text-on-surface-variant">{text}</p>
    </div>
  );
}

function ItemCard({
  icon: Icon,
  title,
  subtitle,
  dueAt,
  href,
  published,
  isAdmin,
  type,
  itemId,
  busy,
  setBusy,
  load,
}: {
  icon: any;
  title: string;
  subtitle: string;
  dueAt: string;
  href: string;
  published: boolean;
  isAdmin: boolean;
  type: "quiz" | "assignment";
  itemId: string;
  busy: string | null;
  setBusy: (v: string | null) => void;
  load: () => void;
}) {
  const toggle = async () => {
    setBusy(`pub-${type}-${itemId}`);
    try {
      if (type === "quiz") await toggleQuizPublish(itemId, !published);
      else await toggleAssignmentPublish(itemId, !published);
      toast.success(published ? "Unpublished" : "Published");
      load();
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    setBusy(`del-${type}-${itemId}`);
    try {
      if (type === "quiz") await deleteQuiz(itemId);
      else await deleteAssignment(itemId);
      toast.success("Deleted");
      load();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container p-4 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors">
      <Link href={href} className="flex items-center gap-3 min-w-0">
        <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
          <Icon className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-on-surface truncate">{title}</p>
          <p className="text-xs text-on-surface-variant truncate">
            {subtitle}
            <span className="inline-flex items-center gap-1 ml-2">
              <CalendarDays className="size-3" /> {dueAt}
            </span>
          </p>
        </div>
      </Link>
      <div className="flex items-center gap-2 shrink-0">
        <Badge
          variant="secondary"
          className={cn(
            "rounded-full",
            published ? "text-emerald-500" : "text-on-surface-variant",
          )}
        >
          {published ? (
            <CheckCircle2 className="size-3 mr-1" />
          ) : (
            <Circle className="size-3 mr-1" />
          )}
          {published ? "Published" : "Draft"}
        </Badge>
        {isAdmin && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={toggle}
              disabled={busy === `pub-${type}-${itemId}`}
            >
              {published ? "Unpublish" : "Publish"}
            </Button>
            <Link href={type === "quiz" ? `/quizzes/${itemId}/edit` : `/assignments/${itemId}/edit`}>
              <Button variant="ghost" size="sm" className="rounded-full">
                Edit
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-on-surface-variant hover:text-destructive"
              onClick={remove}
              disabled={busy === `del-${type}-${itemId}`}
            >
              {busy === `del-${type}-${itemId}` ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function StudentsTab({
  courseId,
  courseName,
  enrollments,
  load,
}: {
  courseId: string;
  courseName: string;
  enrollments: { id: string; name: string; email: string }[];
  load: () => void;
}) {
  const [students, setStudents] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkList, setBulkList] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listStudents().then(setStudents).catch(() => {});
  }, []);

  const addEnrollment = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const result = await enrollStudents(courseId, selected);
      const added = (result as { added?: number }).added ?? selected.length;
      toast.success(
        `${added} student${added === 1 ? "" : "s"} enrolled in ${courseName}`,
      );
      setSelected([]);
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to enroll");
    } finally {
      setBusy(false);
    }
  };

  const addBulk = async (enrollAll: boolean) => {
    setBusy(true);
    try {
      const result = await enrollStudentsByList(courseId, {
        list: bulkList,
        enrollAll,
      });
      if (result.success) {
        toast.success(`${result.message} in ${courseName}`, { duration: 6000 });
        setBulkList("");
        setShowBulk(false);
        load();
      } else {
        toast.error(result.message, { duration: 8000 });
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to enroll");
    } finally {
      setBusy(false);
    }
  };

  const removeEnrol = async (studentId: string) => {
    setBusy(true);
    try {
      await removeEnrollment(courseId, studentId);
      toast.success("Enrollment removed");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove");
    } finally {
      setBusy(false);
    }
  };

  const alreadyEnrolled = new Set(enrollments.map((e) => e.id));
  const available = students.filter((s) => !alreadyEnrolled.has(s.id));

  const matches = query.trim().toLowerCase();
  const filtered = matches
    ? available.filter(
        (s) =>
          s.name.toLowerCase().includes(matches) ||
          s.email.toLowerCase().includes(matches),
      )
    : available;

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((s) => selected.includes(s.id));

  return (
    <Card className="rounded-3xl border-outline-variant/60">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5 text-primary" /> Enrolled Students
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={available.length === 0 || busy}
            onClick={() => setShowBulk((v) => !v)}
          >
            <UsersRound className="size-4 mr-1" /> Enroll In Bulk
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button
                  size="sm"
                  className="rounded-full"
                  disabled={available.length === 0}
                />
              }
            >
              <UserPlus className="size-4 mr-1" /> Add Students
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add students to {courseName}</DialogTitle>
                <DialogDescription>
                  Tick everyone you want. {selected.length} selected.
                </DialogDescription>
              </DialogHeader>

              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="rounded-xl"
              />

              <div className="max-h-64 overflow-y-auto rounded-xl border border-outline-variant/40 divide-y divide-outline-variant/30">
                {filtered.length === 0 ? (
                  <p className="p-4 text-xs text-on-surface-variant text-center">
                    {available.length === 0
                      ? "Every student already has an account and is enrolled."
                      : "No students match that search."}
                  </p>
                ) : (
                  filtered.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-primary/5"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={selected.includes(s.id)}
                        onChange={() => toggle(s.id)}
                      />
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-primary">
                          {s.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">
                          {s.name}
                        </p>
                        <p className="text-xs text-on-surface-variant truncate">
                          {s.email}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>

              {filtered.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelected((prev) =>
                      allVisibleSelected
                        ? prev.filter((id) => !filtered.some((s) => s.id === id))
                        : [...new Set([...prev, ...filtered.map((s) => s.id)])],
                    )
                  }
                  className="text-xs font-bold text-primary self-start"
                >
                  {allVisibleSelected ? "Clear visible" : "Select all visible"}
                </button>
              )}

              <DialogFooter>
                <Button
                  onClick={addEnrollment}
                  disabled={busy || selected.length === 0}
                  className="rounded-full"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin mr-1" />
                  ) : (
                    <UserPlus className="size-4 mr-1" />
                  )}
                  Enroll {selected.length > 0 ? selected.length : ""}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showBulk && (
          <div className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container-highest/20 p-5">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                Paste the class list
              </Label>
              <Textarea
                value={bulkList}
                onChange={(e) => setBulkList(e.target.value)}
                rows={5}
                placeholder={
                  "ali.khan@example.com\nBilal Ahmed <bilal@example.com>\n Sana, sana@example.com"
                }
                className="rounded-2xl font-mono text-xs leading-relaxed bg-surface-container-low border-outline-variant"
              />
              <p className="text-[11px] font-medium text-on-surface-variant">
                {bulkList.trim()
                  ? `${parseStudentList(bulkList).length} address${
                      parseStudentList(bulkList).length === 1 ? "" : "es"
                    } detected. Everyone must already have a student account.`
                  : "One per line. Names are optional."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => addBulk(false)}
                disabled={busy || parseStudentList(bulkList).length === 0}
                className="rounded-full"
              >
                {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : <UsersRound className="size-4 mr-1" />}
                Enroll Listed Students
              </Button>
              <Button
                onClick={() => addBulk(true)}
                disabled={busy || students.length === 0}
                variant="outline"
                className="rounded-full"
              >
                <Users className="size-4 mr-1" /> Enroll Every Student
              </Button>
            </div>
          </div>
        )}

        {enrollments.length === 0 ? (
          <div className="text-center py-12">
            <Users className="size-10 text-on-surface-variant/40 mx-auto mb-3" />
            <p className="text-sm font-bold text-on-surface">No students yet</p>
            <p className="text-xs text-on-surface-variant">
              Enroll students so they can access quizzes and assignments.
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-outline-variant/40">
            {enrollments.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-black text-primary">
                      {e.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{e.name}</p>
                    <p className="text-xs text-on-surface-variant flex items-center gap-1">
                      <Mail className="size-3" /> {e.email}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-on-surface-variant hover:text-destructive"
                  onClick={() => removeEnrol(e.id)}
                  disabled={busy}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}