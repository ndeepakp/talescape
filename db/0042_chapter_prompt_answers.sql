-- Discussion prompts: an author can attach open prompts to a chapter; a reader's
-- answer becomes a public post tagged with the story + chapter + the prompt it
-- answers (so we can show an "Answering: …" header and a spoiler veil).
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS answer_story_id uuid REFERENCES stories(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS answer_chapter  int,
  ADD COLUMN IF NOT EXISTS answer_prompt   text;

CREATE INDEX IF NOT EXISTS posts_answer_story_idx ON posts (answer_story_id);

-- New notification kind: a reader answered the author's chapter prompt. Also
-- retires the long-unused 'comment' kind (per-story comments were removed).
DELETE FROM notifications WHERE kind = 'comment';
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
    'purchase', 'follow', 'subscribe',
    'reaction', 'sub_expiring', 'new_chapter', 'mention', 'story_mention',
    'post_like', 'post_comment', 'review', 'prompt_answer'
  ));
