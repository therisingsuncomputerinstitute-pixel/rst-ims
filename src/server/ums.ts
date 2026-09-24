"use server";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/drizzle";
import {
  assignmentAttachments,
  assignments,
  courseEnrollments,
  courses,
  member,
  organization,
  quizAttempts,
  quizQuestions,
  quizzes,
  submissions,
  user,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase-server";
import { letterForPercent } from "@/lib/grading";

// ─────────────────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────────────────

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  return session.user;
}

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") {
    throw new Error("Only admins can perform this action.");
  }
  return session.user;
}

async function getOrgIdForUser(userId: string) {
  const membership = await db.query.member.findFirst({
    where: (m, { eq: e }) => e(m.userId, userId),
  });
  return membership?.organizationId ?? null;
}

async function getCurrentOrgId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const orgId =
    (session.session.activeOrganizationId as string | null) ??
    (await getOrgIdForUser(session.user.id));
  return orgId;
}

async function requireAdminOrg() {
  const admin = await requireAdmin();
  const orgId = await getCurrentOrgId();
  if (!orgId) throw new Error("No organization found for this user.");
  return { admin, orgId };
}

async function assertCourseInOrg(courseId: string, orgId: string) {
  const course = await db.query.courses.findFirst({
    where: (c, { eq: e }) => e(c.id, courseId),
    columns: { id: true, organizationId: true },
  });
  if (!course) throw new Error("Course not found.");
  if (course.organizationId !== orgId) {
    throw new Error("You do not have access to this course.");
  }
}

async function getQuizOrg(quizId: string): Promise<string | null> {
  const q = await db.query.quizzes.findFirst({
    where: (x, { eq: e }) => e(x.id, quizId),
    columns: { id: true, organizationId: true },
  });
  return q?.organizationId ?? null;
}

async function assertQuizInOrg(quizId: string, orgId: string) {
  const quizOrg = await getQuizOrg(quizId);
  if (!quizOrg || quizOrg !== orgId) {
    throw new Error("You do not have access to this quiz.");
  }
}

async function getAssignmentOrg(assignmentId: string): Promise<string | null> {
  const a = await db.query.assignments.findFirst({
    where: (x, { eq: e }) => e(x.id, assignmentId),
    columns: { id: true, organizationId: true },
  });
  return a?.organizationId ?? null;
}

async function assertAssignmentInOrg(assignmentId: string, orgId: string) {
  const assignmentOrg = await getAssignmentOrg(assignmentId);
  if (!assignmentOrg || assignmentOrg !== orgId) {
    throw new Error("You do not have access to this assignment.");
  }
}

async function getOrgStudentIds(orgId: string): Promise<string[]> {
  const [fromMembers, fromEnrollments] = await Promise.all([
    db
      .select({ id: member.userId })
      .from(member)
      .where(eq(member.organizationId, orgId)),
    db
      .select({ id: user.id })
      .from(courseEnrollments)
      .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
      .innerJoin(user, eq(courseEnrollments.studentId, user.id))
      .where(eq(courses.organizationId, orgId)),
  ]);
  return Array.from(
    new Set([
      ...fromMembers.map((r) => r.id),
      ...fromEnrollments.map((r) => r.id),
    ]),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Courses
// ─────────────────────────────────────────────────────────────────────────

export type CourseWithStats = {
  id: string;
  courseId?: string;
  name: string;
  code: string;
  description: string | null;
  instructorName: string | null;
  term: string | null;
  createdAt: Date;
  quizCount: number;
  assignmentCount: number;
  studentCount: number;
};

export async function listCourses() {
  const u = await requireUser();
  const orgId = await getCurrentOrgId();
  if (!orgId) return [];

  const isAdmin = u.role === "admin";

  const base = {
    with: {
      quizzes: { columns: { id: true } },
      assignments: { columns: { id: true } },
      courseEnrollments: { columns: { id: true } },
    },
  } as const;

  const rows = isAdmin
    ? await db.query.courses.findMany({
        where: (c, { eq: e }) => e(c.organizationId, orgId),
        ...base,
        orderBy: (c, { asc: a }) => [a(c.name)],
      })
    : await db.query.courses.findMany({
        where: (c, { eq: e }) => e(c.organizationId, orgId),
        ...base,
        orderBy: (c, { asc: a }) => [a(c.name)],
      });

  const enrolledRows = isAdmin
    ? new Map<string, true>()
    : new Map(
        (
          await db
            .select({ courseId: courseEnrollments.courseId })
            .from(courseEnrollments)
            .where(eq(courseEnrollments.studentId, u.id))
        ).map((r) => [r.courseId, true as const]),
      );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    instructorName: row.instructorName,
    term: row.term,
    createdAt: row.createdAt,
    quizCount: row.quizzes.length,
    assignmentCount: row.assignments.length,
    studentCount: row.courseEnrollments.length,
    isEnrolled: enrolledRows.has(row.id),
  }));
}

export async function createCourse(input: {
  name: string;
  code: string;
  description?: string;
  instructorName?: string;
  term?: string;
}) {
  const admin = await requireAdmin();
  const orgId = await getCurrentOrgId();
  if (!orgId) throw new Error("No organization found for this user.");

  const [created] = await db
    .insert(courses)
    .values({
      organizationId: orgId,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      description: input.description?.trim() || null,
      instructorName: input.instructorName?.trim() || null,
      term: input.term?.trim() || null,
    })
    .returning();

  // The admin that creates the course auto-enrolls (admins see everything anyway)
  return created;
}

export async function updateCourse(
  courseId: string,
  input: Partial<{
    name: string;
    code: string;
    description: string;
    instructorName: string;
    term: string;
  }>,
) {
  const { orgId } = await requireAdminOrg();
  await assertCourseInOrg(courseId, orgId);
  const [updated] = await db
    .update(courses)
    .set({
      name: input.name?.trim(),
      code: input.code?.trim().toUpperCase(),
      description: input.description?.trim() || null,
      instructorName: input.instructorName?.trim() || null,
      term: input.term?.trim() || null,
    })
    .where(and(eq(courses.id, courseId), eq(courses.organizationId, orgId)))
    .returning();
  if (!updated) throw new Error("Course not found.");
  return updated;
}

export async function getCourse(courseId: string) {
  const u = await requireUser();
  const isAdmin = u.role === "admin";

  const course = await db.query.courses.findFirst({
    where: (c, { eq: e }) => e(c.id, courseId),
    with: {
      quizzes: {
        orderBy: (q, { asc: a }) => [a(q.createdAt)],
      },
      assignments: {
        orderBy: (a, { asc: ascA }) => [ascA(a.createdAt)],
      },
    },
  });
  if (!course) throw new Error("Course not found.");

  if (isAdmin) {
    const orgId = await getCurrentOrgId();
    if (!orgId || course.organizationId !== orgId) {
      throw new Error("Course not found.");
    }
  }

  const isEnrolled = isAdmin
    ? true
    : !!(await db.query.courseEnrollments.findFirst({
        where: (ce, { eq: e }) =>
          and(e(ce.courseId, courseId), e(ce.studentId, u.id)),
      }));
  if (!isAdmin && !isEnrolled) throw new Error("You are not enrolled in this course.");

  const enrollments = isAdmin
    ? await listEnrolledStudents(courseId)
    : [];

  return {
    course: {
      id: course.id,
      name: course.name,
      code: course.code,
      description: course.description,
      instructorName: course.instructorName,
      term: course.term,
      createdAt: course.createdAt,
    },
    quizzes: (course.quizzes as any[])
      .filter((q) => isAdmin || q.isPublished)
      .map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        durationMinutes: q.durationMinutes,
        totalQuestions: q.totalQuestions,
        maxScore: q.maxScore,
        isPublished: q.isPublished,
        dueAt: q.dueAt,
        createdAt: q.createdAt,
      })),
    assignments: (course.assignments as any[])
      .filter((a) => isAdmin || a.isPublished)
      .map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        maxScore: a.maxScore,
        isPublished: a.isPublished,
        dueAt: a.dueAt,
        createdAt: a.createdAt,
      })),
    enrollments,
    isEnrolled,
    isAdmin,
  };
}

