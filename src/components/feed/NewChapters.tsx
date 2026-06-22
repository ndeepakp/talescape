import Link from "next/link";
import { BookCover } from "@/components/story/BookCover";
import { type CoverStyle } from "@/lib/cover-style";

export type NewChapterStory = {
  id: string;
  slug: string | null;
  title: string;
  author: string | null;
  cover_url: string | null;
  cover_style: CoverStyle | null;
  chapter_index: number; // where the reader left off (resume here)
  new_count: number;
};

// A horizontal "New chapters for you" strip at the top of the feed — stories the
// reader follows/owns access to that have dropped chapters they haven't seen.
export function NewChapters({ stories }: { stories: NewChapterStory[] }) {
  if (stories.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        ✨ New chapters for you
      </h2>
      <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
        {stories.map((s) => (
          <Link
            key={s.id}
            href={`/stories/${s.slug ?? s.id}?chapter=${s.chapter_index}`}
            className="group w-28 shrink-0"
          >
            <div className="relative">
              <BookCover
                title={s.title}
                author={s.author}
                coverUrl={s.cover_url}
                coverStyle={s.cover_style}
                className="aspect-[2/3] w-full rounded-md shadow-sm transition group-hover:-translate-y-1 group-hover:shadow-md"
              />
              <span className="absolute right-1 top-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-fg shadow">
                +{s.new_count}
              </span>
            </div>
            <p className="mt-1 truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
              {s.title}
            </p>
            <p className="truncate text-[11px] text-zinc-500">
              {s.author ?? "Unknown"}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
