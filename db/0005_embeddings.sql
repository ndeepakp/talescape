-- Vector embedding for each story (all-MiniLM-L6-v2 produces 384 dimensions).

ALTER TABLE stories ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Approximate-nearest-neighbour index for fast cosine similarity search.
CREATE INDEX IF NOT EXISTS stories_embedding_idx
  ON stories USING hnsw (embedding vector_cosine_ops);