export async function deleteCourse(courseId: string) {
  const { orgId } = await requireAdminOrg();
  await assertCourseInOrg(courseId, orgId);
  await db
    .delete(courses)
    .where(and(eq(courses.id, courseId), eq(courses.organizationId, orgId)));
  return { success: true };
}

export async function listStudents() {
  const { orgId } = await requireAdminOrg();
  const ids = await getOrgStudentIds(orgId);
  if (!ids.length) return [];
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(and(eq(user.role, "student"), inArray(user.id, ids)))
    .orderBy(asc(user.name));
}

export async function listEnrolledStudents(courseId: string) {
  const { orgId } = await requireAdminOrg();
  await assertCourseInOrg(courseId, orgId);
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(courseEnrollments)
    .innerJoin(user, eq(courseEnrollments.studentId, user.id))
    .where(eq(courseEnrollments.courseId, courseId));
}

export async function enrollStudents(courseId: string, studentIds: string[]) {
  const { orgId } = await requireAdminOrg();
  await assertCourseInOrg(courseId, orgId);
  const ids = studentIds.filter(Boolean);
  if (!ids.length) return { success: true };
  const existing = await db
    .select({ studentId: courseEnrollments.studentId })
    .from(courseEnrollments)
    .where(
      and(
        eq(courseEnrollments.courseId, courseId),
        inArray(courseEnrollments.studentId, ids),
      ),
    );
  const existingSet = new Set(existing.map((e) => e.studentId));
  const toAdd = ids.filter((id) => !existingSet.has(id));
  if (toAdd.length) {
    await db.insert(courseEnrollments).values(
      toAdd.map((studentId) => ({ courseId, studentId })),
    );
  }
  return { success: true };
}

export async function removeEnrollment(courseId: string, studentId: string) {
  const { orgId } = await requireAdminOrg();
  await assertCourseInOrg(courseId, orgId);
  await db
    .delete(courseEnrollments)
    .where(
      and(
        eq(courseEnrollments.courseId, courseId),
        eq(courseEnrollments.studentId, studentId),
      ),
    );
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Quizzes
// ─────────────────────────────────────────────────────────────────────────

export type QuizQuestionInput = {
  type: "mcq" | "true_false";
  prompt: string;
  options?: { id: string; text: string }[];
  correctAnswer?: string[] | [boolean][number][];
  points?: number;
};

async function insertQuestions(
  quizId: string,
  questions: QuizQuestionInput[],
) {
  if (!questions.length) return;
  await db.insert(quizQuestions).values(
    questions.map((q, i) => ({
      quizId,
      type: q.type,
      prompt: q.prompt.trim(),
      options: q.type === "mcq" ? (q.options ?? []) : null,
      correctAnswer:
        q.type === "true_false"
          ? q.correctAnswer
          : (q.correctAnswer ?? ([] as string[])),
      points: q.points ?? 1,
      orderIndex: i,
    })),
  );
}

export async function createQuiz(input: {
  courseId: string;
  title: string;
  description?: string;
  instructions?: string;
  durationMinutes?: number;
  dueAt?: string | null;
  questions: QuizQuestionInput[];
}) {
  await requireAdmin();
  const orgId = await getCurrentOrgId();
  if (!orgId) throw new Error("No organization found for this user.");
  await assertCourseInOrg(input.courseId, orgId);
  if (!input.questions.length) throw new Error("Quiz must have questions.");
  const maxScore = input.questions.reduce(
    (sum, q) => sum + (q.points ?? 1),
    0,
  );

  const [quiz] = await db
    .insert(quizzes)
    .values({
      courseId: input.courseId,
      organizationId: orgId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      durationMinutes: input.durationMinutes ?? 15,
      totalQuestions: input.questions.length,
      maxScore,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    })
    .returning();

  await insertQuestions(quiz.id, input.questions);
  return quiz;
}

export async function getQuiz(quizId: string) {
  const u = await requireUser();
  const quiz = await db.query.quizzes.findFirst({
    where: (q, { eq: e }) => e(q.id, quizId),
    with: {
      course: { columns: { id: true, name: true, code: true } },
      questions: { orderBy: (qn, { asc: a }) => [a(qn.orderIndex)] },
    },
  });
  if (!quiz) throw new Error("Quiz not found.");

  const isAdmin = u.role === "admin";
  if (isAdmin) {
    const orgId = await getCurrentOrgId();
    if (!orgId || quiz.organizationId !== orgId) {
      throw new Error("Quiz not found.");
    }
  }
  const isEnrolled = isAdmin
    ? true
    : await db.query.courseEnrollments.findFirst({
        where: (ce, { eq: e }) =>
          and(e(ce.courseId, quiz.courseId), e(ce.studentId, u.id)),
      });

  if (!isAdmin && !isEnrolled) throw new Error("You are not enrolled in this course.");
  if (!isAdmin && !quiz.isPublished) throw new Error("Quiz is not available yet.");

  if (!isAdmin) {
    quiz.questions = (quiz.questions as any[]).map(
      ({ correctAnswer, ...rest }) => rest,
    );
  }

  return quiz;
}

export async function listQuizAttempts(quizId: string) {
  const { orgId } = await requireAdminOrg();
  await assertQuizInOrg(quizId, orgId);
  return db
    .select({
      id: quizAttempts.id,
      studentName: user.name,
      studentEmail: user.email,
      scoreEarned: quizAttempts.scoreEarned,
      scoreTotal: quizAttempts.scoreTotal,
      status: quizAttempts.status,
      startedAt: quizAttempts.startedAt,
      submittedAt: quizAttempts.submittedAt,
    })
    .from(quizAttempts)
    .innerJoin(user, eq(quizAttempts.studentId, user.id))
    .where(eq(quizAttempts.quizId, quizId))
    .orderBy(desc(quizAttempts.startedAt));
}

export type QuizPerQuestionStat = {
  questionId: string;
  prompt: string;
  type: string;
  points: number;
  correctCount: number;
  total: number;
};

export type QuizStats = {
  attemptsCount: number;
  inProgressCount: number;
  submittedCount: number;
  enrolledCount: number;
  averagePercent: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  passRate: number | null;
  perQuestion: QuizPerQuestionStat[];
};

export async function getQuizStats(quizId: string): Promise<QuizStats> {
  const { orgId } = await requireAdminOrg();
  await assertQuizInOrg(quizId, orgId);

  const quiz = await db.query.quizzes.findFirst({
    where: (q, { eq: e }) => e(q.id, quizId),
    columns: { id: true, courseId: true },
  });
  if (!quiz) throw new Error("Quiz not found.");

  const [questions, attempts, enrolledRows] = await Promise.all([
    db.query.quizQuestions.findMany({
      where: (q, { eq: e }) => e(q.quizId, quizId),
      orderBy: (q, { asc: a }) => [a(q.orderIndex)],
    }),
    db.query.quizAttempts.findMany({
      where: (a, { eq: e }) => e(a.quizId, quizId),
    }),
    db
      .select({ id: courseEnrollments.id })
      .from(courseEnrollments)
      .where(eq(courseEnrollments.courseId, quiz.courseId)),
  ]);

  const submitted = attempts.filter((a) => a.status === "submitted");
  const inProgressCount = attempts.length - submitted.length;

  const pcts = submitted
    .map((a) =>
      a.scoreTotal > 0 ? (a.scoreEarned / a.scoreTotal) * 100 : null,
    )
    .filter((p): p is number => p !== null);
  const averagePercent = pcts.length
    ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length)
    : null;
  const passRate = pcts.length
    ? Math.round((pcts.filter((p) => p >= 50).length / pcts.length) * 100)
    : null;

  const earnedValues = submitted.map((a) => a.scoreEarned);
  const highestScore = earnedValues.length ? Math.max(...earnedValues) : null;
  const lowestScore = earnedValues.length ? Math.min(...earnedValues) : null;

  const perQuestion: QuizPerQuestionStat[] = questions.map((q) => {
    const entries = submitted
      .map((a) =>
        ((a.answers as any[]) ?? []).find((ans) => ans.questionId === q.id),
      )
      .filter((ans) => ans && typeof ans.isCorrect === "boolean");
    return {
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      points: q.points,
      correctCount: entries.filter((ans) => ans.isCorrect).length,
      total: entries.length,
    };
  });

  return {
    attemptsCount: attempts.length,
    inProgressCount,
    submittedCount: submitted.length,
    enrolledCount: enrolledRows.length,
    averagePercent,
    highestScore,
    lowestScore,
    passRate,
    perQuestion,
  };
}

