import { notFound, redirect } from "next/navigation";
import { handleByUserId } from "@/lib/handles";

export const dynamic = "force-dynamic";

export default async function LegacyEditRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const handle = await handleByUserId(id);
  if (!handle) notFound();
  redirect(`/${handle}/edit`);
}
