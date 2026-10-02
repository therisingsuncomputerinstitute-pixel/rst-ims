"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Signature, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FeeSlipList } from "@/components/ums/fee-slip-list";
import {
  createFeeSlip,
  deleteFeeSlip,
  getSignatureStatus,
  listCourses,
  listFeeSlips,
  listStudents,
  uploadSignature,
} from "@/server/ums";

type Slip = Awaited<ReturnType<typeof listFeeSlips>>[number];
type Course = Awaited<ReturnType<typeof listCourses>>[number];
type Student = Awaited<ReturnType<typeof listStudents>>[number];

/** Signatories in the same order they appear on the generated PDF. */
const SIGNATORIES = [
  { file: "shuja-uz-zaman.png", label: "Shuja Uz Zaman" },
  { file: "muhammad-hamza-sheikh.png", label: "Muhammad Hamza Sheikh" },
] as const;

/** Common reasons a student pays less than the original fee. */
const ADJUSTMENT_REASONS = [
  "Scholarship",
  "Fee waived",
  "Sibling discount",
  "Guardian concession",
  "Staff / family rate",
  "Partial month",
  "Approved reduction",
] as const;

/** Month label used by default, matching the "October 2026" style on the slip. */
function currentPeriod(): string {
  const now = new Date();
  return `${now.toLocaleString("en-US", { month: "long" })} ${now.getFullYear()}`;
}

