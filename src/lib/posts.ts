import { sql } from "@/lib/db";

export type PostRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: string | null;
  handle: string | null;
  image: string | null;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
  mine: boolean;
  mentions_me: boolean;
  // Set when the post is a reader's answer to a chapter's discussion prompt.
  answer_story_id: string | null;
  answer_chapter: number | null;
  answer_prompt: string | null;
  answer_story_slug: string | null;
  answer_story_title: string | null;
};

// Posts for the community feed (all authors) or a single author's profile.
export async function getPosts({
  viewerId,
  authorId,
  limit = 50,
}: {
  viewerId: string;
  authorId?: string;
  limit?: number;
}): Promise<PostRow[]> {
  return sql<PostRow[]>`
    SELECT
      p.id, p.body, p.created_at, p.author_id,
      u.name AS author, u.username AS handle, u.image,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id)::int AS like_count,
      EXISTS (
        SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ${viewerId}
      ) AS liked_by_me,
      (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id)::int AS comment_count,
      (p.author_id = ${viewerId}) AS mine,
      p.answer_story_id, p.answer_chapter, p.answer_prompt,
      ast.slug AS answer_story_slug, ast.title AS answer_story_title,
      EXISTS (
        SELECT 1 FROM post_mentions pm WHERE pm.post_id = p.id AND pm.user_id = ${viewerId}
      ) AS mentions_me
    FROM posts p
    JOIN "user" u ON u.id = p.author_id
    LEFT JOIN stories ast ON ast.id = p.answer_story_id
    ${authorId ? sql`WHERE p.author_id = ${authorId}` : sql``}
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `;
}

// Posts that reference a given story. The composer inserts story links as
// "[Title](/stories/<slug-or-uuid>)" tokens, so a post is "about" a story when
// its body contains that story's link token. Newer posts use the slug and older
// ones the UUID, so we match either.
export async function getStoryPosts(
  storyId: string,
  viewerId: string,
  slug?: string | null,
  limit = 50,
): Promise<PostRow[]> {
  const uuidToken = `%(/stories/${storyId})%`;
  const slugToken = slug ? `%(/stories/${slug})%` : null;
  return sql<PostRow[]>`
    SELECT
      p.id, p.body, p.created_at, p.author_id,
      u.name AS author, u.username AS handle, u.image,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id)::int AS like_count,
      EXISTS (
        SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ${viewerId}
      ) AS liked_by_me,
      (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id)::int AS comment_count,
      (p.author_id = ${viewerId}) AS mine,
      p.answer_story_id, p.answer_chapter, p.answer_prompt,
      ast.slug AS answer_story_slug, ast.title AS answer_story_title,
      EXISTS (
        SELECT 1 FROM post_mentions pm WHERE pm.post_id = p.id AND pm.user_id = ${viewerId}
      ) AS mentions_me
    FROM posts p
    JOIN "user" u ON u.id = p.author_id
    LEFT JOIN stories ast ON ast.id = p.answer_story_id
    WHERE p.answer_story_id = ${storyId}
      OR p.body LIKE ${uuidToken}
      ${slugToken ? sql`OR p.body LIKE ${slugToken}` : sql``}
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `;
}

// A single post by id (for the post permalink page), or null if missing.
export async function getPost(id: string, viewerId: string): Promise<PostRow | null> {
  const [p] = await sql<PostRow[]>`
    SELECT
      p.id, p.body, p.created_at, p.author_id,
      u.name AS author, u.username AS handle, u.image,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id)::int AS like_count,
      EXISTS (
        SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ${viewerId}
      ) AS liked_by_me,
      (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id)::int AS comment_count,
      (p.author_id = ${viewerId}) AS mine,
      p.answer_story_id, p.answer_chapter, p.answer_prompt,
      ast.slug AS answer_story_slug, ast.title AS answer_story_title,
      EXISTS (
        SELECT 1 FROM post_mentions pm WHERE pm.post_id = p.id AND pm.user_id = ${viewerId}
      ) AS mentions_me
    FROM posts p
    JOIN "user" u ON u.id = p.author_id
    LEFT JOIN stories ast ON ast.id = p.answer_story_id
    WHERE p.id = ${id}
  `;
  return p ?? null;
}
