"use client";

import { useEffect, useState } from "react";
import { Users, UserCheck, Search, CheckSquare, Square } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { listEnrolledStudents } from "@/server/ums";

type Student = {
  id: string;
  name: string;
  email: string;
};

export function StudentAssignSelector({
  courseId,
  value,
  onChange,
  label = "Assign to students",
}: {
  courseId: string;
  value: string[] | null | undefined;
  onChange: (val: string[] | null) => void;
  label?: string;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const isSpecific = Array.isArray(value) && value.length > 0;
  const selectedIds = new Set(Array.isArray(value) ? value : []);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    listEnrolledStudents(courseId)
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [courseId]);

  const toggleStudent = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next.size === 0 ? [] : Array.from(next));
  };

  const selectAll = () => {
    onChange(students.map((s) => s.id));
  };

  const deselectAll = () => {
    onChange([]);
  };

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{label}</Label>
        {isSpecific && (
          <Badge variant="secondary" className="rounded-full text-xs font-normal">
            {selectedIds.size} of {students.length} students selected
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3",
            !isSpecific
              ? "border-primary bg-primary/10 ring-1 ring-primary"
              : "border-outline-variant/60 hover:border-primary/40 bg-surface-container",
          )}
        >
          <div
            className={cn(
              "p-2 rounded-xl shrink-0 mt-0.5",
              !isSpecific
                ? "bg-primary text-primary-foreground"
                : "bg-surface-container-highest text-on-surface-variant",
            )}
          >
            <Users className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-on-surface">All enrolled students</p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Available to everyone currently enrolled in this course.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!isSpecific) {
              onChange([]);
            }
          }}
          className={cn(
            "p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3",
            isSpecific
              ? "border-primary bg-primary/10 ring-1 ring-primary"
              : "border-outline-variant/60 hover:border-primary/40 bg-surface-container",
          )}
        >
          <div
            className={cn(
              "p-2 rounded-xl shrink-0 mt-0.5",
              isSpecific
                ? "bg-primary text-primary-foreground"
                : "bg-surface-container-highest text-on-surface-variant",
            )}
          >
            <UserCheck className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-on-surface">Specific students</p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Target individual students at their current pace.
            </p>
          </div>
        </button>
      </div>

      {isSpecific && (
        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="relative flex-1 min-w-44">
              <Search className="size-3.5 text-on-surface-variant absolute left-3 top-2.5" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students…"
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs rounded-full"
                onClick={selectAll}
              >
                <CheckSquare className="size-3.5 mr-1" /> Select all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs rounded-full"
                onClick={deselectAll}
              >
                <Square className="size-3.5 mr-1" /> Clear
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-9 w-full rounded-xl" />
              <Skeleton className="h-9 w-full rounded-xl" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          ) : students.length === 0 ? (
            <p className="text-xs text-on-surface-variant py-4 text-center">
              No students are enrolled in this course yet.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-on-surface-variant py-4 text-center">
              No students match &ldquo;{search}&rdquo;.
            </p>
          ) : (
            <div className="max-h-60 overflow-y-auto divide-y divide-outline-variant/40 pr-1">
              {filtered.map((s) => {
                const selected = selectedIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleStudent(s.id)}
                    className={cn(
                      "w-full text-left py-2 px-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors",
                      selected
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-surface-container-highest text-on-surface",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">{s.name}</p>
                      <p className="text-[11px] text-on-surface-variant truncate">
                        {s.email}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "size-4 rounded border flex items-center justify-center text-[10px] font-black transition-colors shrink-0",
                        selected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-outline-variant text-transparent",
                      )}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedIds.size === 0 && (
            <p className="text-[11px] text-amber-500 font-medium">
              ⚠️ Please select at least one student, or choose &ldquo;All enrolled students&rdquo;.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
