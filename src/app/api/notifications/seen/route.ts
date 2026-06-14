import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession, withErrors } from "@/lib/http";

// Marks all of the user's notifications as read (clears the bell badge).
export const POST = withErrors(async () => {
  const session = await requireSession();

  await sql`
    UPDATE notifications SET seen = true
    WHERE user_id = ${session.user.id} AND seen = false
  `;

  return NextResponse.json({ ok: true });
});
