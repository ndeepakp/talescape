-- A published story must never leave the shelf when its author saves edits as a
-- draft. Edits are kept in a separate "working copy" draft linked back to the
-- live story via draft_of; publishing the working copy updates the live story.
-- One working copy per published story (partial unique index).
ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS draft_of uuid REFERENCES stories(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS stories_draft_of_key
  ON stories (draft_of) WHERE draft_of IS NOT NULL;
