import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Signed-in users go straight to the feed.
  if (session) redirect("/feed");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--page)] px-6">
      <main className="w-full max-w-md text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Talescape
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Where stories find their people.
        </p>

        <div className="mt-10 flex flex-col gap-3">
          <Link
            href="/signup"
            className="flex h-12 items-center justify-center rounded-full btn-primary px-5 font-medium transition-colors"
          >
            Create an account
          </Link>
          <Link
            href="/login"
            className="flex h-12 items-center justify-center rounded-full border border-zinc-300 px-5 font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Log in
          </Link>
        </div>
      </main>
    </div>
  );
}
