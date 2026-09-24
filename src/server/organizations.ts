"use server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { member, organization } from "@/db/schema";
import type { Organization, Member } from "@/db/schema";
import { getCurrentUser } from "./users";

export async function getOrganizations(): Promise<Organization[]> {
  const { currentUser } = await getCurrentUser();

  if (!currentUser) return [];

  const members = await db
    .select()
    .from(member)
    .where(eq(member.userId, currentUser.id));

  if (members.length === 0) return [];

  const organizations = await db
    .select()
    .from(organization)
    .where(
      inArray(
        organization.id,
        members.map((m) => m.organizationId),
      ),
    );

  return organizations;
}

export async function getActiveOrganization(
  userId: string,
  preferredOrgId?: string | null,
): Promise<Organization | null> {
  try {
    // If we have a preferred organization, try to fetch it first (validating membership)
    if (preferredOrgId) {
      const memberResults = await db
        .select()
        .from(member)
        .where(
          and(
            eq(member.userId, userId),
            eq(member.organizationId, preferredOrgId),
          ),
        )
        .limit(1);

      if (memberResults.length > 0) {
        const orgResults = await db
          .select()
          .from(organization)
          .where(eq(organization.id, preferredOrgId))
          .limit(1);

        if (orgResults[0]) return orgResults[0];
      }
    }

    // Fallback: Get the first organization the user is a member of
    const memberResults = await db
      .select()
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1);

    const memberUser = memberResults[0];

    if (!memberUser) return null;

    const orgResults = await db
      .select()
      .from(organization)
      .where(eq(organization.id, memberUser.organizationId))
      .limit(1);

    return orgResults[0] ?? null;
  } catch (error) {
    console.error("[Organizations Server] getActiveOrganization error:", error);
    return null;
  }
}

export async function getOrganizationBySlug(
  slug: string,
): Promise<(Organization & { members: Member[] }) | null> {
  try {
    const organizationBySlug = await db.query.organization.findFirst({
      where: eq(organization.slug, slug),
      with: {
        members: {
          with: {
            user: true,
          },
        },
      },
    });

    return (
      (organizationBySlug as (Organization & { members: Member[] }) | null) ??
      null
    );
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function getCurrentUserOrgId(): Promise<string | null> {
  const sessionData = (await getCurrentUser()) as any;
  const activeOrganizationId = sessionData?.session?.activeOrganizationId as
    | string
    | undefined;

  if (activeOrganizationId) return activeOrganizationId;
  const currentUser = sessionData?.currentUser;
  if (!currentUser) return null;

  const org = await getActiveOrganization(currentUser.id);

  return org?.id ?? null;
}
