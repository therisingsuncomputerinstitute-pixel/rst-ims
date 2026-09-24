"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ums/page-header";
import {
  QuizEditor,
  QuizFormState,
  QuestionDraft,
  normalizeQuestions,
} from "@/components/ums/quiz-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { getQuiz, updateQuiz } from "@/server/ums";
import { format } from "date-fns";

function toInputDate(d: Date | null): string {
  if (!d) return "";
  try {
    return format(d, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

export default function EditQuizPage() {
  const params = useParams<{ quizId: string }>();
  const router = useRouter();

  const [form, setForm] = useState<QuizFormState | null>(null);
  const [questions, setQuestions] = useState<QuestionDraft[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getQuiz(params.quizId)
      .then((q: any) => {
        setForm({
          title: q.title,
          description: q.description || "",
          instructions: q.instructions || "",
          durationMinutes: q.durationMinutes,
          dueAt: toInputDate(q.dueAt),
        });
        setQuestions(
          (q.questions as any[]).map((qq) => ({
            key: qq.id,
            type: qq.type,
            prompt: qq.prompt,
            options:
              qq.type === "true_false"
                ? [
                    { id: "true", text: "True" },
                    { id: "false", text: "False" },
                  ]
                : qq.options || [],
            correctAnswer: qq.correctAnswer || [],
            points: qq.points,
          })),
        );
      })
      .catch((e: any) => toast.error(e.message || "Failed to load quiz"));
  }, [params.quizId]);

  const save = async () => {
    if (!form) return;
    if (!form.title.trim()) return toast.error("Quiz title is required.");
    const valid = questions?.filter((q) => q.prompt.trim()) ?? [];
    if (valid.length === 0)
      return toast.error("Add at least one question with a prompt.");
    const missing = questions?.find(
      (q) => q.prompt.trim() && q.correctAnswer.length === 0,
    );
    if (missing) return toast.error("Every question needs a correct answer.");

    setSaving(true);
    try {
      await updateQuiz(params.quizId, {
        title: form.title,
        description: form.description,
        instructions: form.instructions,
        durationMinutes: form.durationMinutes,
        dueAt: form.dueAt || null,
        questions: normalizeQuestions(valid),
      });
      toast.success("Quiz updated");
      router.push(`/quizzes/${params.quizId}`);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to update quiz");
    } finally {
      setSaving(false);
    }
  };

  if (!form || !questions) {
    return (
      <div className="p-4 md:p-8 max-w-3xl space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <PageHeader
        backHref={`/quizzes/${params.quizId}`}
        title="Edit Quiz"
        subtitle="Update the quiz settings and questions."
        icon={<ClipboardList className="size-7 text-primary" />}
      />
      <QuizEditor
        form={form}
        setForm={setForm}
        questions={questions}
        setQuestions={setQuestions}
        onSave={save}
        saving={saving}
        saveLabel="Save changes"
      />
    </div>
  );
}