export async function updateQuiz(
  quizId: string,
  input: Partial<{
    title: string;
    description: string;
    instructions: string;
    durationMinutes: number;
    dueAt: string | null;
    isPublished: boolean;
    questions: QuizQuestionInput[];
  }>,
) {
  const { orgId } = await requireAdminOrg();
  await assertQuizInOrg(quizId, orgId);
  const maxScore = input.questions
    ? input.questions.reduce((s, q) => s + (q.points ?? 1), 0)
    : undefined;

  await db
    .update(quizzes)
    .set({
      title: input.title?.trim(),
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      durationMinutes: input.durationMinutes,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      isPublished: input.isPublished,
      totalQuestions: input.questions?.length,
      maxScore,
    })
    .where(eq(quizzes.id, quizId));

  if (input.questions) {
    await db.delete(quizQuestions).where(eq(quizQuestions.quizId, quizId));
    await insertQuestions(quizId, input.questions);
  }

  return { success: true };
}

export async function toggleQuizPublish(quizId: string, isPublished: boolean) {
  const { orgId } = await requireAdminOrg();
  await assertQuizInOrg(quizId, orgId);
  await db
    .update(quizzes)
    .set({ isPublished })
    .where(and(eq(quizzes.id, quizId), eq(quizzes.organizationId, orgId)));
  return { success: true };
}

export async function deleteQuiz(quizId: string) {
  const { orgId } = await requireAdminOrg();
  await assertQuizInOrg(quizId, orgId);
  await db
    .delete(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.organizationId, orgId)));
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Attempts (student)
// ─────────────────────────────────────────────────────────────────────────

function stripAnswers(questions: any[]) {
  return questions.map(({ correctAnswer, ...rest }) => rest);
}

export async function startQuizAttempt(quizId: string) {
  const u = await requireUser();
  const quiz = await db.query.quizzes.findFirst({
    where: (q, { eq: e }) => e(q.id, quizId),
    with: { course: { columns: { id: true, name: true, code: true } } },
  });
  if (!quiz || !quiz.isPublished) throw new Error("Quiz not available.");
  if (u.role !== "admin") {
    const enrolled = await db.query.courseEnrollments.findFirst({
      where: (ce, { eq: e }) =>
        and(e(ce.courseId, quiz.courseId), e(ce.studentId, u.id)),
    });
    if (!enrolled) throw new Error("You are not enrolled in this course.");
    if (quiz.dueAt && quiz.dueAt < new Date()) {
      throw new Error("This quiz is past its due date.");
    }
  }

  const existing = await db.query.quizAttempts.findFirst({
    where: (a, { eq: e }) =>
      and(e(a.quizId, quizId), e(a.studentId, u.id)),
  });
  if (existing?.status === "submitted") {
    return { attempt: existing, fresh: false };
  }
  if (existing) {
    return { attempt: existing, fresh: false };
  }

  const [attempt] = await db
    .insert(quizAttempts)
    .values({ quizId, studentId: u.id, answers: [] })
    .returning();
  return { attempt, fresh: true };
}

export async function submitQuizAttempt(
  attemptId: string,
  answers: { questionId: string; selected: string[]; text?: string }[],
) {
  const u = await requireUser();
  const attempt = await db.query.quizAttempts.findFirst({
    where: (a, { eq: e }) => e(a.id, attemptId),
  });
  if (!attempt) throw new Error("Attempt not found.");
  if (attempt.studentId !== u.id && u.role !== "admin") {
    throw new Error("Unauthorized.");
  }
  if (attempt.status === "submitted") return { attempt };

  const questions = await db.query.quizQuestions.findMany({
    where: (q, { eq: e }) => e(q.quizId, attempt.quizId),
  });

  let earned = 0;
  let total = 0;
  const normalized = questions.map((q) => {
    const answer = answers.find((a) => a.questionId === q.id);
    const correct = Array.isArray(q.correctAnswer)
      ? (q.correctAnswer as string[])
      : [];
    const selected = answer?.selected ?? ([] as string[]);
    const isCorrect =
      correct.length === selected.length &&
      correct.every((c) => selected.includes(c));
    const textOf = (ids: string[]) =>
      (q.options as { id: string; text: string }[])?.length
        ? (q.options as { id: string; text: string }[])
            .filter((o) => ids.includes(o.id))
            .map((o) => o.text)
            .join(", ")
        : ids.join(", ");
    total += q.points;
    if (isCorrect) earned += q.points;
    return {
      questionId: q.id,
      questionText: q.prompt,
      selected,
      selectedText: textOf(selected),
      text: answer?.text ?? null,
      correct,
      correctText: textOf(correct),
      points: q.points,
      isCorrect,
    };
  });

  await db
    .update(quizAttempts)
    .set({
      answers: normalized,
      scoreEarned: earned,
      scoreTotal: total,
      status: "submitted",
      submittedAt: new Date(),
    })
    .where(eq(quizAttempts.id, attemptId));

  return { attempt: { ...attempt, status: "submitted", scoreEarned: earned, scoreTotal: total } };
}

