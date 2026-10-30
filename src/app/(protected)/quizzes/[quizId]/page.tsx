"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ClipboardList,
  Timer,
  CalendarDays,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Users,
  BarChart3,
  ShieldAlert,
  Maximize2,
  MousePointerClick,
  VideoOff,
  KeyRound,
  Copy,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/ums/confirm-delete";
import {
  FullscreenGuard,
  PausedOverlay,
  ProctorBadge,
  ProctorWarning,
  useQuizProctor,
} from "@/components/ums/quiz-lockdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { authClient } from "@/lib/auth-client";
import {
  getQuiz,
  getMyAttempt,
  startQuizAttempt,
  submitQuizAttempt,
  saveQuizProgress,
  recordQuizViolation,
  listQuizAttempts,
  toggleQuizPublish,
  deleteQuiz,
  getQuizStats,
  pauseStudentQuiz,
  resumeStudentQuiz,
  terminateStudentQuiz,
  getMyAttemptStatus,
} from "@/server/ums";
import { letterForPercent } from "@/lib/grading";

type QuizData = Awaited<ReturnType<typeof getQuiz>>;

function letterColor(letter: string) {
  if (letter === "A") return "text-emerald-400";
  if (letter === "B") return "text-orange-400";
  if (letter === "C") return "text-amber-400";
  if (letter === "D") return "text-orange-600";
  return "text-rose-400";
}

