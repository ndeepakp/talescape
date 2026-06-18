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
  const answers = await sql<{
    question_id: string;
    user_id: string;
    choice: number | null;
    answer: string | null;
    author: string | null;
    handle: string | null;
  }[]>`
    SELECT a.question_id, a.user_id, a.choice, a.answer,
           u.name AS author, u.username AS handle
    FROM question_answers a JOIN "user" u ON u.id = a.user_id
    WHERE a.question_id = ANY(${qids})
    ORDER BY a.created_at
  `;

  const out = questions.map((q) => {
    const qa = answers.filter((a) => a.question_id === q.id);
    const mine = qa.find((a) => a.user_id === session.user.id) ?? null;
    if (q.type === "mcq") {
      return {
        id: q.id,
        type: "mcq" as const,
        prompt: q.prompt,
        options: q.options,
        counts: q.options.map((_, i) => qa.filter((a) => a.choice === i).length),
        total: qa.length,
        myChoice: mine?.choice ?? null,
      };
    }
    return {
      id: q.id,
      type: "open" as const,
      prompt: q.prompt,
      answers: qa
        .filter((a) => a.answer)
        .map((a) => ({
          answer: a.answer as string,
          author: a.author,
          handle: a.handle,
          mine: a.user_id === session.user.id,
        })),
      myAnswer: mine?.answer ?? null,
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

  let choice: number | null = null;
  let answer: string | null = null;
  if (q.type === "mcq") {
    choice = Number(body.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) {
      throw new ApiError(400, "Pick a valid option.");
    }
  } else {
    answer = typeof body.answer === "string" ? body.answer.trim().slice(0, 1000) : "";
    if (!answer) throw new ApiError(400, "Write an answer.");
  }

  await sql`
    INSERT INTO question_answers (story_id, chapter_index, question_id, user_id, choice, answer)
    VALUES (${id}, ${chapterIndex}, ${questionId}, ${session.user.id}, ${choice}, ${answer})
    ON CONFLICT (question_id, user_id)
      DO UPDATE SET choice = ${choice}, answer = ${answer}, updated_at = now()
  `;
  return NextResponse.json({ ok: true });
});
