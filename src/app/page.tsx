import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { BookCover } from "@/components/BookCover";
import { currencySymbol } from "@/lib/pricing";
import { formatCount } from "@/lib/format";
import { type CoverStyle } from "@/lib/cover-style";

type LandingStory = {
  id: string;
  slug: string | null;
  title: string;
  author: string | null;
  author_handle: string | null;
  cover_url: string | null;
  cover_style: CoverStyle | null;
  rating: number | null;
  rating_count: number;
  views: number;
  chapters_public: boolean;
  whole_prices: Record<string, number>;
  currency: string;
};

function priceLabel(s: LandingStory): string {
  if (s.chapters_public) return "Free to read";
  const vals = Object.values(s.whole_prices ?? {}).filter(
    (v) => typeof v === "number" && v > 0,
  );
  if (vals.length) return `From ${currencySymbol(s.currency)}${Math.min(...vals)}`;
  return "Premium";
}

/* A real story rendered as a product card (cover + title + rating + reads). */
function StoryCard({ s, className }: { s: LandingStory; className?: string }) {
  return (
    <Link
      href={`/stories/${s.slug ?? s.id}`}
      className={
        "group block overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl transition hover:-translate-y-1 hover:shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 " +
        (className ?? "")
      }
    >
      <BookCover
        title={s.title}
        author={s.author}
        coverUrl={s.cover_url}
        coverStyle={s.cover_style}
        className="aspect-[3/2] w-full object-cover"
      />
      <div className="p-4">
        <p className="truncate font-bold">{s.title}</p>
        <p className="truncate text-xs text-zinc-500">by {s.author ?? "Unknown"}</p>
        <div className="mt-2 flex items-center gap-3 text-xs">
          {s.rating_count > 0 ? (
            <span className="font-semibold text-amber-500">
              ★ {(s.rating ?? 0).toFixed(1)}
            </span>
          ) : (
            <span className="font-semibold text-emerald-500">New</span>
          )}
          <span className="text-zinc-400">👁 {formatCount(s.views)} reads</span>
        </div>
        <p className="mt-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {priceLabel(s)}
        </p>
      </div>
    </Link>
  );
}

