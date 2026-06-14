-- Lexical (word-overlap) matching for near-verbatim story copies.
-- Complements the AI embedding check, which can miss copies of very different length.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Speeds up trigram lookups on story text as the table grows.
CREATE INDEX IF NOT EXISTS stories_body_trgm_idx
  ON stories USING gin (body gin_trgm_ops);