export default function QuizPage() {
  const params = useParams<{ quizId: string }>();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [attempt, setAttempt] = useState<{
    id: string;
    status: string;
    scoreEarned: number | null;
    scoreTotal: number | null;
    answers: any[];
  } | null>(null);
  const [mode, setMode] = useState<"intro" | "taking" | "review">("intro");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = await getQuiz(params.quizId);
      setQuiz(q);
      const a = await getMyAttempt(params.quizId);
      setAttempt(a as any);
      if (a && a.status === "submitted") setMode("review");
    } catch (e: any) {
      toast.error(e.message || "Failed to load quiz");
    } finally {
      setLoading(false);
    }
  }, [params.quizId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !quiz) {
    return (
      <div className="p-4 md:p-8 space-y-4">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }
  if (!quiz) {
    return (
      <div className="p-4 md:p-8">
        <p className="text-sm text-on-surface-variant">Quiz not found.</p>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <AdminQuizView
        quizId={params.quizId}
        quiz={quiz}
        load={load}
      />
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      {mode === "intro" && (
        <IntroView
          quiz={quiz}
          onStart={async (key?: string) => {
            // Enter full screen on click gesture (desktop only; mobile browsers
            // block the fullscreen API so we skip it silently).
            const isTouch =
              typeof window !== "undefined" &&
              ("ontouchstart" in window || navigator.maxTouchPoints > 1) &&
              !window.matchMedia("(pointer: fine)").matches;
            if (!isTouch && !document.fullscreenElement) {
              document.documentElement
                .requestFullscreen({ navigationUI: "hide" })
                .catch(() => {});
            }
            try {
              const res = await startQuizAttempt(params.quizId, key);
              setAttempt(res.attempt as any);
              setMode("taking");
            } catch (e: any) {
              toast.error(e.message || "Failed to start attempt");
            }
          }}
        />
      )}
      {mode === "taking" && attempt && (
        <AttemptView
          quiz={quiz}
          attempt={attempt}
          onDone={(a) => {
            setAttempt(a as any);
            setMode("review");
            load();
          }}
        />
      )}
      {mode === "review" && attempt && (
        <ReviewView attempt={attempt} quiz={quiz} />
      )}
    </div>
  );
}

function IntroView({
  quiz,
  onStart,
}: {
  quiz: QuizData;
  onStart: (key?: string) => void;
}) {
  const requiresKey = Boolean((quiz as any).requiresKey);
  const [key, setKey] = useState("");
  const keyMissing = requiresKey && !key.trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <Card className="rounded-3xl border-outline-variant/60 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary to-orange-500" />
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="rounded-full font-mono">
              {(quiz as any).course?.code}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {(quiz as any).course?.name}
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface">
            {(quiz as any).title}
          </h1>
          {(quiz as any).description && (
            <p className="text-sm text-on-surface-variant mt-2">
              {(quiz as any).description}
            </p>
          )}
          <div className="flex flex-wrap gap-4 mt-6">
            <Stat icon={ClipboardList} label="Questions" value={(quiz as any).totalQuestions} />
            <Stat icon={Timer} label="Duration" value={`${(quiz as any).durationMinutes} min`} />
            <Stat icon={Trophy} label="Total points" value={(quiz as any).maxScore} />
            {(quiz as any).dueAt && (
              <Stat
                icon={CalendarDays}
                label="Due"
                value={format(new Date((quiz as any).dueAt), "MMM d, h:mm a")}
              />
            )}
          </div>
          {(quiz as any).instructions && (
            <div className="mt-6 rounded-2xl bg-surface-container-highest/60 p-4 text-sm text-on-surface-variant">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface mb-1">
                Instructions
              </p>
              {(quiz as any).instructions}
            </div>
          )}
          <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
              <ShieldAlert className="size-3.5" /> Exam rules
            </p>
            <ul className="mt-2 space-y-1.5 text-on-surface-variant">
              <li className="flex items-start gap-2">
                <Maximize2 className="size-3.5 mt-0.5 shrink-0 text-primary" />
                The quiz opens in full screen and must stay there.
              </li>
              <li className="flex items-start gap-2">
                <MousePointerClick className="size-3.5 mt-0.5 shrink-0 text-primary" />
                {(quiz as any).questions?.some?.((q: any) => q.type === "free_text")
                  ? "The keyboard is only allowed in free-text answer boxes."
                  : "Only the mouse works — the keyboard is disabled."}
              </li>
              <li className="flex items-start gap-2">
                <Eye className="size-3.5 mt-0.5 shrink-0 text-primary" />
                Switching tabs or windows is detected and recorded.
              </li>
              <li className="flex items-start gap-2">
                <VideoOff className="size-3.5 mt-0.5 shrink-0 text-primary" />
                No camera or microphone is used.
              </li>
            </ul>
          </div>
          {requiresKey && (
            <div className="mt-6 rounded-2xl border border-outline-variant/60 bg-surface-container-highest/40 p-4">
              <Label htmlFor="quiz-key" className="flex items-center gap-2 text-sm">
                <KeyRound className="size-4 text-primary" /> Access key
              </Label>
              <Input
                id="quiz-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter the key given by your instructor"
                autoComplete="off"
                className="mt-2"
              />
              <p className="text-[11px] text-on-surface-variant mt-2">
                Your instructor will give you this key. Ask them if you do not have it.
              </p>
            </div>
          )}
          <div className="mt-6">
            <Button
              size="lg"
              className="rounded-full px-8"
              onClick={() => onStart(key)}
              disabled={keyMissing}
            >
              <Play className="size-4 mr-2" /> Start attempt
            </Button>
            <p className="text-[11px] text-on-surface-variant mt-3">
              {keyMissing
                ? "Enter the access key to begin."
                : "You can only attempt this quiz once. The timer starts as soon as you begin."}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="size-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-black text-on-surface leading-tight">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
        </p>
      </div>
    </div>
  );
}