export function PaymentsTab() {
  // One state object, set once when the loads resolve.
  const [data, setData] = useState<{
    slips: Slip[];
    courses: Course[];
    students: Student[];
    signatures: { name: string; uploaded: boolean }[];
  }>({ slips: [], courses: [], students: [], signatures: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const slips = data.slips;
  const courses = data.courses;
  const students = data.students;
  const signatures = data.signatures;

  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [originalFee, setOriginalFee] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(() => {
    Promise.all([listFeeSlips(), listCourses(), listStudents(), getSignatureStatus()])
      .then(([slips, courses, students, signatures]) => {
        setData({ slips, courses, students, signatures });
      })
      .catch(() => toast.error("Could not load fee slips"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const originalNum = Number(originalFee);
  const paidNum = Number(amountPaid);
  const hasBoth = originalFee !== "" && amountPaid !== "";
  const difference =
    hasBoth && Number.isFinite(originalNum) && Number.isFinite(paidNum)
      ? originalNum - paidNum
      : 0;

  const totalCollected = useMemo(
    () => slips.reduce((sum, s) => sum + s.amountPaid, 0),
    [slips],
  );
  const totalOutstanding = useMemo(
    () => slips.reduce((sum, s) => sum + s.balanceDue, 0),
    [slips],
  );

  const resetForm = () => {
    setStudentId("");
    setCourseId("");
    setPeriod(currentPeriod());
    setOriginalFee("");
    setAmountPaid("");
    setMethod("cash");
    setReference("");
    setAdjustmentReason("");
    setNotes("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !courseId || !period.trim()) {
      toast.error("Pick a student, a course and a billing period");
      return;
    }
    if (!hasBoth) {
      toast.error("Enter the original fee and the amount paid");
      return;
    }
    if (paidNum < originalNum && !adjustmentReason.trim()) {
      toast.error(
        "Say why the amount is lower — for example Scholarship or Fee waived. It appears on the slip.",
      );
      return;
    }

    setSaving(true);
    try {
      await createFeeSlip({
        studentId,
        courseId,
        period: period.trim(),
        originalFee: originalNum,
        amountPaid: paidNum,
        method,
        adjustmentReason: adjustmentReason.trim() || null,
        reference: reference.trim() || null,
        paidAt: paidAt ? new Date(paidAt).toISOString() : null,
        notes: notes.trim() || null,
      });
      toast.success("Fee slip created");
      resetForm();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the slip");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteFeeSlip(id);
      toast.success("Slip deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the slip");
    }
  };

  const onSignature = async (name: string, file?: File) => {
    if (!file) return;
    try {
      await uploadSignature({ signatory: name, file });
      toast.success("Signature saved");
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save the signature",
      );
    }
  };

  return (
    <div className="grid gap-6">
      <Card className="rounded-3xl border-outline-variant/60">
        <CardHeader>
          <CardTitle>Record a fee payment</CardTitle>
          <CardDescription>
            One slip per student, per course, per month. Enter exactly what the
            student paid — the amount is free-form, so a part payment or an advance
            is recorded as it happened.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="fs-student">Student</Label>
                <Select value={studentId} onValueChange={(v) => setStudentId(v ?? "")}>
                  <SelectTrigger id="fs-student">
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fs-course">Course</Label>
                <Select value={courseId} onValueChange={(v) => setCourseId(v ?? "")}>
                  <SelectTrigger id="fs-course">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="fs-period">Billing period</Label>
                <Input
                  id="fs-period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="October 2026"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fs-original">Original fee</Label>
                <Input
                  id="fs-original"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={originalFee}
                  onChange={(e) => setOriginalFee(e.target.value)}
                  placeholder="15000"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fs-paid">Amount paid</Label>
                <Input
                  id="fs-paid"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="12000"
                />
              </div>
            </div>

            {hasBoth && difference > 0 && (
              <div className="grid gap-3 rounded-2xl bg-surface-variant/40 px-4 py-3">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  The student is paying {difference.toLocaleString()} less than
                  the original fee. Choose the reason — it is printed on the slip
                  so the reduced amount is explained.
                </p>
                <div className="flex flex-wrap gap-2">
                  {ADJUSTMENT_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAdjustmentReason(r)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        adjustmentReason === r
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-outline-variant hover:bg-surface-variant/60"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fs-reason">Reason shown on the slip</Label>
                  <Input
                    id="fs-reason"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    placeholder="e.g. Scholarship awarded for the semester"
                  />
                </div>
              </div>
            )}

            {hasBoth && difference <= 0 && (
              <div className="rounded-2xl bg-surface-variant/40 px-4 py-3 text-sm">
                {difference < 0 ? (
                  <span className="text-sky-700 dark:text-sky-400">
                    {Math.abs(difference).toLocaleString()} will show as advance
                    paid on the slip.
                  </span>
                ) : (
                  <span className="text-on-surface-variant">
                    Paid in full.
                  </span>
                )}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="fs-method">Payment method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v ?? "")}>
                  <SelectTrigger id="fs-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fs-paid-at">Paid on</Label>
                <Input
                  id="fs-paid-at"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fs-ref">Reference (optional)</Label>
                <Input
                  id="fs-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Receipt number"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fs-notes">Note (optional)</Label>
              <Textarea
                id="fs-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note, e.g. paid by a guardian or via a friend."
                rows={2}
              />
            </div>

            <Button type="submit" disabled={saving} className="w-fit">
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create slip
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-outline-variant/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Signature className="size-5" />
            Signatures
          </CardTitle>
          <CardDescription>
            Upload a PNG of each authorised signature once. They are embedded in
            every generated slip; until then a printed name is shown instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {SIGNATORIES.map((s) => {
            const state = signatures.find((x) => x.name === s.file);
            return (
              <div
                key={s.file}
                className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/60 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-on-surface">
                    {s.label}
                  </p>
                  <Badge
                    variant={state?.uploaded ? "secondary" : "outline"}
                    className="mt-1"
                  >
                    {state?.uploaded ? "On file" : "Not uploaded"}
                  </Badge>
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/png"
                    className="hidden"
                    onChange={(e) => onSignature(s.file, e.target.files?.[0])}
                  />
                  <span className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-3 py-2 text-sm font-medium hover:bg-surface-variant/50">
                    <Upload className="size-4" />
                    Upload
                  </span>
                </label>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
            Fee slips
          </h2>
          <p className="text-xs text-on-surface-variant">
            {slips.length} slip{slips.length === 1 ? "" : "s"} · collected{" "}
            {totalCollected.toLocaleString()} collected ·{" "}
            {totalOutstanding.toLocaleString()} outstanding
          </p>
        </div>
        {loading ? (
          <div className="rounded-3xl border border-outline-variant/60 p-10 text-center text-sm text-on-surface-variant">
            Loading…
          </div>
        ) : (
          <FeeSlipList
            slips={slips}
            onDelete={remove}
            emptyMessage="No fee slips recorded yet."
          />
        )}
      </div>
    </div>
  );
}