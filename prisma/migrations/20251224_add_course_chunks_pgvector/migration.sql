CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS course_chunks (
  chunk_id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_course_chunks_course_id
  ON course_chunks (course_id);

CREATE INDEX IF NOT EXISTS idx_course_chunks_embedding
  ON course_chunks USING HNSW (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION match_course_chunks(
  query_embedding VECTOR(1536),
  match_count INTEGER,
  filter_course_id TEXT
)
RETURNS TABLE (
  chunk_id TEXT,
  content TEXT,
  score DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    course_chunks.chunk_id,
    course_chunks.content,
    1 - (course_chunks.embedding <=> query_embedding) AS score
  FROM course_chunks
  WHERE course_chunks.course_id = filter_course_id
  ORDER BY course_chunks.embedding <=> query_embedding
  LIMIT match_count;
$$;