export async function getMyAttempt(quizId: string) {
  const u = await requireUser();
  return db.query.quizAttempts.findFirst({
    where: (a, { eq: e }) =>
      and(e(a.quizId, quizId), e(a.studentId, u.id)),
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Assignments
// ─────────────────────────────────────────────────────────────────────────

export async function createAssignment(input: {
  courseId: string;
  title: string;
  description?: string;
  instructions?: string;
  maxScore: number;
  dueAt?: string | null;
}) {
  const { orgId } = await requireAdminOrg();
  await assertCourseInOrg(input.courseId, orgId);
  const [assignment] = await db
    .insert(assignments)
    .values({
      courseId: input.courseId,
      organizationId: orgId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      maxScore: input.maxScore,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    })
    .returning();
  return assignment;
}

export async function updateAssignment(
  assignmentId: string,
  input: Partial<{
    title: string;
    description: string;
    instructions: string;
    maxScore: number;
    dueAt: string | null;
    isPublished: boolean;
  }>,
) {
  const { orgId } = await requireAdminOrg();
  await assertAssignmentInOrg(assignmentId, orgId);
  await db
    .update(assignments)
    .set({
      title: input.title?.trim(),
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      maxScore: input.maxScore,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      isPublished: input.isPublished,
    })
    .where(and(eq(assignments.id, assignmentId), eq(assignments.organizationId, orgId)));
  return { success: true };
}

export async function toggleAssignmentPublish(
  assignmentId: string,
  isPublished: boolean,
) {
  const { orgId } = await requireAdminOrg();
  await assertAssignmentInOrg(assignmentId, orgId);
  await db
    .update(assignments)
    .set({ isPublished })
    .where(and(eq(assignments.id, assignmentId), eq(assignments.organizationId, orgId)));
  return { success: true };
}

export async function deleteAssignment(assignmentId: string) {
  const { orgId } = await requireAdminOrg();
  await assertAssignmentInOrg(assignmentId, orgId);
  const files = await db
    .select({ filePath: assignmentAttachments.filePath })
    .from(assignmentAttachments)
    .where(eq(assignmentAttachments.assignmentId, assignmentId));
  if (files.length && (await ensureBucket())) {
    await getSupabaseServer()!
      .storage.from(SUBMISSION_BUCKET)
      .remove(files.map((f) => f.filePath));
  }
  await db
    .delete(assignments)
    .where(and(eq(assignments.id, assignmentId), eq(assignments.organizationId, orgId)));
  return { success: true };
}

export async function getAssignment(assignmentId: string) {
  const u = await requireUser();
  const assignment = await db.query.assignments.findFirst({
    where: (a, { eq: e }) => e(a.id, assignmentId),
    with: {
      course: { columns: { id: true, name: true, code: true } },
      attachments: {
        columns: {
          id: true,
          kind: true,
          fileName: true,
          fileSize: true,
          createdAt: true,
        },
      },
    },
  });
  if (!assignment) throw new Error("Assignment not found.");

  const isAdmin = u.role === "admin";
  if (isAdmin) {
    const orgId = await getCurrentOrgId();
    if (!orgId || assignment.organizationId !== orgId) {
      throw new Error("Assignment not found.");
    }
  } else {
    const enrolled = await db.query.courseEnrollments.findFirst({
      where: (ce, { eq: e }) =>
        and(e(ce.courseId, assignment.courseId), e(ce.studentId, u.id)),
    });
    if (!enrolled) throw new Error("You are not enrolled in this course.");
    if (!assignment.isPublished) throw new Error("Assignment not available yet.");
    const mySubmission = await db.query.submissions.findFirst({
      where: (s, { eq: e }) =>
        and(
          e(s.assignmentId, assignmentId),
          e(s.studentId, u.id),
        ),
    });
    return { assignment, mySubmission, canSubmit: true };
  }

  const submissionsList = await db
    .select()
    .from(submissions)
    .innerJoin(user, eq(submissions.studentId, user.id))
    .where(eq(submissions.assignmentId, assignmentId))
    .orderBy(desc(submissions.createdAt));
  return { assignment, submissions: submissionsList, canSubmit: false };
}

// ─────────────────────────────────────────────────────────────────────────
// Submissions (student + admin)
// ─────────────────────────────────────────────────────────────────────────

const SUBMISSION_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "submissions";

async function ensureBucket() {
  const supabase = getSupabaseServer();
  if (!supabase) return false;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const { data, error } = await supabase.storage.getBucket(SUBMISSION_BUCKET);
  if (error || !data) {
    if (serviceKey.startsWith("sb_") && !serviceKey.startsWith("sb_secret_")) {
      throw new Error(
        "Supabase rejected the service key (invalid format). Set SUPABASE_SERVICE_ROLE_KEY to the legacy service_role JWT " +
          "(Settings → API Keys → service_role, an eyJ… value) or a first-party sb_secret_… key.",
      );
    }
    const { error: createError } = await supabase.storage.createBucket(
      SUBMISSION_BUCKET,
      { public: false },
    );
    if (createError) {
      throw new Error(`Storage bucket setup failed: ${createError.message}`);
    }
  } else if (data.public) {
    // Re-created before with public access — correct it to private.
    await supabase.storage.updateBucket(SUBMISSION_BUCKET, { public: false });
  }
  return true;
}

export async function submitAssignment(
  assignmentId: string,
  formData: FormData,
) {
  const u = await requireUser();
  const assignment = await db.query.assignments.findFirst({
    where: (a, { eq: e }) => e(a.id, assignmentId),
  });
  if (!assignment) throw new Error("Assignment not found.");
  if (u.role !== "admin" && !assignment.isPublished) {
    throw new Error("Assignment not available yet.");
  }
  const enrolled = await db.query.courseEnrollments.findFirst({
    where: (ce, { eq: e }) =>
      and(e(ce.courseId, assignment.courseId), e(ce.studentId, u.id)),
  });
  if (!enrolled && u.role !== "admin") {
    throw new Error("You are not enrolled in this course.");
  }

  const file = formData.get("file") as File | null;
  const comments = (formData.get("comments") as string | null)?.trim() || null;
  if (!file || !file.size) throw new Error("Please attach a file.");

  // Strip unsafe characters from the file name
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `assignments/${assignmentId}/${u.id}_${Date.now()}_${safeName}`;

  if (!(await ensureBucket())) {
    throw new Error(
      "Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const supabase = getSupabaseServer()!;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(SUBMISSION_BUCKET)
    .upload(filePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const existing = await db.query.submissions.findFirst({
    where: (s, { eq: e }) =>
      and(e(s.assignmentId, assignmentId), e(s.studentId, u.id)),
  });

  // Remove previously stored file if replacing
  if (existing?.fileUrl) {
    const oldPath = extractPathFromUrl(existing.fileUrl);
    if (oldPath) {
      await supabase.storage.from(SUBMISSION_BUCKET).remove([oldPath]);
    }
  }

  const keepGrade = existing?.status === "graded";
  const values = {
    assignmentId,
    studentId: u.id,
    fileName: file.name,
    // Store the object path (bucket is private); downloads use signed URLs.
    fileUrl: filePath,
    fileSize: file.size,
    comments,
    status: (keepGrade ? "graded" : "submitted") as "submitted" | "graded",
  };

  const submission = existing
    ? (
        await db
          .update(submissions)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(submissions.id, existing.id))
          .returning()
      )[0]
    : (
        await db.insert(submissions).values(values as any).returning()
      )[0];

  return { submission };
}

function extractPathFromUrl(fullUrl: string): string | null {
  if (!fullUrl.startsWith("http")) return fullUrl; // already a storage object path
  try {
    const u = new URL(fullUrl);
    const match = u.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export async function getSubmissionDownloadUrl(submissionId: string) {
  const u = await requireUser();
  const submission = await db.query.submissions.findFirst({
    where: (s, { eq: e }) => e(s.id, submissionId),
  });
  if (!submission) throw new Error("Submission not found.");

  const assignment = await db.query.assignments.findFirst({
    where: (a, { eq: e }) => e(a.id, submission.assignmentId),
    columns: { id: true, organizationId: true },
  });
  if (!assignment) throw new Error("Assignment not found.");

  const orgId = await getCurrentOrgId();
  const isOwner = submission.studentId === u.id;
  const isAdminOfOrg =
    u.role === "admin" && !!orgId && assignment.organizationId === orgId;
  if (!isOwner && !isAdminOfOrg) {
    throw new Error("You do not have access to this file.");
  }
  if (!submission.fileUrl) return null;
  if (submission.fileUrl.startsWith("http")) return submission.fileUrl;

  if (!(await ensureBucket())) {
    throw new Error("Storage is not configured.");
  }
  const supabase = getSupabaseServer()!;
  const { data, error } = await supabase.storage
    .from(SUBMISSION_BUCKET)
    .createSignedUrl(submission.fileUrl, 3600);
  if (error || !data?.signedUrl) {
    throw new Error("Could not create a download link.");
  }
  return data.signedUrl;
}

export async function uploadAssignmentAttachment(
  assignmentId: string,
  kind: string,
  formData: FormData,
) {
  const { orgId } = await requireAdminOrg();
  await assertAssignmentInOrg(assignmentId, orgId);

  const file = formData.get("file") as File | null;
  if (!file || !file.size) throw new Error("Please choose a file.");

  const normalizedKind = (kind === "instructions" ? "instructions" : "reference") as
    | "instructions"
    | "reference";

  if (!(await ensureBucket())) {
    throw new Error(
      "Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const supabase = getSupabaseServer()!;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `assignment-files/${assignmentId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safeName}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(SUBMISSION_BUCKET)
    .upload(filePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  await db.insert(assignmentAttachments).values({
    assignmentId,
    kind: normalizedKind,
    fileName: file.name,
    filePath,
    fileSize: file.size,
  });
  return { success: true };
}

export async function removeAssignmentAttachment(attachmentId: string) {
  const { orgId } = await requireAdminOrg();

  const row = await db.query.assignmentAttachments.findFirst({
    where: (t, { eq: e }) => e(t.id, attachmentId),
    columns: { assignmentId: true, filePath: true },
  });
  if (!row) return { success: true };
  await assertAssignmentInOrg(row.assignmentId, orgId);

  if (await ensureBucket()) {
    await getSupabaseServer()!
      .storage.from(SUBMISSION_BUCKET)
      .remove([row.filePath]);
  }
  await db
    .delete(assignmentAttachments)
    .where(eq(assignmentAttachments.id, attachmentId));
  return { success: true };
}

export async function getAssignmentAttachmentUrl(attachmentId: string) {
  const u = await requireUser();
  const attachment = await db.query.assignmentAttachments.findFirst({
    where: (t, { eq: e }) => e(t.id, attachmentId),
  });
  if (!attachment) throw new Error("Attachment not found.");

  const assignment = await db.query.assignments.findFirst({
    where: (a, { eq: e }) => e(a.id, attachment.assignmentId),
    columns: {
      id: true,
      courseId: true,
      organizationId: true,
      isPublished: true,
    },
  });
  if (!assignment) throw new Error("Assignment not found.");

  const orgId = await getCurrentOrgId();
  const isAdminOfOrg =
    u.role === "admin" && !!orgId && assignment.organizationId === orgId;
  if (!isAdminOfOrg) {
    const enrolled = await db.query.courseEnrollments.findFirst({
      where: (ce, { eq: e }) =>
        and(e(ce.courseId, assignment.courseId), e(ce.studentId, u.id)),
    });
    if (!enrolled) throw new Error("You are not enrolled in this course.");
    if (!assignment.isPublished) {
      throw new Error("Assignment not available yet.");
    }
  }

  if (!(await ensureBucket())) {
    throw new Error("Storage is not configured.");
  }
  const supabase = getSupabaseServer()!;
  const { data, error } = await supabase.storage
    .from(SUBMISSION_BUCKET)
    .createSignedUrl(attachment.filePath, 3600);
  if (error || !data?.signedUrl) {
    throw new Error("Could not create a download link.");
  }
  return data.signedUrl;
}

export async function listPendingSubmissions() {
  const { orgId } = await requireAdminOrg();
  return db
    .select()
    .from(submissions)
    .innerJoin(user, eq(submissions.studentId, user.id))
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(
      and(eq(submissions.status, "submitted"), eq(assignments.organizationId, orgId)),
    )
    .orderBy(desc(submissions.createdAt))
    .limit(20);
}

export async function gradeSubmission(
  submissionId: string,
  grade: number,
  feedback?: string,
) {
  const admin = await requireAdmin();
  const submission = await db.query.submissions.findFirst({
    where: (s, { eq: e }) => e(s.id, submissionId),
  });
  if (!submission) throw new Error("Submission not found.");
  if (grade < 0) throw new Error("Grade cannot be negative.");

  const assignment = await db.query.assignments.findFirst({
    where: (a, { eq: e }) => e(a.id, submission.assignmentId),
  });
  if (assignment && grade > assignment.maxScore) {
    throw new Error(
      `Grade cannot exceed the maximum score of ${assignment.maxScore}.`,
    );
  }

  await db
    .update(submissions)
    .set({
      grade,
      feedback: feedback?.trim() || null,
      status: "graded",
      gradedBy: admin.id,
      gradedAt: new Date(),
    })
    .where(eq(submissions.id, submissionId));
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Grades / performance
// ─────────────────────────────────────────────────────────────────────────

export type GradeRow = {
  id: string;
  courseName: string;
  courseCode: string;
  title: string;
  kind: "quiz" | "assignment";
  earned: number | null;
  max: number | null;
  percent: number | null;
  letter: string | null;
  status: string;
  dueAt: Date | null;
  gradedAt: Date | null;
};

export async function getMyGrades() {
  const u = await requireUser();
  const orgId = await getCurrentOrgId();
  if (!orgId) return { rows: [], overallPercent: null, overallLetter: null };

  const myCourses = await db
    .select({ courseId: courseEnrollments.courseId })
    .from(courseEnrollments)
    .where(eq(courseEnrollments.studentId, u.id));
  const courseIds = myCourses.map((r) => r.courseId);
  if (!courseIds.length) {
    return { rows: [], overallPercent: null, overallLetter: null };
  }

  const courseRows = await db
    .select({ id: courses.id, name: courses.name, code: courses.code })
    .from(courses)
    .where(inArray(courses.id, courseIds));

  const courseMap = new Map(courseRows.map((c) => [c.id, c]));

  const attempts = await db
    .select()
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
    .where(
      and(
        eq(quizAttempts.studentId, u.id),
        eq(quizAttempts.status, "submitted"),
        inArray(quizzes.courseId, courseIds),
      ),
    );

  const subs = await db
    .select()
    .from(submissions)
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(
      and(
        eq(submissions.studentId, u.id),
        eq(submissions.status, "graded"),
        inArray(assignments.courseId, courseIds),
      ),
    );

  const rows: GradeRow[] = [];
  for (const { quiz_attempts: a, quizzes: q } of attempts) {
    const course = courseMap.get(q.courseId);
    const percent = a.scoreTotal > 0 ? (a.scoreEarned / a.scoreTotal) * 100 : null;
    rows.push({
      id: a.id,
      courseName: course?.name ?? "—",
      courseCode: course?.code ?? "—",
      title: q.title,
      kind: "quiz",
      earned: a.scoreEarned,
      max: a.scoreTotal,
      percent: percent === null ? null : Math.round(percent),
      letter: percent === null ? null : letterForPercent(percent),
      status: "graded",
      dueAt: q.dueAt,
      gradedAt: a.submittedAt,
    });
  }
  for (const { submissions: s, assignments: a } of subs) {
    const course = courseMap.get(a.courseId);
    const percent = a.maxScore > 0 && s.grade != null ? (s.grade / a.maxScore) * 100 : null;
    rows.push({
      id: s.id,
      courseName: course?.name ?? "—",
      courseCode: course?.code ?? "—",
      title: a.title,
      kind: "assignment",
      earned: s.grade,
      max: a.maxScore,
      percent: percent === null ? null : Math.round(percent),
      letter: percent === null ? null : letterForPercent(percent),
      status: "graded",
      dueAt: a.dueAt,
      gradedAt: s.gradedAt,
    });
  }

  rows.sort((x, y) =>
    (y.gradedAt?.getTime() ?? 0) - (x.gradedAt?.getTime() ?? 0),
  );

  const percentValues = rows
    .map((r) => r.percent)
    .filter((p): p is number => p !== null);
  const overallPercent =
    percentValues.length > 0
      ? Math.round(
          percentValues.reduce((s, p) => s + p, 0) / percentValues.length,
        )
      : null;

  return {
    rows,
    overallPercent,
    overallLetter:
      overallPercent === null ? null : letterForPercent(overallPercent),
  };
}

export type DashboardActivityItem = {
  id: string;
  type: "submission" | "quiz" | "assignment" | "grade" | "enrollment";
  title: string;
  subtitle: string;
  createdAt: string | null;
  href: string;
};

export type DashboardData = {
  isAdmin: boolean;
  overallPercent: number | null;
  overallLetter: string | null;
  courses: any[];
  upcomingQuizzes: any[];
  upcomingAssignments: any[];
  pendingGradingCount: number;
  recentSubmissions: any[];
  recentGrades: GradeRow[];
  studentCount: number;
  counts?: { courses: number; quizzes: number; assignments: number };
  quizStats?: {
    attempts: number;
    inProgress: number;
    submitted: number;
    passRate: number | null;
  };
  assignmentStats?: {
    submitted: number;
    graded: number;
    pending: number;
    avgPercent: number | null;
  };
  coursePerformance?: {
    courseId: string;
    courseName: string;
    courseCode: string;
    percent: number | null;
  }[];
  activity?: DashboardActivityItem[];
  dueSoon?: DashboardActivityItem[];
  courseProgress?: {
    courseId: string;
    courseName: string;
    courseCode: string;
    completed: number;
    total: number;
    percent: number;
  }[];
  scoreTrend?: { title: string; percent: number | null }[];
};

export async function getStudentDashboardData(): Promise<DashboardData> {
  const u = await requireUser();
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    return {
      isAdmin: u.role === "admin",
      overallPercent: null,
      overallLetter: null,
      courses: [],
      upcomingQuizzes: [],
      upcomingAssignments: [],
      pendingGradingCount: 0,
      recentSubmissions: [],
      recentGrades: [],
      studentCount: 0,
    };
  }

  if (u.role === "admin") {
    const studentIds = await getOrgStudentIds(orgId);
    const studentCountRes = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .where(
        and(eq(user.role, "student"), inArray(user.id, studentIds)),
      )) as unknown as { count: number }[];
    const pendingRes = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(submissions)
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .where(
        and(
          eq(submissions.status, "submitted"),
          eq(assignments.organizationId, orgId),
        ),
      )) as unknown as {
      count: number;
    }[];
    const recentSubmissions = await listPendingSubmissions();
    const courseCountRes = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(courses)
      .where(eq(courses.organizationId, orgId))) as unknown as {
      count: number;
    }[];
    const quizCountRes = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quizzes)
      .where(
        and(eq(quizzes.organizationId, orgId), eq(quizzes.isPublished, true)),
      )) as unknown as { count: number }[];
    const assignmentCountRes = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(assignments)
      .where(
        and(
          eq(assignments.organizationId, orgId),
          eq(assignments.isPublished, true),
        ),
      )) as unknown as { count: number }[];

    // Quiz stats (org-wide)
    const quizAttemptRows = await db
      .select({
        status: quizAttempts.status,
        scoreEarned: quizAttempts.scoreEarned,
        scoreTotal: quizAttempts.scoreTotal,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(eq(quizzes.organizationId, orgId));
    const submittedAttempts = quizAttemptRows.filter(
      (a) => a.status === "submitted",
    );
    const scoredAttempts = submittedAttempts.filter(
      (a) => a.scoreTotal > 0,
    );
    const passRate =
      scoredAttempts.length > 0
        ? Math.round(
            (scoredAttempts.filter(
              (a) => a.scoreEarned / a.scoreTotal >= 0.5,
            ).length /
              scoredAttempts.length) *
              100,
          )
        : null;

    // Assignment stats (org-wide)
    const assignSubRows = await db
      .select({
        status: submissions.status,
        grade: submissions.grade,
        maxScore: assignments.maxScore,
      })
      .from(submissions)
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .where(eq(assignments.organizationId, orgId));
    const gradedAssigns = assignSubRows.filter((s) => s.status === "graded");
    const gradedPercents = gradedAssigns
      .map((s) =>
        s.grade != null && s.maxScore > 0 ? (s.grade / s.maxScore) * 100 : null,
      )
      .filter((p): p is number => p !== null);
    const avgAssignmentPercent =
      gradedPercents.length > 0
        ? Math.round(
            gradedPercents.reduce((s, p) => s + p, 0) / gradedPercents.length,
          )
        : null;

    // Course performance (avg graded percent per course), for charts
    const perfRows = await db
      .select({
        courseId: courses.id,
        courseName: courses.name,
        courseCode: courses.code,
        grade: submissions.grade,
        maxScore: assignments.maxScore,
      })
      .from(submissions)
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .innerJoin(courses, eq(assignments.courseId, courses.id))
      .where(
        and(eq(assignments.organizationId, orgId), eq(submissions.status, "graded")),
      );
    const perfByCourse = new Map<
      string,
      { name: string; code: string; percents: number[] }
    >();
    for (const r of perfRows) {
      if (r.grade == null || r.maxScore <= 0) continue;
      const entry =
        perfByCourse.get(r.courseId) ?? {
          name: r.courseName,
          code: r.courseCode,
          percents: [],
        };
      entry.percents.push((r.grade / r.maxScore) * 100);
      perfByCourse.set(r.courseId, entry);
    }
    const coursePerformance = [...perfByCourse.entries()].map(
      ([courseId, e]) => ({
        courseId,
        courseName: e.name,
        courseCode: e.code,
        percent: Math.round(
          e.percents.reduce((s, p) => s + p, 0) / e.percents.length,
        ),
      }),
    );

    // Activity feed: recent submissions + completed quizzes + enrollments
    const actSubmissions = await db
      .select({
        id: submissions.id,
        studentName: user.name,
        assignmentId: submissions.assignmentId,
        assignmentTitle: assignments.title,
        createdAt: submissions.createdAt,
      })
      .from(submissions)
      .innerJoin(user, eq(submissions.studentId, user.id))
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .where(eq(assignments.organizationId, orgId))
      .orderBy(desc(submissions.createdAt))
      .limit(6);
    const actQuizzes = await db
      .select({
        id: quizAttempts.id,
        studentName: user.name,
        quizTitle: quizzes.title,
        createdAt: quizAttempts.submittedAt,
      })
      .from(quizAttempts)
      .innerJoin(user, eq(quizAttempts.studentId, user.id))
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(
        and(
          eq(quizzes.organizationId, orgId),
          eq(quizAttempts.status, "submitted"),
        ),
      )
      .orderBy(desc(quizAttempts.submittedAt))
      .limit(6);
    const actEnrollments = await db
      .select({
        id: courseEnrollments.id,
        studentName: user.name,
        courseName: courses.name,
        createdAt: courseEnrollments.enrolledAt,
      })
      .from(courseEnrollments)
      .innerJoin(user, eq(courseEnrollments.studentId, user.id))
      .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
      .where(eq(courses.organizationId, orgId))
      .orderBy(desc(courseEnrollments.enrolledAt))
      .limit(6);
    const activity: DashboardActivityItem[] = [
      ...actSubmissions.map((r) => ({
        id: `sub-${r.id}`,
        type: "submission" as const,
        title: `${r.studentName} submitted`,
        subtitle: r.assignmentTitle,
        createdAt: r.createdAt ? r.createdAt.toISOString() : null,
        href: `/assignments/${r.assignmentId}`,
      })),
      ...actQuizzes.map((r) => ({
        id: `quiz-${r.id}`,
        type: "quiz" as const,
        title: `${r.studentName} completed`,
        subtitle: r.quizTitle,
        createdAt: r.createdAt ? r.createdAt.toISOString() : null,
        href: ``,
      })),
      ...actEnrollments.map((r) => ({
        id: `enr-${r.id}`,
        type: "enrollment" as const,
        title: `${r.studentName} enrolled`,
        subtitle: r.courseName,
        createdAt: r.createdAt ? r.createdAt.toISOString() : null,
        href: ``,
      })),
    ]
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, 12);

    return {
      isAdmin: true,
      overallPercent: null,
      overallLetter: null,
      courses: [],
      upcomingQuizzes: [],
      upcomingAssignments: [],
      pendingGradingCount: pendingRes[0]?.count ?? 0,
      recentSubmissions: recentSubmissions.map((r) => ({
        id: r.submissions.id,
        assignmentId: r.submissions.assignmentId,
        fileName: r.submissions.fileName,
        assignmentTitle: r.assignments.title,
        studentName: r.user.name,
        createdAt: r.submissions.createdAt,
      })),
      recentGrades: [],
      studentCount: studentCountRes[0]?.count ?? 0,
      counts: {
        courses: courseCountRes[0]?.count ?? 0,
        quizzes: quizCountRes[0]?.count ?? 0,
        assignments: assignmentCountRes[0]?.count ?? 0,
      },
      quizStats: {
        attempts: quizAttemptRows.length,
        inProgress: quizAttemptRows.filter(
          (a) => a.status === "in_progress",
        ).length,
        submitted: submittedAttempts.length,
        passRate,
      },
      assignmentStats: {
        submitted: assignSubRows.length,
        graded: gradedAssigns.length,
        pending: assignSubRows.length - gradedAssigns.length,
        avgPercent: avgAssignmentPercent,
      },
      coursePerformance,
      activity,
    };
  }

  // Student dashboard
  const grades = await getMyGrades();
  const myCourses: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    instructorName: string | null;
    quizCount: number;
    assignmentCount: number;
    isEnrolled: boolean;
  }[] = await listCourses();

  const courseIds = myCourses.map((c) => c.id);
  const upcomingQuizzes = courseIds.length
    ? await db
        .select()
        .from(quizzes)
        .where(
          and(
            eq(quizzes.isPublished, true),
            inArray(quizzes.courseId, courseIds),
            sql`${quizzes.dueAt} > now()`,
          ),
        )
        .orderBy(asc(quizzes.dueAt))
        .limit(8)
    : [];
  const upcomingAssignments = courseIds.length
    ? await db
        .select()
        .from(assignments)
        .where(
          and(
            eq(assignments.isPublished, true),
            inArray(assignments.courseId, courseIds),
            sql`${assignments.dueAt} > now()`,
          ),
        )
        .orderBy(asc(assignments.dueAt))
        .limit(8)
    : [];

  const courseNameOf = new Map(
    myCourses.map((c) => [c.id, c.name] as const),
  );
  const upcomingQuizzesWithCourse = upcomingQuizzes.map((q) => ({
    ...q,
    courseName: courseNameOf.get(q.courseId) ?? "",
  }));
  const upcomingAssignmentsWithCourse = upcomingAssignments.map((a) => ({
    ...a,
    courseName: courseNameOf.get(a.courseId) ?? "",
  }));

  // Due-soon alerts (within 48 hours)
  const within48h = (d: Date | null | undefined) =>
    !!d && d.getTime() - Date.now() <= 48 * 3600 * 1000;
  const dueSoon: DashboardActivityItem[] = [
    ...upcomingQuizzesWithCourse
      .filter((q) => within48h(q.dueAt))
      .map((q) => ({
        id: `q-${q.id}`,
        type: "quiz" as const,
        title: q.title,
        subtitle: q.courseName,
        createdAt: q.dueAt ? q.dueAt.toISOString() : null,
        href: `/quizzes/${q.id}`,
      })),
    ...upcomingAssignmentsWithCourse
      .filter((a) => within48h(a.dueAt))
      .map((a) => ({
        id: `a-${a.id}`,
        type: "assignment" as const,
        title: a.title,
        subtitle: a.courseName,
        createdAt: a.dueAt ? a.dueAt.toISOString() : null,
        href: `/assignments/${a.id}`,
      })),
  ].sort((x, y) => (y.createdAt ?? "").localeCompare(x.createdAt ?? ""));

  // Per-course progress (published quizzes + assignments vs completed work)
  const publishedQuizRows = courseIds.length
    ? await db
        .select({ id: quizzes.id, courseId: quizzes.courseId })
        .from(quizzes)
        .where(and(inArray(quizzes.courseId, courseIds), eq(quizzes.isPublished, true)))
    : [];
  const publishedAssignRows = courseIds.length
    ? await db
        .select({ id: assignments.id, courseId: assignments.courseId })
        .from(assignments)
        .where(and(inArray(assignments.courseId, courseIds), eq(assignments.isPublished, true)))
    : [];
  const courseTotals = new Map<string, { quizzes: number; assignments: number }>();
  for (const q of publishedQuizRows) {
    const t = courseTotals.get(q.courseId) ?? { quizzes: 0, assignments: 0 };
    t.quizzes += 1;
    courseTotals.set(q.courseId, t);
  }
  for (const a of publishedAssignRows) {
    const t = courseTotals.get(a.courseId) ?? { quizzes: 0, assignments: 0 };
    t.assignments += 1;
    courseTotals.set(a.courseId, t);
  }
  const quizCourseOf = new Map(publishedQuizRows.map((q) => [q.id, q.courseId] as const));
  const assignCourseOf = new Map(
    publishedAssignRows.map((a) => [a.id, a.courseId] as const),
  );
  const completedByCourse = new Map<string, number>();
  const bump = (courseId?: string) => {
    if (!courseId) return;
    completedByCourse.set(courseId, (completedByCourse.get(courseId) ?? 0) + 1);
  };
  const myAttemptsRes = courseIds.length
    ? await db
        .select({ quizId: quizAttempts.quizId })
        .from(quizAttempts)
        .where(
          and(
            eq(quizAttempts.studentId, u.id),
            eq(quizAttempts.status, "submitted"),
            inArray(quizAttempts.quizId, publishedQuizRows.map((q) => q.id)),
          ),
        )
    : [];
  myAttemptsRes.forEach((t) => bump(quizCourseOf.get(t.quizId)));
  const mySubsRes = courseIds.length
    ? await db
        .select({ assignmentId: submissions.assignmentId })
        .from(submissions)
        .where(
          and(
            eq(submissions.studentId, u.id),
            inArray(submissions.assignmentId, publishedAssignRows.map((a) => a.id)),
          ),
        )
    : [];
  mySubsRes.forEach((s) => bump(assignCourseOf.get(s.assignmentId)));
  const courseProgress = myCourses
    .filter((c) => c.isEnrolled)
    .map((c) => {
      const t = courseTotals.get(c.id) ?? { quizzes: 0, assignments: 0 };
      const total = t.quizzes + t.assignments;
      const completed = completedByCourse.get(c.id) ?? 0;
      return {
        courseId: c.id,
        courseName: c.name,
        courseCode: c.code,
        completed,
        total,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

  // Score trend (chronological) for charts
  const scoreTrend = [...grades.rows]
    .reverse()
    .slice(-12)
    .map((r) => ({ title: r.title, percent: r.percent }));

  // Recent activity
  const myRecentAttempts = courseIds.length
    ? await db
        .select({
          id: quizAttempts.id,
          quizTitle: quizzes.title,
          submittedAt: quizAttempts.submittedAt,
        })
        .from(quizAttempts)
        .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
        .where(
          and(
            eq(quizAttempts.studentId, u.id),
            eq(quizAttempts.status, "submitted"),
            inArray(quizzes.courseId, courseIds),
          ),
        )
        .orderBy(desc(quizAttempts.submittedAt))
        .limit(5)
    : [];
  const myRecentSubs = courseIds.length
    ? await db
        .select({
          id: submissions.id,
          assignmentTitle: assignments.title,
          fileName: submissions.fileName,
          assignmentId: submissions.assignmentId,
          createdAt: submissions.createdAt,
        })
        .from(submissions)
        .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
        .where(
          and(
            eq(submissions.studentId, u.id),
            inArray(assignments.courseId, courseIds),
          ),
        )
        .orderBy(desc(submissions.createdAt))
        .limit(5)
    : [];
  const activity: DashboardActivityItem[] = [
    ...myRecentAttempts.map((r) => ({
      id: `q-${r.id}`,
      type: "quiz" as const,
      title: r.quizTitle,
      subtitle: "Quiz completed",
      createdAt: r.submittedAt ? r.submittedAt.toISOString() : null,
      href: ``,
    })),
    ...myRecentSubs.map((r) => ({
      id: `s-${r.id}`,
      type: "submission" as const,
      title: r.assignmentTitle,
      subtitle: r.fileName ? `Submitted ${r.fileName}` : "Assignment submitted",
      createdAt: r.createdAt ? r.createdAt.toISOString() : null,
      href: `/assignments/${r.assignmentId}`,
    })),
    ...grades.rows.slice(0, 5).map((r) => ({
      id: `g-${r.id}`,
      type: "grade" as const,
      title: r.title,
      subtitle: `${r.courseCode} · ${r.percent ?? 0}% · ${r.kind}`,
      createdAt: r.gradedAt ? r.gradedAt.toISOString() : null,
      href: r.kind === "quiz" ? `/quizzes/${r.id}` : `/assignments/${r.id}`,
    })),
  ]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 12);

  return {
    isAdmin: false,
    overallPercent: grades.overallPercent,
    overallLetter: grades.overallLetter,
    courses: myCourses,
    upcomingQuizzes: upcomingQuizzesWithCourse,
    upcomingAssignments: upcomingAssignmentsWithCourse,
    pendingGradingCount: 0,
    recentSubmissions: [],
    recentGrades: grades.rows.slice(0, 5),
    studentCount: 0,
    dueSoon,
    courseProgress,
    scoreTrend,
    activity,
  };
}

export type MyQuizItem = {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  title: string;
  durationMinutes: number;
  totalQuestions: number;
  maxScore: number;
  dueAt: Date | null;
  isPublished: boolean;
  status: "not_attempted" | "in_progress" | "submitted";
  scoreEarned: number | null;
  scoreTotal: number | null;
};

export async function listMyQuizzes(): Promise<MyQuizItem[]> {
  const u = await requireUser();
  const isAdmin = u.role === "admin";
  const orgId = await getCurrentOrgId();
  if (!orgId) return [];

  const courseIds = isAdmin
    ? (
        await db.query.courses.findMany({
          where: (c, { eq: e }) => e(c.organizationId, orgId),
          columns: { id: true },
        })
      ).map((c) => c.id)
    : (
        await db
          .select({ courseId: courseEnrollments.courseId })
          .from(courseEnrollments)
          .where(eq(courseEnrollments.studentId, u.id))
      ).map((r) => r.courseId);

  if (!courseIds.length) return [];

  const rows = await db.query.quizzes.findMany({
    where: (q, { and: a, eq: e, inArray: ia }) =>
      a(
        e(q.organizationId, orgId),
        isAdmin ? ia(q.courseId, courseIds) : ia(q.courseId, courseIds),
        isAdmin ? undefined : e(q.isPublished, true),
      ),
    with: {
      course: { columns: { id: true, name: true, code: true } },
      attempts: {
        columns: { id: true, status: true, scoreEarned: true, scoreTotal: true },
        where: isAdmin
          ? undefined
          : (a, { eq: e }) => e(a.studentId, u.id),
      },
    },
    orderBy: (q, { desc: d }) => [d(q.createdAt)],
  });

  return rows.map((r) => {
    const c = (r as any).course;
    const attempt = r.attempts[0];
    const status =
      attempt?.status === "submitted"
        ? "submitted"
        : attempt?.status === "in_progress"
          ? "in_progress"
          : "not_attempted";
    return {
      id: r.id,
      courseId: r.courseId,
      courseCode: c?.code ?? "",
      courseName: c?.name ?? "",
      title: r.title,
      durationMinutes: r.durationMinutes ?? 0,
      totalQuestions: r.totalQuestions ?? 0,
      maxScore: r.maxScore ?? 0,
      dueAt: r.dueAt,
      isPublished: r.isPublished,
      status,
      scoreEarned: attempt?.scoreEarned ?? null,
      scoreTotal: attempt?.scoreTotal ?? null,
    } satisfies MyQuizItem;
  });
}

async function getCourseIdMap(
  isAdmin: boolean,
  orgId: string,
  userId: string,
): Promise<Map<string, { name: string; code: string }>> {
  if (isAdmin) {
    const rows = await db.query.courses.findMany({
      where: (c, { eq: e }) => e(c.organizationId, orgId),
      columns: { id: true, name: true, code: true },
    });
    return new Map(rows.map((c) => [c.id, { name: c.name, code: c.code }]));
  }
  const rows = await db
    .select({ id: courses.id, name: courses.name, code: courses.code })
    .from(courseEnrollments)
    .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
    .where(eq(courseEnrollments.studentId, userId));
  return new Map(rows.map((c) => [c.id, { name: c.name, code: c.code }]));
}

export type MyAssignmentItem = {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  title: string;
  maxScore: number;
  dueAt: Date | null;
  isPublished: boolean;
  status: "not_submitted" | "submitted" | "graded";
  grade: number | null;
};

export async function listMyAssignments(): Promise<MyAssignmentItem[]> {
  const u = await requireUser();
  const isAdmin = u.role === "admin";
  const orgId = await getCurrentOrgId();
  if (!orgId) return [];

  const courseMap = await getCourseIdMap(isAdmin, orgId, u.id);
  if (!courseMap.size) return [];

  const rows = await db.query.assignments.findMany({
    where: (a, { and: x, eq: e, inArray: ia }) =>
      x(
        e(a.organizationId, orgId),
        ia(a.courseId, [...courseMap.keys()]),
        isAdmin ? undefined : e(a.isPublished, true),
      ),
    with: {
      submissions: {
        columns: { id: true, status: true, grade: true },
        where: (s, { eq: e2 }) => e2(s.studentId, u.id),
      },
    },
    orderBy: (a, { desc: d }) => [d(a.createdAt)],
  });

  return rows.map((r) => {
    const sub = r.submissions[0];
    return {
      id: r.id,
      courseId: r.courseId,
      courseCode: courseMap.get(r.courseId)?.code ?? "",
      courseName: courseMap.get(r.courseId)?.name ?? "",
      title: r.title,
      maxScore: r.maxScore ?? 0,
      dueAt: r.dueAt,
      isPublished: r.isPublished,
      status: sub
        ? (sub.status as "submitted" | "graded")
        : "not_submitted",
      grade: sub?.grade ?? null,
    } satisfies MyAssignmentItem;
  });
}

export async function getUpcomingForCourse(courseId: string) {
  const u = await requireUser();
  if (u.role === "admin") {
    const orgId = await getCurrentOrgId();
    const course = await db.query.courses.findFirst({
      where: (c, { eq: e }) => e(c.id, courseId),
      columns: { id: true, organizationId: true },
    });
    if (!course || !orgId || course.organizationId !== orgId) {
      throw new Error("Course not found.");
    }
  } else {
    const enrolled = await db.query.courseEnrollments.findFirst({
      where: (ce, { eq: e }) =>
        and(e(ce.courseId, courseId), e(ce.studentId, u.id)),
    });
    if (!enrolled) throw new Error("You are not enrolled in this course.");
  }
  const [quizList, assignmentList] = await Promise.all([
    db
      .select()
      .from(quizzes)
      .where(
        and(
          eq(quizzes.courseId, courseId),
          u.role !== "admin" ? eq(quizzes.isPublished, true) : undefined,
        ),
      )
      .orderBy(asc(quizzes.dueAt)),
    db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.courseId, courseId),
          u.role !== "admin" ? eq(assignments.isPublished, true) : undefined,
        ),
      )
      .orderBy(asc(assignments.dueAt)),
  ]);
  return { quizzes: quizList, assignments: assignmentList };
}