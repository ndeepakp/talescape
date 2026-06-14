import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";

const MAX_DETAILS = 1000;

// A reader reports a user as not genuine. The report enters a mock "under
// review" due-diligence queue. One standing report per (reporter, reported) —
// re-reporting updates it.
export const POST = withErrors(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const session = await requireSession();
  const me = session.user.id;

  if (id === me) throw new ApiError(400, "You can't report yourself.");

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (!reason) throw new ApiError(400, "Please choose a reason.");
  if (details.length > MAX_DETAILS) {
    throw new ApiError(400, `Details must be ${MAX_DETAILS} characters or fewer.`);
  }

  const [target] = await sql<{ id: string }[]>`SELECT id FROM "user" WHERE id = ${id}`;
  if (!target) throw new ApiError(404, "Not found.");

  await sql`
    INSERT INTO user_reports (reporter_id, reported_id, reason, details, status)
    VALUES (${me}, ${id}, ${reason}, ${details || null}, 'under_review')
    ON CONFLICT (reporter_id, reported_id) DO UPDATE
      SET reason = ${reason}, details = ${details || null},
          status = 'under_review', created_at = now()
  `;

  return NextResponse.json({ ok: true });
});
