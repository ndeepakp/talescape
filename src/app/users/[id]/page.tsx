import { notFound, redirect } from "next/navigation";
import { handleByUserId } from "@/lib/handles";

export const dynamic = "force-dynamic";

// Legacy id-based profile URL → redirect to the handle-based URL.
export default async function LegacyProfileRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const handle = await handleByUserId(id);
  if (!handle) notFound();
  redirect(`/${handle}`);
}
