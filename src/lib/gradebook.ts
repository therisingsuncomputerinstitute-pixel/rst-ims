import { letterForPercent } from "./grading";

/**
 * The Agentic AI Architect program grades out of 100:
 *
 *   final exam      50
 *   mid term        20
 *   quizzes         10   (average of graded quiz attempts)
 *   assignments     10   (average of graded submissions)
 *   participation   10   = 3 attendance + 2 conduct + 5 class participation
 *
 * The three derived components come from data the app already stores, so a
 * teacher only ever types the two exam scores, the conduct mark and the
 * participation mark.
 */
export const WEIGHTS = {
  finalExam: 50,
  midTerm: 20,
  quizzes: 10,
  assignments: 10,
  attendance: 3,
  conduct: 2,
  participation: 5,
} as const;

export const TOTAL_POINTS =
  WEIGHTS.finalExam +
  WEIGHTS.midTerm +
  WEIGHTS.quizzes +
  WEIGHTS.assignments +
  WEIGHTS.attendance +
  WEIGHTS.conduct +
  WEIGHTS.participation;

export type ComponentKey =
  | "finalExam"
  | "midTerm"
  | "quizzes"
  | "assignments"
  | "attendance"
  | "conduct"
  | "participation";

export type GradebookInput = {
  /** null means "not entered yet" and is excluded rather than counted as zero. */
  finalExam: number | null;
  midTerm: number | null;
  /** 0-100, or null when the student has no graded quizzes. */
  quizPercent: number | null;
  /** 0-100, or null when the student has no graded assignments. */
  assignmentPercent: number | null;
  /** 0-100, or null before any class has been marked. */
  attendancePercent: number | null;
  /** 0-2 */
  conduct: number;
  /** 0-5 */
  participation: number;
};

export type GradebookComponent = {
  key: ComponentKey;
  label: string;
  weight: number;
  earned: number | null;
  note: string;
};

export type GradebookResult = {
  components: GradebookComponent[];
  /** Sum of the earned points, or null while every component is unentered. */
  earned: number | null;
  outOf: number;
  percent: number | null;
  letter: string | null;
  /** Points still unentered, so the UI can say the grade is provisional. */
  missing: ComponentKey[];
};

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A percentage of a weighted slice, e.g. 80% of the 10 quiz points = 8. */
const slice = (percent: number | null, weight: number) =>
  percent === null ? null : round2((clamp(percent, 0, 100) / 100) * weight);

export function computeGradebook(input: GradebookInput): GradebookResult {
  const finalExam = input.finalExam;
  const midTerm = input.midTerm;

  const components: GradebookComponent[] = [
    {
      key: "finalExam",
      label: "Final exam",
      weight: WEIGHTS.finalExam,
      earned: finalExam,
      note: "out of 50",
    },
    {
      key: "midTerm",
      label: "Mid term",
      weight: WEIGHTS.midTerm,
      earned: midTerm,
      note: "out of 20",
    },
    {
      key: "quizzes",
      label: "Quizzes",
      weight: WEIGHTS.quizzes,
      earned: slice(input.quizPercent, WEIGHTS.quizzes),
      note:
        input.quizPercent === null
          ? "no graded quizzes yet"
          : `${Math.round(input.quizPercent)}% average`,
    },
    {
      key: "assignments",
      label: "Assignments",
      weight: WEIGHTS.assignments,
      earned: slice(input.assignmentPercent, WEIGHTS.assignments),
      note:
        input.assignmentPercent === null
          ? "nothing graded yet"
          : `${Math.round(input.assignmentPercent)}% average`,
    },
    {
      key: "attendance",
      label: "Attendance",
      weight: WEIGHTS.attendance,
      earned: slice(input.attendancePercent, WEIGHTS.attendance),
      note:
        input.attendancePercent === null
          ? "no classes marked yet"
          : `${Math.round(input.attendancePercent)}% attendance`,
    },
    {
      key: "conduct",
      label: "Phone-free & focused",
      weight: WEIGHTS.conduct,
      earned: round2(clamp(input.conduct, 0, WEIGHTS.conduct)),
      note: "out of 2",
    },
    {
      key: "participation",
      label: "Class participation",
      weight: WEIGHTS.participation,
      earned: round2(clamp(input.participation, 0, WEIGHTS.participation)),
      note: "out of 5",
    },
  ];

  const missing = components
    .filter((c) => c.earned === null)
    .map((c) => c.key);

  // Conduct and participation default to 0 rather than null, so they would make
  // a completely ungraded student look like a 0% F. Only the components that are
  // actually recorded elsewhere (exams, quizzes, assignments, attendance) decide
  // whether there is a grade to show at all.
  const GRADED_ELSEWHERE: ComponentKey[] = [
    "finalExam",
    "midTerm",
    "quizzes",
    "assignments",
    "attendance",
  ];
  const hasRealMark = GRADED_ELSEWHERE.some(
    (key) => components.find((c) => c.key === key)?.earned !== null,
  );

  const entered = components.filter((c) => c.earned !== null);
  const earned = !hasRealMark
    ? null
    : round2(entered.reduce((sum, c) => sum + (c.earned ?? 0), 0));

  // Always out of 100 so a half-entered grade is visibly incomplete rather than
  // flattering: 40/100 with one exam left to enter should not read as 40%.
  const percent = earned === null ? null : round2((earned / TOTAL_POINTS) * 100);

  return {
    components,
    earned,
    outOf: TOTAL_POINTS,
    percent,
    letter: percent === null ? null : letterForPercent(percent),
    missing,
  };
}
