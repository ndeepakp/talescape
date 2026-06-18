import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import type { PostRow } from "@/lib/posts";

// A list of posts, optionally with a composer on top. Used on the feed (with
// composer) and on profiles (a user's own posts, no composer).
export function PostsSection({
  posts,
  composer = false,
  emptyText,
}: {
  posts: PostRow[];
  composer?: boolean;
  emptyText?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {composer && <PostComposer />}
      {posts.length === 0 ? (
        <p className="text-sm text-zinc-500">{emptyText ?? "No posts yet."}</p>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} />)
      )}
    </div>
  );
}
