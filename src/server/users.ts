"use server";

import { and, eq, inArray, not } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { db } from "@/db/drizzle";
import { member, organization, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase-server";

export type AppRole = "student" | "admin";

export const getDefaultOrganization = async () => {
  const orgs = await db.select().from(organization).limit(1);
  if (orgs[0]) return orgs[0];

  const name = process.env.INSTITUTE_NAME || "Institute";
  let slug = process.env.INSTITUTE_SLUG || "institute";
  let slugExists = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  let attempt = 0;
  while (slugExists.length > 0) {
    attempt += 1;
    slug = `${slug}-${attempt + 1}`;
    slugExists = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, slug))
      .limit(1);
  }

  const [org] = await db
    .insert(organization)
    .values({ id: randomUUID(), name, slug })
    .returning();
  return org;
};

export const uploadAvatar = async (formData: FormData) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file uploaded");

  // Get current user to check for old avatar
  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
  });

  // Delete old avatar if it exists
  if (currentUser?.image && currentUser.image.includes("/avatars/")) {
    const oldPath = currentUser.image.split("/avatars/").pop();
    if (oldPath) {
      await supabaseServer.storage.from("avatars").remove([oldPath]);
    }
  }

  // Upload new avatar
  const fileExt = file.name.split(".").pop() || "png";
  const fileName = `${session.user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = fileName; // Store directly in bucket root

  const { data, error } = await supabaseServer.storage
    .from("avatars")
    .upload(filePath, file);

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabaseServer.storage.from("avatars").getPublicUrl(filePath);

  // Update database
  await db
    .update(user)
    .set({ image: publicUrl })
    .where(eq(user.id, session.user.id));

  return publicUrl;
};

export const deleteAvatarAction = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
  });

  if (currentUser?.image && currentUser.image.includes("/avatars/")) {
    const oldPath = currentUser.image.split("/avatars/").pop();
    if (oldPath) {
      await supabaseServer.storage.from("avatars").remove([oldPath]);
    }
  }

  await db
    .update(user)
    .set({ image: null })
    .where(eq(user.id, session.user.id));
  return true;
};

export const getCurrentUser = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
  });

  if (!currentUser) {
    redirect("/login");
  }

  return {
    ...session,
    currentUser,
  };
};

export const signIn = async (email: string, password: string) => {
  try {
    await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    });

    return {
      success: true,
      message: "Signed in successfully.",
    };
  } catch (error) {
    const e = error as Error;

    return {
      success: false,
      message: e.message || "An unknown error occurred.",
    };
  }
};

export const getUsers = async (organizationId: string) => {
  try {
    const members = await db.query.member.findMany({
      where: eq(member.organizationId, organizationId),
    });

    const users = await db.query.user.findMany({
      where: not(
        inArray(
          user.id,
          members.map((m) => m.userId),
        ),
      ),
    });

    return users;
  } catch (error) {
    console.error(error);
    return [];
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

export const createAccount = async (input: {
  name: string;
  email: string;
  password: string;
  role: AppRole;
}) => {
  try {
    await requireAdmin();

    const { name, email, password, role } = input;
    if (!name || !email || !password) {
      return {
        success: false,
        message: "Name, email and password are required.",
      };
    }
    if (!["student", "admin"].includes(role)) {
      return {
        success: false,
        message: "Invalid role. Choose student or admin.",
      };
    }

    const org = await getDefaultOrganization();

    const result = await auth.api.signUpEmail({
      body: { email, password, name },
    });
    const newUserId = result.user?.id;
    if (!newUserId) {
      throw new Error("Failed to create user.");
    }

    await db.update(user).set({ role }).where(eq(user.id, newUserId));

    const existing = await db
      .select()
      .from(member)
      .where(
        and(eq(member.userId, newUserId), eq(member.organizationId, org.id)),
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(member)
        .set({ role })
        .where(eq(member.id, existing[0].id));
    } else {
      await db.insert(member).values({
        organizationId: org.id,
        userId: newUserId,
        role,
      });
    }

    return {
      success: true,
      message: `${name}'s account created successfully.`,
      user: { id: newUserId, name, email, role },
    };
  } catch (error) {
    const e = error as Error;
    return {
      success: false,
      message: e.message || "An unknown error occurred.",
    };
  }
};

export const listAccounts = async () => {
  await requireAdmin();

  const org = await getDefaultOrganization();

  const members = await db
    .select()
    .from(member)
    .where(eq(member.organizationId, org.id));

  if (members.length === 0) return [];

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(
      inArray(
        user.id,
        members.map((m) => m.userId),
      ),
    );

  return users;
};

export const updateAccountRole = async (
  userId: string,
  role: AppRole,
) => {
  try {
    const adminUser = await requireAdmin();

    if (userId === adminUser.id) {
      return {
        success: false,
        message: "You cannot change your own role.",
      };
    }
    if (!["student", "admin"].includes(role)) {
      return {
        success: false,
        message: "Invalid role. Choose student or admin.",
      };
    }

    const org = await getDefaultOrganization();

    const existingMembership = await db
      .select()
      .from(member)
      .where(
        and(eq(member.userId, userId), eq(member.organizationId, org.id)),
      )
      .limit(1);
    if (!existingMembership[0]) {
      return {
        success: false,
        message: "This account does not belong to your organization.",
      };
    }

    await db.update(user).set({ role }).where(eq(user.id, userId));

    const membership = await db
      .select()
      .from(member)
      .where(
        and(eq(member.userId, userId), eq(member.organizationId, org.id)),
      )
      .limit(1);

    if (membership[0]) {
      await db
        .update(member)
        .set({ role })
        .where(eq(member.id, membership[0].id));
    } else {
      await db.insert(member).values({
        organizationId: org.id,
        userId,
        role,
      });
    }

    return { success: true, message: "Role updated successfully." };
  } catch (error) {
    const e = error as Error;
    return {
      success: false,
      message: e.message || "An unknown error occurred.",
    };
  }
};

export const removeAccount = async (userId: string) => {
  try {
    const adminUser = await requireAdmin();

    if (userId === adminUser.id) {
      return {
        success: false,
        message: "You cannot delete your own account.",
      };
    }

    const org = await getDefaultOrganization();
    const membership = await db
      .select()
      .from(member)
      .where(
        and(eq(member.userId, userId), eq(member.organizationId, org.id)),
      )
      .limit(1);
    if (!membership[0]) {
      return {
        success: false,
        message: "This account does not belong to your organization.",
      };
    }

    await db.delete(member).where(eq(member.userId, userId));
    await db.delete(user).where(eq(user.id, userId));

    return { success: true, message: "Account deleted successfully." };
  } catch (error) {
    const e = error as Error;
    return {
      success: false,
      message: e.message || "An unknown error occurred.",
    };
  }
};
