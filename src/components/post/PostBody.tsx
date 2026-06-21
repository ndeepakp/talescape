import Link from "next/link";
import type { ReactNode } from "react";

// Renders post/comment text: @handles become profile links and story tokens
// "[Title](/stories/id)" (inserted by the mention autocomplete) become story
// links. Only internal "/..." links are linkified; everything else is plain.
export function PostBody({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((\/[^)\s]+)\)|@([a-zA-Z0-9_]+)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    if (m[1] !== undefined) {
      nodes.push(
        <Link key={key++} href={m[2]} className="font-medium text-accent hover:underline">
          {m[1]}
        </Link>,
      );
    } else {
      const h = m[3];
      nodes.push(
        <Link key={key++} href={`/${h}`} className="font-medium text-accent hover:underline">
          @{h}
        </Link>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(<span key={key++}>{text.slice(last)}</span>);

  return (
    <p className="whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-200">
      {nodes}
    </p>
  );
}
