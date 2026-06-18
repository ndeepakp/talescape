// Extract unique, lowercased @handles from post/comment text.
const MENTION_RE = /@([a-zA-Z0-9_]+)/g;

export function extractMentions(text: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(text)) !== null) set.add(m[1].toLowerCase());
  return [...set];
}

// Story identifiers from story-link tokens "[Title](/stories/<id-or-slug>)" the
// autocomplete inserts. Newer posts carry a slug; older ones carry a UUID, so we
// accept either and let the caller resolve it. Used to notify each mentioned
// story's author and to find posts about a story.
const STORY_RE = /\(\/stories\/([a-z0-9][a-z0-9-]{0,120})\)/gi;

export function extractStoryMentions(text: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = STORY_RE.exec(text)) !== null) set.add(m[1].toLowerCase());
  return [...set];
}

// A human-readable preview for notifications: collapse story-link tokens
// "[Title](/stories/…)" down to just their title so the raw markdown and the
// story id never leak into the notification text.
const STORY_LINK_RE = /\[([^\]]+)\]\(\/stories\/[^)]+\)/g;

export function cleanSnippet(text: string, maxLen = 120): string {
  return text
    .replace(STORY_LINK_RE, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}