/* Illustrative dashboard previews (clearly examples, not platform stats). */
function EarningsCard() {
  const bars = [40, 62, 50, 78, 95, 70, 88];
  return (
    <div className="rounded-2xl bg-white p-5 text-zinc-900 shadow-xl dark:bg-zinc-900 dark:text-zinc-100">
      <p className="text-xs font-medium text-zinc-500">Your month (example)</p>
      <p className="mt-1 text-3xl font-extrabold">$1,248</p>
      <p className="text-xs text-zinc-500">312 reads · 18 new subscribers</p>
      <div className="mt-4 flex h-16 items-end gap-1.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-indigo-500"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function ContinueCard() {
  return (
    <div className="rounded-2xl bg-white p-5 text-zinc-900 shadow-xl dark:bg-zinc-900 dark:text-zinc-100">
      <p className="text-xs font-medium text-zinc-500">Continue reading (example)</p>
      <p className="mt-1 font-serif text-lg font-bold">The Cartographer&apos;s Oath</p>
      <p className="text-xs text-zinc-500">Chapter 3 — “The Salt Road”</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="h-full w-[62%] rounded-full bg-rose-500" />
      </div>
      <p className="mt-1.5 text-right text-xs text-zinc-400">62%</p>
    </div>
  );
}

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Signed-in users go straight to the feed.
  if (session) redirect("/feed");

  // Real published stories — most-read first — power the hero + "peek" shelf.
  const stories = await sql<LandingStory[]>`
    SELECT
      s.id, s.slug, s.title,
      u.name AS author, u.username AS author_handle,
      s.cover_url, s.cover_style,
      (SELECT ROUND(AVG(stars), 1) FROM reviews r WHERE r.story_id = s.id)::float AS rating,
      (SELECT COUNT(*) FROM reviews r WHERE r.story_id = s.id)::int AS rating_count,
      (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id)::int AS views,
      s.chapters_public, s.whole_prices, s.currency
    FROM stories s
    JOIN "user" u ON u.id = s.author_id
    WHERE s.status = 'published'
    ORDER BY views DESC, s.created_at DESC
    LIMIT 4
  `;
  const hero = stories[0] ?? null;
  const peek = stories.slice(1, 4); // at most three on the "peek" shelf

  return (
    <div className="relative min-h-screen bg-[var(--page)] text-zinc-900 dark:text-zinc-100">
      {/* Top bar — pinned, stays put while the page scrolls */}
      <header className="sticky top-0 z-50 border-b border-zinc-900/5 bg-[var(--page)]/80 backdrop-blur-md dark:border-white/10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          {/* Icon + wordmark fused into one glossy gradient pill */}
          <Link
            href="/"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-rose-500 py-1.5 pl-2 pr-3.5 shadow-md shadow-violet-500/30 ring-1 ring-white/25 transition-transform hover:scale-[1.03]"
          >
            {/* glossy top sheen */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-white/20"
            />
            {/* Original T + R lockup, in white */}
            <svg viewBox="12 20 82 60" className="relative h-7 w-auto" aria-hidden="true">
              <rect x="18" y="26" width="50" height="13" rx="3" fill="#ffffff" />
              <rect x="36.5" y="26" width="13" height="46" rx="3" fill="#ffffff" />
              <text
                x="71"
                y="58"
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="38"
                fontWeight="700"
                fill="#ffffff"
              >
                R
              </text>
            </svg>
            <span className="relative text-lg font-extrabold uppercase tracking-wide text-white">
              Talerooms
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-900/5 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-white/10"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full btn-primary px-4 py-2 text-sm font-semibold"
            >
              Join free
            </Link>
          </nav>
        </div>
      </header>

      {/* Content wrapper clips the hero's rotated sticker cards so they never
          cause sideways scroll — kept off the root so the sticky header works. */}
      <div className="overflow-x-hidden">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-16 pt-10 md:grid-cols-2 md:pt-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
            ✦ Original serialized fiction
          </span>
          <h1 className="mt-5 text-5xl font-black leading-[1.03] tracking-tight sm:text-6xl">
            Your next obsession is{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-rose-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-rose-400">
              one chapter away.
            </span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-zinc-600 dark:text-zinc-300">
            Talerooms is where writers publish original fiction chapter by chapter —
            readers unlock what they love, and authors keep the rights and the
            revenue.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="flex h-12 items-center justify-center rounded-full btn-primary px-8 font-semibold shadow-lg"
            >
              Start free →
            </Link>
            <Link
              href={peek.length > 0 ? "#peek" : "/signup"}
              className="flex h-12 items-center justify-center rounded-full border-2 border-zinc-900/10 px-8 font-semibold text-zinc-900 transition-colors hover:bg-zinc-900/5 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/10"
            >
              See a story
            </Link>
          </div>
          <p className="mt-4 text-sm text-zinc-500">
            Free to join · No card needed · Read or write today
          </p>
        </div>

        {/* Hero focal point: the most-read real story (or a styled placeholder) */}
        <div className="relative mx-auto w-full max-w-xs">
          <div className="absolute -right-5 top-6 hidden h-full w-full rotate-6 rounded-2xl bg-rose-300/60 dark:bg-rose-500/20 sm:block" />
          <div className="absolute -left-5 top-10 hidden h-full w-full -rotate-6 rounded-2xl bg-indigo-300/50 dark:bg-indigo-500/20 sm:block" />
          <div className="animate-floaty relative">
            {hero ? (
              <StoryCard s={hero} />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                <div
                  className="flex aspect-[3/2] flex-col justify-end p-5 text-white"
                  style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed 55%,#db2777)" }}
                >
                  <p className="font-serif text-2xl font-bold">Your story here</p>
                  <p className="mt-1 text-xs opacity-80">be the first to publish</p>
                </div>
                <div className="p-4 text-sm text-zinc-500">Free to read</div>
              </div>
            )}
          </div>
          {hero && hero.rating_count > 0 && (
            <div className="absolute -left-4 -top-4 rotate-[-8deg] rounded-full bg-amber-400 px-3 py-1.5 text-sm font-extrabold text-zinc-900 shadow-lg">
              ★ {(hero.rating ?? 0).toFixed(1)}
            </div>
          )}
          {hero && (
            <div className="absolute -bottom-4 -right-3 rotate-[6deg] rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
              👁 {formatCount(hero.views)} reads
            </div>
          )}
        </div>
      </section>

      {/* What is Talerooms — three bold sticker cards */}
      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
          Not another free-reading mill.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-600 dark:text-zinc-300">
          Think <span className="font-bold">Substack × Patreon</span> for serialized
          fiction — originality-first, and built to become a marketplace for
          narrative IP.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {[
            {
              emoji: "🔓",
              tint: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
              title: "Public pitch, private chapters",
              body: "Readers always see the title and summary. You decide what's free, paid, or subscriber-only.",
            },
            {
              emoji: "🛡️",
              tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
              title: "Originality, enforced",
              body: "Every new story is similarity-checked at publish and backed by an author's originality pledge.",
            },
            {
              emoji: "💎",
              tint: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
              title: "Your story is IP",
              body: "More than free content — a catalogue positioned to be licensed, adapted, and to earn for years.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span
                className={
                  "flex h-12 w-12 items-center justify-center rounded-2xl text-2xl " +
                  c.tint
                }
                aria-hidden="true"
              >
                {c.emoji}
              </span>
              <h3 className="mt-4 text-lg font-bold">{c.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* For creators — bold indigo color block */}
      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="grid items-center gap-10 rounded-[2rem] bg-indigo-600 p-8 text-white sm:p-12 md:grid-cols-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">
              For storytellers
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Write it. Price it. Keep it.
            </h2>
            <p className="mt-3 max-w-md text-indigo-100">
              Stop giving your imagination away for free. Your work earns for you,
              stays yours, and reaches readers who pay because they care.
            </p>
            <ul className="mt-5 flex flex-col gap-2 text-sm text-indigo-50">
              {[
                "Sell by the chapter, bundle the whole story, or go subscriber-only.",
                "Set your own subscription price — subscribers unlock everything you write.",
                "Live dashboard for reads, earnings and active subscribers.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden="true">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-7 inline-flex h-11 items-center justify-center rounded-full bg-white px-6 font-semibold text-indigo-700 shadow hover:bg-indigo-50"
            >
              Start publishing
            </Link>
          </div>
          <div className="mx-auto w-full max-w-xs">
            <EarningsCard />
          </div>
        </div>
      </section>

      {/* For readers — warm amber color block */}
      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="grid items-center gap-10 rounded-[2rem] bg-amber-100 p-8 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50 sm:p-12 md:grid-cols-2">
          <div className="order-2 mx-auto w-full max-w-xs md:order-1">
            <ContinueCard />
          </div>
          <div className="order-1 md:order-2">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
              For readers
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Find stories worth your time.
            </h2>
            <p className="mt-3 max-w-md text-amber-900/80 dark:text-amber-100/80">
              Discover original voices you won&apos;t find anywhere else, pay only
              for what you actually read, and never lose your place again.
            </p>
            <ul className="mt-5 flex flex-col gap-2 text-sm">
              {[
                "A feed tuned to your favourite genres; search by story, genre or @author.",
                "Buy your way — a chapter or the whole story, for an hour, a week, or forever.",
                "Highlight a line to bookmark it — or look up a word's meaning instantly.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden="true">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-7 inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 font-semibold text-white shadow hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Start reading
            </Link>
          </div>
        </div>
      </section>

      {/* A peek inside — real stories from the shelves */}
      {peek.length > 0 && (
        <section id="peek" className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-14">
          <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
            A peek inside the shelves.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-zinc-600 dark:text-zinc-300">
            Real stories from real authors on Talerooms — tap any cover to start.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {peek.map((s) => (
              <StoryCard key={s.id} s={s} />
            ))}
          </div>
        </section>
      )}

      {/* Final CTA — dramatic block */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-6">
        <div className="rounded-[2rem] bg-gradient-to-br from-violet-600 to-indigo-700 px-6 py-16 text-center text-white">
          <h2 className="text-3xl font-black tracking-tight sm:text-5xl">
            Your story starts tonight.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-violet-100">
            Join free — start a story you can&apos;t put down, or publish your first
            chapter before bed.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="flex h-12 w-full items-center justify-center rounded-full bg-white px-8 font-semibold text-indigo-700 shadow-lg hover:bg-indigo-50 sm:w-auto"
            >
              Create your account
            </Link>
            <Link
              href="/login"
              className="flex h-12 w-full items-center justify-center rounded-full border-2 border-white/40 px-8 font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

        <footer className="border-t border-zinc-200/70 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
          © {new Date().getFullYear()} Talerooms · Original fiction, owned by its
          creators.
        </footer>
      </div>
    </div>
  );
}
