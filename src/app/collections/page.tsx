import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { handleByUserId } from "@/lib/handles";

export const dynamic = "force-dynamic";

// "Collections" in the menu → the signed-in user's handle-based collections.
export default async function CollectionsRedirect() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const handle = await handleByUserId(session.user.id);
  redirect(handle ? `/${handle}/collections` : "/feed");
}