function AttemptView({
  quiz,
  attempt,
  onDone,
}: {
  quiz: QuizData;
  attempt: {
    id: string;
    status: string;
    warningLimit?: number;
    startedAt?: Date | string;
    answers?: any[];
  };
  onDone: (a: any) => void;
}) {
  const questions = (quiz as any).questions as any[];
  const [answers, setAnswers] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    if (Array.isArray(attempt?.answers)) {
      for (const a of attempt.answers) {
        if (a?.questionId && Array.isArray(a.selected) && a.selected.length > 0) {
          map[a.questionId] = a.selected;
        }
      }
    }
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem(`quiz_answers_${attempt.id}`);
        if (local) {
          Object.assign(map, JSON.parse(local));
        }
      } catch {}
    }
    return map;
  });

  const [textAnswers, setTextAnswers] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (Array.isArray(attempt?.answers)) {
      for (const a of attempt.answers) {
        if (a?.questionId && typeof a.text === "string" && a.text) {
          map[a.questionId] = a.text;
        }
      }
    }
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem(`quiz_text_answers_${attempt.id}`);
        if (local) {
          Object.assign(map, JSON.parse(local));
        }
      } catch {}
    }
    return map;
  });

  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);
  const [warningLimit, setWarningLimit] = useState(attempt.warningLimit ?? 3);

  const durationSeconds = Math.max(1, ((quiz as any).durationMinutes ?? 15) * 60);

  const calculateSecondsLeft = useCallback(() => {
    if (attempt?.startedAt) {
      const startMs = new Date(attempt.startedAt).getTime();
      const elapsedSeconds = Math.floor((Date.now() - startMs) / 1000);
      return Math.max(0, durationSeconds - Math.max(0, elapsedSeconds));
    }
    return durationSeconds;
  }, [attempt?.startedAt, durationSeconds]);

  const [secondsLeft, setSecondsLeft] = useState(calculateSecondsLeft);

  const submittedRef = useRef(false);
  const answersRef = useRef(answers);
  const textAnswersRef = useRef(textAnswers);
  answersRef.current = answers;
  textAnswersRef.current = textAnswers;

  // Persist answers to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        `quiz_answers_${attempt.id}`,
        JSON.stringify(answers),
      );
    } catch {}
  }, [answers, attempt.id]);

  useEffect(() => {
    try {
      localStorage.setItem(
        `quiz_text_answers_${attempt.id}`,
        JSON.stringify(textAnswers),
      );
    } catch {}
  }, [textAnswers, attempt.id]);

  // Debounced auto-save progress to DB
  useEffect(() => {
    if (isPaused || isTerminated || submittedRef.current) return;
    const timer = setTimeout(() => {
      const currentSelected = answersRef.current;
      const currentTyped = textAnswersRef.current;
      const payload = questions.map((q) => ({
        questionId: q.id,
        selected: currentSelected[q.id] ?? [],
        text: currentTyped[q.id] ?? "",
      }));
      void saveQuizProgress(attempt.id, payload).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [answers, textAnswers, attempt.id, questions, isPaused, isTerminated]);

  const proctor = useQuizProctor(!isPaused && !isTerminated, async () => {
    try {
      const res: any = await recordQuizViolation(attempt.id);
      if (res?.terminated) {
        setIsTerminated(true);
      } else if (res?.autoPaused) {
        setIsPaused(true);
        if (res.warningLimit !== undefined) setWarningLimit(res.warningLimit);
      } else if (res?.warningLimit !== undefined) {
        setWarningLimit(res.warningLimit);
      }
    } catch {
      // ignore
    }
  });

  // Polling for admin resume/pause/termination every 3 seconds
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const status = await getMyAttemptStatus(attempt.id);
        if (status.status === "submitted") {
          clearInterval(poll);
          window.location.reload();
          return;
        }
        setIsPaused(Boolean(status.pausedAt));
        if (status.warningLimit !== undefined) {
          setWarningLimit(status.warningLimit);
        }
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [attempt.id]);

  const handleSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const selected = answersRef.current;
      const typed = textAnswersRef.current;
      const res = await submitQuizAttempt(
        attempt.id,
        questions.map((q) => ({
          questionId: q.id,
          selected: selected[q.id] ?? [],
          text: typed[q.id] ?? "",
        })),
      );
      try {
        localStorage.removeItem(`quiz_answers_${attempt.id}`);
        localStorage.removeItem(`quiz_text_answers_${attempt.id}`);
      } catch {}
      toast.success("Quiz submitted!");
      onDone(res.attempt);
    } catch (e: any) {
      submittedRef.current = false;
      toast.error(e.message || "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  }, [attempt.id, questions, onDone]);

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) {
      if (!submittedRef.current) {
        void handleSubmitRef.current();
      }
      return;
    }

    const t = setInterval(() => {
      const remaining = calculateSecondsLeft();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(t);
        if (!submittedRef.current) {
          void handleSubmitRef.current();
        }
      }
    }, 1000);

    return () => clearInterval(t);
  }, [calculateSecondsLeft, secondsLeft <= 0]);

  const choose = (qid: string, value: string) => {
    if (isPaused || isTerminated || secondsLeft <= 0 || submitting) return;
    const q = questions.find((x) => x.id === qid);
    // single_choice, true_false, and legacy mcq rows = pick exactly one
    const single =
      q?.type === "true_false" ||
      q?.type === "single_choice" ||
      q?.type === "mcq";
    setAnswers((a) => ({
      ...a,
      [qid]: single
        ? [value]
        : a[qid]?.includes(value)
          ? a[qid].filter((x) => x !== value)
          : [...(a[qid] ?? []), value],
    }));
  };

  const typeAnswer = (qid: string, value: string) => {
    if (isPaused || isTerminated || secondsLeft <= 0 || submitting) return;
    setTextAnswers((a) => ({ ...a, [qid]: value }));
  };

  const mm = String(Math.floor(Math.max(secondsLeft, 0) / 60)).padStart(2, "0");
  const ss = String(Math.max(secondsLeft, 0) % 60).padStart(2, "0");
  const isAnswered = (qq: any) =>
    qq.type === "free_text"
      ? Boolean((textAnswers[qq.id] ?? "").trim())
      : (answers[qq.id] ?? []).length > 0;
  const answered = questions.filter(isAnswered).length;

  const q = questions[current];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Sticky header — compact on mobile */}
      <div className="sticky top-0 sm:top-4 z-10 flex items-center justify-between gap-3 rounded-none sm:rounded-2xl border-b sm:border border-outline-variant/60 bg-surface-container/95 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="secondary" className="rounded-full font-mono hidden xs:flex">
            {(quiz as any).course?.code}
          </Badge>
          <p className="text-sm font-bold text-on-surface truncate">
            {(quiz as any).title}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ProctorBadge count={proctor.violationCount} />
          <p className="text-xs text-on-surface-variant hidden md:block">
            {answered}/{questions.length} answered
          </p>
          <div
            className={cn(
              "px-3 py-1.5 rounded-full font-mono font-black text-sm",
              secondsLeft < 60
                ? "bg-rose-500/15 text-rose-400"
                : "bg-primary/10 text-primary",
            )}
          >
            {mm}:{ss}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-outline-variant/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${Math.round((answered / Math.max(questions.length, 1)) * 100)}%` }}
        />
      </div>

      {q ? (
        <Card className="rounded-3xl border-outline-variant/60">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">
              Question {current + 1} of {questions.length}
            </CardTitle>
            <Badge variant="secondary" className="rounded-full">
              {q.points} {q.points === 1 ? "point" : "points"}
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-on-surface mb-5">{q.prompt}</p>
            {q.type === "free_text" ? (
              <div>
                <Label htmlFor={`answer-${q.id}`}>Your answer</Label>
                <Textarea
                  id={`answer-${q.id}`}
                  data-quiz-answer=""
                  value={textAnswers[q.id] ?? ""}
                  onChange={(e) => typeAnswer(q.id, e.target.value)}
                  placeholder="Type your answer"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={isPaused || isTerminated || secondsLeft <= 0 || submitting}
                  className="mt-1.5 min-h-28"
                />
              </div>
            ) : (
            <div className="space-y-3">
              {q.type === "multiple_choice" && (
                <p className="text-xs text-on-surface-variant mb-1 italic">
                  Select all correct answers that apply.
                </p>
              )}
              {q.options?.map?.((o: any) => {
                const sel = (answers[q.id] ?? []).includes(o.id);
                const isMulti = q.type === "multiple_choice";
                return (
                  <button
                    key={o.id}
                    onClick={() => choose(q.id, o.id)}
                    disabled={isPaused || isTerminated || secondsLeft <= 0 || submitting}
                    className={cn(
                      // min-h-14 ensures comfortable touch target on mobile
                      "w-full text-left rounded-2xl border p-4 min-h-14 flex items-center gap-3 transition-all active:scale-[0.98]",
                      sel
                        ? "border-primary bg-primary/10"
                        : "border-outline-variant/60 hover:border-primary/40",
                    )}
                  >
                    {isMulti ? (
                      /* Checkbox indicator for multiple_choice */
                      <span
                        className={cn(
                          "size-6 shrink-0 rounded-md border-2 flex items-center justify-center text-xs font-black transition-colors",
                          sel
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-outline-variant",
                        )}
                      >
                        {sel ? "✓" : ""}
                      </span>
                    ) : (
                      /* Radio indicator for single_choice / true_false / mcq */
                      <span
                        className={cn(
                          "size-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
                          sel ? "border-primary" : "border-outline-variant",
                        )}
                      >
                        {sel && (
                          <span className="size-3 rounded-full bg-primary" />
                        )}
                      </span>
                    )}
                    <span className="text-sm font-medium text-on-surface leading-snug">
                      {o.text}
                    </span>
                  </button>
                );
              })}
            </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          className="rounded-full flex-1 sm:flex-none"
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
        >
          <ChevronLeft className="size-4 mr-1" /> Prev
        </Button>
        <span className="text-xs text-on-surface-variant font-semibold">
          {current + 1} / {questions.length}
        </span>
        <Button
          onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
          disabled={current === questions.length - 1}
          className="rounded-full flex-1 sm:flex-none"
        >
          Next <ChevronRight className="size-4 ml-1" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {questions.map((qq: any, i: number) => (
          <button
            key={qq.id}
            onClick={() => setCurrent(i)}
            className={cn(
              "size-10 rounded-xl text-xs font-black transition-colors border",
              current === i
                ? "bg-primary text-primary-foreground border-primary"
                : isAnswered(qq)
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                  : "bg-surface-container text-on-surface-variant border-outline-variant",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          variant="secondary"
          className="rounded-full"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin mr-1" />
          ) : (
            <CheckCircle2 className="size-4 mr-1" />
          )}
          {submitting ? "Submitting..." : secondsLeft <= 0 ? "Submitting quiz..." : "Submit quiz"}
        </Button>
      </div>

      {!proctor.isFullscreen && (
        <FullscreenGuard onResume={proctor.requestFullscreen} />
      )}
      {isPaused && <PausedOverlay />}
      {proctor.warning && !isPaused && (
        <ProctorWarning
          violation={proctor.warning}
          count={proctor.violationCount}
          warningLimit={attempt.warningLimit ?? 3}
          onDismiss={proctor.dismissWarning}
        />
      )}
    </motion.div>
  );
}

function ReviewView({ quiz, attempt }: { quiz: QuizData; attempt: any }) {
  const pct =
    attempt.scoreTotal > 0 ? Math.round((attempt.scoreEarned / attempt.scoreTotal) * 100) : 0;
  const letter = letterForPercent(pct);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <Card className="rounded-3xl border-outline-variant/60 overflow-hidden text-center">
        <div className="h-1.5 bg-gradient-to-r from-primary to-orange-500" />
        <CardContent className="p-8">
          <div className="inline-flex items-center gap-2 mb-1">
            <CheckCircle2 className="size-5 text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
              Submitted
            </span>
          </div>
          <p className="text-sm font-bold text-on-surface-variant truncate">
            {(quiz as any).title}
          </p>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div>
              <p className="text-4xl font-black text-on-surface">
                {attempt.scoreEarned ?? 0}
                <span className="text-xl text-on-surface-variant">/{attempt.scoreTotal}</span>
              </p>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-1">
                Score
              </p>
            </div>
            <div className="h-12 w-px bg-outline-variant" />
            <div>
              <p className="text-4xl font-black text-on-surface">{pct}%</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-1">
                Percentage
              </p>
            </div>
            <div className="h-12 w-px bg-outline-variant" />
            <div>
              <p className={cn("text-4xl font-black", letterColor(letter))}>{letter}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-1">
                Grade
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-outline-variant/60">
        <CardHeader>
          <CardTitle>Answer review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {attempt.answers?.map?.((ans: any, i: number) => (
            <div
              key={ans.questionId}
              className="rounded-2xl border border-outline-variant/50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-on-surface">
                  {i + 1}. {ans.questionText ?? ""}
                </p>
                {ans.isCorrect ? (
                  <Badge variant="secondary" className="rounded-full text-emerald-500 shrink-0">
                    <CheckCircle2 className="size-3 mr-1" /> +{ans.points ?? 0}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="rounded-full text-rose-500 shrink-0">
                    <XCircle className="size-3 mr-1" /> 0
                  </Badge>
                )}
              </div>
              <div className="mt-3 text-xs space-y-1.5">
                {ans.correctText && (
                  <p className="text-emerald-500">
                    Correct answer: {ans.correctText}
                  </p>
                )}
                {(ans.selectedText || ans.text) ? (
                  <p className={ans.isCorrect ? "text-on-surface-variant" : "text-rose-500"}>
                    Your answer: {ans.selectedText || ans.text}
                  </p>
                ) : (
                  <p className="text-rose-500/80 italic">Not answered</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AdminQuizView({
  quizId,
  quiz,
  load,
}: {
  quizId: string;
  quiz: QuizData;
  load: () => void;
}) {
  const router = useRouter();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getQuizStats>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null);

  useEffect(() => {
    listQuizAttempts(quizId).then(setAttempts).catch(() => {});
    getQuizStats(quizId).then(setStats).catch(() => {});
  }, [quizId]);

  const toggle = async () => {
    setBusy(true);
    try {
      await toggleQuizPublish(quizId, !(quiz as any).isPublished);
      toast.success((quiz as any).isPublished ? "Unpublished" : "Published");
      load();
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteQuiz(quizId);
      toast.success("Quiz deleted");
      router.push(`/courses/${(quiz as any).course?.id}`);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <Card className="rounded-3xl border-outline-variant/60 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary to-orange-500" />
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="rounded-full font-mono">
                  {(quiz as any).course?.code}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full",
                    (quiz as any).isPublished ? "text-emerald-500" : "",
                  )}
                >
                  {(quiz as any).isPublished ? "Published" : "Draft"}
                </Badge>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-on-surface">
                {(quiz as any).title}
              </h1>
              <p className="text-sm text-on-surface-variant mt-1">
                {(quiz as any).totalQuestions} questions · {(quiz as any).durationMinutes} min ·{" "}
                {(quiz as any).maxScore} points
                {(quiz as any).dueAt &&
                  ` · due ${format(new Date((quiz as any).dueAt), "MMM d, h:mm a")}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/quizzes/${quizId}/edit`}>
                <Button variant="outline" className="rounded-full" size="sm" disabled={busy}>
                  <Pencil className="size-4 mr-1" /> Edit
                </Button>
              </Link>
              <Button variant="outline" className="rounded-full" size="sm" onClick={toggle} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : (quiz as any).isPublished ? "Unpublish" : "Publish"}
              </Button>
              <ConfirmDelete
                what="quiz"
                itemName={(quiz as any)?.title ?? "this quiz"}
                size="icon"
                icon={<Trash2 className="size-4" />}
                className="rounded-full text-on-surface-variant hover:text-error hover:bg-error/10"
                consequences={
                  <>
                    <li className="flex items-center gap-2">
                      <Trash2 className="size-3.5 shrink-0" />
                      Every question in this quiz is deleted with it
                    </li>
                    <li className="flex items-center gap-2">
                      <BarChart3 className="size-3.5 shrink-0" />
                      {(stats?.attemptsCount ?? 0)} student attempt
                      {(stats?.attemptsCount ?? 0) === 1 ? "" : "s"} and all
                      recorded scores are lost
                    </li>
                  </>
                }
                onConfirm={remove}
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-outline-variant/40 flex flex-wrap items-center gap-2">
            {(quiz as any).accessKey ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs">
                <KeyRound className="size-3.5 text-primary" />
                <span className="text-on-surface-variant font-medium">Access Key:</span>
                <span className="font-mono font-bold text-primary">{(quiz as any).accessKey}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText((quiz as any).accessKey);
                    toast.success("Access key copied to clipboard!");
                  }}
                  className="hover:text-primary transition-colors text-on-surface-variant ml-1"
                  title="Copy access key"
                >
                  <Copy className="size-3" />
                </button>
              </div>
            ) : (
              <Badge variant="outline" className="rounded-full text-xs font-normal">
                No access key required
              </Badge>
            )}

            {(quiz as any).assignedStudentIds && (quiz as any).assignedStudentIds.length > 0 ? (
              <Badge variant="secondary" className="rounded-full text-xs font-normal">
                <Users className="size-3 mr-1" /> {(quiz as any).assignedStudentIds.length} student{(quiz as any).assignedStudentIds.length === 1 ? "" : "s"} assigned
              </Badge>
            ) : (
              <Badge variant="secondary" className="rounded-full text-xs font-normal">
                <Users className="size-3 mr-1" /> All enrolled students
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {stats && (
        <Card className="rounded-3xl border-outline-variant/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" /> Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile label="Attempts" value={stats.attemptsCount} />
              <StatTile label="Submitted" value={stats.submittedCount} />
              <StatTile label="In progress" value={stats.inProgressCount} />
              <StatTile label="Enrolled students" value={stats.enrolledCount} />
              <StatTile
                label="Average score"
                value={stats.averagePercent != null ? `${stats.averagePercent}%` : "—"}
              />
              <StatTile
                label="Pass rate (≥50%)"
                value={stats.passRate != null ? `${stats.passRate}%` : "—"}
              />
              <StatTile
                label="Highest score"
                value={stats.highestScore != null ? stats.highestScore : "—"}
              />
              <StatTile
                label="Lowest score"
                value={stats.lowestScore != null ? stats.lowestScore : "—"}
              />
            </div>
            {stats.perQuestion.length > 0 && (
              <div className="mt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3">
                  Question performance
                </p>
                <div className="flex flex-col gap-2">
                  {stats.perQuestion.map((pq, i) => {
                    const pct = pq.total ? Math.round((pq.correctCount / pq.total) * 100) : 0;
                    return (
                      <div key={pq.questionId} className="flex items-center gap-3">
                        <span className="w-7 text-xs font-black text-on-surface-variant shrink-0">
                          {i + 1}
                        </span>
                        <span className="flex-1 text-sm font-medium text-on-surface truncate">
                          {pq.prompt}
                        </span>
                        <div className="w-28 md:w-40 h-2 rounded-full bg-surface-container-highest overflow-hidden shrink-0">
                          <div
                            className="h-full rounded-full bg-emerald-500/70"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-on-surface-variant w-16 text-right shrink-0">
                          {pq.correctCount}/{pq.total}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl border-outline-variant/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="size-5 text-primary" /> Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {((quiz as any).questions as any[]).map((q, i) => (
            <div key={q.id} className="rounded-2xl border border-outline-variant/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-on-surface">
                  {i + 1}. {q.prompt}
                </p>
                <Badge variant="secondary" className="rounded-full shrink-0">
                  {q.points} pts ·{" "}
                  {q.type === "single_choice"
                    ? "Single choice"
                    : q.type === "multiple_choice"
                      ? "Multi-select"
                      : q.type === "mcq"
                        ? "Single choice"
                        : q.type === "free_text"
                          ? "Free text"
                          : "True/False"}
                </Badge>
                {stats?.perQuestion && (
                  <Badge variant="outline" className="rounded-full shrink-0 text-emerald-500">
                    {(() => {
                      const pq = stats.perQuestion.find((x) => x.questionId === q.id);
                      return pq ? `${pq.correctCount}/${pq.total} correct` : "";
                    })()}
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(q.type === "mcq" || q.type === "single_choice" || q.type === "multiple_choice") &&
                  q.options?.map((o: any) => (
                    <span
                      key={o.id}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs border",
                        (q.correctAnswer ?? []).includes(o.id)
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                          : "border-outline-variant/50 text-on-surface-variant",
                      )}
                    >
                      {o.text}
                    </span>
                  ))}
                {q.type === "true_false" && (
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs border",
                      (q.correctAnswer ?? [])[0] === "true"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                        : "border-outline-variant/50 text-on-surface-variant",
                    )}
                  >
                    {q.options?.find((o: any) => o.id === (q.correctAnswer ?? [])[0])?.text ?? "—"}
                  </span>
                )}
                {q.type === "free_text" &&
                  ((q.correctAnswer as string[]) ?? []).map((a: string) => (
                    <span
                      key={a}
                      className="px-2.5 py-1 rounded-full text-xs border border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                    >
                      {a}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-outline-variant/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" /> Attempts ({attempts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-8">
              No attempts yet.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-outline-variant/40">
              {attempts.map((a) => {
                const pct =
                  a.scoreTotal > 0
                    ? Math.round((a.scoreEarned / a.scoreTotal) * 100)
                    : 0;
                return (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAttempt(a)}
                    className="flex items-center justify-between py-3 px-2 rounded-xl cursor-pointer hover:bg-surface-container-highest/40 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-bold text-on-surface">{a.studentName}</p>
                      <p className="text-xs text-on-surface-variant">{a.studentEmail}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {a.violations > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-error/15 px-2.5 py-1 text-[11px] font-bold text-error">
                          <ShieldAlert className="size-3" />
                          {a.violations}
                        </span>
                      )}
                      <span
                        className={cn(
                          "text-sm font-black",
                          pct >= 60 ? "text-emerald-400" : "text-rose-400",
                        )}
                      >
                        {a.scoreEarned}/{a.scoreTotal} ({pct}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedAttempt)}
        onOpenChange={(open) => !open && setSelectedAttempt(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedAttempt?.studentName}&apos;s Submission
            </DialogTitle>
            <p className="text-xs text-on-surface-variant">
              {selectedAttempt?.studentEmail} · Score: {selectedAttempt?.scoreEarned}/{selectedAttempt?.scoreTotal} (
              {selectedAttempt?.scoreTotal > 0
                ? Math.round((selectedAttempt.scoreEarned / selectedAttempt.scoreTotal) * 100)
                : 0}
              %)
            </p>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {Array.isArray(selectedAttempt?.answers) && selectedAttempt.answers.length > 0 ? (
              selectedAttempt.answers.map((ans: any, i: number) => (
                <div
                  key={ans.questionId ?? i}
                  className="rounded-2xl border border-outline-variant/50 p-3.5 text-xs space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-on-surface text-sm">
                      {i + 1}. {ans.questionText ?? "Question"}
                    </p>
                    {ans.isCorrect ? (
                      <Badge variant="secondary" className="rounded-full text-emerald-500 shrink-0">
                        <CheckCircle2 className="size-3 mr-1" /> +{ans.points ?? 0}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="rounded-full text-rose-500 shrink-0">
                        <XCircle className="size-3 mr-1" /> 0
                      </Badge>
                    )}
                  </div>
                  {ans.correctText && (
                    <p className="text-emerald-500">
                      Correct answer: {ans.correctText}
                    </p>
                  )}
                  {ans.selectedText || ans.text ? (
                    <p className={ans.isCorrect ? "text-on-surface-variant font-medium" : "text-rose-500 font-medium"}>
                      Student answer: {ans.selectedText || ans.text}
                    </p>
                  ) : (
                    <p className="text-rose-500/80 italic">Not answered</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-on-surface-variant text-center py-6">
                No answer details recorded yet for this attempt.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-outline-variant/50 p-4">
      <p className="text-2xl font-black text-on-surface leading-tight">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-1">
        {label}
      </p>
    </div>
  );
}