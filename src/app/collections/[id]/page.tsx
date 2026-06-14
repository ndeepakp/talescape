import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Legacy collection URL → redirect to the owner's handle-based URL.
export default async function LegacyCollectionRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [row] = await sql<{ handle: string | null }[]>`
    SELECT u.username AS handle
    FROM collections c JOIN "user" u ON u.id = c.user_id
    WHERE c.id = ${id}
  `;
  if (!row?.handle) notFound();
  redirect(`/${row.handle}/collections/${id}`);
}
