"use server";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { workspaceAccess, workspaces, member } from "@/db/schema";
import { getCurrentUser } from "./users";
import { getControlledGlobalWorkspaceSeeds } from "@/lib/workspace-defaults";

// Simple request-level cache to avoid redundant calls to ensureDefaultWorkspaces
const defaultWorkspacesEnsured = new Set<string>();

export async function ensureDefaultWorkspaces(organizationId: string) {
  if (defaultWorkspacesEnsured.has(organizationId)) return;

  const seeds = getControlledGlobalWorkspaceSeeds();
  if (seeds.length === 0) return;

  await db.transaction(async (tx) => {
    // Process each seed individually so we can use the exact partial index
    // predicate in the ON CONFLICT clause. PostgreSQL cannot resolve a
    // conflict against a partial unique index without an explicit target
    // that includes the same WHERE predicate.
    for (const seed of seeds) {
      // Step 1: Try to insert; skip if the global workspace already exists
      // for this org+type combination. We use a raw SQL conflict clause
      // because Drizzle's .onConflictDoNothing() without a target cannot
      // match a partial index.
      const existing = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(
            eq(workspaces.organizationId, organizationId),
            eq(workspaces.type, seed.type),
            eq(workspaces.isGlobal, true),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await tx.insert(workspaces).values({
          organizationId,
          name: seed.name,
          type: seed.type,
          isGlobal: true,
          mandatoryRegistry: seed.mandatoryRegistry,
        });
      } else {
        // Step 2: Force update the mandatory registry to ensure the latest
        // rules are always in place, even if the workspace already existed.
        await tx
          .update(workspaces)
          .set({ mandatoryRegistry: seed.mandatoryRegistry })
          .where(
            and(
              eq(workspaces.organizationId, organizationId),
              eq(workspaces.type, seed.type),
              eq(workspaces.isGlobal, true),
            ),
          );
      }
    }
  });

  defaultWorkspacesEnsured.add(organizationId);
}

export async function canAccessWorkspace(
  userId: string,
  organizationId: string,
  workspaceId: string,
): Promise<boolean> {
  const [workspace] = await db
    .select({
      id: workspaces.id,
      organizationId: workspaces.organizationId,
      isGlobal: workspaces.isGlobal,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) return false;

  // Global workspaces are accessible if they match the user's current organization
  // OR if they are system-wide global (no organizationId).
  if (workspace.isGlobal) {
    if (!workspace.organizationId) return true;
    if (workspace.organizationId === organizationId) return true;

    // Check if user is an admin of the organization that owns this global workspace
    const [membership] = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, workspace.organizationId),
        ),
      )
      .limit(1);
    return Boolean(membership);
  }

  // For non-global workspaces, check organization ownership OR workspace_access
  if (workspace.organizationId === organizationId) return true;

  const [access] = await db
    .select({ id: workspaceAccess.id })
    .from(workspaceAccess)
    .where(
      and(
        eq(workspaceAccess.userId, userId),
        eq(workspaceAccess.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  return Boolean(access);
}

export async function getWorkspaces(organizationId: string): Promise<any[]> {
  const { currentUser } = await getCurrentUser();

  if (!currentUser) return [];

  await ensureDefaultWorkspaces(organizationId);

  const access = await db
    .select({ workspaceId: workspaceAccess.workspaceId })
    .from(workspaceAccess)
    .where(eq(workspaceAccess.userId, currentUser.id));

  const workspaceIds = access.map((a) => a.workspaceId);

  const results = await db
    .select()
    .from(workspaces)
    .where(
      or(
        and(
          eq(workspaces.organizationId, organizationId),
          workspaceIds.length > 0
            ? or(
                eq(workspaces.isGlobal, true),
                inArray(workspaces.id, workspaceIds),
              )
            : eq(workspaces.isGlobal, true),
        ),
        isNull(workspaces.organizationId),
      ),
    );

  return results;
}

export async function getActiveWorkspace(
  userId: string,
  organizationId: string,
  preferredWorkspaceId?: string | null,
): Promise<any | null> {
  try {
    await ensureDefaultWorkspaces(organizationId);

    if (preferredWorkspaceId) {
      const hasAccess = await canAccessWorkspace(
        userId,
        organizationId,
        preferredWorkspaceId,
      );

      if (hasAccess) {
        const result = await db
          .select()
          .from(workspaces)
          .where(eq(workspaces.id, preferredWorkspaceId))
          .limit(1);

        if (result[0]) return result[0];
      }
    }

    // If no preferred workspace, find a global one, prioritizing 'reinsurance' type
    const [globalWorkspace] = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.organizationId, organizationId),
          eq(workspaces.isGlobal, true),
        ),
      )
      .orderBy(
        sql`CASE WHEN ${workspaces.type} = 'reinsurance' THEN 0 ELSE 1 END`,
        asc(workspaces.name),
      )
      .limit(1);

    if (globalWorkspace) return globalWorkspace;

    const access = await db
      .select({ workspaceId: workspaceAccess.workspaceId })
      .from(workspaceAccess)
      .innerJoin(workspaces, eq(workspaces.id, workspaceAccess.workspaceId))
      .where(
        and(
          eq(workspaceAccess.userId, userId),
          eq(workspaces.organizationId, organizationId),
        ),
      )
      .orderBy(asc(workspaces.name))
      .limit(1);

    if (!access[0]) return null;

    const [result] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, access[0].workspaceId))
      .limit(1);

    return result ?? null;
  } catch (error) {
    console.error("[Workspaces Server] getActiveWorkspace error:", error);
    return null;
  }
}

export async function getCurrentUserWorkspaceId(): Promise<string | null> {
  const { currentUser } = await getCurrentUser();
  if (!currentUser) return null;

  // This relies on the session having activeWorkspaceId,
  // but for a raw server call we might need to fetch it
  const { session } = (await getCurrentUser()) as any;
  if (session?.activeWorkspaceId) return session.activeWorkspaceId;

  return null;
}

export async function changeWorkspace(workspaceId: string) {
  const { currentUser, session } = (await getCurrentUser()) as any;
  if (!currentUser) return { success: false, error: "Unauthorized" };

  const organizationId = session?.activeOrganizationId;
  if (!organizationId) {
    return { success: false, error: "No active organization" };
  }

  const allowed = await canAccessWorkspace(
    currentUser.id,
    organizationId,
    workspaceId,
  );
  if (!allowed) {
    return { success: false, error: "Access denied to this workspace" };
  }

  return { success: true };
}
