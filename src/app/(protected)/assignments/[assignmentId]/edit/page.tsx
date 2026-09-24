"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getAssignment,
  updateAssignment,
  uploadAssignmentAttachment,
  removeAssignmentAttachment,
  getAssignmentAttachmentUrl,
} from "@/server/ums";
import {
  AssignmentAttachment,
  AttachmentRow,
  NewFileDraft,
  PendingFilesEditor,
} from "@/components/ums/assignment-files";
import { format } from "date-fns";
import { PageHeader } from "@/components/ums/page-header";

export default function EditAssignmentPage() {
  const params = useParams<{ assignmentId: string }>();
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [attachments, setAttachments] = useState<AssignmentAttachment[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<NewFileDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAssignment(params.assignmentId)
      .then((d: any) => {
        const a = d.assignment;
        setForm({
          title: a.title,
          description: a.description || "",
          instructions: a.instructions || "",
          maxScore: String(a.maxScore),
          dueAt: a.dueAt ? format(new Date(a.dueAt), "yyyy-MM-dd'T'HH:mm") : "",
        });
        setAttachments((a.attachments ?? []) as AssignmentAttachment[]);
      })
      .catch((e: any) => toast.error(e.message || "Failed to load assignment"));
  }, [params.assignmentId]);

  const set = (k: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((f: any) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.title.trim()) return toast.error("Title is required.");
    const maxScore = Number(form.maxScore);
    if (!Number.isFinite(maxScore) || maxScore <= 0)
      return toast.error("Max score must be a positive number.");
    setSaving(true);
    try {
      await updateAssignment(params.assignmentId, {
        title: form.title,
        description: form.description,
        instructions: form.instructions,
        maxScore,
        dueAt: form.dueAt || null,
      });
      for (const id of removed) {
        await removeAssignmentAttachment(id);
      }
      for (const d of newFiles) {
        const fd = new FormData();
        fd.append("file", d.file);
        await uploadAssignmentAttachment(params.assignmentId, d.kind, fd);
      }
      toast.success("Assignment updated");
      router.push(`/assignments/${params.assignmentId}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update assignment");
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="p-4 md:p-8 max-w-3xl space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <PageHeader
        backHref={`/assignments/${params.assignmentId}`}
        title="Edit Assignment"
        subtitle="Update the assignment details."
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
                <Label htmlFor="as-due">Due date</Label>
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
                className="mt-1.5 min-h-20"
              />
            </div>
            <div>
              <Label htmlFor="as-inst">Instructions</Label>
              <Textarea
                id="as-inst"
                value={form.instructions}
                onChange={set("instructions")}
                className="mt-1.5 min-h-20"
              />
            </div>
            <div>
              <Label>Attached files</Label>
              {attachments.length > 0 && (
                <div className="mt-1.5 space-y-2">
                  {attachments.map((att) => (
                    <AttachmentRow
                      key={att.id}
                      attachment={att}
                      onDownload={async () => {
                        try {
                          const url = await getAssignmentAttachmentUrl(att.id);
                          if (url) window.open(url, "_blank", "noopener,noreferrer");
                        } catch (err: any) {
                          toast.error(err.message || "Could not open file");
                        }
                      }}
                      onRemove={() => {
                        setAttachments((a) => a.filter((x) => x.id !== att.id));
                        setRemoved((r) => [...r, att.id]);
                      }}
                    />
                  ))}
                </div>
              )}
              <div className="mt-3 rounded-2xl border border-outline-variant/50 p-4">
                <PendingFilesEditor files={newFiles} setFiles={setNewFiles} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link href={`/assignments/${params.assignmentId}`}>
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
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}