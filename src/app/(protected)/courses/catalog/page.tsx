"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  Lock,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { listCourseCatalog } from "@/server/ums";
import { PageHeader } from "@/components/ums/page-header";

type CatalogCourse = Awaited<ReturnType<typeof listCourseCatalog>>[number];

export default function CourseCatalogPage() {
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    listCourseCatalog()
      .then(setCourses)
      .catch(() => toast.error("Failed to load courses"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const search = query.trim().toLowerCase();
  const filtered = search
    ? courses.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.code.toLowerCase().includes(search) ||
          (c.instructorName ?? "").toLowerCase().includes(search),
      )
    : courses;

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Course Catalog"
        subtitle="Every course offered at the institute. You can browse them here — enrolling is done by the administration."
        icon={<BookOpen className="size-7 text-primary" />}
        actions={
          <Link href="/courses">
            <Button variant="secondary" className="rounded-full">
              <GraduationCap className="size-4 mr-1" /> My Courses
            </Button>
          </Link>
        }
      />

      <div className="max-w-sm mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-on-surface-variant" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses or codes..."
            className="rounded-full pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-16 text-center">
            <BookOpen className="size-12 text-on-surface-variant/40 mx-auto mb-4" />
            <p className="text-base font-black text-on-surface">
              {search ? "No courses match that search" : "No courses published yet"}
            </p>
            <p className="text-sm text-on-surface-variant mt-1">
              {search
                ? "Try a different name or course code."
                : "Check back once the administration adds a course."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const body = (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <BookOpen className="size-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={c.isEnrolled ? "default" : "outline"}
                      className="rounded-full"
                    >
                      {c.isEnrolled ? "Enrolled" : "Locked"}
                    </Badge>
                    <Badge variant="secondary" className="rounded-full font-mono">
                      {c.code}
                    </Badge>
                  </div>
                </div>

                <p
                  className={`font-black text-on-surface text-lg ${
                    c.isEnrolled ? "group-hover:text-primary transition-colors" : ""
                  }`}
                >
                  {c.name}
                </p>
                <p className="text-xs text-on-surface-variant mt-1 line-clamp-3">
                  {c.description || c.instructorName || "No description"}
                </p>
                {c.term && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-2">
                    {c.term}
                  </p>
                )}

                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-outline-variant/40 text-[11px] font-bold text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <ClipboardList className="size-3.5" /> {c.quizCount} quiz
                    {c.quizCount === 1 ? "" : "zes"}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="size-3.5" /> {c.assignmentCount} assignment
                    {c.assignmentCount === 1 ? "" : "s"}
                  </span>
                </div>
              </>
            );

            return (
              <Card
                key={c.id}
                className="rounded-3xl border-outline-variant/60 hover:border-primary/40 transition-colors"
              >
                <CardContent className="p-5 flex flex-col h-full">
                  {c.isEnrolled ? (
                    <Link href={`/courses/${c.id}`} className="group flex-1">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex-1">{body}</div>
                  )}

                  <div className="mt-4 pt-3 border-t border-outline-variant/40">
                    {c.isEnrolled ? (
                      <Link href={`/courses/${c.id}`}>
                        <Button
                          variant="secondary"
                          className="w-full rounded-full"
                          size="sm"
                        >
                          Open
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full rounded-full"
                        size="sm"
                        disabled
                        title="Only the administration can enroll students"
                      >
                        <Lock className="size-3.5 mr-1" /> Not enrolled
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
