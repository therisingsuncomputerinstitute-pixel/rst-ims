import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getMaintenanceState, setMaintenanceMode } from "@/server/ums";

/**
 * Maintenance mode API.
 * - GET  -> public status ({ enabled, message }).
 * - POST -> admin-only toggle. Sending { enabled: false } resumes the portal.
 */

export async function GET() {
  const state = await getMaintenanceState();
  return NextResponse.json(state);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    enabled?: boolean;
    message?: string;
  };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }
  const state = await setMaintenanceMode({
    enabled: body.enabled,
    message: body.message,
  });
  return NextResponse.json(state);
}
