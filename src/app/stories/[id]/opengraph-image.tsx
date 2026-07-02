import { ImageResponse } from "next/og";
import { sql } from "@/lib/db";
import { resolveStory } from "@/lib/slug";
import { COVER_PALETTES, defaultPalette, type CoverStyle } from "@/lib/cover-style";

// Auto-generated social share image (1200×630) for a story — a branded card in
// the story's cover palette. Gives every story a great-looking link preview,
// including coverless ones. Next serves this as the page's og:image + twitter
// image automatically.
//
// Note: only satori's bundled default font exists here — do NOT set fontFamily
// (an unresolved font aborts the render worker with an empty reply).
export const runtime = "nodejs";
export const alt = "A story on Talerooms";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: param } = await params;
  const resolved = await resolveStory(param);

  let title = "Talerooms";
  let author: string | null = null;
  let palette = 0;
  if (resolved) {
    const [s] = await sql<
      { title: string; status: string; cover_style: CoverStyle | null; author: string | null }[]
    >`
      SELECT s.title, s.status, s.cover_style, u.name AS author
      FROM stories s JOIN "user" u ON u.id = s.author_id
      WHERE s.id = ${resolved.id}
    `;
    if (s && s.status === "published") {
      title = s.title;
      author = s.author;
      palette = s.cover_style?.palette ?? defaultPalette(s.title);
    }
  }
  const pal = COVER_PALETTES[palette % COVER_PALETTES.length];
  const shown = title.length > 120 ? title.slice(0, 117) + "…" : title;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: pal.bg,
          color: pal.fg,
          padding: 80,
        }}
      >
        <div style={{ display: "flex", width: 72, height: 10, borderRadius: 8, background: pal.accent }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>{shown}</div>
          {author && (
            <div style={{ display: "flex", fontSize: 34, marginTop: 28, opacity: 0.85 }}>by {author}</div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 30, opacity: 0.85 }}>
          <div style={{ display: "flex", fontWeight: 700 }}>Talerooms</div>
          <div style={{ display: "flex" }}>Read on talerooms.fly.dev</div>
        </div>
      </div>
    ),
    size,
  );
}
