// Extract unique, lowercased @handles from post/comment text.
const MENTION_RE = /@([a-zA-Z0-9_]+)/g;

export function extractMentions(text: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(text)) !== null) set.add(m[1].toLowerCase());
  return [...set];
}

// Story ids from story-link tokens "[Title](/stories/<uuid>)" the autocomplete
// inserts. Used to notify each mentioned story's author.
const STORY_RE =
  /\(\/stories\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export function extractStoryMentions(text: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = STORY_RE.exec(text)) !== null) set.add(m[1].toLowerCase());
  return [...set];
}
