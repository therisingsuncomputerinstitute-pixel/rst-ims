"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Plus,
  ClipboardList,
  FileText,
  Users,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { listCourses, deleteCourse } from "@/server/ums";
import { PageHeader } from "@/components/ums/page-header";

type Course = Awaited<ReturnType<typeof listCourses>>[number];

export default function CoursesPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listCourses().then(setCourses).catch(() => toast.error("Failed to load courses")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    setBusy(id);
    try {
      await deleteCourse(id);
      toast.success("Course deleted");
      router.refresh();
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete course");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Courses"
        subtitle={
          isAdmin
            ? "Create courses and manage their quizzes, assignments and enrollments."
            : "Courses you are enrolled in."
        }
        icon={<BookOpen className="size-7 text-primary" />}
        actions={
          isAdmin ? (
            <Link href="/courses/new">
              <Button className="rounded-full">
                <Plus className="size-4 mr-1" /> New Course
              </Button>
            </Link>
          ) : undefined
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-16 text-center">
            <BookOpen className="size-12 text-on-surface-variant/40 mx-auto mb-4" />
            <p className="text-base font-black text-on-surface">
              {isAdmin ? "No courses yet" : "You are not enrolled in any course yet"}
            </p>
            <p className="text-sm text-on-surface-variant mt-1">
              {isAdmin
                ? "Create your first course to get started."
                : "Courses will appear here once the administration enrolls you."}
            </p>
            {isAdmin && (
              <Link href="/courses/new" className="inline-block mt-5">
                <Button className="rounded-full">
                  <Plus className="size-4 mr-1" /> Create Course
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Card
              key={c.id}
              className="rounded-3xl border-outline-variant/60 hover:border-primary/40 transition-colors"
            >
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <BookOpen className="size-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    {!isAdmin && (
                      <Badge
                        variant={c.isEnrolled ? "default" : "outline"}
                        className="rounded-full"
                      >
                        {c.isEnrolled ? "Enrolled" : "Not enrolled"}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="rounded-full font-mono">
                      {c.code}
                    </Badge>
                  </div>
                </div>
                <Link href={`/courses/${c.id}`} className="group">
                  <p className="font-black text-on-surface group-hover:text-primary transition-colors text-lg">
                    {c.name}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                    {c.description || c.instructorName || "No description"}
                  </p>
                </Link>
                {c.term && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-2">
                    {c.term}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-outline-variant/40 text-[11px] font-bold text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <ClipboardList className="size-3.5" /> {c.quizCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="size-3.5" /> {c.assignmentCount}
                  </span>
                  {isAdmin && (
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5" /> {c.studentCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-outline-variant/40">
                  <Link href={`/courses/${c.id}`} className="flex-1">
                    <Button variant="secondary" className="w-full rounded-full" size="sm">
                      Open <ArrowRight className="size-3.5 ml-1" />
                    </Button>
                  </Link>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-on-surface-variant hover:text-destructive"
                      onClick={() => remove(c.id)}
                      disabled={busy === c.id}
                    >
                      {busy === c.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Delete"
                      )}
                    </Button>
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