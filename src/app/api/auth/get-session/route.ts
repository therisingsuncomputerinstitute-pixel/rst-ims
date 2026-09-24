import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
  const ctx = await headers();
  const session = await auth.api.getSession({ headers: ctx });
  return Response.json(session);
}