"use client";

import { useRef, type Dispatch, type SetStateAction } from "react";
import { FileText, Plus, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AssignmentAttachmentKind = "instructions" | "reference";

export const ATTACHMENT_KIND_LABELS: Record<AssignmentAttachmentKind, string> = {
  instructions: "Instructions",
  reference: "Reference",
};

export type AssignmentAttachment = {
  id: string;
  kind: AssignmentAttachmentKind;
  fileName: string;
  fileSize: number | null;
  createdAt: Date;
};

export type NewFileDraft = {
  key: string;
  file: File;
  kind: AssignmentAttachmentKind;
};

export function newFileKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function fileSizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function PendingFilesEditor({
  files,
  setFiles,
}: {
  files: NewFileDraft[];
  setFiles: Dispatch<SetStateAction<NewFileDraft[]>>;
}) {
  const addedRef = useRef<number>(0);

  const appendFile = (file: File) => {
    setFiles((prev) => [
      ...prev,
      {
        key: newFileKey(),
        file,
        kind: "reference" as AssignmentAttachmentKind,
      },
    ]);
    addedRef.current += 1;
  };

  return (
    <div className="space-y-3">
      {files.length === 0 && (
        <p className="text-xs text-on-surface-variant">
          No files attached yet. Add an instructions PDF, reference material, or
          any other format.
        </p>
      )}
      {files.map((d) => (
        <div
          key={d.key}
          className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/50 p-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="size-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-on-surface truncate">
                {d.file.name}
              </p>
              <p className="text-xs text-on-surface-variant">
                {fileSizeLabel(d.file.size)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select
              value={d.kind}
              onValueChange={(v) => {
                const kind =
                  v === "instructions" ? "instructions" : "reference";
                setFiles((prev) =>
                  prev.map((p) => (p.key === d.key ? { ...p, kind } : p)),
                );
              }}
            >
              <SelectTrigger className="w-36 h-9 text-xs rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instructions">Instructions</SelectItem>
                <SelectItem value="reference">Reference</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full size-8 shrink-0"
              onClick={() =>
                setFiles((prev) => prev.filter((p) => p.key !== d.key))
              }
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ))}
      <label className="inline-flex items-center justify-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-xs font-bold text-on-surface hover:border-primary/40 cursor-pointer transition-colors">
        <Plus className="size-4" />
        Add file
        <input
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) appendFile(f);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

export function AttachmentRow({
  attachment,
  onDownload,
  onRemove,
}: {
  attachment: AssignmentAttachment;
  onDownload: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/50 p-3.5">
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="size-5 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-on-surface truncate">
            {attachment.fileName}
          </p>
          <p className="text-xs text-on-surface-variant">
            {ATTACHMENT_KIND_LABELS[attachment.kind]}
            {attachment.fileSize ? ` · ${fileSizeLabel(attachment.fileSize)}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={onDownload}
        >
          <Download className="size-4 mr-1" /> Download
        </Button>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full size-8 shrink-0 text-on-surface-variant hover:text-destructive"
            onClick={onRemove}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}