"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Check,
  Clock,
  Loader2,
  Plus,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  createAttendanceSession,
  deleteAttendanceSession,
  getAttendanceSheet,
  listAttendanceSessions,
  saveAttendance,
} from "@/server/ums";

type Session = Awaited<ReturnType<typeof listAttendanceSessions>>[number];
type Sheet = Awaited<ReturnType<typeof getAttendanceSheet>>;
type Status = "present" | "absent" | "late" | "excused";

/** Class-length shortcuts; the dialog also takes a custom number. */
const DURATION_PRESETS = [30, 45, 60, 90, 120, 180] as const;

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

const STATUS_OPTIONS: { value: Status; label: string; hint: string }[] = [
  { value: "present", label: "Present", hint: "P" },
  { value: "late", label: "Late", hint: "L" },
  { value: "absent", label: "Absent", hint: "A" },
  { value: "excused", label: "Excused", hint: "E" },
];

const STATUS_STYLES: Record<Status, string> = {
  present: "text-emerald-500",
  late: "text-amber-500",
  absent: "text-destructive",
  excused: "text-on-surface-variant",
};

const statusCounts = (counts: Record<string, number>) =>
  STATUS_OPTIONS.reduce(
    (acc, o) => ({ ...acc, [o.value]: counts[o.value] ?? 0 }),
    {} as Record<Status, number>,
  );

/** `datetime-local` wants a local "YYYY-MM-DDTHH:mm" string, not an ISO UTC one. */
const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

export function AttendanceTab({ courseId }: { courseId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listAttendanceSessions(courseId)
      .then(setSessions)
      .catch(() => toast.error("Could not load attendance"))
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(load, [load]);

  return (
    <Card className="rounded-3xl border-outline-variant/60">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="size-4 text-primary" /> Attendance
          </CardTitle>
          <CardDescription className="mt-1">
            Create a class, then tick the roster while it runs. Students see
            their own attendance only — nobody can mark themselves present.
          </CardDescription>
        </div>
        <Button className="rounded-full shrink-0" onClick={() => setOpen(true)}>
          <Plus className="size-4 mr-1" /> New class
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-outline-variant/50 p-8 text-center">
            <Loader2 className="size-4 animate-spin mx-auto text-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant/50 p-8 text-center">
            <p className="text-sm text-on-surface-variant">
              No classes yet. Create one to take attendance.
            </p>
          </div>
        ) : (
          sessions.map((s) => (
            <SessionRow key={s.id} session={s} onChanged={load} />
          ))
        )}
      </CardContent>

      <NewSessionDialog
        courseId={courseId}
        open={open}
        onOpenChange={setOpen}
        busy={busy}
        setBusy={setBusy}
        onCreated={load}
      />
    </Card>
  );
}

