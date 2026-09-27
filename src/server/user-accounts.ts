import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { account, member, session, user } from "@/db/schema";

type AccountRole = "student" | "admin";

export const findUserByEmail = async (email: string) =>
  db.query.user.findFirst({
    where: sql`lower(${user.email}) = ${email.trim().toLowerCase()}`,
  });

export const getCredentialAccount = async (userId: string) => {
  const rows = await db
    .select()
    .from(account)
    .where(
      and(eq(account.userId, userId), eq(account.providerId, "credential")),
    )
    .limit(1);
  return rows[0] ?? null;
};

export const getCredentialPassword = async (userId: string) => {
  const credential = await getCredentialAccount(userId);
  return credential?.password ?? null;
};

/**
 * Writes a credential password the same way better-auth does, so the account
 * stays usable for `signInEmail` / `setPassword`.
 * Returns the previous hash so callers can roll the change back.
 */
export const setCredentialPassword = async (
  userId: string,
  plainPassword: string,
) => {
  const previousHash = await getCredentialPassword(userId);
  const hash = await hashPassword(plainPassword);
  const existing = await getCredentialAccount(userId);

  if (existing) {
    await db
      .update(account)
      .set({ password: hash })
      .where(eq(account.id, existing.id));
  } else {
    await db.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hash,
    });
  }

  return previousHash;
};

export const restoreCredentialPassword = async (
  userId: string,
  previousHash: string | null,
) => {
  if (previousHash) {
    await db
      .update(account)
      .set({ password: previousHash })
      .where(
        and(eq(account.userId, userId), eq(account.providerId, "credential")),
      );
    return;
  }
  await db
    .delete(account)
    .where(
      and(eq(account.userId, userId), eq(account.providerId, "credential")),
    );
};

export const revokeUserSessions = async (
  userId: string,
  exceptToken?: string,
) => {
  if (exceptToken) {
    await db
      .delete(session)
      .where(and(eq(session.userId, userId), ne(session.token, exceptToken)));
    return;
  }
  await db.delete(session).where(eq(session.userId, userId));
};

/**
 * Creates a user + credential account + organization member row directly.
 * Going through `auth.api.signUpEmail` from a server action would hand the
 * caller the new user's session cookie (the `nextCookies()` plugin forwards
 * every `set-cookie` of any auth call made during a request).
 */
export const createAccountWithPassword = async (input: {
  name: string;
  email: string;
  password: string;
  role: AccountRole;
  organizationId: string;
}) => {
  const email = input.email.trim().toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const userId = randomUUID();
  const now = new Date();

  await db.insert(user).values({
    id: userId,
    name: input.name.trim() || email.split("@")[0],
    email,
    emailVerified: false,
    role: input.role,
    banned: false,
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(account).values({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: await hashPassword(input.password),
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(member).values({
    organizationId: input.organizationId,
    userId,
    role: input.role,
  });

  return { id: userId, email, name: input.name.trim() || email.split("@")[0] };
};
