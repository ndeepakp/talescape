import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ProfileForm } from "@/app/[handle]/edit/ProfileForm";

export const dynamic = "force-dynamic";

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [user] = await sql<
    {
      id: string;
      name: string | null;
      username: string | null;
      bio: string | null;
      about: string | null;
      subscription_price: number | null;
      image: string | null;
    }[]
  >`
    SELECT id, name, username, bio, about, subscription_price, image
    FROM "user" WHERE lower(username) = lower(${handle})
  `;
  if (!user) notFound();
  // Only the owner may edit; everyone else lands on the public profile.
  if (session.user.id !== user.id) redirect(`/${user.username ?? handle}`);

  const genres = await sql<{ id: number; name: string }[]>`
    SELECT id, name FROM genres ORDER BY name
  `;
  const genreRows = await sql<{ genre_id: number }[]>`
    SELECT genre_id FROM user_genres WHERE user_id = ${user.id}
  `;

  return (
    <ProfileForm
      genres={genres}
      profile={{
        id: user.id,
        name: user.name ?? "",
        username: user.username ?? "",
        bio: user.bio ?? "",
        about: user.about ?? "",
        subscriptionPrice: user.subscription_price,
        image: user.image,
        genreIds: genreRows.map((r) => r.genre_id),
      }}
    />
  );
}
