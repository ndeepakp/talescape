import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { StoryForm } from "./StoryForm";

export default async function WritePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const genres = await sql<{ id: number; name: string }[]>`
    SELECT id, name FROM genres ORDER BY name
  `;

  return <StoryForm genres={genres} />;
}
