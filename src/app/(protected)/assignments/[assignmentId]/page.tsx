"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  CalendarDays,
  Rocket,
  Loader2,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Timer,
  GraduationCap,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { authClient } from "@/lib/auth-client";
import {
  getAssignment,
  submitAssignment,
  gradeSubmission,
  getSubmissionDownloadUrl,
  getAssignmentAttachmentUrl,
} from "@/server/ums";
import {
  AssignmentAttachment,
  AttachmentRow,
} from "@/components/ums/assignment-files";
import { letterForPercent } from "@/lib/grading";

type AssignmentData = Awaited<ReturnType<typeof getAssignment>>;

function toSafeDate(value: unknown): Date | null {
  const d = value ? new Date(value as string | number | Date) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function fmtDate(value: unknown, pattern: string): string {
  const d = toSafeDate(value);
  if (!d) return "-";
  try {
    return format(d, pattern);
  } catch {
    return "-";
  }
}

function letterColor(letter: string) {
  if (letter === "A") return "text-emerald-400";
  if (letter === "B") return "text-orange-400";
  if (letter === "C") return "text-amber-400";
  if (letter === "D") return "text-orange-600";
  return "text-rose-400";
}

async function openDownload(fn: () => Promise<string | null>) {
  try {
    const url = await fn();
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  } catch (e: any) {
    toast.error(e.message || "Could not open file");
  }
}

function AssignmentFiles({
  attachments,
  isAdmin = false,
}: {
  attachments: AssignmentAttachment[];
  isAdmin?: boolean;
}) {
  const instructions = attachments.filter((a) => a.kind === "instructions");
  const references = attachments.filter((a) => a.kind === "reference" || a.kind === "link");
  const answerKeys = attachments.filter((a) => a.kind === "answer_key");
  if (attachments.length === 0) return null;

  const section = (title: string, items: AssignmentAttachment[], isKeySection = false) =>
    items.length === 0 ? null : (
      <div className="mt-5">
        <p className={cn(
          "text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5",
          isKeySection ? "text-amber-500 font-bold" : "text-on-surface-variant"
        )}>
          {title}
        </p>
        <div className="space-y-2">
          {items.map((att) => (
            <AttachmentRow
              key={att.id}
              attachment={att}
              onDownload={() =>
                openDownload(() =>
                  getAssignmentAttachmentUrl(att.id).then((url) => {
                    if (url) {
                      window.open(url, "_blank", "noopener,noreferrer");
                      return null;
                    }
                    return url;
                  }),
                )
              }
            />
          ))}
        </div>
      </div>
    );

  return (
    <div>
      {section("Instructions", instructions)}
      {section("Resources", references)}
      {isAdmin && section("Answer Key (Admin Only)", answerKeys, true)}
    </div>
  );
}

export default function AssignmentPage() {
  const params = useParams<{ assignmentId: string }>();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";
  const assignmentId = params.assignmentId;

  const [data, setData] = useState<AssignmentData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getAssignment(assignmentId)
      .then(setData)
      .catch((e: any) => toast.error(e.message || "Failed to load assignment"))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  useEffect(() => {
    load();
  }, [load]);

  return <StudentOrAdmin assignmentId={assignmentId} data={data} loading={loading} isAdmin={isAdmin} reload={load} />;
}

function StudentOrAdmin({
  assignmentId,
  data,
  loading,
  isAdmin,
  reload,
}: {
  assignmentId: string;
  data: AssignmentData | null;
  loading: boolean;
  isAdmin: boolean;
  reload: () => void;
}) {
  if (loading && !data)
    return (
      <div className="p-4 md:p-8 space-y-4">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  if (!data) return null;

  if (isAdmin) {
    const subs = ((data as any).submissions ?? []) as any[];
    return (
      <AdminAssignmentView assignmentId={assignmentId} assignment={data.assignment} submissions={subs} reload={reload} />
    );
  }
  return (
    <StudentAssignmentView
      assignment={data.assignment}
      mySubmission={(data as any).mySubmission ?? null}
      reload={reload}
    />
  );
}

function StudentAssignmentView({
  assignment,
  mySubmission,
  reload,
}: {
  assignment: any;
  mySubmission: any;
  reload: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dueDate = toSafeDate(assignment.dueAt);

  const submit = async () => {
    if (!file) return toast.error("Please attach a file.");
    setSaving(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("comments", comments);
    try {
      await submitAssignment(assignment.id, fd);
      toast.success("Assignment submitted");
      setFile(null);
      setComments("");
      reload();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit assignment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <Card className="rounded-3xl border-outline-variant/60 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary to-orange-500" />
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="rounded-full font-mono">
              {assignment.course?.code}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {assignment.course?.name}
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface">
            {assignment.title}
          </h1>
          <div className="flex flex-wrap gap-4 mt-5">
            <span className="flex items-center gap-2 text-sm font-bold text-on-surface-variant">
              <Rocket className="size-4 text-primary" /> {assignment.maxScore} points
            </span>
            {dueDate ? (
              <span
                className={cn(
                  "flex items-center gap-2 text-sm font-bold",
                  dueDate < new Date() ? "text-rose-400" : "text-on-surface-variant",
                )}
              >
                <CalendarDays className="size-4" /> Due {fmtDate(dueDate, "MMM d, h:mm a")}
              </span>
            ) : null}
          </div>
          {assignment.description && (
            <p className="text-sm text-on-surface-variant mt-4">
              {assignment.description}
            </p>
          )}
          {assignment.instructions && (
            <div className="mt-5 rounded-2xl bg-surface-container-highest/60 p-4 text-sm text-on-surface-variant">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface mb-1">
                Instructions
              </p>
              {assignment.instructions}
            </div>
          )}
          <AssignmentFiles attachments={assignment.attachments ?? []} />
        </CardContent>
      </Card>

      {mySubmission ? (
        <SubmissionStatus
          submission={mySubmission}
          maxScore={assignment.maxScore}
        />
      ) : null}

      <Card className="rounded-3xl border-outline-variant/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-5 text-primary" />
            {mySubmission ? "Resubmit or update your work" : "Submit your work"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                setFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={cn(
                "rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-outline-variant/60",
              )}
            >
              {file ? (
                <div>
                  <FileText className="size-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-bold text-on-surface break-all">{file.name}</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · ready to upload
                  </p>
                </div>
              ) : (
                <div>
                  <Upload className="size-8 text-on-surface-variant/50 mx-auto mb-2" />
                  <p className="text-sm font-medium text-on-surface-variant">
                    Drag & drop your file here
                  </p>
                </div>
              )}
              <label className="inline-block mt-4">
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <span className="inline-flex items-center justify-center rounded-full border border-outline-variant px-4 py-2 text-xs font-bold text-on-surface hover:border-primary/40 cursor-pointer transition-colors">
                Choose file
              </span>
            </label>
            <p className="text-xs text-on-surface-variant">
              PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, ZIP, PNG, JPG, JPEG, HEIC,
              WebP, MP4, MOV up to 5 MB. You can resubmit to replace your file (the
              old file is removed).
            </p>
            </div>
            <div>
              <Label htmlFor="as-comments">Comments (optional)</Label>
              <Textarea
                id="as-comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Notes for your instructor…"
                className="mt-1.5 min-h-20"
              />
            </div>
            <Button
              onClick={submit}
              disabled={saving}
              className="rounded-full w-full md:w-auto"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin mr-1" />
              ) : (
                <Upload className="size-4 mr-1" />
              )}
                {mySubmission
                  ? mySubmission.resubmitted
                    ? "Resubmit assignment"
                    : "Update submission"
                  : "Submit assignment"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SubmissionStatus({
  submission,
  maxScore,
}: {
  submission: any;
  maxScore: number;
}) {
  const graded = submission.status === "graded";
  const submittedAt = toSafeDate(submission.createdAt);
  const pct =
    graded && maxScore > 0
      ? Math.round((submission.grade / maxScore) * 100)
      : null;
  const letter = pct != null ? letterForPercent(pct) : null;

  return (
    <Card className="rounded-3xl border-outline-variant/60">
      <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {graded ? (
              <CheckCircle2 className="size-5 text-emerald-400" />
            ) : pct === null ? (
              <Timer className="size-5 text-amber-400" />
            ) : (
              <XCircle className="size-5 text-rose-400" />
            )}
            <p
              className={cn(
                "text-[10px] font-black uppercase tracking-widest",
                graded ? "text-emerald-400" : "text-amber-500",
              )}
            >
              {graded ? "Graded" : "Submitted · awaiting grade"}
            </p>
          </div>
          <p className="text-sm font-bold text-on-surface mt-1">
            {submission.fileName}
          </p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Submitted {fmtDate(submittedAt, "MMM d, h:mm a")}
            {submission.resubmitted && submission.resubmittedAt && (
              <> · Resubmitted {fmtDate(submission.resubmittedAt, "MMM d, h:mm a")}</>
            )}
            {submission.comments && ` · “${submission.comments}”`}
          </p>
          {submission.fileUrl && (
            <button
              onClick={() =>
                openDownload(() => getSubmissionDownloadUrl(submission.id))
              }
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary mt-2 hover:underline"
            >
              <Download className="size-3.5" /> View / Download submission
            </button>
          )}
        </div>
        {graded && (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-black text-on-surface">
                {submission.grade}
                <span className="text-lg text-on-surface-variant">
                  /{maxScore}
                </span>
              </p>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                Score
              </p>
            </div>
            <div className="text-center">
              <p className={cn("text-3xl font-black", letter ? letterColor(letter) : "")}>
                {pct != null ? `${pct}%` : "--"}
              </p>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                {letter ?? "Percent"}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminAssignmentView({
  assignmentId,
  assignment,
  submissions,
  reload,
}: {
  assignmentId: string;
  assignment: any;
  submissions: any[];
  reload: () => void;
}) {
  const [gradeTarget, setGradeTarget] = useState<any>(null);
  const [gradeVal, setGradeVal] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const dueDate = toSafeDate(assignment.dueAt);

  useEffect(() => {
    if (gradeTarget) setGradeVal(gradeTarget.grade ?? 0);
  }, [gradeTarget]);

  const saveGrade = async () => {
    if (!gradeTarget) return;
    if (gradeVal < 0 || gradeVal > assignment.maxScore)
      return toast.error(`Grade must be between 0 and ${assignment.maxScore}.`);
    setSaving(true);
    try {
      await gradeSubmission(gradeTarget.id, gradeVal, feedback);
      toast.success("Grade saved");
      setGradeTarget(null);
      setFeedback("");
      reload();
    } catch (e: any) {
      toast.error(e.message || "Failed to save grade");
    } finally {
      setSaving(false);
    }
  };

  const graded = submissions.filter((s) => s.status === "graded").length;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <Card className="rounded-3xl border-outline-variant/60 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary to-orange-500" />
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="rounded-full font-mono">
              {assignment.course?.code}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {assignment.course?.name}
            </Badge>
            {assignment.isPublished ? (
              <Badge className="rounded-full text-emerald-500" variant="secondary">
                <CheckCircle2 className="size-3 mr-1" /> Published
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full">
                Draft
              </Badge>
            )}
            {assignment.assignedStudentIds && assignment.assignedStudentIds.length > 0 ? (
              <Badge variant="secondary" className="rounded-full text-xs font-normal">
                <Users className="size-3 mr-1" /> {assignment.assignedStudentIds.length} student{assignment.assignedStudentIds.length === 1 ? "" : "s"} assigned
              </Badge>
            ) : (
              <Badge variant="secondary" className="rounded-full text-xs font-normal">
                <Users className="size-3 mr-1" /> All enrolled students
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-on-surface">
            {assignment.title}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {assignment.maxScore} points
            {dueDate ? ` · due ${fmtDate(dueDate, "MMM d, h:mm a")}` : ""}
          </p>
          <div className="flex items-center gap-2 mt-4">
            <Link href={`/assignments/${assignmentId}/edit`}>
              <Button variant="outline" size="sm" className="rounded-full">
                Edit assignment
              </Button>
            </Link>
          </div>
          <AssignmentFiles attachments={assignment.attachments ?? []} isAdmin={true} />
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-outline-variant/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" />
            Submissions ({submissions.length})
            <Badge variant="secondary" className="rounded-full ml-2">
              {graded} graded
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-10">
              No submissions yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {submissions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-outline-variant/60 bg-surface-container-highest/20 p-4 transition-all hover:border-outline-variant"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-black text-primary">
                          {s.user?.name?.slice(0, 2).toUpperCase() ?? "?"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-on-surface">
                            {s.user?.name ?? "Student"}
                          </p>
                          <span className="text-xs text-on-surface-variant font-mono">
                            ({s.user?.email})
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          Submitted {fmtDate(s.createdAt, "MMM d, yyyy h:mm a")}
                          {s.resubmitted && s.resubmittedAt && (
                            <span className="text-amber-500 font-semibold ml-1.5">
                              · Resubmitted {fmtDate(s.resubmittedAt, "MMM d, h:mm a")}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {s.status === "graded" ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="rounded-full text-emerald-500 font-mono px-3 py-1">
                            {s.grade}/{assignment.maxScore}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full text-xs"
                            onClick={() => {
                              setGradeTarget(s);
                              setGradeVal(s.grade ?? 0);
                            }}
                          >
                            Edit Grade
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="rounded-full px-5 text-xs font-bold"
                          onClick={() => {
                            setGradeTarget(s);
                            setGradeVal(s.grade ?? 0);
                          }}
                        >
                          Grade Submission
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Prominent File & Link Access Box */}
                  <div className="mt-3.5 pt-3 border-t border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container/60 rounded-xl p-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                        <FileText className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">
                          {s.fileName ?? "Submission file"}
                        </p>
                        <p className="text-[11px] text-on-surface-variant">
                          Click download to view student&apos;s submitted work
                        </p>
                      </div>
                    </div>
                    {(s.fileUrl || s.fileName) ? (
                      <Button
                        size="sm"
                        variant="default"
                        className="rounded-full shrink-0 shadow-sm"
                        onClick={() => openDownload(() => getSubmissionDownloadUrl(s.id))}
                      >
                        <Download className="size-4 mr-1.5" />
                        Download File
                      </Button>
                    ) : (
                      <span className="text-xs text-on-surface-variant italic">No file attached</span>
                    )}
                  </div>

                  {s.comments && (
                    <div className="mt-2.5 rounded-xl bg-surface-container-highest/40 p-2.5 text-xs text-on-surface-variant">
                      <span className="font-bold text-on-surface mr-1">Student Notes:</span>
                      &ldquo;{s.comments}&rdquo;
                    </div>
                  )}
                  {s.feedback && (
                    <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                      <span className="font-bold mr-1">Instructor Feedback:</span>
                      &ldquo;{s.feedback}&rdquo;
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {gradeTarget && (
        <Dialog open={!!gradeTarget} onOpenChange={(o) => !o && setGradeTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grade submission</DialogTitle>
              <DialogDescription>
                {gradeTarget.user?.name}
                {gradeTarget.resubmitted && gradeTarget.resubmittedAt && (
                  <> · Resubmitted {fmtDate(gradeTarget.resubmittedAt, "MMM d, h:mm a")}</>
                )}
                {" · "}{gradeTarget.fileName}
                {gradeTarget.fileUrl && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      onClick={() =>
                        openDownload(() =>
                          getSubmissionDownloadUrl(gradeTarget.id),
                        )
                      }
                      className="text-primary hover:underline"
                    >
                      open file
                    </button>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="gv">Score (out of {assignment.maxScore})</Label>
                <Input
                  id="gv"
                  type="number"
                  min={0}
                  max={assignment.maxScore}
                  value={gradeVal}
                  onChange={(e) => setGradeVal(Number(e.target.value))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="gf">Feedback (optional)</Label>
                <Textarea
                  id="gf"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Comments for the student…"
                  className="mt-1.5 min-h-20"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={saveGrade} disabled={saving} className="rounded-full">
                {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Save grade
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}