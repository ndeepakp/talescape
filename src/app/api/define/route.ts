import { NextResponse } from "next/server";
import { ApiError, requireSession, withErrors } from "@/lib/http";

// A single English word (letters, with optional internal hyphen/apostrophe).
const WORD_RE = /^[a-zA-Z][a-zA-Z'-]{0,48}$/;

type DictEntry = {
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: { definition?: string }[];
  }[];
};

// Look up the meaning of a highlighted word via the free Dictionary API
// (dictionaryapi.dev — open, no key). Returns a trimmed, UI-friendly shape; an
// empty `entries` means "no definition found" rather than an error.
export const GET = withErrors(async (req: Request) => {
  await requireSession();
  const word = (new URL(req.url).searchParams.get("word") ?? "").trim().toLowerCase();
  if (!WORD_RE.test(word)) {
    throw new ApiError(400, "Pick a single word to look up.");
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(5000) },
    );
  } catch {
    throw new ApiError(502, "Couldn't reach the dictionary. Try again.");
  }

  if (res.status === 404) return NextResponse.json({ word, phonetic: null, entries: [] });
  if (!res.ok) throw new ApiError(502, "Dictionary lookup failed.");

  const data = (await res.json().catch(() => [])) as DictEntry[];
  const first = Array.isArray(data) ? data[0] : undefined;

  const phonetic =
    first?.phonetic ?? first?.phonetics?.find((p) => p.text)?.text ?? null;

  // Up to 3 parts of speech, 2 definitions each — enough for a small card.
  const entries = (first?.meanings ?? [])
    .slice(0, 3)
    .map((m) => ({
      partOfSpeech: m.partOfSpeech ?? "",
      definitions: (m.definitions ?? [])
        .map((d) => d.definition)
        .filter((d): d is string => !!d)
        .slice(0, 2),
    }))
    .filter((m) => m.definitions.length > 0);

  return NextResponse.json({ word, phonetic, entries });
});