function SessionRow({
  session,
  onChanged,
}: {
  session: Session;
  onChanged: () => void;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const counts = useMemo(() => statusCounts(session.counts), [session.counts]);

  const openSheet = async () => {
    try {
      setSheet(await getAttendanceSheet(session.id));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteAttendanceSession(session.id);
      toast.success("Class deleted");
      setConfirm(false);
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-outline-variant/60 bg-surface-container p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-on-surface truncate">{session.title}</p>
            {session.isOpenNow ? (
              <Badge className="rounded-full bg-emerald-500/15 text-emerald-500">
                <span className="size-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                Running now
              </Badge>
            ) : (
              <Badge variant="secondary" className="rounded-full">
                <Clock className="size-3 mr-1" />
                {new Date(session.startsAt) > new Date()
                  ? "Upcoming"
                  : "Closed"}
              </Badge>
            )}
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            {format(new Date(session.startsAt), "EEE d MMM, HH:mm")} ·{" "}
            {session.durationMinutes} min ·{" "}
            {format(new Date(session.startsAt), "HH:mm")}–
            {format(new Date(session.closesAt), "HH:mm")}
          </p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {STATUS_OPTIONS.map((o) => (
              <span
                key={o.value}
                className={cn(
                  "text-xs font-bold",
                  counts[o.value] > 0
                    ? STATUS_STYLES[o.value]
                    : "text-on-surface-variant/50",
                )}
              >
                {o.hint} {counts[o.value]}
              </span>
            ))}
            <span className="text-xs text-on-surface-variant">
              {session.marked} of {session.marked === 1 ? "1 marked" : "marked"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button size="sm" className="rounded-full" onClick={openSheet}>
            <Users className="size-4 mr-1" /> Take attendance
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-on-surface-variant hover:text-destructive"
            onClick={() => setConfirm(true)}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {confirm && (
        <Dialog open onOpenChange={setConfirm}>
          <DialogContent className="rounded-3xl max-w-md">
            <DialogHeader>
              <DialogTitle>Delete this class?</DialogTitle>
              <DialogDescription>
                &ldquo;{session.title}&rdquo; and every attendance mark for it will
                be removed. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={() => setConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="rounded-full"
                onClick={remove}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="size-4 mr-1" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {sheet && (
        <RosterDialog
          sheet={sheet}
          onClose={() => setSheet(null)}
          onSaved={onChanged}
        />
      )}
    </>
  );
}

function RosterDialog({
  sheet,
  onClose,
  onSaved,
}: {
  sheet: Sheet;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [marks, setMarks] = useState<Record<string, Status | "">>(() => {
    const seed: Record<string, Status | ""> = {};
    for (const s of sheet.students) seed[s.id] = s.status ?? "";
    return seed;
  });
  const [saving, setSaving] = useState(false);

  const setMark = (id: string, value: string) =>
    setMarks((m) => ({ ...m, [id]: value as Status | "" }));

  const markAll = (value: Status) =>
    setMarks(Object.fromEntries(sheet.students.map((s) => [s.id, value])));

  const markedCount = Object.values(marks).filter(Boolean).length;
  const dirty = sheet.students.some((s) => (marks[s.id] || "") !== (s.status ?? ""));

  const save = async () => {
    setSaving(true);
    try {
      const entries = sheet.students
        .filter((s) => marks[s.id])
        .map((s) => ({ studentId: s.id, status: marks[s.id] as string }));
      const result = await saveAttendance(sheet.session.id, entries);
      toast.success(`Attendance saved · ${result.saved} student${result.saved === 1 ? "" : "s"}`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl max-w-2xl">
        <DialogHeader>
          <DialogTitle>{sheet.session.title}</DialogTitle>
          <DialogDescription>
            {format(new Date(sheet.session.startsAt), "EEEE d MMMM, HH:mm")} ·{" "}
            {sheet.session.durationMinutes} min
          </DialogDescription>
        </DialogHeader>

        {sheet.students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant/50 p-8 text-center">
            <p className="text-sm text-on-surface-variant">
              Nobody is enrolled in this course yet.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Mark all
              </span>
              {STATUS_OPTIONS.map((o) => (
                <Button
                  key={o.value}
                  variant="outline"
                  size="sm"
                  className={cn("rounded-full", STATUS_STYLES[o.value])}
                  onClick={() => markAll(o.value)}
                >
                  {o.label}
                </Button>
              ))}
            </div>

            <div className="max-h-[45vh] overflow-y-auto grid gap-2 pr-1">
              {sheet.students.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/60 bg-surface-container px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">
                      {s.name}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate">
                      {s.email}
                    </p>
                  </div>
                  <Select
                    value={marks[s.id] || "unset"}
                    onValueChange={(v) => setMark(s.id, v ?? "")}
                  >
                    <SelectTrigger
                      className="rounded-full w-[9.5rem] shrink-0"
                      aria-label={`Attendance for ${s.name}`}
                    >
                      <SelectValue placeholder="Not marked" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter className="items-center sm:items-center">
          <p className="text-xs text-on-surface-variant mr-auto">
            {markedCount} of {sheet.students.length} marked
          </p>
          <Button
            variant="ghost"
            className="rounded-full"
            onClick={onClose}
            disabled={saving}
          >
            Close
          </Button>
          <Button
            className="rounded-full"
            onClick={save}
            disabled={saving || sheet.students.length === 0}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <Check className="size-4 mr-1" />
            )}
            Save
          </Button>
        </DialogFooter>
        {dirty && !saving && (
          <p className="text-xs text-amber-500 flex items-center gap-1.5">
            <TriangleAlert className="size-3.5" />
            You have unsaved changes.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewSessionDialog({
  courseId,
  open,
  onOpenChange,
  busy,
  setBusy,
  onCreated,
}: {
  courseId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date()));
  const [duration, setDuration] = useState<number | "custom">("custom");
  const [custom, setCustom] = useState("60");
  const [created, setCreated] = useState<{ title: string } | null>(
    null,
  );

  const reset = () => {
    setTitle("");
    setStartsAt(toLocalInput(new Date()));
    setDuration("custom");
    setCustom("60");
    setCreated(null);
  };

  const durationMinutes = duration === "custom" ? Number(custom) : duration;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5) {
      return toast.error("Class length must be at least 5 minutes.");
    }
    setBusy(true);
    try {
      const session = await createAttendanceSession(courseId, {
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        durationMinutes,
      });
      setCreated({ title: session.title });
      onCreated();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="rounded-3xl max-w-lg">
        <DialogHeader>
          <DialogTitle>{created ? "Class created" : "New class"}</DialogTitle>
          <DialogDescription>
            {created
              ? "The class is created. Open Take attendance to tick the roster while it runs."
              : "Set when the class starts and how long it runs."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <>
            <div className="rounded-3xl border border-primary/30 bg-primary/5 p-8 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                Class created
              </p>
              <p className="text-2xl font-black text-primary mt-2">
                {created.title}
              </p>
            </div>
            <Button
              className="rounded-full"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Done
            </Button>
          </>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <div>
              <Label htmlFor="att-title">Class name (optional)</Label>
              <Input
                id="att-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lecture 3"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="att-start">Starts at</Label>
              <Input
                id="att-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1.5"
              />
              <p className="text-xs text-on-surface-variant mt-1.5">
                Check-in opens 15 minutes before this time and closes 15 minutes
                after the class ends.
              </p>
            </div>

            <div>
              <Label>Class length</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {DURATION_PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDuration(m)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm font-bold transition-colors",
                      duration === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-outline-variant/50 text-on-surface-variant hover:text-on-surface",
                    )}
                  >
                    {m < 60 ? `${m} min` : `${m / 60} hr`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDuration("custom")}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-bold transition-colors",
                    duration === "custom"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant/50 text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  Custom
                </button>
              </div>
              {duration === "custom" && (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    min={5}
                    max={480}
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    className="w-28"
                    aria-label="Custom class length in minutes"
                  />
                  <span className="text-sm text-on-surface-variant">
                    minutes
                  </span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full" disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin mr-1" />
                ) : (
                  <CalendarCheck className="size-4 mr-1" />
                )}
                Create class
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
