-- Chapter Q&A answers. The questions themselves live inside the chapter JSON
-- (stories.chapters[i].questions, each with a stable client-generated id), so
-- editing a story keeps existing answers valid. Answers are public (everyone
-- sees everyone's). One answer per (question, user), editable.
CREATE TABLE IF NOT EXISTS question_answers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id      uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  chapter_index int NOT NULL,
  question_id   text NOT NULL,
  user_id       text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  choice        int,   -- selected option index (MCQ)
  answer        text,  -- free text (open question)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, user_id)
);
CREATE INDEX IF NOT EXISTS question_answers_q_idx ON question_answers (question_id);
