import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/db/drizzle";
import { user, member, organization, account } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
  const setupToken = process.env.ADMIN_SETUP_TOKEN;
  const url = new URL(request.url);
  const providedToken =
    url.searchParams.get("token") ?? request.headers.get("x-admin-setup-token") ?? "";

  const admins = await db
    .select()
    .from(user)
    .where(eq(user.role, "admin"))
    .limit(1);
  const hasAdmins = admins.length > 0;

  // If an admin already exists, bootstrapping is disabled unless the setup
  // token is supplied. If no admins exist yet, the token is still required
  // whenever one is configured.
  if (hasAdmins) {
    if (!setupToken || providedToken !== setupToken) {
      return NextResponse.json(
        { error: "Bootstrap disabled: an admin account already exists." },
        { status: 403 },
      );
    }
  } else if (setupToken && providedToken !== setupToken) {
    return NextResponse.json(
      { error: "Unauthorized: missing or invalid setup token." },
      { status: 401 },
    );
  }

  const targetEmail =
    process.env.ADMIN_BOOTSTRAP_EMAIL || "muhammadhamzasheikh02@gmail.com";
  const targetName = process.env.ADMIN_BOOTSTRAP_NAME || "Institute Admin";
  const targetPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!targetPassword || targetPassword.length < 8) {
    return NextResponse.json(
      { error: "ADMIN_BOOTSTRAP_PASSWORD must be set (min 8 characters)." },
      { status: 500 },
    );
  }

  const foundUsers = await db
    .select()
    .from(user)
    .where(eq(user.email, targetEmail));

  let u = foundUsers[0];
  let created = false;

  if (!u) {
    let signedUp: any;
    try {
      signedUp = await auth.api.signUpEmail({
        body: {
          name: targetName,
          email: targetEmail,
          password: targetPassword,
        },
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: `SignUp failed: ${err?.message ?? err}` },
        { status: 500 },
      );
    }
    const signedUpUser = signedUp?.user;
    if (!signedUpUser?.id) {
      return NextResponse.json(
        { error: "SignUp did not return a user." },
        { status: 500 },
      );
    }
    u = signedUpUser;
    created = true;
  }

  await db.update(user).set({ role: "admin" }).where(eq(user.id, u.id));

  const accRows = await db
    .select({ password: account.password })
    .from(account)
    .where(eq(account.userId, u.id));

  // Ensure a default organization exists and the admin is a member
  const orgs = await db.select().from(organization).limit(1);
  let org = orgs[0];
  if (!org) {
    const [createdOrg] = await db
      .insert(organization)
      .values({
        id: randomUUID(),
        name: process.env.INSTITUTE_NAME || "Institute",
        slug: `${process.env.INSTITUTE_SLUG || "institute"}-${Date.now()}`,
      })
      .returning();
    org = createdOrg;
  }

  const members = await db
    .select()
    .from(member)
    .where(eq(member.userId, u.id));
  for (const m of members) {
    await db
      .update(member)
      .set({ role: "admin" })
      .where(eq(member.id, m.id));
  }

  const membership = await db
    .select()
    .from(member)
    .where(eq(member.userId, u.id))
    .limit(1);
  if (!membership.length) {
    await db.insert(member).values({
      organizationId: org.id,
      userId: u.id,
      role: "admin",
    });
  }

  return NextResponse.json({
    success: true,
    created,
    userId: u.id,
    userName: u.name,
    email: u.email,
    passwordSet: accRows.some((a) => !!a.password),
    organization: org.name,
    membersUpdated: members.length,
  });
}