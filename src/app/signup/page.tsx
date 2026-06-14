import { sql } from "@/lib/db";
import { SignupForm } from "./SignupForm";

export default async function SignupPage() {
  const genres = await sql<{ id: number; name: string }[]>`
    SELECT id, name FROM genres ORDER BY name
  `;

  return <SignupForm genres={genres} />;
}
