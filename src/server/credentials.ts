"use server";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import { db } from "@/db/drizzle";
import { member, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  isEmailConfigured,
  isTestSenderDomain,
  sendCredentialsEmail,
} from "@/lib/email";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { nameFromEmail, parseStudentList } from "@/lib/student-list";
import { getDefaultOrganization } from "@/server/users";
import {
  createAccountWithPassword,
  findUserByEmail,
  getCredentialPassword,
  restoreCredentialPassword,
  revokeUserSessions,
  setCredentialPassword,
} from "@/server/user-accounts";

const SETUP_TOKEN_TTL_MS = 30 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALL = LOWER + UPPER + DIGITS;

const pick = (set: string) => set.charAt(randomInt(set.length));

const generateTemporaryPassword = () => {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  while (chars.length < 14) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
};

const getSecret = () =>
  process.env.BETTER_AUTH_SECRET || process.env.INSTITUTE_SLUG || "rst-ims";

const signSetupToken = (userId: string) => {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + SETUP_TOKEN_TTL_MS }),
  ).toString("base64url");
  const signature = createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
};

const readSetupToken = (token: string): string | null => {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof decoded?.uid !== "string") return null;
    if (typeof decoded?.exp !== "number" || decoded.exp < Date.now()) {
      return null;
    }
    return decoded.uid as string;
  } catch {
    return null;
  }
};

const requireAdmin = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.role !== "admin") {
    throw new Error("Only admins can perform this action.");
  }
  return session.user;
};

const emailConfigError =
  "Email is not configured yet. Add a real RESEND_API_KEY to .env, then try again.";

const fail = (message: string) => ({ success: false as const, message });

/** Upper bound per run so one paste can't lock up the request. */
const MAX_ENROLMENTS_PER_RUN = 200;

type ProvisionResult = {
  email: string;
  name: string;
  created: boolean;
  ok: boolean;
  error?: string;
};

/** Accounts we must never reset the password of or mail credentials to. */
const NOT_A_STUDENT = "That address belongs to an admin account.";

const provisionAndEmail = async (input: {
  email: string;
  name: string;
  password: string;
}): Promise<ProvisionResult> => {
  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim() || nameFromEmail(email) || email;
  const existing = await findUserByEmail(email);

  if (existing && existing.role !== "student") {
    return { email, name, created: false, ok: false, error: NOT_A_STUDENT };
  }

  let userId = existing?.id ?? null;
  const created = !existing;
  let previousHash: string | null = null;
  let previousFlag = false;

  if (existing) {
    previousHash = await setCredentialPassword(existing.id, input.password);
    previousFlag = Boolean(existing.mustChangePassword);
    await db
      .update(user)
      .set({ mustChangePassword: true })
      .where(eq(user.id, existing.id));
    await revokeUserSessions(existing.id);
  } else {
    const org = await getDefaultOrganization();
    const createdUser = await createAccountWithPassword({
      name,
      email,
      password: input.password,
      role: "student",
      organizationId: org.id,
    });
    userId = createdUser.id;
    await db
      .update(user)
      .set({ mustChangePassword: true })
      .where(eq(user.id, userId));
  }

  const result = await sendCredentialsEmail({
    to: email,
    name,
    email,
    temporaryPassword: input.password,
  });

  if (!result.ok) {
    if (created && userId) {
      await db.delete(member).where(eq(member.userId, userId));
      await db.delete(user).where(eq(user.id, userId));
    } else if (userId) {
      await restoreCredentialPassword(userId, previousHash);
      await db
        .update(user)
        .set({ mustChangePassword: previousFlag })
        .where(eq(user.id, userId));
    }
    return { email, name, created, ok: false, error: result.error };
  }

  return { email, name, created, ok: true };
};

