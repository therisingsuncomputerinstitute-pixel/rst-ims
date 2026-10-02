import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { courses, feeSlips, user } from "@/db/schema";
import { generateFeeSlip, SIGNATORIES } from "@/lib/fee-slip-pdf";
import { getSupabaseServer } from "@/lib/supabase-server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Renders one fee slip as a PDF. Open the URL to view it in the browser, or add
 * `?download=1` to save it. Admins can open any slip in their organization;
 * students can only open their own.
 */

const SIGNATURE_BUCKET = "signatures";

const out: Record<string, Uint8Array | null> = {};
for (const s of SIGNATORIES) out[s.key] = null;

async function loadSignatures() {
  const supabase = getSupabaseServer();

  for (const s of SIGNATORIES) {
    // Preferred: the private Supabase bucket, updated through the admin UI.
    if (supabase) {
      const { data, error } = await supabase.storage
        .from(SIGNATURE_BUCKET)
        .download(s.key);
      if (!error && data) {
        out[s.key] = new Uint8Array(await data.arrayBuffer());
        continue;
      }
    }
    // Fallback: a PNG committed at public/signatures/<name>, so signatures can
    // also be dropped into the project without touching the database.
    try {
      const local = await readFile(
        join(process.cwd(), "public", "signatures", s.key),
      );
      out[s.key] = new Uint8Array(local);
    } catch {
      /* neither source has it — the PDF falls back to a printed name */
    }
  }
  return out;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const viewer = session.user;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Resolve the viewer's organization from the session, falling back to their
  // membership row — the session user object itself carries no organization.
  const orgId =
    (session.session.activeOrganizationId as string | null) ??
    (
      await db.query.member.findFirst({
        where: (m, { eq: e }) => e(m.userId, viewer.id),
      })
    )?.organizationId;

  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const rows = await db
    .select({
      id: feeSlips.id,
      organizationId: feeSlips.organizationId,
      studentId: feeSlips.studentId,
      studentName: user.name,
      studentEmail: user.email,
      rollNumber: user.rollNumber,
      courseId: feeSlips.courseId,
      courseName: courses.name,
      courseCode: courses.code,
      period: feeSlips.period,
      slipReference: feeSlips.slipReference,
      adjustmentReason: feeSlips.adjustmentReason,
      originalFee: feeSlips.originalFee,
      amountPaid: feeSlips.amountPaid,
      currency: feeSlips.currency,
      method: feeSlips.method,
      reference: feeSlips.reference,
      paidAt: feeSlips.paidAt,
      notes: feeSlips.notes,
      createdAt: feeSlips.createdAt,
    })
    .from(feeSlips)
    .innerJoin(user, eq(feeSlips.studentId, user.id))
    .innerJoin(courses, eq(feeSlips.courseId, courses.id))
    .where(and(eq(feeSlips.id, id), eq(feeSlips.organizationId, orgId)));

  const slip = rows[0];
  if (!slip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // A student may only ever open their own slip. Return 404 (not 403) so the
  // endpoint does not confirm that someone else's slip exists.
  if (viewer.role !== "admin" && slip.studentId !== viewer.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const originalFee = Number(slip.originalFee ?? 0);
  const amountPaid = Number(slip.amountPaid ?? 0);

  const bytes = await generateFeeSlip({
    slipReference: slip.slipReference,
    issuedOn: new Date(slip.createdAt),
    paidOn: new Date(slip.paidAt),
    studentName: slip.studentName,
    studentEmail: slip.studentEmail,
    // The student's permanent 5-digit roll number; falls back to the user id
    // only for records created before roll numbers existed.
    rollNumber: slip.rollNumber ?? slip.studentId.slice(0, 5).toUpperCase(),
    courseName: slip.courseName,
    courseCode: slip.courseCode,
    period: slip.period,
    originalFee,
    amountPaid,
    adjustmentReason: slip.adjustmentReason,
    currency: slip.currency,
    method: slip.method,
    reference: slip.reference,
    notes: slip.notes,
    signatures: await loadSignatures(),
  });

  const wantsDownload =
    new URL(req.url).searchParams.get("download") === "1";

  const safeName = `${slip.slipReference.replace(/[^a-zA-Z0-9]+/g, "-")}-${slip.studentName}-${slip.courseCode}`
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${wantsDownload ? "attachment" : "inline"}; filename="${safeName || "fee-slip"}.pdf"`,
    },
  });
}