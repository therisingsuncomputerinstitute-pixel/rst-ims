"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createCourse } from "@/server/ums";
import { PageHeader } from "@/components/ums/page-header";

export default function NewCoursePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    instructorName: "",
    term: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    setBusy(true);
    try {
      const created = await createCourse(form);
      toast.success("Course created");
      router.push(`/courses/${created.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to create course");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <PageHeader
        backHref="/courses"
        title="New Course"
        subtitle="Create a course to group quizzes, assignments and enrollments."
        icon={<BookOpen className="size-7 text-primary" />}
      />
      <Card className="rounded-3xl border-outline-variant/60">
        <CardHeader>
          <CardTitle>Course details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-5">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="name">Course name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="e.g. Calculus I"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="code">Course code</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={set("code")}
                  placeholder="e.g. MATH-101"
                  className="mt-1.5 font-mono uppercase"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="instructor">Instructor</Label>
              <Input
                id="instructor"
                value={form.instructorName}
                onChange={set("instructorName")}
                placeholder="e.g. Dr. Ali Raza"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="term">Term</Label>
              <Input
                id="term"
                value={form.term}
                onChange={set("term")}
                placeholder="e.g. Fall 2026"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={set("description")}
                placeholder="Brief overview of what this course covers."
                className="mt-1.5 min-h-24"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link href="/courses">
                <Button type="button" variant="ghost" className="rounded-full">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" className="rounded-full" disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin mr-1" />
                ) : (
                  <Save className="size-4 mr-1" />
                )}
                Create course
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}