export const emailCredentialsToStudents = async (input: {
  list: string;
  sharedPassword?: string;
}) => {
  try {
    await requireAdmin();
    if (!isEmailConfigured()) return fail(emailConfigError);

    const entries = parseStudentList(input.list ?? "");
    if (entries.length === 0) {
      return fail("No valid email addresses found in the list.");
    }

    const shared = input.sharedPassword?.trim();
    if (shared && shared.length < MIN_PASSWORD_LENGTH) {
      return fail(
        `The shared password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }

    const results: ProvisionResult[] = [];
    for (const entry of entries) {
      results.push(
        await provisionAndEmail({
          email: entry.email,
          name: entry.name,
          password: shared && shared.length > 0 ? shared : generateTemporaryPassword(),
        }),
      );
    }

    return summarize(results);
  } catch (error) {
    const e = error as Error;
    return fail(e.message || "Failed to send credentials.");
  }
};

export const emailCredentialsToUser = async (userId: string) => {
  try {
    await requireAdmin();
    if (!isEmailConfigured()) return fail(emailConfigError);

    const target = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });
    if (!target) return fail("That account no longer exists.");
    if (target.role !== "student") {
      return fail("Only student accounts receive emailed credentials.");
    }

    const result = await provisionAndEmail({
      email: target.email,
      name: target.name,
      password: generateTemporaryPassword(),
    });

    if (!result.ok) {
      return fail(
        `Could not email ${target.email}: ${result.error ?? "unknown error"}`,
      );
    }

    return {
      success: true as const,
      message: `Credentials emailed to ${target.email}. They must set their own password before using the portal.`,
      created: result.created,
    };
  } catch (error) {
    const e = error as Error;
    return fail(e.message || "Failed to send credentials.");
  }
};

export const emailCredentialsToAllStudents = async (): Promise<EmailSummaryResult> => {
  try {
    await requireAdmin();
    if (!isEmailConfigured()) return failSummary(emailConfigError);

    const org = await getDefaultOrganization();
    const memberships = await db
      .select({ userId: member.userId })
      .from(member)
      .where(eq(member.organizationId, org.id));
    if (memberships.length === 0) return failSummary("There are no students yet.");

    const students = await db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(
        and(
          inArray(user.id, memberships.map((m) => m.userId)),
          eq(user.role, "student"),
        ),
      );
    if (students.length === 0) return failSummary("There are no students yet.");

    const results: ProvisionResult[] = [];
    for (const student of students) {
      results.push(
        await provisionAndEmail({
          email: student.email,
          name: student.name,
          password: generateTemporaryPassword(),
        }),
      );
    }

    return summarize(results);
  } catch (error) {
    const e = error as Error;
    return failSummary(e.message || "Failed to send credentials.");
  }
};

export type EnrollResult = {
  success: boolean;
  message: string;
  created: number;
  emailed: number;
  total: number;
  credentials: { email: string; name: string; password: string }[];
  skipped: { email: string; reason: string }[];
};

export type EmailSummaryResult = {
  success: boolean;
  message: string;
  sent: number;
  created: number;
  total: number;
  failures: { email: string; error: string }[];
};

const failEnroll = (message: string): EnrollResult => ({
  success: false,
  message,
  created: 0,
  emailed: 0,
  total: 0,
  credentials: [],
  skipped: [],
});

const failSummary = (message: string): EmailSummaryResult => ({
  success: false,
  message,
  sent: 0,
  created: 0,
  total: 0,
  failures: [],
});

/**
 * Mint a fresh temporary password for one student and hand it back to the
 * admin, for the manual-email workflow (no Resend needed). Forces a password
 * change on their next sign-in and kills their existing sessions.
 */
export const resetStudentPassword = async (input: {
  userId: string;
  sharedPassword?: string;
}) => {
  try {
    await requireAdmin();

    const target = await db.query.user.findFirst({
      where: eq(user.id, input.userId ?? ""),
    });
    if (!target) return fail("That account no longer exists.");
    if (target.role !== "student") {
      return fail("Only student accounts get temporary passwords.");
    }

    const shared = input.sharedPassword?.trim();
    if (shared && shared.length < MIN_PASSWORD_LENGTH) {
      return fail(
        `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }
    const password =
      shared && shared.length > 0 ? shared : generateTemporaryPassword();

    await setCredentialPassword(target.id, password);
    await db
      .update(user)
      .set({ mustChangePassword: true })
      .where(eq(user.id, target.id));
    await revokeUserSessions(target.id);

    return {
      success: true as const,
      message: `New password for ${target.name}. Copy it now — it is not stored anywhere in readable form.`,
      email: target.email,
      name: target.name,
      password,
    };
  } catch (error) {
    const e = error as Error;
    return fail(e.message || "Failed to reset the password.");
  }
};

/**
 * Create many student accounts from one pasted list.
 *
 * Existing students are left untouched (no password reset) and reported as
 * skipped, so re-running a list is safe. Admins can only pass through
 * `provisionAndEmail`, which refuses non-student addresses.
 *
 * When `sendEmail` is false the generated passwords are returned so the admin
 * can hand them out by hand.
 */
export const enrollStudents = async (input: {
  list: string;
  sharedPassword?: string;
  sendEmail?: boolean;
}): Promise<EnrollResult> => {
  try {
    await requireAdmin();

    const sendEmail = Boolean(input.sendEmail);
    if (sendEmail && !isEmailConfigured()) return failEnroll(emailConfigError);

    const entries = parseStudentList(input.list ?? "");
    if (entries.length === 0) {
      return failEnroll("No valid email addresses found in the list.");
    }
    if (entries.length > MAX_ENROLMENTS_PER_RUN) {
      return failEnroll(
        `That is ${entries.length} students — the limit is ${MAX_ENROLMENTS_PER_RUN} per run. Split the list.`,
      );
    }

    const shared = input.sharedPassword?.trim();
    if (shared && shared.length < MIN_PASSWORD_LENGTH) {
      return failEnroll(
        `The shared password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }

    const org = await getDefaultOrganization();
    const created: { email: string; name: string; password: string }[] = [];
    const skipped: { email: string; reason: string }[] = [];
    let emailed = 0;

    for (const entry of entries) {
      const email = entry.email.trim().toLowerCase();
      const name = entry.name?.trim() || nameFromEmail(email) || email;
      const existing = await findUserByEmail(email);

      if (existing) {
        skipped.push({
          email,
          reason:
            existing.role === "student"
              ? "Already enrolled"
              : "Is an admin account",
        });
        continue;
      }

      const password =
        shared && shared.length > 0 ? shared : generateTemporaryPassword();

      if (sendEmail) {
        const result = await provisionAndEmail({ email, name, password });
        if (result.ok) {
          emailed += 1;
        } else {
          skipped.push({ email, reason: result.error ?? "Email failed" });
        }
        continue;
      }

      // No email: keep the account and surface the password for hand-off.
      await createAccountWithPassword({
        name,
        email,
        password,
        role: "student",
        organizationId: org.id,
      });
      await db
        .update(user)
        .set({ mustChangePassword: true })
        .where(eq(user.email, email));
      created.push({ email, name, password });
    }

    const parts = [`${created.length} enrolled`];
    if (emailed > 0) parts.push(`${emailed} emailed`);
    if (skipped.length > 0) parts.push(`${skipped.length} skipped`);

    return {
      success: skipped.length === 0,
      message:
        parts.join(" · ") +
        (entries.length > 1 ? ` · ${entries.length} students in your list` : ""),
      created: created.length,
      emailed,
      total: entries.length,
      credentials: created,
      skipped,
    };
  } catch (error) {
    const e = error as Error;
    return failEnroll(e.message || "Failed to enroll students.");
  }
};

const summarize = (results: ProvisionResult[]): EmailSummaryResult => {
  const sent = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const created = sent.filter((r) => r.created).length;

  const parts = [`${sent.length} of ${results.length} emailed`];
  if (created > 0) parts.push(`${created} new account${created === 1 ? "" : "s"} created`);

  return {
    success: failed.length === 0,
    message: parts.join(" · ") + (failed.length > 0 ? " · some failed" : ""),
    sent: sent.length,
    created,
    total: results.length,
    failures: failed.map((r) => ({
      email: r.email,
      error: r.error ?? "Unknown error",
    })),
  };
};

/**
 * Step 1 of the emailed flow: confirm the student owns the account by
 * re-entering the email + temporary password from the email.
 */
export const startPasswordSetup = async (input: {
  email: string;
  password: string;
}) => {
  const email = (input.email ?? "").trim().toLowerCase();
  const password = input.password ?? "";

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    "unknown";
  const limitKey = `setup:${ip}:${email}`;

  const limit = checkRateLimit(limitKey);
  if (!limit.allowed) {
    return {
      success: false as const,
      message: "Too many attempts. Please try again in a few minutes.",
    };
  }

  const genericError = {
    success: false as const,
    message: "That email and password combination is not correct.",
  };

  if (!email || !password) return genericError;
  if (password.length > MAX_PASSWORD_LENGTH) return genericError;

  const student = await findUserByEmail(email);
  if (!student) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return genericError;
  }

  const hash = await getCredentialPassword(student.id);
  const matches = hash ? await verifyPassword({ hash, password }) : false;
  if (!matches) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return genericError;
  }

  clearRateLimit(limitKey);

  return {
    success: true as const,
    token: signSetupToken(student.id),
    email: student.email,
    name: student.name,
  };
};

/**
 * Step 2: store the password the student chose themselves.
 */
export const completePasswordSetup = async (input: {
  token: string;
  newPassword: string;
}) => {
  try {
    const newPassword = input.newPassword ?? "";

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return fail(
        `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }
    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      return fail("That password is too long.");
    }

    const userId = readSetupToken(input.token ?? "");
    if (!userId) {
      return fail("This setup link has expired. Please start again.");
    }

    const target = await db.query.user.findFirst({ where: eq(user.id, userId) });
    if (!target) {
      return fail("That account no longer exists.");
    }

    const currentHash = await getCredentialPassword(userId);
    if (currentHash) {
      const unchanged = await verifyPassword({
        hash: currentHash,
        password: newPassword,
      });
      if (unchanged) {
        return fail("Choose a password different from the temporary one.");
      }
    }

    await setCredentialPassword(userId, newPassword);
    await db
      .update(user)
      .set({ mustChangePassword: false })
      .where(eq(user.id, userId));
    await revokeUserSessions(userId);

    return {
      success: true as const,
      message: "Your password has been set. Sign in with it to continue.",
    };
  } catch (error) {
    const e = error as Error;
    return fail(e.message || "Failed to set your password.");
  }
};

export const getEmailDeliveryStatus = async () => {
  return { configured: isEmailConfigured(), testSenderOnly: isTestSenderDomain() };
};

/**
 * Same as `completePasswordSetup` but for a student who is already signed in
 * with the temporary password (they used the normal login form).
 */
export const setOwnPassword = async (newPassword: string) => {
  try {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session?.user) {
      return fail("Your session expired. Please sign in again.");
    }
    if (!session.user.mustChangePassword) {
      return fail("Your password is already set.");
    }
    if ((newPassword ?? "").length < MIN_PASSWORD_LENGTH) {
      return fail(`Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      return fail("That password is too long.");
    }

    const currentHash = await getCredentialPassword(session.user.id);
    if (
      currentHash &&
      (await verifyPassword({ hash: currentHash, password: newPassword }))
    ) {
      return fail("Choose a password different from the temporary one.");
    }

    // better-auth's `setPassword` endpoint only works when no password exists,
    // so replace the credential hash directly (same scrypt format).
    await setCredentialPassword(session.user.id, newPassword);
    await db
      .update(user)
      .set({ mustChangePassword: false })
      .where(eq(user.id, session.user.id));
    await revokeUserSessions(session.user.id, session.session.token);

    return {
      success: true as const,
      message: "Your password has been set.",
    };
  } catch (error) {
    const e = error as Error;
    return fail(e.message || "Failed to set your password.");
  }
};
