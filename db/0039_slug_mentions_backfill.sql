-- Clean up history after switching story-mention links from UUIDs to slugs.

-- 1) Notification snippets stored the raw post text, including the
--    "[Title](/stories/<uuid>)" token. Collapse those tokens down to just the
--    title so no markdown or id leaks into the notification text.
UPDATE notifications
SET data = jsonb_set(
  data,
  '{snippet}',
  to_jsonb(
    btrim(regexp_replace(data->>'snippet', '\[([^\]]+)\]\(/stories/[^)]+\)', '\1', 'g'))
  )
)
WHERE data ? 'snippet'
  AND data->>'snippet' ~ '\(/stories/';

-- 2) Rewrite the story-link tokens inside existing post bodies from the UUID to
--    the story's slug, so old posts render slug URLs too. Looping per story
--    handles posts that mention more than one story.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, slug FROM stories WHERE slug IS NOT NULL LOOP
    UPDATE posts
    SET body = replace(body, '(/stories/' || r.id || ')', '(/stories/' || r.slug || ')')
    WHERE body LIKE '%(/stories/' || r.id || ')%';
  END LOOP;
END $$;
