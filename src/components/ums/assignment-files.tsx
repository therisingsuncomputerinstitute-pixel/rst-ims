"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { FileText, Plus, X, Download, Trash2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ums/confirm-delete";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AssignmentAttachmentKind = "instructions" | "reference" | "link" | "answer_key";

export const ATTACHMENT_KIND_LABELS: Record<AssignmentAttachmentKind, string> = {
  instructions: "Instructions",
  reference: "Reference",
  link: "Link",
  answer_key: "Answer Key",
};

export type AssignmentAttachment = {
  id: string;
  kind: AssignmentAttachmentKind;
  fileName: string;
  fileSize: number | null;
  createdAt: Date;
  url?: string | null;
};

export type DraftAttachmentKind = "instructions" | "reference" | "answer_key";

export type NewFileDraft = {
  key: string;
  file: File;
  kind: DraftAttachmentKind;
};

export type NewLinkDraft = {
  key: string;
  title: string;
  url: string;
  kind: DraftAttachmentKind;
};

function parseDraftKind(v: string | null): DraftAttachmentKind {
  return v === "instructions" || v === "answer_key" ? v : "reference";
}

export type NewAttachmentDraft =
  | ({ type: "file" } & NewFileDraft)
  | ({ type: "link" } & NewLinkDraft);

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
  links,
  setLinks,
}: {
  files: NewFileDraft[];
  setFiles: Dispatch<SetStateAction<NewFileDraft[]>>;
  links?: NewLinkDraft[];
  setLinks?: Dispatch<SetStateAction<NewLinkDraft[]>>;
}) {
  const addedRef = useRef<number>(0);
  const [open, setOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkKind, setLinkKind] = useState<DraftAttachmentKind>("reference");

  const appendFile = (file: File) => {
    setFiles((prev) => [
      ...prev,
      {
        key: newFileKey(),
        file,
        kind: "reference",
      },
    ]);
    addedRef.current += 1;
  };

  const addLink = () => {
    if (!setLinks) return;
    if (!linkTitle.trim()) return;
    if (!linkUrl.trim()) return;
    setLinks((prev) => [
      ...(prev ?? []),
      {
        key: newFileKey(),
        title: linkTitle.trim(),
        url: linkUrl.trim(),
        kind: linkKind,
      },
    ]);
    setLinkTitle("");
    setLinkUrl("");
    setLinkKind("reference");
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      {links && links.length > 0 && (
        <div className="space-y-2">
          {links.map((d) => (
            <div
              key={d.key}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-outline-variant/50 p-4 overflow-hidden"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                <LinkIcon className="size-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-sm font-bold text-on-surface truncate">
                    {d.title}
                  </p>
                  <p className="text-xs text-on-surface-variant truncate block max-w-full">
                    {ATTACHMENT_KIND_LABELS[d.kind]} · {d.url.replace(/^https?:\/\//, "").slice(0, 50)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Select
                  value={d.kind}
                  onValueChange={(v) => {
                    const kind = parseDraftKind(v);
                    if (!setLinks) return;
                    setLinks((prev) =>
                      (prev ?? []).map((p) => (p.key === d.key ? { ...p, kind } : p)),
                    );
                  }}
                >
                  <SelectTrigger className="w-36 h-9 text-xs rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instructions">Instructions</SelectItem>
                    <SelectItem value="reference">Reference</SelectItem>
                    <SelectItem value="answer_key">Answer Key</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full size-8 shrink-0"
                  onClick={() => {
                    if (setLinks) {
                      setLinks((prev) => (prev ?? []).filter((p) => p.key !== d.key));
                    }
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {files.length === 0 && (!links || links.length === 0) && (
        <p className="text-xs text-on-surface-variant">
          No files or links attached yet. Add an instructions PDF, reference material,
          or an external link.
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
                {ATTACHMENT_KIND_LABELS[d.kind]} · {fileSizeLabel(d.file.size)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select
              value={d.kind}
              onValueChange={(v) => {
                const kind = parseDraftKind(v);
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
                <SelectItem value="answer_key">Answer Key</SelectItem>
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
      <div className="flex flex-wrap items-center gap-2">
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
        {setLinks && (
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => setOpen(true)}
          >
            <LinkIcon className="size-4 mr-1" /> Add link
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add a link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="att-link-title">Title</Label>
              <Input
                id="att-link-title"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="e.g. Lecture slides"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="att-link-url">URL</Label>
              <Input
                id="att-link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={linkKind}
                onValueChange={(v) => setLinkKind(parseDraftKind(v))}
              >
                <SelectTrigger className="mt-1.5 rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reference">Reference</SelectItem>
                  <SelectItem value="instructions">Instructions</SelectItem>
                  <SelectItem value="answer_key">Answer Key</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-full" onClick={addLink} disabled={!linkTitle.trim() || !linkUrl.trim()}>
              Add link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const isLink = attachment.kind === "link" || !!attachment.url;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-outline-variant/50 p-3.5 overflow-hidden">
      <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
        {isLink ? (
          <LinkIcon className="size-5 text-primary shrink-0" />
        ) : (
          <FileText className="size-5 text-primary shrink-0" />
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-sm font-bold text-on-surface truncate">
            {attachment.fileName}
          </p>
          <p className="text-xs text-on-surface-variant truncate block max-w-full">
            {ATTACHMENT_KIND_LABELS[attachment.kind as AssignmentAttachmentKind] ?? "Reference"}
            {!isLink && attachment.fileSize ? ` · ${fileSizeLabel(attachment.fileSize)}` : ""}
            {isLink && attachment.url ? ` · ${attachment.url.replace(/^https?:\/\//, "").slice(0, 50)}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={onDownload}
        >
          {isLink ? <LinkIcon className="size-4 mr-1" /> : <Download className="size-4 mr-1" />}
          {isLink ? "Open" : "Download"}
        </Button>
        {onRemove && (
          <ConfirmDelete
            what="attachment"
            itemName={attachment.fileName}
            size="icon"
            icon={<X className="size-4" />}
            className="rounded-full size-8 shrink-0 text-on-surface-variant hover:text-error hover:bg-error/10"
            consequences={
              <li className="flex items-center gap-2">
                <Trash2 className="size-3.5 shrink-0" />
                This item will be removed from the assignment
              </li>
            }
            onConfirm={onRemove}
          />
        )}
      </div>
    </div>
  );
}