import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NavMenu } from "@/components/layout/NavMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SearchBar } from "@/components/layout/SearchBar";
import { Avatar } from "@/components/layout/Avatar";

// Global top bar shown on every page once signed in: brand, Write, the
// notification bell and the hamburger menu. Hidden when logged out (login /
// signup pages) so it doesn't appear there.
export async function TopBar() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const [me] = await sql<{ username: string | null }[]>`
    SELECT username FROM "user" WHERE id = ${session.user.id}
  `;
  const profileHref = me?.username ? `/${me.username}` : `/users/${session.user.id}`;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/60 bg-[var(--page)]/80 backdrop-blur dark:border-zinc-800/60">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-6 sm:gap-4">
        <Link href="/feed" aria-label="Talerooms — home" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Talerooms" width={34} height={34} className="rounded-lg" />
        </Link>
        <Link
          href={profileHref}
          aria-label="View profile"
          className="shrink-0 rounded-full ring-zinc-300 transition hover:ring-2 dark:ring-zinc-700"
        >
          <Avatar src={session.user.image} name={session.user.name} size={34} />
        </Link>
        <div className="flex flex-1 justify-center">
          <div className="w-full max-w-md">
            <SearchBar />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href="/write"
            aria-label="Write"
            className="flex h-10 w-10 items-center justify-center gap-2 rounded-full border border-accent text-sm font-medium text-accent transition-colors hover:bg-accent/10 sm:w-auto sm:px-4"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            >
              <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
            </svg>
            <span className="hidden sm:inline">Write</span>
          </Link>
          <NotificationBell />
          <NavMenu />
        </div>
      </div>
    </header>
  );
}
