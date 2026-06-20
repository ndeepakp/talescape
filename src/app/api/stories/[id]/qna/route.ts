import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";
import { type Question } from "@/lib/story-validation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ChapterShape = { questions?: Question[] };

async function chapterQuestions(storyId: string, chapterIndex: number) {
  const [story] = await sql<{ chapters: unknown }[]>`
    SELECT chapters FROM stories WHERE id = ${storyId}
  `;
  if (!story) throw new ApiError(404, "Not found.");
  const chapters = Array.isArray(story.chapters) ? story.chapters : [];
  const ch = chapters[chapterIndex] as ChapterShape | undefined;
  return Array.isArray(ch?.questions) ? ch!.questions! : [];
}

// Questions for a chapter, plus public aggregated answers and the viewer's own.
export const GET = withErrors(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");
  const session = await requireSession();
  const chapterIndex = parseInt(new URL(req.url).searchParams.get("chapter") ?? "", 10);
  if (!Number.isInteger(chapterIndex) || chapterIndex < 0) {
    throw new ApiError(400, "Bad chapter.");
  }

  const questions = await chapterQuestions(id, chapterIndex);
  if (questions.length === 0) return NextResponse.json({ questions: [] });

  const qids = questions.map((q) => q.id);
  // Only the viewer's own answers — the correct answer is revealed per question
  // once they've answered it (so it can't be peeked from the response first).
  const mineRows = await sql<{ question_id: string; choice: number | null }[]>`
    SELECT question_id, choice FROM question_answers
    WHERE story_id = ${id} AND user_id = ${session.user.id}
      AND question_id = ANY(${qids})
  `;
  const myChoiceFor = new Map(mineRows.map((r) => [r.question_id, r.choice]));

  const out = questions.map((q) => {
    const myChoice = myChoiceFor.get(q.id) ?? null;
    return {
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      myChoice,
      correct: myChoice !== null ? q.answer : null,
    };
  });

  return NextResponse.json({ questions: out });
});

// Submit (or update) the viewer's answer to one question.
export const POST = withErrors(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");
  const session = await requireSession();
  const body = await req.json().catch(() => ({}));
  const chapterIndex = Number(body.chapterIndex);
  const questionId = typeof body.questionId === "string" ? body.questionId : "";
  if (!Number.isInteger(chapterIndex) || chapterIndex < 0 || !questionId) {
    throw new ApiError(400, "Bad request.");
  }

  const q = (await chapterQuestions(id, chapterIndex)).find((x) => x.id === questionId);
  if (!q) throw new ApiError(404, "Question not found.");

  const choice = Number(body.choice);
  if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) {
    throw new ApiError(400, "Pick a valid option.");
  }

  await sql`
    INSERT INTO question_answers (story_id, chapter_index, question_id, user_id, choice, answer)
    VALUES (${id}, ${chapterIndex}, ${questionId}, ${session.user.id}, ${choice}, NULL)
    ON CONFLICT (question_id, user_id)
      DO UPDATE SET choice = ${choice}, answer = NULL, updated_at = now()
  `;
  // Whether the reader got it right — drives the instant ✓/✗ feedback.
  return NextResponse.json({ ok: true, correct: choice === q.answer });
});
