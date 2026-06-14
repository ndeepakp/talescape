import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notify } from "@/lib/notify";

async function followerCount(userId: string) {
  const [row] = await sql`
    SELECT COUNT(*)::int AS count FROM follows WHERE following_id = ${userId}
  `;
  return (row as { count: number }).count;
}

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to follow." }, { status: 401 });
  }
  if (session.user.id === id) {
    return NextResponse.json({ error: "You can't follow yourself." }, { status: 400 });
  }

  const inserted = await sql`
    INSERT INTO follows (follower_id, following_id)
    VALUES (${session.user.id}, ${id})
    ON CONFLICT DO NOTHING
    RETURNING follower_id
  `;

  // Only notify on a genuinely new follow (not a repeat).
  if (inserted.length > 0) {
    await notify({ userId: id, kind: "follow", actorId: session.user.id });
  }

  return NextResponse.json({ following: true, followerCount: await followerCount(id) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to follow." }, { status: 401 });
  }

  await sql`
    DELETE FROM follows WHERE follower_id = ${session.user.id} AND following_id = ${id}
  `;

  return NextResponse.json({ following: false, followerCount: await followerCount(id) });
}
