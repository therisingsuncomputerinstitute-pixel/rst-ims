"use client";

import { useState } from "react";
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
import { createQuiz } from "@/server/ums";

export default function NewQuizPage() {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();

  const [form, setForm] = useState<QuizFormState>({
    title: "",
    description: "",
    instructions: "",
    durationMinutes: 15,
    dueAt: "",
  });
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim()) return toast.error("Quiz title is required.");
    const valid = questions.filter((q) => q.prompt.trim());
    if (valid.length === 0)
      return toast.error("Add at least one question with a prompt.");
    const missing = questions.find(
      (q) => q.prompt.trim() && q.correctAnswer.length === 0,
    );
    if (missing) return toast.error("Every question needs a correct answer.");

    setSaving(true);
    try {
      const q = await createQuiz({
        courseId: params.courseId,
        title: form.title,
        description: form.description,
        instructions: form.instructions,
        durationMinutes: form.durationMinutes,
        dueAt: form.dueAt || null,
        questions: normalizeQuestions(valid),
      });
      toast.success("Quiz created");
      router.push(`/quizzes/${q.id}`);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to create quiz");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <PageHeader
        backHref={`/courses/${params.courseId}`}
        title="New Quiz"
        subtitle="Create a quiz with multiple choice or true/false questions."
        icon={<ClipboardList className="size-7 text-primary" />}
      />
      <QuizEditor
        form={form}
        setForm={setForm}
        questions={questions}
        setQuestions={setQuestions}
        onSave={save}
        saving={saving}
      />
    </div>
  );
}