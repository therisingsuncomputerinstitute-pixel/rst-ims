"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createAssignment, uploadAssignmentAttachment } from "@/server/ums";
import {
  NewFileDraft,
  PendingFilesEditor,
} from "@/components/ums/assignment-files";
import { PageHeader } from "@/components/ums/page-header";

export default function NewAssignmentPage() {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<NewFileDraft[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    instructions: "",
    maxScore: "10",
    dueAt: "",
  });

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required.");
    const maxScore = Number(form.maxScore);
    if (!Number.isFinite(maxScore) || maxScore <= 0)
      return toast.error("Max score must be a positive number.");
    setSaving(true);
    try {
      const created = await createAssignment({
        courseId: params.courseId,
        title: form.title,
        description: form.description,
        instructions: form.instructions,
        maxScore,
        dueAt: form.dueAt || null,
      });
      for (const d of files) {
        const fd = new FormData();
        fd.append("file", d.file);
        await uploadAssignmentAttachment(created.id, d.kind, fd);
      }
      toast.success("Assignment created");
      router.push(`/assignments/${created.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to create assignment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <PageHeader
        backHref={`/courses/${params.courseId}`}
        title="New Assignment"
        subtitle="Create an assignment students can submit files to."
        icon={<FileText className="size-7 text-primary" />}
      />
      <Card className="rounded-3xl border-outline-variant/60">
        <CardHeader>
          <CardTitle>Assignment details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-5">
            <div>
              <Label htmlFor="as-title">Title</Label>
              <Input
                id="as-title"
                value={form.title}
                onChange={set("title")}
                placeholder="e.g. Problem Set 3"
                className="mt-1.5"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="as-max">Max score</Label>
                <Input
                  id="as-max"
                  type="number"
                  min={1}
                  value={form.maxScore}
                  onChange={set("maxScore")}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="as-due">Due date (optional)</Label>
                <Input
                  id="as-due"
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={set("dueAt")}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="as-desc">Description</Label>
              <Textarea
                id="as-desc"
                value={form.description}
                onChange={set("description")}
                placeholder="Short summary shown to students."
                className="mt-1.5 min-h-20"
              />
            </div>
            <div>
              <Label htmlFor="as-inst">Instructions</Label>
              <Textarea
                id="as-inst"
                value={form.instructions}
                onChange={set("instructions")}
                placeholder="Submission requirements, formatting, etc."
                className="mt-1.5 min-h-20"
              />
            </div>
            <div>
              <Label>Attached files (instructions PDF, references, etc. — optional)</Label>
              <div className="mt-1.5 rounded-2xl border border-outline-variant/50 p-4">
                <PendingFilesEditor files={files} setFiles={setFiles} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link href={`/courses/${params.courseId}`}>
                <Button type="button" variant="ghost" className="rounded-full">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" className="rounded-full" disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin mr-1" />
                ) : (
                  <Save className="size-4 mr-1" />
                )}
                Create assignment
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}