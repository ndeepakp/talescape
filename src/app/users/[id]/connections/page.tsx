import { notFound, redirect } from "next/navigation";
import { handleByUserId } from "@/lib/handles";

export const dynamic = "force-dynamic";

export default async function LegacyConnectionsRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const handle = await handleByUserId(id);
  if (!handle) notFound();
  redirect(`/${handle}/connections${tab ? `?tab=${tab}` : ""}`);
}
