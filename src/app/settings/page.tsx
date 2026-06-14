import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAppearance } from "@/lib/get-appearance";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const appearance = await getAppearance(session);

  return <SettingsForm userId={session.user.id} initial={appearance} />;
}
