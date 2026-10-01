"use server";

import { randomInt } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/db/drizzle";
import {
  assignmentAttachments,
  assignments,
  ATTENDANCE_STATUSES,
  attendanceRecords,
  attendanceSessions,
  courseEnrollments,
  courseResources,
  courses,
  gradebookEntries,
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
import {
  computeGradebook,
  WEIGHTS,
  type GradebookResult,
} from "@/lib/gradebook";
import { parseStudentList } from "@/lib/student-list";

// ─────────────────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * One session resolution per request. `requireUser`, `requireAdmin` and
 * `getCurrentOrgId` each used to call `auth.api.getSession` independently, so a
 * single action cost two or three identical round-trips to the database. React's
 * `cache` collapses them into one lookup for the lifetime of the request.
 */
const getRequestSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

const requireSession = async () => {
  const session = await getRequestSession();
  if (!session?.user) redirect("/login");
  return session;
};

async function requireUser() {
  const { user } = await requireSession();
  return user;
}

async function requireAdmin() {
  const { user } = await requireSession();
  if (user.role !== "admin") {
    throw new Error("Only admins can perform this action.");
  }
  return user;
}

async function getOrgIdForUser(userId: string) {
  const membership = await db.query.member.findFirst({
    where: (m, { eq: e }) => e(m.userId, userId),
  });
  return membership?.organizationId ?? null;
}

async function getCurrentOrgId() {
  const session = await requireSession();
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

async function assertResourceInOrg(resourceId: string, orgId: string) {
  const row = await db.query.courseResources.findFirst({
    where: (r, { eq: e }) => e(r.id, resourceId),
    columns: { id: true, courseId: true, filePath: true },
  });
  if (!row) throw new Error("Resource not found.");
  await assertCourseInOrg(row.courseId, orgId);
  return row;
}

async function removeStorageObjects(paths: string[]) {
  if (!paths.length) return;
  if (!(await ensureBucket())) return;
  await getSupabaseServer()!
    .storage.from(SUBMISSION_BUCKET)
    .remove(paths);
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

/**
 * Courses the signed-in user should see on `/courses`.
 * Admins get every course in the org; students only get the ones they are
 * enrolled in. Use `listCourseCatalog` for the read-only "all courses" view.
 */
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

  const rows = await db.query.courses.findMany({
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

  return rows
    .filter((row) => isAdmin || enrolledRows.has(row.id))
    .map((row) => ({
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

/**
 * Read-only listing of every course in the org, including ones the student is
 * not enrolled in. There is deliberately no self-enroll path here: enrolling is
 * an admin-only action.
 */
export async function listCourseCatalog() {
  const u = await requireUser();
  const orgId = await getCurrentOrgId();
  if (!orgId) return [];

  const rows = await db.query.courses.findMany({
    where: (c, { eq: e }) => e(c.organizationId, orgId),
    with: {
      quizzes: { columns: { id: true } },
      assignments: { columns: { id: true } },
      courseEnrollments: { columns: { id: true } },
    },
    orderBy: (c, { asc: a }) => [a(c.name)],
  });

  const enrolledRows = new Set(
    (
      await db
        .select({ courseId: courseEnrollments.courseId })
        .from(courseEnrollments)
        .where(eq(courseEnrollments.studentId, u.id))
    ).map((r) => r.courseId),
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    instructorName: row.instructorName,
    term: row.term,
    quizCount: row.quizzes.length,
    assignmentCount: row.assignments.length,
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
      resources: {
        orderBy: (r, { asc: ascR }) => [ascR(r.createdAt)],
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
      usesWeightedGrading: course.usesWeightedGrading,
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
    resources: (course.resources as any[])
      .filter((r) => isAdmin || r.isPublished)
      .map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        kind: r.kind,
        url: r.kind === "link" ? r.url : null,
        fileName: r.fileName,
        fileSize: r.fileSize,
        isPublished: r.isPublished,
        createdAt: r.createdAt,
      })),
    enrollments,
    isEnrolled,
    isAdmin,
  };
}

/**
 * Deleting a course cascades to its quizzes, assignments and every student
 * submission, so the caller must echo back the course code. The UI asks the
 * admin to type it; this check makes the confirmation unavoidable.
 */
export async function deleteCourse(
  courseId: string,
  confirmation?: string,
) {
  const { orgId } = await requireAdminOrg();
  await assertCourseInOrg(courseId, orgId);

  const [course] = await db
    .select({ name: courses.name, code: courses.code })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.organizationId, orgId)))
    .limit(1);
  if (!course) throw new Error("That course no longer exists.");

  if ((confirmation ?? "").trim().toUpperCase() !== course.code.toUpperCase()) {
    throw new Error(
      `Type the course code ${course.code} to confirm deletion.`,
    );
  }

  const stored = await db
    .select({ filePath: courseResources.filePath })
    .from(courseResources)
    .where(eq(courseResources.courseId, courseId));
  await removeStorageObjects(
    stored.map((r) => r.filePath).filter((p): p is string => !!p),
  );

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

export type BulkEnrollResult = {
  success: boolean;
  message: string;
  added: number;
  alreadyEnrolled: number;
  unknown: number;
  total: number;
};

/** Guard rail so one paste/dialog can't try to insert a whole institute. */
const MAX_BULK_ENROLLMENTS = 200;

const addEnrollments = async (
  courseId: string,
  orgId: string,
  studentIds: string[],
) => {
  // Dedupe within the batch and drop empties.
  const requested = [...new Set(studentIds.map((id) => id?.trim()).filter(Boolean))];
  if (!requested.length) {
    return { added: 0, alreadyEnrolled: 0, unknown: 0, total: 0 };
  }
  if (requested.length > MAX_BULK_ENROLLMENTS) {
    throw new Error(
      `That is ${requested.length} students — the limit is ${MAX_BULK_ENROLLMENTS} at a time. Split the list.`,
    );
  }

  // Only students that actually belong to this org can be enrolled.
  const orgIds = new Set(await getOrgStudentIds(orgId));
  const inOrg = requested.filter((id) => orgIds.has(id));
  const notInOrg = requested.length - inOrg.length;

  const knownStudents = inOrg.length
    ? await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.role, "student"), inArray(user.id, inOrg)))
    : [];
  const studentSet = new Set(knownStudents.map((s) => s.id));

  const unknown =
    notInOrg + inOrg.filter((id) => !studentSet.has(id)).length;
  const targets = inOrg.filter((id) => studentSet.has(id));

  if (!targets.length) {
    return { added: 0, alreadyEnrolled: 0, unknown, total: requested.length };
  }

  const existing = await db
    .select({ studentId: courseEnrollments.studentId })
    .from(courseEnrollments)
    .where(
      and(
        eq(courseEnrollments.courseId, courseId),
        inArray(courseEnrollments.studentId, targets),
      ),
    );
  const existingSet = new Set(existing.map((e) => e.studentId));
  const toAdd = targets.filter((id) => !existingSet.has(id));

  if (toAdd.length) {
    // onConflictDoNothing makes this safe even if two admins click at once.
    await db
      .insert(courseEnrollments)
      .values(toAdd.map((studentId) => ({ courseId, studentId })))
      .onConflictDoNothing({
        target: [courseEnrollments.courseId, courseEnrollments.studentId],
      });
  }

  return {
    added: toAdd.length,
    alreadyEnrolled: targets.length - toAdd.length,
    unknown,
    total: requested.length,
  };
};

export async function enrollStudents(courseId: string, studentIds: string[]) {
  const { orgId } = await requireAdminOrg();
  await assertCourseInOrg(courseId, orgId);
  const result = await addEnrollments(courseId, orgId, studentIds ?? []);
  return { success: true, ...result };
}

/**
 * Enroll a whole class at once from a pasted list of emails or names.
 * Anything that is not an org student is reported instead of inserted.
 */
export async function enrollStudentsByList(
  courseId: string,
  input: { list: string; enrollAll?: boolean },
): Promise<BulkEnrollResult> {
  const { orgId } = await requireAdminOrg();
  await assertCourseInOrg(courseId, orgId);

  try {
    const students = await listStudents();
    const known = new Map(students.map((s) => [s.email.toLowerCase(), s]));

    let targets: { id: string; email: string }[] = [];

    if (input.enrollAll) {
      targets = students.map((s) => ({ id: s.id, email: s.email }));
    } else {
      const entries = parseStudentList(input.list ?? "");
      if (!entries.length) {
        return {
          success: false,
          message: "No valid email addresses found in the list.",
          added: 0,
          alreadyEnrolled: 0,
          unknown: 0,
          total: 0,
        };
      }
      const missing: string[] = [];
      for (const entry of entries) {
        const match = known.get(entry.email);
        if (match) {
          targets.push({ id: match.id, email: match.email });
        } else {
          missing.push(entry.email);
        }
      }
      if (missing.length) {
        return {
          success: false,
          message: `${missing.length} address${
            missing.length === 1 ? " is" : "es are"
          } not a student account yet: ${missing.slice(0, 5).join(", ")}${
            missing.length > 5 ? ` +${missing.length - 5} more` : ""
          }. Create them on the Users page first.`,
          added: 0,
          alreadyEnrolled: 0,
          unknown: missing.length,
          total: entries.length,
        };
      }
    }

    const result = await addEnrollments(
      courseId,
      orgId,
      targets.map((t) => t.id),
    );

    const parts: string[] = [];
    if (result.added > 0) {
      parts.push(`${result.added} enrolled`);
    }
    if (result.alreadyEnrolled > 0) {
      parts.push(`${result.alreadyEnrolled} already enrolled`);
    }
    if (parts.length === 0) {
      parts.push("Nothing to do");
    }

    return {
      success:
        result.unknown === 0 && (result.added > 0 || result.alreadyEnrolled > 0),
      message: parts.join(" · "),
      ...result,
    };
  } catch (error) {
    const e = error as Error;
    return {
      success: false,
      message: e.message || "Failed to enroll students.",
      added: 0,
      alreadyEnrolled: 0,
      unknown: 0,
      total: 0,
    };
  }
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

/** Uploaded resources are capped here; next.config.ts allows a little more. */
const MAX_RESOURCE_BYTES = 25 * 1024 * 1024;

/**
 * Course resources are read-only study material: a link, or a file served from
 * the private bucket through a short-lived signed URL.
 */
export async function createCourseResource(
  courseId: string,
  formData: FormData,
) {
  const { orgId } = await requireAdminOrg();
  await assertCourseInOrg(courseId, orgId);

  const title = ((formData.get("title") as string) ?? "").trim();
  if (!title) throw new Error("Title is required.");
  const description =
    ((formData.get("description") as string) ?? "").trim() || null;

  if (formData.get("kind") === "file") {
    const file = formData.get("file") as File | null;
    if (!file || !file.size) throw new Error("Please choose a file.");
    if (file.size > MAX_RESOURCE_BYTES) {
      throw new Error("Files must be 25 MB or smaller.");
    }
    if (!(await ensureBucket())) {
      throw new Error(
        "Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
    const supabase = getSupabaseServer()!;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `course-resources/${courseId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safeName}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(SUBMISSION_BUCKET)
      .upload(filePath, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const [created] = await db
      .insert(courseResources)
      .values({
        courseId,
        title,
        description,
        kind: "file",
        fileName: file.name,
        filePath,
        fileSize: file.size,
      })
      .returning();
    return created;
  }

  const rawUrl = ((formData.get("url") as string) ?? "").trim();
  if (!rawUrl) throw new Error("Please add a link.");
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("That link is not valid.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Links must start with http:// or https://");
  }

  const [created] = await db
    .insert(courseResources)
    .values({
      courseId,
      title,
      description,
      kind: "link",
      url: parsed.toString(),
    })
    .returning();
  return created;
}

export async function toggleCourseResourcePublish(
  resourceId: string,
  isPublished: boolean,
) {
  const { orgId } = await requireAdminOrg();
  await assertResourceInOrg(resourceId, orgId);

  const [updated] = await db
    .update(courseResources)
    .set({ isPublished })
    .where(eq(courseResources.id, resourceId))
    .returning();
  if (!updated) throw new Error("Resource not found.");
  return { success: true };
}

export async function deleteCourseResource(resourceId: string) {
  const { orgId } = await requireAdminOrg();
  const row = await assertResourceInOrg(resourceId, orgId);

  if (row.filePath) await removeStorageObjects([row.filePath]);
  await db
    .delete(courseResources)
    .where(eq(courseResources.id, resourceId));
  return { success: true };
}

/**
 * Students may only open resources of a course they are enrolled in, and only
 * once the admin has published them. Admins see drafts.
 */
export async function getCourseResourceUrl(resourceId: string) {
  const u = await requireUser();
  const resource = await db.query.courseResources.findFirst({
    where: (r, { eq: e }) => e(r.id, resourceId),
  });
  if (!resource) throw new Error("Resource not found.");

  const course = await db.query.courses.findFirst({
    where: (c, { eq: e }) => e(c.id, resource.courseId),
    columns: { id: true, organizationId: true },
  });
  if (!course) throw new Error("Course not found.");

  const orgId = await getCurrentOrgId();
  const isAdminOfOrg =
    u.role === "admin" && !!orgId && course.organizationId === orgId;
  if (!isAdminOfOrg) {
    const enrolled = await db.query.courseEnrollments.findFirst({
      where: (ce, { eq: e }) =>
        and(e(ce.courseId, course.id), e(ce.studentId, u.id)),
    });
    if (!enrolled) throw new Error("You are not enrolled in this course.");
    if (!resource.isPublished) throw new Error("Resource not available yet.");
  }

  if (resource.kind === "link") return resource.url;
  if (!resource.filePath) return null;

  if (!(await ensureBucket())) throw new Error("Storage is not configured.");
  const { data, error } = await getSupabaseServer()!
    .storage.from(SUBMISSION_BUCKET)
    .createSignedUrl(resource.filePath, 3600);
  if (error || !data?.signedUrl) {
    throw new Error("Could not create a download link.");
  }
  return data.signedUrl;
}

// ─────────────────────────────────────────────────────────────────────────
// Attendance
//
// A session is one class. The admin ticks the roster, and a short code lets
// students mark themselves present. The code is only accepted from 15 minutes
// before the class starts until 15 minutes after it ends.
// ─────────────────────────────────────────────────────────────────────────

const ATTENDANCE_MARGIN_MS = 15 * 60 * 1000;

const attendanceWindow = (session: {
  startsAt: Date;
  durationMinutes: number;
}) => {
  const opens = new Date(new Date(session.startsAt).getTime() - ATTENDANCE_MARGIN_MS);
  const ends = new Date(
    new Date(session.startsAt).getTime() + session.durationMinutes * 60_000,
  );
  return {
    opensAt: opens,
    endsAt: ends,
    closesAt: new Date(ends.getTime() + ATTENDANCE_MARGIN_MS),
  };
};

const attendanceIsOpen = (session: {
  startsAt: Date;
  durationMinutes: number;
}) => {
  const { opensAt, closesAt } = attendanceWindow(session);
  const now = Date.now();
  return now >= opensAt.getTime() && now <= closesAt.getTime();
};


const emptyCounts = (): Record<string, number> => ({ present: 0, absent: 0, late: 0, excused: 0 });

export async function createAttendanceSession(
  courseId: string,
  input: { title?: string; startsAt: string; durationMinutes: number },
) {
  const { admin, orgId } = await requireAdminOrg();
  await assertCourseInOrg(courseId, orgId);

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new Error("Pick a valid start time.");
  }
  const durationMinutes = Math.round(input.durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
    throw new Error("Class length must be between 5 and 480 minutes.");
  }

  const title =
    input.title?.trim() ||
    `Class — ${startsAt.toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })}`;

  const [created] = await db
    .insert(attendanceSessions)
    .values({
      courseId,
      organizationId: orgId,
      title,
      startsAt,
      durationMinutes,
      createdBy: admin.id,
    })
    .returning();

  return {
    id: created.id,
    title: created.title,
    startsAt: created.startsAt,
    durationMinutes: created.durationMinutes,
    ...attendanceWindow(created),
  };
}

export async function listAttendanceSessions(courseId: string) {
  const { orgId } = await requireAdminOrg();
  await assertCourseInOrg(courseId, orgId);

  const sessions = await db
    .select()
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.courseId, courseId),
        eq(attendanceSessions.organizationId, orgId),
      ),
    )
    .orderBy(desc(attendanceSessions.startsAt));

  const records = await db
    .select({
      sessionId: attendanceRecords.sessionId,
      status: attendanceRecords.status,
    })
    .from(attendanceRecords)
    .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
    .where(eq(attendanceSessions.courseId, courseId));

  const counts = new Map<string, Record<string, number>>();
  for (const r of records) {
    const bucket = counts.get(r.sessionId) ?? emptyCounts();
    bucket[r.status] = (bucket[r.status] ?? 0) + 1;
    counts.set(r.sessionId, bucket);
  }

  return sessions.map((s) => {
    const bucket = counts.get(s.id) ?? emptyCounts();
    const marked = Object.values(bucket).reduce((a, b) => a + b, 0);
    return {
      id: s.id,
      title: s.title,
      startsAt: s.startsAt,
      durationMinutes: s.durationMinutes,
      isOpenNow: attendanceIsOpen(s),
      ...attendanceWindow(s),
      counts: bucket,
      marked,
    };
  });
}

export async function getAttendanceSheet(sessionId: string) {
  const { orgId } = await requireAdminOrg();
  const session = await db.query.attendanceSessions.findFirst({
    where: (s, { eq: e }) => e(s.id, sessionId),
  });
  if (!session) throw new Error("That class session no longer exists.");
  await assertCourseInOrg(session.courseId, orgId);

  // Same roster the enrollment list shows.
  const roster = await listEnrolledStudents(session.courseId);
  const records = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.sessionId, sessionId));
  const byStudent = new Map(records.map((r) => [r.studentId, r]));

  return {
    session: {
      id: session.id,
      courseId: session.courseId,
      title: session.title,
      startsAt: session.startsAt,
      durationMinutes: session.durationMinutes,
      isOpenNow: attendanceIsOpen(session),
      ...attendanceWindow(session),
    },
    students: roster
      .map((s) => {
        const record = byStudent.get(s.id);
        return {
          id: s.id,
          name: s.name,
          email: s.email,
          status: (record?.status ?? null) as (typeof ATTENDANCE_STATUSES)[number] | null,
          method: (record?.method ?? null) as "manual" | null,
          markedAt: record?.markedAt ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function saveAttendance(
  sessionId: string,
  entries: { studentId: string; status: string }[],
) {
  const { admin, orgId } = await requireAdminOrg();
  const session = await db.query.attendanceSessions.findFirst({
    where: (s, { eq: e }) => e(s.id, sessionId),
  });
  if (!session) throw new Error("That class session no longer exists.");
  await assertCourseInOrg(session.courseId, orgId);

  const roster = await listEnrolledStudents(session.courseId);
  const allowed = new Set(roster.map((s) => s.id));
  const clean = entries.filter(
    (e): e is { studentId: string; status: (typeof ATTENDANCE_STATUSES)[number] } =>
      allowed.has(e.studentId) &&
      (ATTENDANCE_STATUSES as readonly string[]).includes(e.status),
  );
  if (clean.length !== entries.length) {
    throw new Error(
      "One of those entries is not a student on this course roster, or has an invalid status.",
    );
  }

  const existing = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.sessionId, sessionId));
  const byStudent = new Map(existing.map((r) => [r.studentId, r]));
  const now = new Date();

  for (const entry of clean) {
    const prior = byStudent.get(entry.studentId);
    // Keep the "self check-in" badge when the admin confirms the same result.
      await db
      .insert(attendanceRecords)
      .values({
        sessionId,
        studentId: entry.studentId,
        status: entry.status,
        method: "manual",
        markedBy: admin.id,
        markedAt: now,
      })
      .onConflictDoUpdate({
        target: [attendanceRecords.sessionId, attendanceRecords.studentId],
        set: {
          status: entry.status,
          method: "manual",
          markedBy: admin.id,
          markedAt: now,
        },
      });
  }

  return { success: true, saved: clean.length };
}

export async function deleteAttendanceSession(sessionId: string) {
  const { orgId } = await requireAdminOrg();
  const session = await db.query.attendanceSessions.findFirst({
    where: (s, { eq: e }) => e(s.id, sessionId),
    columns: { id: true, courseId: true },
  });
  if (!session) return { success: true };
  await assertCourseInOrg(session.courseId, orgId);
  // attendance_records cascade with the session
  await db.delete(attendanceSessions).where(eq(attendanceSessions.id, sessionId));
  return { success: true };
}

/** The student's own recent classes, for the check-in page. */
export async function listMyAttendance() {
  const u = await requireUser();
  const rows = await db
    .select({
      sessionId: attendanceSessions.id,
      title: attendanceSessions.title,
      courseId: attendanceSessions.courseId,
      courseName: courses.name,
      courseCode: courses.code,
      startsAt: attendanceSessions.startsAt,
      durationMinutes: attendanceSessions.durationMinutes,
      status: attendanceRecords.status,
      method: attendanceRecords.method,
    })
    .from(attendanceSessions)
    .innerJoin(
      courseEnrollments,
      and(
        eq(courseEnrollments.courseId, attendanceSessions.courseId),
        eq(courseEnrollments.studentId, u.id),
      ),
    )
    .leftJoin(
      attendanceRecords,
      and(
        eq(attendanceRecords.sessionId, attendanceSessions.id),
        eq(attendanceRecords.studentId, u.id),
      ),
    )
    .leftJoin(courses, eq(courses.id, attendanceSessions.courseId))
    .orderBy(desc(attendanceSessions.startsAt))
    .limit(20);

  return rows.map((r) => ({
    ...r,
    isOpenNow: attendanceIsOpen({
      startsAt: r.startsAt,
      durationMinutes: r.durationMinutes,
    }),
  }));
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
  if (!orgId) {
    return { rows: [], courseIds: [], overallPercent: null, overallLetter: null };
  }

  const myCourses = await db
    .select({ courseId: courseEnrollments.courseId })
    .from(courseEnrollments)
    .where(eq(courseEnrollments.studentId, u.id));
  const courseIds = myCourses.map((r) => r.courseId);
  if (!courseIds.length) {
    return { rows: [], courseIds, overallPercent: null, overallLetter: null };
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
    courseIds,
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
/* ------------------------------------------------------------------ *
 * Weighted gradebook (Agentic AI Architect quarters, out of 100)
 * ------------------------------------------------------------------ */

export type GradebookStudentRow = {
  studentId: string;
  name: string;
  email: string;
  finalExam: number | null;
  midTerm: number | null;
  conduct: number;
  participation: number;
  remarks: string | null;
  quizPercent: number | null;
  assignmentPercent: number | null;
  attendancePercent: number | null;
  result: GradebookResult;
};

const asNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Average of a set of (earned, max) pairs, ignoring anything not graded yet. */
const averagePercent = (pairs: { earned: number | null; max: number | null }[]) => {
  const usable = pairs.filter(
    (p) => p.earned !== null && p.max !== null && p.max > 0,
  );
  if (!usable.length) return null;
  const sum = usable.reduce((acc, p) => acc + ((p.earned as number) / (p.max as number)) * 100, 0);
  return sum / usable.length;
};

/**
 * The three derived inputs for one student in one course. Quizzes and
 * assignments come from graded work; attendance counts present and late as
 * attended and leaves excused absences out of the denominator entirely.
 */
async function derivedInputs(courseId: string, studentId: string) {
  const [attempts, gradedSubs, records] = await Promise.all([
    db
      .select({
        earned: quizAttempts.scoreEarned,
        max: quizAttempts.scoreTotal,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(
        and(
          eq(quizAttempts.studentId, studentId),
          eq(quizAttempts.status, "submitted"),
          eq(quizzes.courseId, courseId),
        ),
      ),
    db
      .select({ earned: submissions.grade, max: assignments.maxScore })
      .from(submissions)
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .where(
        and(
          eq(submissions.studentId, studentId),
          eq(submissions.status, "graded"),
          eq(assignments.courseId, courseId),
        ),
      ),
    db
      .select({ status: attendanceRecords.status })
      .from(attendanceRecords)
      .innerJoin(
        attendanceSessions,
        eq(attendanceRecords.sessionId, attendanceSessions.id),
      )
      .where(
        and(
          eq(attendanceRecords.studentId, studentId),
          eq(attendanceSessions.courseId, courseId),
        ),
      ),
  ]);

  const counted = records.filter(
    (r) => r.status !== null && r.status !== "excused",
  );
  const attended = counted.filter(
    (r) => r.status === "present" || r.status === "late",
  );

  return {
    quizPercent: averagePercent(attempts),
    assignmentPercent: averagePercent(gradedSubs),
    attendancePercent: counted.length ? (attended.length / counted.length) * 100 : null,
  };
}

function assertWeightedCourse(courseId: string, weighted: boolean) {
  if (!weighted) {
    throw new Error("This course does not use the weighted grading scheme.");
  }
}

/** Admin view: the whole roster with each student's computed grade. */
export async function listCourseGradebook(courseId: string) {
  const { orgId } = await requireAdminOrg();
  const [course] = await db
    .select({
      id: courses.id,
      name: courses.name,
      code: courses.code,
      weighted: courses.usesWeightedGrading,
    })
    .from(courses)
    .where(eq(courses.id, courseId));
  if (!course) throw new Error("Course not found.");
  await assertCourseInOrg(courseId, orgId);
  assertWeightedCourse(courseId, course.weighted);

  const roster = await listEnrolledStudents(courseId);
  const entries = await db
    .select()
    .from(gradebookEntries)
    .where(eq(gradebookEntries.courseId, courseId));
  const byStudent = new Map(entries.map((e) => [e.studentId, e]));

  const rows: GradebookStudentRow[] = [];
  for (const s of roster) {
    const entry = byStudent.get(s.id);
    const derived = await derivedInputs(courseId, s.id);
    rows.push({
      studentId: s.id,
      name: s.name,
      email: s.email,
      finalExam: asNumber(entry?.finalExamScore),
      midTerm: asNumber(entry?.midTermScore),
      conduct: asNumber(entry?.conductScore) ?? 0,
      participation: asNumber(entry?.participationScore) ?? 0,
      remarks: entry?.remarks ?? null,
      ...derived,
      result: computeGradebook({
        finalExam: asNumber(entry?.finalExamScore),
        midTerm: asNumber(entry?.midTermScore),
        conduct: asNumber(entry?.conductScore) ?? 0,
        participation: asNumber(entry?.participationScore) ?? 0,
        ...derived,
      }),
    });
  }
  return { course, weights: WEIGHTS, rows };
}

/** Save one student's teacher-entered marks. Derived parts are never written. */
export async function saveGradebookEntry(input: {
  courseId: string;
  studentId: string;
  finalExam: number | null;
  midTerm: number | null;
  conduct: number;
  participation: number;
  remarks?: string | null;
}) {
  const u = await requireAdmin();
  const { orgId } = await requireAdminOrg();
  const [course] = await db
    .select({ weighted: courses.usesWeightedGrading })
    .from(courses)
    .where(eq(courses.id, input.courseId));
  if (!course) throw new Error("Course not found.");
  await assertCourseInOrg(input.courseId, orgId);
  assertWeightedCourse(input.courseId, course.weighted);

  const enrolled = await db.query.courseEnrollments.findFirst({
    where: (ce, { and: andFn, eq: eqFn }) =>
      andFn(
        eqFn(ce.courseId, input.courseId),
        eqFn(ce.studentId, input.studentId),
      ),
  });
  if (!enrolled) throw new Error("That student is not enrolled in this course.");

  // Clamped here, not just in the form: the number inputs are only a
  // convenience and must not be the thing standing between a typo and 999/50.
  const bounded = (v: number | null, max: number) =>
    v === null ? null : Math.min(max, Math.max(0, v));
  const finalExam = bounded(input.finalExam, WEIGHTS.finalExam);
  const midTerm = bounded(input.midTerm, WEIGHTS.midTerm);
  const conduct = bounded(input.conduct, WEIGHTS.conduct);
  const participation = bounded(input.participation, WEIGHTS.participation);
  if (conduct === null || participation === null) {
    throw new Error("Marks could not be read.");
  }
  if (
    (input.finalExam !== null && !Number.isFinite(input.finalExam)) ||
    (input.midTerm !== null && !Number.isFinite(input.midTerm))
  ) {
    throw new Error("Marks must be numbers.");
  }

  const values = {
    finalExamScore: finalExam === null ? null : String(finalExam),
    midTermScore: midTerm === null ? null : String(midTerm),
    conductScore: String(conduct),
    participationScore: String(participation),
    remarks: input.remarks?.trim() || null,
    enteredBy: u.id,
    updatedAt: new Date(),
  };

  await db
    .insert(gradebookEntries)
    .values({
      courseId: input.courseId,
      studentId: input.studentId,
      organizationId: orgId,
      finalExamMax: String(WEIGHTS.finalExam),
      midTermMax: String(WEIGHTS.midTerm),
      ...values,
    })
    .onConflictDoUpdate({
      target: [gradebookEntries.courseId, gradebookEntries.studentId],
      set: values,
    });

  return { success: true };
}

/** Student view: their weighted grade for one course. */
export async function getMyCourseGradebook(courseId: string) {
  const u = await requireUser();
  const orgId = await getCurrentOrgId();
  if (!orgId) return null;
  const [course] = await db
    .select({
      id: courses.id,
      name: courses.name,
      code: courses.code,
      weighted: courses.usesWeightedGrading,
    })
    .from(courses)
    .where(
      and(
        eq(courses.id, courseId),
        eq(courses.organizationId, orgId),
      ),
    );
  if (!course) throw new Error("Course not found.");
  if (!course.weighted) return null;

  const enrolled = await db.query.courseEnrollments.findFirst({
    where: (ce, { and: andFn, eq: eqFn }) =>
      andFn(eqFn(ce.courseId, courseId), eqFn(ce.studentId, u.id)),
  });
  if (!enrolled) throw new Error("You are not enrolled in this course.");

  const [entry] = await db
    .select()
    .from(gradebookEntries)
    .where(
      and(
        eq(gradebookEntries.courseId, courseId),
        eq(gradebookEntries.studentId, u.id),
      ),
    );
  const derived = await derivedInputs(courseId, u.id);

  return {
    course,
    weights: WEIGHTS,
    remarks: entry?.remarks ?? null,
    result: computeGradebook({
      finalExam: asNumber(entry?.finalExamScore),
      midTerm: asNumber(entry?.midTermScore),
      conduct: asNumber(entry?.conductScore) ?? 0,
      participation: asNumber(entry?.participationScore) ?? 0,
      ...derived,
    }),
  };
}
