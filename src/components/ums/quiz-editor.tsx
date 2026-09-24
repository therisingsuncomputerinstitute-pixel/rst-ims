"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { QuizQuestionInput } from "@/server/ums";

export type QuizFormState = {
  title: string;
  description: string;
  instructions: string;
  durationMinutes: number;
  dueAt: string;
};

export type QuestionDraft = {
  key: string;
  type: "mcq" | "true_false";
  prompt: string;
  options: { id: string; text: string }[];
  correctAnswer: string[];
  points: number;
};

let counter = 0;
const uid = () => `opt_${Date.now()}_${counter++}`;

export function normalizeQuestions(
  questions: QuestionDraft[],
): QuizQuestionInput[] {
  return questions.map((q) => ({
    type: q.type,
    prompt: q.prompt,
    options: q.type === "mcq" ? q.options : undefined,
    correctAnswer: q.correctAnswer,
    points: q.points,
  }));
}

function blankQuestion(): QuestionDraft {
  return {
    key: uid(),
    type: "mcq",
    prompt: "",
    options: [
      { id: uid(), text: "" },
      { id: uid(), text: "" },
      { id: uid(), text: "" },
      { id: uid(), text: "" },
    ],
    correctAnswer: [],
    points: 1,
  };
}

export function QuizEditor({
  form,
  setForm,
  questions,
  setQuestions,
  onSave,
  saving,
  saveLabel = "Save quiz",
}: {
  form: QuizFormState;
  setForm: (f: QuizFormState) => void;
  questions: QuestionDraft[];
  setQuestions: (q: QuestionDraft[]) => void;
  onSave: () => void;
  saving: boolean;
  saveLabel?: string;
}) {
  const set = (k: keyof QuizFormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm({ ...form, [k]: e.target.value });

  const updateQuestion = (key: string, patch: Partial<QuestionDraft>) =>
    setQuestions(
      questions.map((q) => (q.key === key ? { ...q, ...patch } : q)),
    );

  const updateOption = (key: string, optId: string, text: string) =>
    setQuestions(
      questions.map((q) =>
        q.key === key
          ? {
              ...q,
              options: q.options.map((o) =>
                o.id === optId ? { ...o, text } : o,
              ),
            }
          : q,
      ),
    );

  const toggleMcqCorrect = (key: string, optId: string) => {
    setQuestions(
      questions.map((q) =>
        q.key === key
          ? {
              ...q,
              correctAnswer: q.correctAnswer.includes(optId)
                ? q.correctAnswer.filter((x) => x !== optId)
                : [...q.correctAnswer, optId],
            }
          : q,
      ),
    );
  };

  const addOption = (key: string) =>
    setQuestions(
      questions.map((q) =>
        q.key === key
          ? { ...q, options: [...q.options, { id: uid(), text: "" }] }
          : q,
      ),
    );

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border-outline-variant/60">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div>
            <Label htmlFor="ql-title">Quiz title</Label>
            <Input
              id="ql-title"
              value={form.title}
              onChange={set("title")}
              placeholder="e.g. Calculus I — Midterm Quiz 1"
              className="mt-1.5"
            />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="ql-duration">Duration (minutes)</Label>
              <Input
                id="ql-duration"
                type="number"
                min={1}
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm({ ...form, durationMinutes: Number(e.target.value) })
                }
                className="mt-1.5"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="ql-due">Due date (optional)</Label>
              <Input
                id="ql-due"
                type="datetime-local"
                value={form.dueAt}
                onChange={set("dueAt")}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ql-desc">Description</Label>
            <Textarea
              id="ql-desc"
              value={form.description}
              onChange={set("description")}
              placeholder="Short summary shown to students."
              className="mt-1.5 min-h-20"
            />
          </div>
          <div>
            <Label htmlFor="ql-instructions">Instructions</Label>
            <Textarea
              id="ql-instructions"
              value={form.instructions}
              onChange={set("instructions")}
              placeholder="Rules and notes shown on the intro screen before the attempt."
              className="mt-1.5 min-h-20"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">
          Questions ({questions.length})
        </h2>
        <Badge variant="secondary" className="rounded-full">
          {questions.reduce((s, q) => s + q.points, 0)} points
        </Badge>
      </div>

      {questions.map((q, idx) => (
        <Card key={q.key} className="rounded-3xl border-outline-variant/60">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">
              Question {idx + 1}
              <Select
                value={q.type}
                onValueChange={(v) =>
                  updateQuestion(q.key, {
                    type: v as "mcq" | "true_false",
                    correctAnswer:
                      v === "true_false" ? [] : q.correctAnswer,
                    options:
                      v === "true_false"
                        ? [
                            { id: "true", text: "True" },
                            { id: "false", text: "False" },
                          ]
                        : q.options,
                  })
                }
              >
                <SelectTrigger className="w-44 h-8 ml-3 inline-flex !w-auto text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple choice</SelectItem>
                  <SelectItem value="true_false">True / False</SelectItem>
                </SelectContent>
              </Select>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={`pts-${q.key}`} className="text-xs text-on-surface-variant">
                  Points
                </Label>
                <Input
                  id={`pts-${q.key}`}
                  type="number"
                  min={1}
                  value={q.points}
                  onChange={(e) =>
                    updateQuestion(q.key, { points: Number(e.target.value) || 1 })
                  }
                  className="w-20 h-8"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-on-surface-variant hover:text-destructive"
                onClick={() =>
                  setQuestions(questions.filter((x) => x.key !== q.key))
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor={`q-${q.key}`}>Prompt</Label>
              <Textarea
                id={`q-${q.key}`}
                value={q.prompt}
                onChange={(e) => updateQuestion(q.key, { prompt: e.target.value })}
                placeholder="Type the question…"
                className="mt-1.5 min-h-20"
              />
            </div>
            <div>
              <Label className="mb-2 block">
                {q.type === "true_false" ? "Correct answer" : "Options (select the correct one/ones)"}
              </Label>
              <div className="space-y-2">
                {q.options.map((o) => {
                  const isCorrect = q.correctAnswer.includes(o.id);
                  return (
                    <div key={o.id} className="flex items-center gap-2">
                      {q.type === "mcq" ? (
                        <button
                          type="button"
                          onClick={() => toggleMcqCorrect(q.key, o.id)}
                          className={cn(
                            "size-5 shrink-0 rounded-md border flex items-center justify-center text-[10px] font-black transition-colors",
                            isCorrect
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-outline-variant text-transparent hover:border-emerald-400",
                          )}
                          title="Mark as correct answer"
                        >
                          ✓
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(q.key, {
                              correctAnswer: isCorrect ? [] : [o.id],
                            })
                          }
                          className={cn(
                            "size-5 shrink-0 rounded-full border flex items-center justify-center transition-colors",
                            isCorrect
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-outline-variant",
                          )}
                        />
                      )}
                      <Input
                        value={o.text}
                        disabled={q.type === "true_false"}
                        onChange={(e) =>
                          updateOption(q.key, o.id, e.target.value)
                        }
                        placeholder="Option text"
                        className="h-9"
                      />
                      {isCorrect && (
                        <Badge variant="secondary" className="rounded-full text-emerald-500 shrink-0">
                          Correct
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              {q.type === "mcq" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full mt-2"
                  onClick={() => addOption(q.key)}
                >
                  <Plus className="size-3.5 mr-1" /> Add option
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        className="w-full rounded-2xl border-dashed"
        onClick={() => setQuestions([...questions, blankQuestion()])}
      >
        <Plus className="size-4 mr-1" /> Add question
      </Button>

      <div className="flex justify-end pt-2">
        <Button onClick={onSave} disabled={saving} className="rounded-full">
          {saving ? (
            <Loader2 className="size-4 animate-spin mr-1" />
          ) : (
            <Save className="size-4 mr-1" />
          )}
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}